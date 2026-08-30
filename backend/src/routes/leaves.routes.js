import express from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAdminOrHR } from '../auth.js';
import { asyncHandler, MONTH_NAMES, monthNameToNumber, todayStr } from '../helpers.js';
import { logAudit } from '../audit.js';
import {
  getFinancialYearInfo,
  getUserDetailedLeaveBalances,
  executeFinancialYearRollover,
} from '../services/leave-engine.service.js';

const router = express.Router();

router.use(authMiddleware);

const LEAVE_SELECT = `
  SELECT l.id as leaveId, l.userId, l.leaveContent, l.leaveType, l.reason, l.status, l.response,
         COALESCE(l.fromDate, l.date) as fromDate,
         COALESCE(l.toDate, l.date) as toDate,
         l.duration, l.half, l.timestamp,
         lt.name as leaveTypeName, lt.colorCode as leaveTypeColor, lt.icon as leaveTypeIcon
  FROM leaves l
  LEFT JOIN leave_types lt ON lt.code = l.leaveType
`;

function leaveRowsToResponse(rows) {
  return rows.map((r) => ({
    leaveId: r.leaveId,
    userId: r.userId,
    name: r.name || null,
    leaveContent: r.leaveContent,
    leaveType: r.leaveType || 'CL',
    leaveTypeName: r.leaveTypeName || r.leaveType || 'Casual Leave',
    leaveTypeColor: r.leaveTypeColor || '#10b981',
    leaveTypeIcon: r.leaveTypeIcon || 'beach_access',
    fromDate: r.fromDate ? String(r.fromDate).slice(0, 10) : null,
    toDate: r.toDate ? String(r.toDate).slice(0, 10) : null,
    reason: r.reason,
    duration: r.duration,
    half: r.half,
    timestamp: r.timestamp,
    status: r.status,
    response: r.response,
  }));
}

// GET /leaves/types - Catalog of all active leave types
router.get(
  '/types',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM leave_types WHERE status = "active" ORDER BY id ASC');
    res.json(rows);
  })
);

// GET /leaves/my (Employee self service)
router.get(
  '/my',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `${LEAVE_SELECT} LEFT JOIN users u ON u.id = l.userId WHERE l.userId = ? ORDER BY l.timestamp DESC`,
      [req.user.userId]
    );
    res.json(leaveRowsToResponse(rows));
  })
);

// GET /leaves/my-leaves-info (Employee self service - detailed leave portfolio with CL, SL, EL)
router.get(
  '/my-leaves-info',
  asyncHandler(async (req, res) => {
    const data = await getUserDetailedLeaveBalances(req.user.userId);
    res.json({
      ...data,
      userId: req.user.userId,
      remainingLeaves: data.summary.totalRemaining,
      totalLeaves: data.summary.totalQuota,
      usedLeaves: data.summary.totalUsed,
    });
  })
);

// GET /leaves/user/:userId/balances - Detailed balances for specific user
router.get(
  '/user/:userId/balances',
  asyncHandler(async (req, res) => {
    const targetUserId = Number(req.params.userId);
    const data = await getUserDetailedLeaveBalances(targetUserId);
    res.json(data);
  })
);

// GET /leaves/users-leaves-info - Admin / HR only
router.get(
  '/users-leaves-info',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const [users] = await pool.query('SELECT id, name FROM users ORDER BY name ASC');
    const result = [];
    for (const u of users) {
      const data = await getUserDetailedLeaveBalances(u.id);
      result.push({
        userId: u.id,
        name: u.name,
        financialYear: data.financialYear,
        leaveTypes: data.leaveTypes,
        totalLeaves: data.summary.totalQuota,
        usedLeaves: data.summary.totalUsed,
        remainingLeaves: data.summary.totalRemaining,
      });
    }
    res.json(result);
  })
);

// GET /leaves/pending-leaves-count
router.get(
  '/pending-leaves-count',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT COUNT(*) as count FROM leaves WHERE status = 'Pending'");
    res.json(Number(rows[0].count));
  })
);

