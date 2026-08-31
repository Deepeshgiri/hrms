import express from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireFinanceOrAdmin } from '../auth.js';
import { asyncHandler, MONTH_NAMES } from '../helpers.js';
import { logAudit } from '../audit.js';
import { currentTenant } from '../tenant.js';

const router = express.Router();

router.use(authMiddleware);

async function getStructureWithComponents(id) {
  const [rows] = await pool.query(
    `SELECT ss.id, ss.userId, ss.basicSalary, ss.hra, ss.da,
            u.name as employeeName, u.employeeId
     FROM salary_structures ss
     JOIN users u ON u.id = ss.userId
     WHERE ss.id = ?`,
    [id]
  );
  if (rows.length === 0) return null;

  const s = rows[0];
  const [allowances] = await pool.query(
    'SELECT name, amount FROM salary_allowances WHERE salaryStructureId = ?',
    [id]
  );
  const [deductions] = await pool.query(
    'SELECT name, amount FROM salary_deductions WHERE salaryStructureId = ?',
    [id]
  );

  return {
    id: s.id,
    userId: s.userId,
    employeeName: s.employeeName,
    employeeId: s.employeeId,
    basicSalary: Number(s.basicSalary) || 0,
    hra: Number(s.hra) || 0,
    da: Number(s.da) || 0,
    allowances: allowances.map((a) => ({ name: a.name, amount: Number(a.amount) || 0 })),
    deductions: deductions.map((d) => ({ name: d.name, amount: Number(d.amount) || 0 })),
  };
}

async function computeSalary(userId) {
  const [rows] = await pool.query('SELECT * FROM salary_structures WHERE userId = ?', [userId]);
  if (rows.length === 0) return null;
  const s = rows[0];

  const [allowances] = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) as total FROM salary_allowances WHERE salaryStructureId = ?',
    [s.id]
  );
  const [deductions] = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) as total FROM salary_deductions WHERE salaryStructureId = ?',
    [s.id]
  );

  const basic = Number(s.basicSalary) || 0;
  const hra = Number(s.hra) || 0;
  const da = Number(s.da) || 0;
  const gross = basic + hra + da + (Number(allowances[0].total) || 0);
  const totalDeductions = Number(deductions[0].total) || 0;

  return {
    basicSalary: basic,
    grossSalary: gross,
    netSalary: gross - totalDeductions,
  };
}

// GET /hr/payroll/stats
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    // If Employee, show personal stats
    if (req.user.roleId === 3) {
      const [empPayslips] = await pool.query(
        "SELECT COUNT(*) as processed, COALESCE(SUM(netSalary), 0) as total FROM payslips WHERE userId = ? AND status IN ('Processed','Paid')",
        [req.user.userId]
      );
      const [pendRows] = await pool.query(
        "SELECT COUNT(*) as pending FROM payslips WHERE userId = ? AND status = 'Draft'",
        [req.user.userId]
      );
      return res.json({
        totalEmployees: 1,
        processedPayslips: Number(empPayslips[0].processed) || 0,
        pendingPayslips: Number(pendRows[0].pending) || 0,
        totalPayroll: Number(empPayslips[0].total) || 0,
      });
    }

    const tenantId = currentTenant(req);
    const [empRows] = await pool.query('SELECT COUNT(*) as c FROM users WHERE tenantId = ?', [tenantId]);
    const [procRows] = await pool.query(
      "SELECT COUNT(*) as c FROM payslips WHERE tenantId = ? AND status IN ('Processed','Paid')",
      [tenantId]
    );
    const [pendRows] = await pool.query(
      "SELECT COUNT(*) as c FROM payslips WHERE tenantId = ? AND status = 'Draft'",
      [tenantId]
    );
    const [payRows] = await pool.query(
      "SELECT COALESCE(SUM(netSalary), 0) as total FROM payslips WHERE tenantId = ? AND status IN ('Processed','Paid')",
      [tenantId]
    );

    res.json({
      totalEmployees: Number(empRows[0].c) || 0,
      processedPayslips: Number(procRows[0].c) || 0,
      pendingPayslips: Number(pendRows[0].c) || 0,
      totalPayroll: Number(payRows[0].total) || 0,
    });
  })
);

