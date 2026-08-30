import express from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAdminOrHR } from '../auth.js';
import { asyncHandler, toIso, todayStr, pad } from '../helpers.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdminOrHR);

// GET /bio/biometric/devices
router.get(
  '/biometric/devices',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, deviceName, deviceSN, ipAddress, location, status, lastSeenAt FROM biometric_devices ORDER BY id'
    );
    res.json(rows);
  })
);

// GET /bio/devices/status
router.get(
  '/devices/status',
  asyncHandler(async (req, res) => {
    const today = todayStr();
    const [totalRows] = await pool.query('SELECT COUNT(*) as c FROM biometric_devices');
    const [activeRows] = await pool.query("SELECT COUNT(*) as c FROM biometric_devices WHERE status = 'Active'");
    const [offlineRows] = await pool.query("SELECT COUNT(*) as c FROM biometric_devices WHERE status = 'Offline'");
    const [inactiveRows] = await pool.query("SELECT COUNT(*) as c FROM biometric_devices WHERE status = 'Inactive'");
    const [punchRows] = await pool.query(
      'SELECT COUNT(*) as c FROM attendance WHERE DATE(datetime) = ?',
      [today]
    );
    const [uniqueRows] = await pool.query(
      'SELECT COUNT(DISTINCT userId) as c FROM attendance WHERE DATE(datetime) = ? AND userId IS NOT NULL',
      [today]
    );

    res.json({
      totalDevices: Number(totalRows[0].c) || 0,
      activeDevices: Number(activeRows[0].c) || 0,
      offlineDevices: Number(offlineRows[0].c) || 0,
      inactiveDevices: Number(inactiveRows[0].c) || 0,
      todayPunches: Number(punchRows[0].c) || 0,
      uniqueUsersToday: Number(uniqueRows[0].c) || 0,
    });
  })
);

// POST /bio/biometric/approve-device  { pendingId, deviceName, location }
router.post(
  '/biometric/approve-device',
  asyncHandler(async (req, res) => {
    const { pendingId, deviceName, location } = req.body;

    if (!pendingId) {
      return res.status(400).json({ success: false, message: 'pendingId is required' });
    }

    const [pending] = await pool.query('SELECT * FROM biometric_pending_devices WHERE id = ?', [Number(pendingId)]);
    if (pending.length === 0) {
      return res.status(404).json({ success: false, message: 'Pending device not found' });
    }

    const deviceSN = pending[0].deviceSN;
    await pool.query(
      `INSERT INTO biometric_devices (deviceName, deviceSN, ipAddress, location, status, lastSeenAt)
       VALUES (?, ?, NULL, ?, 'Active', NOW())
       ON DUPLICATE KEY UPDATE deviceName = VALUES(deviceName), location = VALUES(location), status = 'Active'`,
      [deviceName || deviceSN, deviceSN, location || 'Office']
    );
    await pool.query('DELETE FROM biometric_pending_devices WHERE id = ?', [Number(pendingId)]);

    res.json({ success: true, message: 'Device approved and added successfully' });
  })
);

// POST /bio/biometric/device
router.post(
  '/biometric/device',
  asyncHandler(async (req, res) => {
    const { deviceName, deviceSN, ipAddress, location, status } = req.body;

    if (!deviceName || !deviceSN) {
      return res.status(400).json({ success: false, message: 'deviceName and deviceSN are required' });
    }

    await pool.query(
      `INSERT INTO biometric_devices (deviceName, deviceSN, ipAddress, location, status, lastSeenAt)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE deviceName = VALUES(deviceName), ipAddress = VALUES(ipAddress),
               location = VALUES(location), status = VALUES(status)`,
      [deviceName, deviceSN, ipAddress || null, location || 'Office', status || 'Active']
    );

    res.json({ success: true, message: 'Device added successfully' });
  })
);

// PUT /bio/biometric/device/:id
router.put(
  '/biometric/device/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { deviceName, deviceSN, ipAddress, location, status } = req.body;

    const [result] = await pool.query(
      `UPDATE biometric_devices
       SET deviceName = ?, deviceSN = ?, ipAddress = ?, location = ?, status = ?
       WHERE id = ?`,
      [deviceName, deviceSN, ipAddress || null, location || 'Office', status || 'Active', id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }
    res.json({ success: true, message: 'Device updated successfully' });
  })
);

