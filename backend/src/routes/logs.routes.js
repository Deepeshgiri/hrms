import express from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAdminOrHR } from '../auth.js';
import { asyncHandler, toIso } from '../helpers.js';
import { currentTenant } from '../tenant.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdminOrHR);

// GET /api/logs
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      search,
      action,
      entityType,
      userId,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = req.query;

    let sql = `SELECT id, userId, userName, userEmail, userRole, action, entityType, entityId,
                      description, details, ipAddress, userAgent, created_at
               FROM audit_logs
               WHERE tenantId = ?`;
    const params = [currentTenant(req)];

    if (search) {
      sql += ` AND (description LIKE ? OR userName LIKE ? OR action LIKE ? OR entityId LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (action) {
      sql += ` AND action = ?`;
      params.push(action);
    }

    if (entityType) {
      sql += ` AND entityType = ?`;
      params.push(entityType);
    }

    if (userId) {
      sql += ` AND userId = ?`;
      params.push(Number(userId));
    }

    if (startDate) {
      sql += ` AND DATE(created_at) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      sql += ` AND DATE(created_at) <= ?`;
      params.push(endDate);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 100, Number(offset) || 0);

    const [rows] = await pool.query(sql, params);

    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM audit_logs WHERE tenantId = ?', [currentTenant(req)]);

    res.json({
      total: countRows[0]?.total || 0,
      logs: rows.map((r) => ({
        ...r,
        created_at: toIso(r.created_at),
        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
      })),
    });
  })
);

// GET /api/logs/stats
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const tenantId = currentTenant(req);
    const [todayCount] = await pool.query('SELECT COUNT(*) as c FROM audit_logs WHERE tenantId = ? AND DATE(created_at) = CURDATE()', [tenantId]);
    const [userCount] = await pool.query("SELECT COUNT(*) as c FROM audit_logs WHERE tenantId = ? AND entityType = 'USER' AND DATE(created_at) = CURDATE()", [tenantId]);
    const [leaveCount] = await pool.query("SELECT COUNT(*) as c FROM audit_logs WHERE tenantId = ? AND entityType = 'LEAVE' AND DATE(created_at) = CURDATE()", [tenantId]);
    const [payrollCount] = await pool.query("SELECT COUNT(*) as c FROM audit_logs WHERE tenantId = ? AND entityType = 'PAYROLL' AND DATE(created_at) = CURDATE()", [tenantId]);
    const [attCount] = await pool.query("SELECT COUNT(*) as c FROM audit_logs WHERE tenantId = ? AND entityType = 'ATTENDANCE' AND DATE(created_at) = CURDATE()", [tenantId]);

    const [recentActions] = await pool.query(
      `SELECT action, COUNT(*) as count FROM audit_logs WHERE tenantId = ? AND DATE(created_at) = CURDATE() GROUP BY action ORDER BY count DESC LIMIT 5`,
      [tenantId]
    );

    res.json({
      todayLogs: todayCount[0]?.c || 0,
      userChangesToday: userCount[0]?.c || 0,
      leaveActionsToday: leaveCount[0]?.c || 0,
      payrollActionsToday: payrollCount[0]?.c || 0,
      attendanceActionsToday: attCount[0]?.c || 0,
      topActions: recentActions,
    });
  })
);

// GET /api/logs/export
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id, created_at, userName, userEmail, userRole, action, entityType, entityId, description, ipAddress
       FROM audit_logs
       WHERE tenantId = ?
       ORDER BY created_at DESC LIMIT 1000`,
      [currentTenant(req)]
    );

    let csv = 'Log ID,Timestamp,User Name,User Email,Role,Action,Entity,Entity ID,Description,IP Address\n';
    rows.forEach((r) => {
      const time = toIso(r.created_at);
      const desc = (r.description || '').replace(/"/g, '""');
      csv += `${r.id},"${time}","${r.userName || ''}","${r.userEmail || ''}","${r.userRole || ''}","${r.action}","${r.entityType}","${r.entityId || ''}","${desc}","${r.ipAddress || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  })
);

export default router;