// GET /hr/payroll/salary-structures - Admin / HR / Finance only
router.get(
  '/salary-structures',
  requireFinanceOrAdmin,
  asyncHandler(async (req, res) => {
    const tenantId = currentTenant(req);
    const [rows] = await pool.query(
      'SELECT id FROM salary_structures WHERE tenantId = ? ORDER BY id',
      [tenantId]
    );
    const result = [];
    for (const r of rows) {
      const s = await getStructureWithComponents(r.id);
      if (s) result.push(s);
    }
    res.json(result);
  })
);

// POST /hr/payroll/salary-structure - Admin / HR / Finance only
router.post(
  '/salary-structure',
  requireFinanceOrAdmin,
  asyncHandler(async (req, res) => {
    const { userId, basicSalary = 0, hra = 0, da = 0, allowances = [], deductions = [] } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const tenantId = currentTenant(req);
    const [targetUser] = await pool.query('SELECT id, tenantId FROM users WHERE id = ?', [Number(userId)]);
    if (targetUser.length === 0 || targetUser[0].tenantId !== tenantId) {
      return res.status(404).json({ success: false, message: 'Employee not found in your organization' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [existing] = await conn.query(
        'SELECT id FROM salary_structures WHERE userId = ? AND tenantId = ?',
        [Number(userId), tenantId]
      );
      let structureId;

      if (existing.length > 0) {
        structureId = existing[0].id;
        await conn.query(
          'UPDATE salary_structures SET basicSalary = ?, hra = ?, da = ? WHERE id = ?',
          [Number(basicSalary) || 0, Number(hra) || 0, Number(da) || 0, structureId]
        );
        await conn.query('DELETE FROM salary_allowances WHERE salaryStructureId = ?', [structureId]);
        await conn.query('DELETE FROM salary_deductions WHERE salaryStructureId = ?', [structureId]);
      } else {
        const [insertResult] = await conn.query(
          'INSERT INTO salary_structures (userId, basicSalary, hra, da, tenantId) VALUES (?, ?, ?, ?, ?)',
          [Number(userId), Number(basicSalary) || 0, Number(hra) || 0, Number(da) || 0, tenantId]
        );
        structureId = insertResult.insertId;
      }

      for (const a of allowances || []) {
        if (a && a.name) {
          await conn.query(
            'INSERT INTO salary_allowances (salaryStructureId, name, amount) VALUES (?, ?, ?)',
            [structureId, a.name, Number(a.amount) || 0]
          );
        }
      }
      for (const d of deductions || []) {
        if (d && d.name) {
          await conn.query(
            'INSERT INTO salary_deductions (salaryStructureId, name, amount) VALUES (?, ?, ?)',
            [structureId, d.name, Number(d.amount) || 0]
          );
        }
      }

      await conn.commit();

      const [uRows] = await pool.query('SELECT name FROM users WHERE id = ?', [Number(userId)]);
      const empName = uRows[0]?.name || `User ID ${userId}`;

      logAudit(req, {
        action: 'SALARY_STRUCTURE_SAVED',
        entityType: 'PAYROLL',
        entityId: structureId,
        description: `Configured salary structure (Base: ₹${Number(basicSalary).toLocaleString('en-IN')}) for ${empName}`,
        details: { userId, basicSalary, hra, da, allowances, deductions },
      });

      res.json({ success: true, message: 'Salary structure saved successfully' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// GET /hr/payroll/payslips?month=&year=&userId=
router.get(
  '/payslips',
  asyncHandler(async (req, res) => {
    const { month, year } = req.query;
    let targetUserId = req.query.userId;

    // If logged in as an employee (Role 3), strictly force userId to own ID
    if (req.user.roleId === 3) {
      targetUserId = req.user.userId;
    }

    let sql = `SELECT p.id, p.userId, p.month, p.year, p.basicSalary, p.grossSalary, p.netSalary,
                      p.status, p.paidDate, u.name as employeeName, u.employeeId
               FROM payslips p
               JOIN users u ON u.id = p.userId
               WHERE p.tenantId = ?`;
    const params = [currentTenant(req)];
    if (month) {
      sql += ' AND p.month = ?';
      params.push(Number(month));
    }
    if (year) {
      sql += ' AND p.year = ?';
      params.push(Number(year));
    }
    if (targetUserId) {
      sql += ' AND p.userId = ?';
      params.push(Number(targetUserId));
    }
    sql += ' ORDER BY p.year DESC, p.month DESC, u.name';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  })
);

// POST /hr/payroll/generate-all-payslips - Admin / HR / Finance only
router.post(
  '/generate-all-payslips',
  requireFinanceOrAdmin,
  asyncHandler(async (req, res) => {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'month and year are required' });
    }

    const tenantId = currentTenant(req);
    const [employees] = await pool.query(
      'SELECT userId FROM salary_structures WHERE tenantId = ?',
      [tenantId]
    );

    let generated = 0;
    for (const emp of employees) {
      const salary = await computeSalary(emp.userId);
      if (!salary) continue;

      await pool.query(
        `INSERT INTO payslips (userId, month, year, basicSalary, grossSalary, netSalary, status, tenantId)
         VALUES (?, ?, ?, ?, ?, ?, 'Draft', ?)
         ON DUPLICATE KEY UPDATE
           basicSalary = VALUES(basicSalary),
           grossSalary = VALUES(grossSalary),
           netSalary = VALUES(netSalary),
           status = 'Draft',
           paidDate = NULL,
           tenantId = VALUES(tenantId)`,
        [emp.userId, Number(month), Number(year), salary.basicSalary, salary.grossSalary, salary.netSalary, tenantId]
      );
      generated += 1;
    }

    logAudit(req, {
      action: 'PAYSLIPS_GENERATED',
      entityType: 'PAYROLL',
      description: `Generated ${generated} monthly payslips for ${MONTH_NAMES[month - 1]} ${year}`,
      details: { month, year, count: generated },
    });

    res.json({ success: true, message: `Generated ${generated} payslip(s) for ${MONTH_NAMES[month - 1]} ${year}` });
  })
);

// PUT /hr/payroll/payslip/:id/status - Admin / HR / Finance only
router.put(
  '/payslip/:id/status',
  requireFinanceOrAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { status, paidDate } = req.body;

    if (!id || !status) {
      return res.status(400).json({ success: false, message: 'id and status are required' });
    }

    const tenantId = currentTenant(req);

    const [checkRows] = await pool.query('SELECT id FROM payslips WHERE id = ? AND tenantId = ?', [id, tenantId]);
    if (checkRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payslip not found' });
    }

    await pool.query(
      'UPDATE payslips SET status = ?, paidDate = ? WHERE id = ?',
      [status, paidDate || null, id]
    );

    const [pRows] = await pool.query(
      'SELECT p.month, p.year, u.name as empName FROM payslips p JOIN users u ON u.id = p.userId WHERE p.id = ?',
      [id]
    );
    const pInfo = pRows[0];
    const desc = pInfo ? `for ${pInfo.empName} (${MONTH_NAMES[pInfo.month - 1]} ${pInfo.year})` : `ID ${id}`;

    logAudit(req, {
      action: 'PAYSLIP_STATUS_UPDATED',
      entityType: 'PAYROLL',
      entityId: id,
      description: `Marked payslip ${desc} as "${status}"`,
      details: { payslipId: id, status, paidDate },
    });

    res.json({ success: true, message: `Payslip marked as ${status}` });
  })
);

// DELETE /hr/payroll/payslip/:id - Admin / HR / Finance only
router.delete(
  '/payslip/:id',
  requireFinanceOrAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM payslips WHERE id = ? AND tenantId = ?', [id, currentTenant(req)]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Payslip not found' });
    }

    logAudit(req, {
      action: 'PAYSLIP_DELETED',
      entityType: 'PAYROLL',
      entityId: id,
      description: `Deleted payslip record ID: ${id}`,
    });

    res.json({ success: true, message: 'Payslip deleted successfully' });
  })
);