// GET /leaves (all users leaves) - Admin / HR only
router.get(
  '/',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `${LEAVE_SELECT} LEFT JOIN users u ON u.id = l.userId ORDER BY l.timestamp DESC`
    );
    res.json(leaveRowsToResponse(rows));
  })
);

// POST /leaves/ (submit leave - Any logged in user)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { fromDate, toDate, date, duration = 'F', half, leaveContent, reason, leaveType = 'CL' } = req.body;

    if (!leaveContent || !reason) {
      return res.status(400).json({ success: false, message: 'leaveContent and reason are required' });
    }

    let f = fromDate || null;
    let t = toDate || null;

    if (duration === 'R') {
      if (!f || !t) {
        return res.status(400).json({ success: false, message: 'fromDate and toDate are required for a range leave' });
      }
    } else {
      if (!date) {
        return res.status(400).json({ success: false, message: 'date is required' });
      }
      f = t = date;
    }

    const typeCode = String(leaveType || 'CL').toUpperCase();

    const [insertResult] = await pool.query(
      `INSERT INTO leaves (userId, leaveContent, leaveType, fromDate, toDate, date, duration, half, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [req.user.userId, leaveContent, typeCode, f, t, date, duration, half || null, reason]
    );

    logAudit(req, {
      action: 'LEAVE_APPLIED',
      entityType: 'LEAVE',
      entityId: insertResult.insertId,
      description: `${req.user.name} applied for [${typeCode}] "${leaveContent}" (${f} to ${t}): ${reason}`,
      details: { leaveType: typeCode, leaveContent, fromDate: f, toDate: t, reason, duration },
    });

    res.json({ success: true, message: 'Leave request submitted successfully' });
  })
);

// PUT /leaves/ (accept / reject) - Admin / HR only
router.put(
  '/',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const { leaveId, status, response, userId } = req.body;

    if (!leaveId || !status) {
      return res.status(400).json({ success: false, message: 'leaveId and status are required' });
    }

    const newStatus = Number(status) === 2 ? 'Accepted' : 'Rejected';

    await pool.query('UPDATE leaves SET status = ?, response = ? WHERE id = ?', [
      newStatus,
      response || '',
      Number(leaveId),
    ]);

    const [leaveRows] = await pool.query(
      'SELECT l.leaveContent, l.leaveType, u.name as applicantName FROM leaves l JOIN users u ON u.id = l.userId WHERE l.id = ?',
      [Number(leaveId)]
    );
    const applicant = leaveRows[0]?.applicantName || `User ID ${userId}`;
    const type = leaveRows[0]?.leaveType || 'CL';

    logAudit(req, {
      action: newStatus === 'Accepted' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      entityType: 'LEAVE',
      entityId: leaveId,
      description: `${req.user.name} ${newStatus.toLowerCase()} [${type}] leave request for ${applicant}. Note: ${response || 'None'}`,
      details: { leaveId, status: newStatus, response, applicant, leaveType: type },
    });

    res.json({ success: true, message: `Leave ${newStatus.toLowerCase()} successfully` });
  })
);

// PUT /leaves/update-leave
router.put(
  '/update-leave',
  asyncHandler(async (req, res) => {
    const { leaveId, leaveContent, leaveType = 'CL', reason, fromDate, toDate } = req.body;
    if (!leaveId) {
      return res.status(400).json({ success: false, message: 'leaveId is required' });
    }

    const [existing] = await pool.query('SELECT userId FROM leaves WHERE id = ?', [Number(leaveId)]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }
    if (req.user.roleId === 3 && existing[0].userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await pool.query(
      'UPDATE leaves SET leaveContent = ?, leaveType = ?, reason = ?, fromDate = ?, toDate = ? WHERE id = ?',
      [leaveContent, leaveType, reason, fromDate, toDate, Number(leaveId)]
    );

    logAudit(req, {
      action: 'LEAVE_UPDATED',
      entityType: 'LEAVE',
      entityId: leaveId,
      description: `Updated leave application ID: ${leaveId}`,
      details: { leaveContent, leaveType, reason, fromDate, toDate },
    });

    res.json({ success: true, message: 'Leave updated successfully' });
  })
);

// DELETE /leaves/:leaveId
router.delete(
  '/:leaveId',
  asyncHandler(async (req, res) => {
    const leaveId = Number(req.params.leaveId);

    const [existing] = await pool.query('SELECT userId, leaveContent FROM leaves WHERE id = ?', [leaveId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }
    if (req.user.roleId === 3 && existing[0].userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await pool.query('DELETE FROM leaves WHERE id = ?', [leaveId]);

    logAudit(req, {
      action: 'LEAVE_DELETED',
      entityType: 'LEAVE',
      entityId: leaveId,
      description: `Cancelled/deleted leave application ID: ${leaveId}`,
    });

    res.json({ success: true, message: 'Leave deleted successfully' });
  })
);

// ---------- Financial Year Rollover & Auto-Allotment Endpoints ----------

// POST /leaves/financial-year/rollover - Admin / HR triggered Financial Year Reset & Rollover
router.post(
  '/financial-year/rollover',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const { targetFY } = req.body; // e.g. "2027-2028"
    const tenantId = req.headers['x-tenant-id'] || req.user.tenantId || 1;

    const result = await executeFinancialYearRollover(tenantId, targetFY);

    logAudit(req, {
      action: 'FINANCIAL_YEAR_LEAVES_ROLLED_OVER',
      entityType: 'LEAVE',
      description: `Executed Financial Year Leave Reset & Rollover for ${result.targetFinancialYear} across ${result.usersProcessed} employees (${result.totalEarnedLeavesCarried} EL carried forward)`,
      details: result,
    });

    res.json({
      success: true,
      message: `Financial Year ${result.targetFinancialYear} leave rollover completed successfully!`,
      data: result,
    });
  })
);

// GET /leaves/financial-year/summary - Overview of FY metrics
router.get(
  '/financial-year/summary',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const fyInfo = getFinancialYearInfo();

    const [breakdown] = await pool.query(
      `SELECT lt.name, lt.code, lt.colorCode,
              COALESCE(SUM(ultb.allotted), 0) as totalAllotted,
              COALESCE(SUM(ultb.carried), 0) as totalCarried,
              COALESCE(SUM(ultb.used), 0) as totalUsed
       FROM leave_types lt
       LEFT JOIN user_leave_type_balances ultb ON ultb.leaveTypeCode = lt.code AND ultb.financialYear = ?
       WHERE lt.status = 'active'
       GROUP BY lt.id, lt.name, lt.code, lt.colorCode`,
      [fyInfo.fyString]
    );

    res.json({
      financialYear: fyInfo.fyString,
      fyLabel: fyInfo.label,
      startDate: fyInfo.startDate,
      endDate: fyInfo.endDate,
      typesBreakdown: breakdown.map((b) => ({
        name: b.name,
        code: b.code,
        colorCode: b.colorCode,
        totalAllotted: Number(b.totalAllotted) || 0,
        totalCarried: Number(b.totalCarried) || 0,
        totalUsed: Number(b.totalUsed) || 0,
        totalRemaining: Math.max(0, (Number(b.totalAllotted) || 0) + (Number(b.totalCarried) || 0) - (Number(b.totalUsed) || 0)),
      })),
    });
  })
);

// ---------- Institute Holidays ----------

// GET /leaves/institute-holidays
router.get(
  '/institute-holidays',
  asyncHandler(async (req, res) => {
    const targetUserId = req.query.userId ? Number(req.query.userId) : req.user.userId;

    const [globalHolidays] = await pool.query(
      'SELECT leaveDate, "Company" as type, "Official Company Holiday" as title FROM institute_holidays ORDER BY leaveDate'
    );

    const [userHolidays] = await pool.query(
      'SELECT id, holidayDate as leaveDate, "Personal" as type, title, isOptional FROM user_holidays WHERE userId = ? ORDER BY holidayDate',
      [targetUserId]
    );

    const combined = [
      ...globalHolidays.map((r) => ({
        leaveDate: String(r.leaveDate).slice(0, 10),
        type: 'Company',
        title: r.title,
        isOptional: false,
      })),
      ...userHolidays.map((r) => ({
        id: r.id,
        leaveDate: String(r.leaveDate).slice(0, 10),
        type: 'Personal',
        title: r.title || 'Personal Custom Holiday',
        isOptional: Boolean(r.isOptional),
      })),
    ];

    combined.sort((a, b) => (a.leaveDate > b.leaveDate ? 1 : -1));
    res.json(combined);
  })
);

// POST /leaves/institute-holiday - Admin / HR only
router.post(
  '/institute-holiday',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date is required' });
    }
    const cleanDate = String(date).slice(0, 10);
    await pool.query(
      'INSERT INTO institute_holidays (leaveDate) VALUES (?) ON DUPLICATE KEY UPDATE leaveDate = leaveDate',
      [cleanDate]
    );

    logAudit(req, {
      action: 'COMPANY_HOLIDAY_ADDED',
      entityType: 'HOLIDAY',
      description: `Added official company holiday on ${cleanDate}`,
      details: { date: cleanDate },
    });

    res.json({ success: true, message: 'Institute holiday added successfully' });
  })
);

// DELETE /leaves/institute-holiday/:date - Admin / HR only
router.delete(
  '/institute-holiday/:date',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const cleanDate = String(req.params.date).slice(0, 10);
    const [result] = await pool.query('DELETE FROM institute_holidays WHERE leaveDate = ?', [cleanDate]);

    logAudit(req, {
      action: 'COMPANY_HOLIDAY_DELETED',
      entityType: 'HOLIDAY',
      description: `Deleted official company holiday on ${cleanDate}`,
      details: { date: cleanDate },
    });

    res.json({
      success: result.affectedRows > 0,
      message: result.affectedRows > 0 ? 'Holiday deleted' : 'Holiday not found',
    });
  })
);

// ---------- User monthly leave balances ----------

// GET /leaves/users-leaves - Admin / HR only
router.get(
  '/users-leaves',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const year = new Date().getFullYear();
    const [rows] = await pool.query(
      `SELECT u.id as userId, u.name, lb.month, lb.leaves
       FROM users u
       LEFT JOIN leave_balances lb ON lb.userId = u.id AND lb.year = ?
       ORDER BY u.name, lb.month`,
      [year]
    );
    const byUser = {};
    rows.forEach((r) => {
      if (!byUser[r.userId]) byUser[r.userId] = { userId: r.userId, name: r.name, leaves: [] };
      byUser[r.userId].leaves.push({
        month: MONTH_NAMES[(r.month || 0) - 1] || 'January',
        leaves: r.leaves != null ? Number(r.leaves) : 0,
      });
    });
    res.json(Object.values(byUser));
  })
);

// PUT /leaves/user-leave - Admin / HR only
router.put(
  '/user-leave',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const { userId, leave } = req.body;
    const year = new Date().getFullYear();
    if (!userId || !Array.isArray(leave)) {
      return res.status(400).json({ success: false, message: 'userId and leave array are required' });
    }
    for (const item of leave) {
      const month = monthNameToNumber(item.month);
      if (!month) continue;
      await pool.query(
        `INSERT INTO leave_balances (userId, month, year, leaves, alloted)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE leaves = VALUES(leaves)`,
        [Number(userId), month, year, Number(item.leaves) || 0, Number(item.leaves) || 0]
      );
    }

    logAudit(req, {
      action: 'USER_LEAVES_CONFIGURED',
      entityType: 'LEAVE',
      entityId: userId,
      description: `Updated monthly leave balances for user ID: ${userId}`,
    });

    res.json({ success: true, message: 'User leaves updated successfully' });
  })
);

// GET /leaves/users-leaves-for-allot/ - Admin / HR only
router.get(
  '/users-leaves-for-allot',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const year = new Date().getFullYear();
    const [rows] = await pool.query(
      `SELECT u.id as userId, u.name, lb.month, lb.leaves, lb.alloted, lb.carried, lb.used
       FROM users u
       LEFT JOIN leave_balances lb ON lb.userId = u.id AND lb.year = ?
       ORDER BY u.name, lb.month`,
      [year]
    );
    const byUser = {};
    rows.forEach((r) => {
      if (!byUser[r.userId]) byUser[r.userId] = { userId: r.userId, name: r.name, leaves: [] };
      byUser[r.userId].leaves.push({
        month: MONTH_NAMES[(r.month || 0) - 1] || 'January',
        leaves: r.leaves != null ? Number(r.leaves) : 0,
        alloted: r.alloted != null ? Number(r.alloted) : 0,
        carried: r.carried != null ? Number(r.carried) : 0,
        used: r.used != null ? Number(r.used) : 0,
      });
    });
    res.json(Object.values(byUser));
  })
);

// PUT /leaves/user-leave-allot - Admin / HR only
router.put(
  '/user-leave-allot',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const { userId, leave } = req.body;
    const year = new Date().getFullYear();
    if (!userId || !Array.isArray(leave)) {
      return res.status(400).json({ success: false, message: 'userId and leave array are required' });
    }
    for (const item of leave) {
      const month = monthNameToNumber(item.month);
      if (!month) continue;
      await pool.query(
        `INSERT INTO leave_balances (userId, month, year, leaves, alloted, carried, used)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE leaves = VALUES(leaves), alloted = VALUES(alloted), carried = VALUES(carried), used = VALUES(used)`,
        [
          Number(userId),
          month,
          year,
          Number(item.leaves) || 0,
          Number(item.alloted) || 0,
          Number(item.carried) || 0,
          Number(item.used) || 0,
        ]
      );
    }

    logAudit(req, {
      action: 'LEAVES_ALLOTTED',
      entityType: 'LEAVE',
      entityId: userId,
      description: `Allotted annual/monthly leave quota matrix for user ID: ${userId}`,
    });

    res.json({ success: true, message: 'Leaves allotted successfully' });
  })
);

// GET /leaves/all-users-leaves - Admin / HR only
router.get(
  '/all-users-leaves',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const month = Number(req.query.month) + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const [rows] = await pool.query(
      `SELECT u.name as userName, l.leaveContent, COALESCE(l.leaveType, 'CL') as leaveType,
              COALESCE(lt.name, l.leaveType, 'Casual Leave') as leaveTypeName,
              COALESCE(lt.colorCode, '#10b981') as leaveTypeColor,
              COALESCE(l.fromDate, l.date) as fromDate,
              COALESCE(l.toDate, l.date) as toDate,
              l.status,
              CASE WHEN l.duration = 'H' THEN 0.5
                   ELSE (DATEDIFF(COALESCE(l.toDate, l.date), COALESCE(l.fromDate, l.date)) + 1)
              END as days
       FROM leaves l
       JOIN users u ON u.id = l.userId
       LEFT JOIN leave_types lt ON lt.code = l.leaveType
       WHERE MONTH(COALESCE(l.fromDate, l.date)) = ? AND YEAR(COALESCE(l.fromDate, l.date)) = ?
       ORDER BY u.name`,
      [month, year]
    );
    res.json(
      rows.map((r) => ({
        userName: r.userName,
        leaveContent: r.leaveContent,
        leaveType: r.leaveType,
        leaveTypeName: r.leaveTypeName,
        leaveTypeColor: r.leaveTypeColor,
        fromDate: r.fromDate,
        toDate: r.toDate,
        status: r.status,
        days: Number(r.days) || 0,
      }))
    );
  })
);

export default router;
