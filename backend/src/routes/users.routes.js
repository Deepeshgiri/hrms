import express from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../auth.js';
import { asyncHandler, toIso, toDateStr, todayStr, pad } from '../helpers.js';

const router = express.Router();

router.use(authMiddleware);

const DEFAULT_TIMING = { fromTime: '09:00:00', toTime: '18:00:00' };

async function getGlobalTiming() {
  const [rows] = await pool.query(
    'SELECT MIN(fromTime) as fromTime, MAX(toTime) as toTime FROM timings WHERE fromTime IS NOT NULL AND toTime IS NOT NULL'
  );
  if (rows[0] && rows[0].fromTime) {
    return { fromTime: rows[0].fromTime, toTime: rows[0].toTime };
  }
  return DEFAULT_TIMING;
}

async function getUserTiming(userId) {
  const [rows] = await pool.query(
    'SELECT fromTime, toTime FROM timings WHERE userId = ?',
    [userId]
  );
  if (rows[0] && rows[0].fromTime) {
    return { fromTime: rows[0].fromTime, toTime: rows[0].toTime };
  }
  return getGlobalTiming();
}

// GET /api/users
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id as userId, name, email, employeeId, designation, department, roleId
       FROM users ORDER BY name`
    );
    res.json(rows);
  })
);

// GET /api/users/timings
router.get(
  '/timings',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT u.id as userId, u.name, t.fromTime, t.toTime
       FROM users u
       LEFT JOIN timings t ON t.userId = u.id
       ORDER BY u.name`
    );
    const result = rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      fromTime: r.fromTime || DEFAULT_TIMING.fromTime,
      toTime: r.toTime || DEFAULT_TIMING.toTime,
    }));
    res.json(result);
  })
);

// PUT /api/users/timings  { userId, fromTime, toTime }
router.put(
  '/timings',
  asyncHandler(async (req, res) => {
    const { userId, fromTime, toTime } = req.body;
    if (!userId || !fromTime || !toTime) {
      return res.status(400).json({ success: false, message: 'userId, fromTime and toTime are required' });
    }
    await pool.query(
      `INSERT INTO timings (userId, fromTime, toTime) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE fromTime = VALUES(fromTime), toTime = VALUES(toTime)`,
      [userId, fromTime, toTime]
    );
    res.json({ success: true, message: 'Timings updated successfully' });
  })
);

// GET /api/users/attendance  (all users grouped by day)
router.get(
  '/attendance',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT datetime FROM attendance ORDER BY datetime ASC'
    );
    const timing = await getGlobalTiming();
    res.json({
      entries: rows.map((r) => ({ datetime: toIso(r.datetime) })),
      from_to_time: timing,
    });
  })
);

// GET /api/users/attendance/today
router.get(
  '/attendance/today',
  asyncHandler(async (req, res) => {
    const today = todayStr();

    const [users] = await pool.query(
      `SELECT id as userId, name FROM users ORDER BY name`
    );
    const [entries] = await pool.query(
      `SELECT a.userId, DATE_FORMAT(a.datetime, '%H:%i:%s') as entry
       FROM attendance a
       WHERE DATE(a.datetime) = ?
       ORDER BY a.datetime ASC`,
      [today]
    );

    const byUser = {};
    entries.forEach((e) => {
      if (!byUser[e.userId]) byUser[e.userId] = [];
      byUser[e.userId].push({ entry: e.entry });
    });

    const result = [];
    for (const u of users) {
      result.push({
        userId: u.userId,
        name: u.name,
        entries: byUser[u.userId] || [],
        from_to_time: await getUserTiming(u.userId),
      });
    }
    res.json(result);
  })
);

// GET /api/users/attendance/monthly?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get(
  '/attendance/monthly',
  asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }
    const [rows] = await pool.query(
      `SELECT a.userId, a.datetime as punches, u.employeeId, u.name
       FROM attendance a
       JOIN users u ON u.id = a.userId
       WHERE DATE(a.datetime) BETWEEN ? AND ?
       ORDER BY a.datetime ASC`,
      [startDate, endDate]
    );
    res.json(
      rows.map((r) => ({
        userId: r.userId,
        employeeId: r.employeeId,
        name: r.name,
        punches: toIso(r.punches),
      }))
    );
  })
);

// GET /api/users/:userId/attendance
router.get(
  '/:userId/attendance',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const [rows] = await pool.query(
      'SELECT datetime FROM attendance WHERE userId = ? ORDER BY datetime ASC',
      [userId]
    );
    const timing = await getUserTiming(userId);
    res.json({
      entries: rows.map((r) => ({ datetime: toIso(r.datetime) })),
      from_to_time: timing,
    });
  })
);

// GET /api/users/:userId/monthly-attendance
router.get(
  '/:userId/monthly-attendance',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const [rows] = await pool.query(
      `SELECT DATE(a.datetime) as date, DATE_FORMAT(a.datetime, '%H:%i') as time
       FROM attendance a
       WHERE a.userId = ?
       ORDER BY a.datetime ASC`,
      [userId]
    );

    const byDate = {};
    rows.forEach((r) => {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(r.time);
    });

    const result = Object.keys(byDate).map((date) => ({
      date,
      datetime: byDate[date].join(','),
    }));
    res.json(result);
  })
);

export default router;
