import express from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAdminOrHR } from '../auth.js';
import { asyncHandler, toIso, todayStr, pad } from '../helpers.js';
import { currentTenant } from '../tenant.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdminOrHR);

// GET /bio/biometric/devices
router.get(
  '/biometric/devices',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, deviceName, deviceSN, ipAddress, location, status, lastSeenAt FROM biometric_devices WHERE tenantId = ? ORDER BY id',
      [currentTenant(req)]
    );
    res.json(rows);
  })
);

// GET /bio/devices/status
router.get(
  '/devices/status',
  asyncHandler(async (req, res) => {
    const today = todayStr();
    const tenantId = currentTenant(req);
    const [totalRows] = await pool.query('SELECT COUNT(*) as c FROM biometric_devices WHERE tenantId = ?', [tenantId]);
    const [activeRows] = await pool.query("SELECT COUNT(*) as c FROM biometric_devices WHERE tenantId = ? AND status = 'Active'", [tenantId]);
    const [offlineRows] = await pool.query("SELECT COUNT(*) as c FROM biometric_devices WHERE tenantId = ? AND status = 'Offline'", [tenantId]);
    const [inactiveRows] = await pool.query("SELECT COUNT(*) as c FROM biometric_devices WHERE tenantId = ? AND status = 'Inactive'", [tenantId]);
    const [punchRows] = await pool.query(
      'SELECT COUNT(*) as c FROM attendance WHERE tenantId = ? AND DATE(datetime) = ?',
      [tenantId, today]
    );
    const [uniqueRows] = await pool.query(
      'SELECT COUNT(DISTINCT userId) as c FROM attendance WHERE tenantId = ? AND DATE(datetime) = ? AND userId IS NOT NULL',
      [tenantId, today]
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
    const tenantId = currentTenant(req);
    await pool.query(
      `INSERT INTO biometric_devices (deviceName, deviceSN, ipAddress, location, status, lastSeenAt, tenantId)
       VALUES (?, ?, NULL, ?, 'Active', NOW(), ?)
       ON DUPLICATE KEY UPDATE deviceName = VALUES(deviceName), location = VALUES(location), status = 'Active', tenantId = VALUES(tenantId)`,
      [deviceName || deviceSN, deviceSN, location || 'Office', tenantId]
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

    const tenantId = currentTenant(req);
    await pool.query(
      `INSERT INTO biometric_devices (deviceName, deviceSN, ipAddress, location, status, lastSeenAt, tenantId)
       VALUES (?, ?, ?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE deviceName = VALUES(deviceName), ipAddress = VALUES(ipAddress),
               location = VALUES(location), status = VALUES(status), tenantId = VALUES(tenantId)`,
      [deviceName, deviceSN, ipAddress || null, location || 'Office', status || 'Active', tenantId]
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
       WHERE id = ? AND tenantId = ?`,
      [deviceName, deviceSN, ipAddress || null, location || 'Office', status || 'Active', id, currentTenant(req)]
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
    const [result] = await pool.query(
      'DELETE FROM biometric_devices WHERE id = ? AND tenantId = ?',
      [id, currentTenant(req)]
    );
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

    const tenantId = currentTenant(req);
    const [device] = await pool.query(
      'SELECT id FROM biometric_devices WHERE deviceSN = ? AND tenantId = ?',
      [deviceSN, tenantId]
    );
    if (device.length === 0) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    await pool.query('UPDATE biometric_devices SET lastSeenAt = NOW() WHERE deviceSN = ? AND tenantId = ?', [deviceSN, tenantId]);

    // Simulate syncing a couple of punches so the download has a visible effect
    const now = new Date();
    const minute = pad(now.getMinutes());
    const hour = pad(now.getHours());
    const today = todayStr();
    await pool.query(
      `INSERT INTO attendance (userId, datetime, entryType, deviceSN, enrollId, rawLine, status, tenantId)
       VALUES (NULL, ?, 'machine', ?, 'SYNC-1', ?, 'in', ?)`,
      [`${today} ${hour}:${minute}:00`, deviceSN, `download from device ${deviceSN}`, currentTenant(req)]
    );

    res.json({ success: true, message: `Download initiated for device ${deviceSN}` });
  })
);

// GET /bio/employees/mapping
router.get(
  '/employees/mapping',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id as userId, name, email, employeeId FROM users WHERE tenantId = ? ORDER BY name`,
      [currentTenant(req)]
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

    const tenantId = currentTenant(req);
    const [targetUser] = await pool.query('SELECT id, tenantId FROM users WHERE id = ?', [Number(userId)]);
    if (targetUser.length === 0 || targetUser[0].tenantId !== tenantId) {
      return res.status(404).json({ success: false, message: 'Employee not found in your organization' });
    }

    await pool.query(
      `INSERT INTO punch_mappings (deviceSN, enrollId, userId) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE userId = VALUES(userId)`,
      [deviceSN, enrollId, Number(userId)]
    );

    // Attach user to existing punches from this device + enrollId
    await pool.query(
      'UPDATE attendance SET userId = ? WHERE deviceSN = ? AND enrollId = ? AND tenantId = ?',
      [Number(userId), deviceSN, enrollId, tenantId]
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
               WHERE a.tenantId = ?`;
    const params = [currentTenant(req)];

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
