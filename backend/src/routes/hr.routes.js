import express from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../auth.js';
import { asyncHandler, todayStr, pad } from '../helpers.js';

const router = express.Router();

router.use(authMiddleware);

const DEFAULT_FROM_TIME = '09:00:00';

async function getUserFirstEntryToday() {
  const today = todayStr();
  const [rows] = await pool.query(
    `SELECT a.userId, DATE_FORMAT(MIN(a.datetime), '%H:%i:%s') as firstEntry
     FROM attendance a
     WHERE DATE(a.datetime) = ?
     GROUP BY a.userId`,
    [today]
  );
  return rows;
}

async function getUsersWithTimings() {
  const [rows] = await pool.query(
    `SELECT u.id as userId, u.name,
            COALESCE(t.fromTime, '${DEFAULT_FROM_TIME}') as fromTime
     FROM users u
     LEFT JOIN timings t ON t.userId = u.id`
  );
  return rows;
}

function timeToSeconds(t) {
  const parts = String(t || '').split(':');
  if (parts.length < 2) return 0;
  return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + (Number(parts[2]) || 0);
}

// GET /hr/dashboard-stats
router.get(
  '/dashboard-stats',
  asyncHandler(async (req, res) => {
    const today = todayStr();

    const [totalRows] = await pool.query('SELECT COUNT(*) as c FROM users');
    const totalEmployees = Number(totalRows[0].c) || 0;

    const [presentRows] = await pool.query(
      `SELECT COUNT(DISTINCT userId) as c FROM attendance WHERE DATE(datetime) = ?`,
      [today]
    );
    const presentToday = Number(presentRows[0].c) || 0;

    const [leaveRows] = await pool.query(
      `SELECT COUNT(DISTINCT userId) as c FROM leaves
       WHERE status = 'Accepted'
         AND (COALESCE(fromDate, date) <= ? AND COALESCE(toDate, date) >= ?)`,
      [today, today]
    );
    const onLeave = Number(leaveRows[0].c) || 0;

    const [pendingRows] = await pool.query(
      "SELECT COUNT(*) as c FROM leaves WHERE status = 'Pending'"
    );
    const pendingLeaves = Number(pendingRows[0].c) || 0;

    const firstEntries = await getUserFirstEntryToday();
    const users = await getUsersWithTimings();

    const entryMap = {};
    firstEntries.forEach((e) => {
      entryMap[e.userId] = e.firstEntry;
    });

    let lateArrivals = 0;
    users.forEach((u) => {
      const entry = entryMap[u.userId];
      if (entry) {
        const diff = timeToSeconds(entry) - timeToSeconds(u.fromTime);
        if (diff > 300) lateArrivals += 1;
      }
    });

    res.json({ totalEmployees, presentToday, onLeave, pendingLeaves, lateArrivals });
  })
);

// GET /hr/analytics/attendance?month=1-12&year=YYYY
router.get(
  '/analytics/attendance',
  asyncHandler(async (req, res) => {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();
    const monthPad = pad(month);

    const [users] = await pool.query(
      `SELECT u.id as userId, u.name FROM users u ORDER BY u.name`
    );

    const [presentRows] = await pool.query(
      `SELECT userId, COUNT(DISTINCT DATE(datetime)) as presentDays
       FROM attendance
       WHERE YEAR(datetime) = ? AND MONTH(datetime) = ?
       GROUP BY userId`,
      [year, month]
    );
    const [leaveRows] = await pool.query(
      `SELECT userId, COUNT(DISTINCT DATE(COALESCE(fromDate, date))) as leaveDays
       FROM leaves
       WHERE status = 'Accepted' AND YEAR(COALESCE(fromDate, date)) = ? AND MONTH(COALESCE(fromDate, date)) = ?
       GROUP BY userId`,
      [year, month]
    );

    const presentMap = {};
    presentRows.forEach((r) => {
      presentMap[r.userId] = Number(r.presentDays) || 0;
    });
    const leaveMap = {};
    leaveRows.forEach((r) => {
      leaveMap[r.userId] = Number(r.leaveDays) || 0;
    });

    res.json(
      users.map((u) => ({
        name: u.name,
        presentDays: presentMap[u.userId] || 0,
        leaveDays: leaveMap[u.userId] || 0,
      }))
    );
  })
);

// GET /hr/analytics/leaves?year=YYYY
router.get(
  '/analytics/leaves',
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT MONTH(COALESCE(fromDate, date)) as month, status, COUNT(*) as c
       FROM leaves
       WHERE YEAR(COALESCE(fromDate, date)) = ?
       GROUP BY MONTH(COALESCE(fromDate, date)), status`,
      [year]
    );

    const data = {};
    rows.forEach((r) => {
      if (!data[r.month]) data[r.month] = { month: r.month, approved: 0, pending: 0, rejected: 0, totalLeaves: 0 };
      const key = r.status.toLowerCase();
      if (key in data[r.month]) data[r.month][key] = Number(r.c) || 0;
      data[r.month].totalLeaves += Number(r.c) || 0;
    });

    const result = [];
    for (let m = 1; m <= 12; m++) {
      result.push(data[m] || { month: m, approved: 0, pending: 0, rejected: 0, totalLeaves: 0 });
    }
    res.json(result);
  })
);

// GET /hr/analytics/overview
router.get(
  '/analytics/overview',
  asyncHandler(async (req, res) => {
    const [totalRows] = await pool.query('SELECT COUNT(*) as c FROM users');
    const [pendingRows] = await pool.query("SELECT COUNT(*) as c FROM leaves WHERE status = 'Pending'");

    res.json({
      totalEmployees: Number(totalRows[0].c) || 0,
      pendingLeaves: Number(pendingRows[0].c) || 0,
      averageRating: 0,
      totalReviews: 0,
      performanceDistribution: {},
    });
  })
);

// POST /hr/attendance/manual
router.post(
  '/attendance/manual',
  asyncHandler(async (req, res) => {
    const { userId, date, checkIn, checkOut, status, remarks } = req.body;

    if (!userId || !date) {
      return res.status(400).json({ success: false, message: 'userId and date are required', error: 'userId and date are required' });
    }

    const d = String(date).slice(0, 10);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (checkIn) {
        await conn.query(
          `INSERT INTO attendance (userId, datetime, entryType, status, rawLine)
           VALUES (?, ?, 'manual', ?, ?)`,
          [Number(userId), `${d} ${checkIn}`, status || 'Present', remarks || 'Manual attendance entry']
        );
      }
      if (checkOut) {
        await conn.query(
          `INSERT INTO attendance (userId, datetime, entryType, status, rawLine)
           VALUES (?, ?, 'manual', ?, ?)`,
          [Number(userId), `${d} ${checkOut}`, status || 'Present', remarks || 'Manual attendance entry']
        );
      }
      if (!checkIn && !checkOut) {
        await conn.query(
          `INSERT INTO attendance (userId, datetime, entryType, status, rawLine)
           VALUES (?, ?, 'manual', ?, ?)`,
          [Number(userId), `${d} 09:00:00`, status || 'Present', remarks || 'Manual attendance entry']
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.json({ success: true, message: 'Manual attendance saved successfully' });
  })
);

export default router;
