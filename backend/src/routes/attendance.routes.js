import express from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../auth.js';
import { asyncHandler, toIso, todayStr, pad } from '../helpers.js';
import { logAudit } from '../audit.js';

const router = express.Router();

router.use(authMiddleware);

// GET /api/attendance/my-status  (Get today's punch status for logged-in user)
router.get(
  '/my-status',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const today = todayStr();

    const [punches] = await pool.query(
      `SELECT id, datetime, entryType, status, rawLine
       FROM attendance
       WHERE userId = ? AND DATE(datetime) = ?
       ORDER BY datetime ASC`,
      [userId, today]
    );

    const [timings] = await pool.query(
      `SELECT fromTime, toTime FROM timings WHERE userId = ?`,
      [userId]
    );

    const timing = timings[0] || { fromTime: '09:00:00', toTime: '18:00:00' };

    const firstPunch = punches.length > 0 ? punches[0] : null;
    const lastPunch = punches.length > 1 ? punches[punches.length - 1] : (punches.length === 1 ? punches[0] : null);

    // Is currently clocked in: if punches count is odd
    const isClockedIn = punches.length % 2 === 1;

    res.json({
      success: true,
      punches: punches.map(p => ({
        id: p.id,
        datetime: toIso(p.datetime),
        time: String(p.datetime).slice(11, 19) || p.datetime,
        entryType: p.entryType,
        status: p.status,
        note: p.rawLine,
      })),
      totalPunches: punches.length,
      isClockedIn,
      firstPunchTime: firstPunch ? String(firstPunch.datetime).slice(11, 19) : null,
      lastPunchTime: punches.length > 1 ? String(lastPunch.datetime).slice(11, 19) : null,
      timing,
    });
  })
);

// POST /api/attendance/punch  (Web Clock-In / Clock-Out)
router.post(
  '/punch',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { note, punchType } = req.body; // punchType: 'in', 'out', or auto
    const today = todayStr();

    const now = new Date();
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    const datetimeStr = `${today} ${hours}:${minutes}:${seconds}`;

    // Get today's existing punches
    const [existing] = await pool.query(
      `SELECT COUNT(*) as count FROM attendance WHERE userId = ? AND DATE(datetime) = ?`,
      [userId, today]
    );

    const count = Number(existing[0].count) || 0;
    const status = punchType || (count % 2 === 0 ? 'Clock In' : 'Clock Out');

    const [result] = await pool.query(
      `INSERT INTO attendance (userId, datetime, entryType, deviceSN, enrollId, rawLine, status)
       VALUES (?, ?, 'web', 'WEB_PORTAL', ?, ?, ?)`,
      [userId, datetimeStr, `USER-${userId}`, note || `Web Punch (${status})`, status]
    );

    logAudit(req, {
      action: status.toLowerCase().includes('in') ? 'PUNCH_CLOCK_IN' : 'PUNCH_CLOCK_OUT',
      entityType: 'ATTENDANCE',
      entityId: result.insertId,
      description: `${req.user.name} clocked ${status.toLowerCase()} at ${hours}:${minutes}`,
      details: { datetime: datetimeStr, status, entryType: 'web', note },
    });

    res.json({
      success: true,
      message: `Successfully clocked ${status.toLowerCase() === 'clock in' || status === 'in' ? 'in' : 'out'} at ${hours}:${minutes}`,
      punch: {
        id: result.insertId,
        datetime: datetimeStr,
        status,
        entryType: 'web',
      },
      isClockedIn: (count + 1) % 2 === 1,
    });
  })
);

// GET /api/attendance/my-history?month=MM&year=YYYY
router.get(
  '/my-history',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();

    const [rows] = await pool.query(
      `SELECT DATE(datetime) as date, datetime, status, entryType
       FROM attendance
       WHERE userId = ? AND MONTH(datetime) = ? AND YEAR(datetime) = ?
       ORDER BY datetime ASC`,
      [userId, month, year]
    );

    const byDate = {};
    rows.forEach(r => {
      const d = String(r.date).slice(0, 10);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({
        datetime: toIso(r.datetime),
        time: String(r.datetime).slice(11, 16),
        status: r.status,
      });
    });

    const result = Object.keys(byDate).map(date => {
      const items = byDate[date];
      return {
        date,
        firstPunch: items[0]?.time || '-',
        lastPunch: items.length > 1 ? items[items.length - 1]?.time : items[0]?.time,
        totalPunches: items.length,
        punches: items,
      };
    });

    res.json(result);
  })
);

export default router;
