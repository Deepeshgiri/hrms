import express from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../auth.js';
import { asyncHandler, MONTH_NAMES, monthNameToNumber, todayStr } from '../helpers.js';

const router = express.Router();

router.use(authMiddleware);

const LEAVE_SELECT = `
  SELECT l.id as leaveId, l.userId, l.leaveContent, l.reason, l.status, l.response,
         COALESCE(l.fromDate, l.date) as fromDate,
         COALESCE(l.toDate, l.date) as toDate,
         l.duration, l.half, l.timestamp
  FROM leaves l
`;

function leaveRowsToResponse(rows) {
  return rows.map((r) => ({
    leaveId: r.leaveId,
    userId: r.userId,
    name: r.name,
    leaveContent: r.leaveContent,
    fromDate: r.fromDate,
    toDate: r.toDate,
    reason: r.reason,
    timestamp: r.timestamp,
    status: r.status,
    response: r.response,
  }));
}

async function computeLeaveUsage(userId, year) {
  const [rows] = await pool.query(
    `SELECT
       CASE WHEN l.duration = 'H' THEN 0.5 ELSE (DATEDIFF(COALESCE(l.toDate, l.date), COALESCE(l.fromDate, l.date)) + 1) END as days
     FROM leaves l
     WHERE l.userId = ? AND l.status = 'Accepted'
       AND YEAR(COALESCE(l.fromDate, l.date)) = ?`,
    [userId, year]
  );
  let used = 0;
  rows.forEach((r) => {
    used += Number(r.days) || 0;
  });
  return used;
}

async function getUserLeaveInfo(userId) {
  const year = new Date().getFullYear();
  const [bal] = await pool.query(
    'SELECT COALESCE(SUM(leaves), 0) as total FROM leave_balances WHERE userId = ? AND year = ?',
    [userId, year]
  );
  const total = Number(bal[0].total) || 0;
  const used = await computeLeaveUsage(userId, year);
  const remaining = Math.max(0, total - used);
  return { userId, totalLeaves: total, usedLeaves: used, remainingLeaves: remaining };
}

// GET /leaves/my
router.get(
  '/my',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `${LEAVE_SELECT} WHERE l.userId = ? ORDER BY l.timestamp DESC`,
      [req.user.userId]
    );
    res.json(leaveRowsToResponse(rows));
  })
);

// GET /leaves/my-leaves-info
router.get(
  '/my-leaves-info',
  asyncHandler(async (req, res) => {
    res.json(await getUserLeaveInfo(req.user.userId));
  })
);

// GET /leaves/users-leaves-info
router.get(
  '/users-leaves-info',
  asyncHandler(async (req, res) => {
    const [users] = await pool.query('SELECT id FROM users');
    const result = [];
    for (const u of users) {
      const info = await getUserLeaveInfo(u.id);
      const [nameRows] = await pool.query('SELECT name FROM users WHERE id = ?', [u.id]);
      result.push({ ...info, name: nameRows[0] ? nameRows[0].name : '' });
    }
    res.json(result);
  })
);

// GET /leaves/pending-leaves-count
router.get(
  '/pending-leaves-count',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT COUNT(*) as count FROM leaves WHERE status = 'Pending'"
    );
    res.json(Number(rows[0].count));
  })
);

// GET /leaves  (all users leaves)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `${LEAVE_SELECT} JOIN users u ON u.id = l.userId ORDER BY l.timestamp DESC`
    );
    res.json(leaveRowsToResponse(rows));
  })
);