// DELETE /bio/biometric/device/:id
router.delete(
  '/biometric/device/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const [result] = await pool.query('DELETE FROM biometric_devices WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }
    res.json({ success: true, message: 'Device deleted successfully' });
  })
);

// POST /bio/download/:deviceSN
router.post(
  '/download/:deviceSN',
  asyncHandler(async (req, res) => {
    const deviceSN = req.params.deviceSN;

    const [device] = await pool.query('SELECT id FROM biometric_devices WHERE deviceSN = ?', [deviceSN]);
    if (device.length === 0) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    await pool.query('UPDATE biometric_devices SET lastSeenAt = NOW() WHERE deviceSN = ?', [deviceSN]);

    // Simulate syncing a couple of punches so the download has a visible effect
    const now = new Date();
    const minute = pad(now.getMinutes());
    const hour = pad(now.getHours());
    const today = todayStr();
    await pool.query(
      `INSERT INTO attendance (userId, datetime, entryType, deviceSN, enrollId, rawLine, status)
       VALUES (NULL, ?, 'machine', ?, 'SYNC-1', ?, 'in')`,
      [`${today} ${hour}:${minute}:00`, deviceSN, `download from device ${deviceSN}`]
    );

    res.json({ success: true, message: `Download initiated for device ${deviceSN}` });
  })
);

// GET /bio/employees/mapping
router.get(
  '/employees/mapping',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id as userId, name, email, employeeId FROM users ORDER BY name`
    );
    res.json({ users: rows, totalCount: rows.length });
  })
);

// POST /bio/punches/map-employee  { enrollId, deviceSN, userId }
router.post(
  '/punches/map-employee',
  asyncHandler(async (req, res) => {
    const { enrollId, deviceSN, userId } = req.body;

    if (!enrollId || !deviceSN || !userId) {
      return res.status(400).json({ success: false, message: 'enrollId, deviceSN and userId are required' });
    }

    await pool.query(
      `INSERT INTO punch_mappings (deviceSN, enrollId, userId) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE userId = VALUES(userId)`,
      [deviceSN, enrollId, Number(userId)]
    );

    // Attach user to existing punches from this device + enrollId
    await pool.query(
      'UPDATE attendance SET userId = ? WHERE deviceSN = ? AND enrollId = ?',
      [Number(userId), deviceSN, enrollId]
    );

    res.json({ success: true, message: 'Employee mapped to punches successfully' });
  })
);

// GET /bio/punches/recent
router.get(
  '/punches/recent',
  asyncHandler(async (req, res) => {
    const { startDate, endDate, deviceSN, enrollId, mapped } = req.query;

    let sql = `SELECT a.id, a.datetime, a.deviceSN, a.enrollId, a.userId, a.status, a.rawLine, a.entryType,
                      u.name, u.employeeId
               FROM attendance a
               LEFT JOIN users u ON u.id = a.userId
               WHERE 1 = 1`;
    const params = [];

    if (startDate) {
      sql += ' AND DATE(a.datetime) >= ?';
      params.push(String(startDate).slice(0, 10));
    }
    if (endDate) {
      sql += ' AND DATE(a.datetime) <= ?';
      params.push(String(endDate).slice(0, 10));
    }
    if (deviceSN) {
      sql += ' AND a.deviceSN = ?';
      params.push(deviceSN);
    }
    if (enrollId) {
      sql += ' AND a.enrollId LIKE ?';
      params.push(`%${enrollId}%`);
    }
    if (mapped === 'known') {
      sql += ' AND a.userId IS NOT NULL';
    } else if (mapped === 'unknown') {
      sql += ' AND a.userId IS NULL';
    }

    sql += ' ORDER BY a.datetime DESC LIMIT 1000';

    const [rows] = await pool.query(sql, params);

    res.json({
      punches: rows.map((r) => ({
        id: r.id,
        datetime: toIso(r.datetime),
        deviceSN: r.deviceSN,
        enrollId: r.enrollId,
        userId: r.userId,
        name: r.name,
        employeeId: r.employeeId,
        status: r.status,
        rawLine: r.rawLine,
        entryType: r.entryType,
      })),
    });
  })
);

export default router;