// GET /hr/payroll/payslip/:id/download
router.get(
  '/payslip/:id/download',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const tenantId = currentTenant(req);
    const [rows] = await pool.query(
      `SELECT p.*, u.name as employeeName, u.employeeId, u.designation, u.department
       FROM payslips p
       JOIN users u ON u.id = p.userId
       WHERE p.id = ? AND p.tenantId = ?`,
      [id, tenantId]
    );
    if (rows.length === 0) {
      return res.status(404).send('Payslip not found');
    }
    const p = rows[0];

    // If Employee, ensure own payslip
    if (req.user.roleId === 3 && p.userId !== req.user.userId) {
      return res.status(403).send('Access denied: You can only download your own payslip');
    }

    const [allowances] = await pool.query(
      `SELECT sa.name, sa.amount FROM salary_allowances sa
       JOIN salary_structures ss ON ss.id = sa.salaryStructureId
       WHERE ss.userId = ?`,
      [p.userId]
    );
    const [deductions] = await pool.query(
      `SELECT sd.name, sd.amount FROM salary_deductions sd
       JOIN salary_structures ss ON ss.id = sd.salaryStructureId
       WHERE ss.userId = ?`,
      [p.userId]
    );

    const rowsHtml = (arr) =>
      arr
        .map(
          (x) =>
            `<tr><td>${x.name}</td><td style="text-align:right">&#8377;${Number(x.amount).toLocaleString('en-IN')}</td></tr>`
        )
        .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payslip - ${p.employeeName}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 720px; margin: 20px auto; color: #222; }
    .header { text-align: center; border-bottom: 3px solid #3f51b5; padding-bottom: 12px; }
    .header h1 { margin: 0; color: #3f51b5; }
    .emp-info { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .emp-info td { padding: 4px 8px; }
    table.comp { width: 100%; border-collapse: collapse; margin: 8px 0; }
    table.comp th, table.comp td { border: 1px solid #ccc; padding: 8px; }
    table.comp th { background: #f0f2ff; }
    .total { font-weight: bold; background: #e8f5e9; }
    .footer { margin-top: 24px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>HRMS Pvt. Ltd.</h1>
    <p>Salary Payslip &mdash; ${MONTH_NAMES[p.month - 1]} ${p.year}</p>
  </div>
  <table class="emp-info">
    <tr><td><strong>Employee:</strong> ${p.employeeName} (${p.employeeId || 'N/A'})</td>
        <td><strong>Status:</strong> ${p.status}</td></tr>
    <tr><td><strong>Designation:</strong> ${p.designation || '-'}</td>
        <td><strong>Paid Date:</strong> ${p.paidDate || '-'}</td></tr>
    <tr><td><strong>Department:</strong> ${p.department || '-'}</td></tr>
  </table>
  <table class="comp">
    <tr><th>Component</th><th>Amount</th></tr>
    <tr><td>Basic Salary</td><td style="text-align:right">&#8377;${Number(p.basicSalary).toLocaleString('en-IN')}</td></tr>
    <tr><td>HRA</td><td style="text-align:right">&#8377;${Number(p.grossSalary - p.basicSalary).toLocaleString('en-IN')} <small>(incl.)</small></td></tr>
    <tr><th colspan="2" style="text-align:left">Allowances</th></tr>
    ${rowsHtml(allowances) || '<tr><td colspan="2">-</td></tr>'}
    <tr><th colspan="2" style="text-align:left">Deductions</th></tr>
    ${rowsHtml(deductions) || '<tr><td colspan="2">-</td></tr>'}
    <tr class="total"><td>Gross Salary</td><td style="text-align:right">&#8377;${Number(p.grossSalary).toLocaleString('en-IN')}</td></tr>
    <tr class="total"><td>Net Salary</td><td style="text-align:right">&#8377;${Number(p.netSalary).toLocaleString('en-IN')}</td></tr>
  </table>
  <div class="footer">This is a system generated payslip. &copy; ${p.year} HRMS</div>
</body>
</html>`;

    res.type('html').send(html);
  })
);

export default router;