// POST /leaves/  (submit leave)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { fromDate, toDate, date, duration = 'F', half, leaveContent, reason } = req.body;

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

    await pool.query(
      `INSERT INTO leaves (userId, leaveContent, fromDate, toDate, date, duration, half, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [req.user.userId, leaveContent, f, t, date, duration, half || null, reason]
    );

    res.json({ success: true, message: 'Leave request submitted successfully' });
  })
);

// PUT /leaves/  (accept / reject)
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const { leaveId, status, response, userId } = req.body;

    if (!leaveId || !status) {
      return res.status(400).json({ success: false, message: 'leaveId and status are required' });
    }

    const newStatus = Number(status) === 2 ? 'Accepted' : 'Rejected';

    await pool.query(
      'UPDATE leaves SET status = ?, response = ? WHERE id = ?',
      [newStatus, response || '', Number(leaveId)]
    );

    res.json({ success: true, message: `Leave ${newStatus.toLowerCase()} successfully` });
  })
);

// PUT /leaves/update-leave
router.put(
  '/update-leave',
  asyncHandler(async (req, res) => {
    const { leaveId, leaveContent, reason, fromDate, toDate } = req.body;
    if (!leaveId) {
      return res.status(400).json({ success: false, message: 'leaveId is required' });
    }
    await pool.query(
      'UPDATE leaves SET leaveContent = ?, reason = ?, fromDate = ?, toDate = ? WHERE id = ?',
      [leaveContent, reason, fromDate, toDate, Number(leaveId)]
    );
    res.json({ success: true, message: 'Leave updated successfully' });
  })
);

// PUT /leaves/update-user-leave-info
router.put(
  '/update-user-leave-info',
  asyncHandler(async (req, res) => {
    const { userId, totalLeaves } = req.body;
    const year = new Date().getFullYear();
    if (userId && totalLeaves != null) {
      await pool.query(
        'UPDATE leave_balances SET leaves = ? WHERE userId = ? AND year = ?',
        [Number(totalLeaves), Number(userId), year]
      );
    }
    res.json({ success: true, message: 'User leave info updated' });
  })
);

// PUT /leaves/re-calculate-leaves
router.put(
  '/re-calculate-leaves',
  asyncHandler(async (req, res) => {
    const year = new Date().getFullYear();
    const [usage] = await pool.query(
      `SELECT l.userId, MONTH(COALESCE(l.fromDate, l.date)) as m,
              SUM(CASE WHEN l.duration = 'H' THEN 0.5 ELSE (DATEDIFF(COALESCE(l.toDate, l.date), COALESCE(l.fromDate, l.date)) + 1) END) as used
       FROM leaves l
       WHERE l.status = 'Accepted' AND YEAR(COALESCE(l.fromDate, l.date)) = ?
       GROUP BY l.userId, MONTH(COALESCE(l.fromDate, l.date))`,
      [year]
    );

    for (const row of usage) {
      await pool.query(
        'UPDATE leave_balances SET used = ? WHERE userId = ? AND month = ? AND year = ?',
        [Number(row.used) || 0, row.userId, row.m, year]
      );
    }

    res.json({ success: true, message: 'Leaves recalculated successfully' });
  })
);

// DELETE /leaves/:leaveId
router.delete(
  '/:leaveId',
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM leaves WHERE id = ?', [Number(req.params.leaveId)]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }
    res.json({ success: true, message: 'Leave deleted successfully' });
  })
);

// ---------- Institute Holidays ----------

// GET /leaves/institute-holidays
router.get(
  '/institute-holidays',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT leaveDate FROM institute_holidays ORDER BY leaveDate'
    );
    res.json(rows.map((r) => ({ leaveDate: r.leaveDate })));
  })
);

// POST /leaves/institute-holiday  { date }
router.post(
  '/institute-holiday',
  asyncHandler(async (req, res) => {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date is required' });
    }
    await pool.query(
      'INSERT INTO institute_holidays (leaveDate) VALUES (?) ON DUPLICATE KEY UPDATE leaveDate = leaveDate',
      [String(date).slice(0, 10)]
    );
    res.json({ success: true, message: 'Institute holiday added successfully' });
  })
);

// DELETE /leaves/institute-holiday/:date
router.delete(
  '/institute-holiday/:date',
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('DELETE FROM institute_holidays WHERE leaveDate = ?', [
      String(req.params.date).slice(0, 10),
    ]);
    res.json({ success: result.affectedRows > 0, message: result.affectedRows > 0 ? 'Holiday deleted' : 'Holiday not found' });
  })
);

// ---------- User monthly leave balances ----------

// GET /leaves/users-leaves
router.get(
  '/users-leaves',
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

// PUT /leaves/user-leave  { userId, leave: [{month, leaves}] }
router.put(
  '/user-leave',
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
    res.json({ success: true, message: 'User leaves updated successfully' });
  })
);

// GET /leaves/users-leaves-for-allot/
router.get(
  '/users-leaves-for-allot',
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

// PUT /leaves/user-leave-allot  { userId, leave: [{month, leaves, alloted, carried, used}] }
router.put(
  '/user-leave-allot',
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
    res.json({ success: true, message: 'Leaves allotted successfully' });
  })
);

// ---------- Default role leaves ----------

// GET /leaves/default-role-leaves
router.get(
  '/default-role-leaves',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT r.id as roleId, r.roleName, dl.month, dl.leaves
       FROM roles r
       LEFT JOIN default_leave dl ON dl.roleId = r.id
       ORDER BY r.id, dl.month`
    );
    const byRole = {};
    rows.forEach((r) => {
      if (!byRole[r.roleId]) byRole[r.roleId] = { roleId: r.roleId, roleName: r.roleName, leaves: [] };
      byRole[r.roleId].leaves.push({
        month: MONTH_NAMES[(r.month || 0) - 1] || 'January',
        leaves: r.leaves != null ? Number(r.leaves) : 0,
      });
    });
    res.json(Object.values(byRole));
  })
);

// PUT /leaves/default-leave  { roleId, leave: [{month, leaves}] }
router.put(
  '/default-leave',
  asyncHandler(async (req, res) => {
    const { roleId, leave } = req.body;
    if (!roleId || !Array.isArray(leave)) {
      return res.status(400).json({ success: false, message: 'roleId and leave array are required' });
    }
    for (const item of leave) {
      const month = monthNameToNumber(item.month);
      if (!month) continue;
      await pool.query(
        `INSERT INTO default_leave (roleId, month, leaves)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE leaves = VALUES(leaves)`,
        [Number(roleId), month, Number(item.leaves) || 0]
      );
    }
    res.json({ success: true, message: 'Default role leaves updated successfully' });
  })
);

// GET /leaves/all-users-leaves?month=0-11&year=YYYY
router.get(
  '/all-users-leaves',
  asyncHandler(async (req, res) => {
    const month = Number(req.query.month) + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const [rows] = await pool.query(
      `SELECT u.name as userName, l.leaveContent as leaveType,
              COALESCE(l.fromDate, l.date) as fromDate,
              COALESCE(l.toDate, l.date) as toDate,
              l.status,
              CASE WHEN l.duration = 'H' THEN 0.5
                   ELSE (DATEDIFF(COALESCE(l.toDate, l.date), COALESCE(l.fromDate, l.date)) + 1)
              END as days
       FROM leaves l
       JOIN users u ON u.id = l.userId
       WHERE MONTH(COALESCE(l.fromDate, l.date)) = ? AND YEAR(COALESCE(l.fromDate, l.date)) = ?
       ORDER BY u.name`,
      [month, year]
    );
    res.json(
      rows.map((r) => ({
        userName: r.userName,
        leaveType: r.leaveType,
        fromDate: r.fromDate,
        toDate: r.toDate,
        status: r.status,
        days: Number(r.days) || 0,
      }))
    );
  })
);

export default router;
