import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authMiddleware, requireAdmin, requireAdminOrHR } from '../auth.js';
import { asyncHandler, toIso, toDateStr, todayStr, pad, MONTH_NAMES } from '../helpers.js';
import { logAudit } from '../audit.js';

const router = express.Router();

router.use(authMiddleware);

const DEFAULT_TIMING = { fromTime: '09:00:00', toTime: '18:00:00', isWorkingDay: true, lateGraceMinutes: 15 };
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function getGlobalTiming() {
  const [rows] = await pool.query(
    'SELECT MIN(fromTime) as fromTime, MAX(toTime) as toTime FROM timings WHERE fromTime IS NOT NULL AND toTime IS NOT NULL'
  );
  if (rows[0] && rows[0].fromTime) {
    return { fromTime: rows[0].fromTime, toTime: rows[0].toTime, isWorkingDay: true, lateGraceMinutes: 15 };
  }
  return DEFAULT_TIMING;
}

async function getUserTiming(userId, dateStr = null) {
  if (dateStr) {
    const d = new Date(dateStr);
    const dayName = DAYS_OF_WEEK[d.getDay()];
    const [dayRows] = await pool.query(
      'SELECT fromTime, toTime, isWorkingDay, lateGraceMinutes FROM user_day_timings WHERE userId = ? AND dayOfWeek = ?',
      [userId, dayName]
    );
    if (dayRows.length > 0) {
      return {
        fromTime: dayRows[0].fromTime,
        toTime: dayRows[0].toTime,
        isWorkingDay: Boolean(dayRows[0].isWorkingDay),
        lateGraceMinutes: Number(dayRows[0].lateGraceMinutes) || 15,
      };
    }
  }

  const [rows] = await pool.query(
    'SELECT fromTime, toTime FROM timings WHERE userId = ?',
    [userId]
  );
  if (rows[0] && rows[0].fromTime) {
    return { fromTime: rows[0].fromTime, toTime: rows[0].toTime, isWorkingDay: true, lateGraceMinutes: 15 };
  }
  return getGlobalTiming();
}

// GET /api/users/meta/roles
router.get(
  '/meta/roles',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT id, roleName FROM roles ORDER BY id');
    res.json(rows);
  })
);

// GET /api/users/meta/departments
router.get(
  '/meta/departments',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != '' ORDER BY department`
    );
    const depts = rows.map((r) => r.department);
    const defaults = ['Administration', 'Human Resources', 'Engineering', 'Finance', 'Design', 'Marketing', 'Sales', 'Operations'];
    const merged = Array.from(new Set([...defaults, ...depts]));
    res.json(merged);
  })
);

// GET /api/users/profile/me
router.get(
  '/profile/me',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const [rows] = await pool.query(
      `SELECT u.id as userId, u.name, u.email, u.employeeId, u.designation, u.department, u.roleId, r.roleName, u.created_at
       FROM users u
       LEFT JOIN roles r ON r.id = u.roleId
       WHERE u.id = ?`,
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = rows[0];
    user.timing = await getUserTiming(userId, todayStr());
    res.json(user);
  })
);

// PUT /api/users/profile/update
router.put(
  '/profile/update',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { name, designation, department } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    await pool.query(
      'UPDATE users SET name = ?, designation = ?, department = ? WHERE id = ?',
      [name, designation || null, department || null, userId]
    );

    logAudit(req, {
      action: 'PROFILE_UPDATED',
      entityType: 'USER',
      entityId: userId,
      description: `User ${req.user.name} updated their profile info`,
      details: { name, designation, department },
    });

    res.json({ success: true, message: 'Profile updated successfully' });
  })
);

// PUT /api/users/profile/password
router.put(
  '/profile/password',
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const match = await bcrypt.compare(currentPassword, rows[0].password);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);

    logAudit(req, {
      action: 'PASSWORD_CHANGED',
      entityType: 'USER',
      entityId: userId,
      description: `User ${req.user.name} changed their password`,
    });

    res.json({ success: true, message: 'Password updated successfully' });
  })
);

// GET /api/users
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { search, department, roleId } = req.query;

    let sql = `SELECT u.id as userId, u.name, u.email, u.employeeId, u.designation, u.department, u.roleId,
                      r.roleName, t.fromTime, t.toTime, u.created_at
               FROM users u
               LEFT JOIN roles r ON r.id = u.roleId
               LEFT JOIN timings t ON t.userId = u.id
               WHERE 1 = 1`;
    const params = [];

    if (search) {
      sql += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.employeeId LIKE ? OR u.designation LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (department) {
      sql += ` AND u.department = ?`;
      params.push(department);
    }
    if (roleId) {
      sql += ` AND u.roleId = ?`;
      params.push(Number(roleId));
    }

    sql += ` ORDER BY u.name ASC`;

    const [rows] = await pool.query(sql, params);
    const result = rows.map((r) => ({
      userId: r.userId,
      id: r.userId,
      name: r.name,
      email: r.email,
      employeeId: r.employeeId || `EMP-${r.userId}`,
      designation: r.designation || 'Staff',
      department: r.department || 'General',
      roleId: r.roleId || 3,
      roleName: r.roleName || 'Employee',
      fromTime: r.fromTime || DEFAULT_TIMING.fromTime,
      toTime: r.toTime || DEFAULT_TIMING.toTime,
      created_at: r.created_at,
    }));
    res.json(result);
  })
);

// POST /api/users (Create new employee - Admin / HR only)
router.post(
  '/',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const {
      name,
      email,
      password,
      employeeId,
      designation,
      department,
      roleId = 3,
      fromTime = '09:00:00',
      toTime = '18:00:00',
      annualQuota = 18.0,
      monthlyAccrual = 1.5,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'An employee with this email already exists' });
    }

    const rawPassword = password || 'emp123';
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const finalEmpId = employeeId || `EMP-${Date.now().toString().slice(-4)}`;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [userResult] = await conn.query(
        `INSERT INTO users (name, email, password, employeeId, designation, department, roleId, tenantId)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          name.trim(),
          cleanEmail,
          hashedPassword,
          finalEmpId,
          designation || 'Staff',
          department || 'General',
          Number(roleId) || 3,
        ]
      );

      const newUserId = userResult.insertId;

      // Insert timing
      await conn.query(
        `INSERT INTO timings (userId, fromTime, toTime) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE fromTime = VALUES(fromTime), toTime = VALUES(toTime)`,
        [newUserId, fromTime, toTime]
      );

      // Seed 7 day schedule
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      for (const d of days) {
        const isWork = d !== 'Sunday';
        const start = isWork ? (d === 'Saturday' ? '10:00:00' : fromTime) : '00:00:00';
        const end = isWork ? (d === 'Saturday' ? '14:00:00' : toTime) : '00:00:00';
        await conn.query(
          `INSERT INTO user_day_timings (userId, dayOfWeek, isWorkingDay, fromTime, toTime, lateGraceMinutes)
           VALUES (?, ?, ?, ?, ?, 15)`,
          [newUserId, d, isWork, start, end]
        );
      }

      // Seed user leave policy
      await conn.query(
        `INSERT INTO user_leave_policies (userId, annualQuota, monthlyAccrual, sickLeaves, casualLeaves)
         VALUES (?, ?, ?, 6.0, 12.0)`,
        [newUserId, Number(annualQuota) || 18.0, Number(monthlyAccrual) || 1.5]
      );

      // Seed current year default leave balances
      const currentYear = new Date().getFullYear();
      const perMonth = (Number(annualQuota) || 18.0) / 12;
      for (let m = 1; m <= 12; m++) {
        await conn.query(
          `INSERT INTO leave_balances (userId, month, year, leaves, alloted, carried, used)
           VALUES (?, ?, ?, ?, ?, 0, 0)`,
          [newUserId, m, currentYear, perMonth, perMonth]
        );
      }

      await conn.commit();

      logAudit(req, {
        action: 'USER_CREATED',
        entityType: 'USER',
        entityId: newUserId,
        description: `Created new employee "${name.trim()}" (${finalEmpId}) in ${department || 'General'}`,
        details: { name: name.trim(), email: cleanEmail, employeeId: finalEmpId, designation, department, roleId },
      });

      res.status(201).json({
        success: true,
        message: 'Employee added successfully with customized schedule and leave policy',
        userId: newUserId,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// GET /api/users/:userId/schedule (7-Day Custom Work Schedule)
router.get(
  '/:userId/schedule',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);

    // Non-admin/HR users can only access their own schedule
    if (req.user.roleId === 3 && req.user.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [rows] = await pool.query(
      `SELECT dayOfWeek, isWorkingDay, fromTime, toTime, lateGraceMinutes, halfDayMinutes
       FROM user_day_timings
       WHERE userId = ?
       ORDER BY FIELD(dayOfWeek, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
      [userId]
    );

    if (rows.length === 0) {
      // Return defaults
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      return res.json(
        days.map((d) => ({
          dayOfWeek: d,
          isWorkingDay: d !== 'Sunday',
          fromTime: d === 'Saturday' ? '10:00:00' : '09:00:00',
          toTime: d === 'Saturday' ? '14:00:00' : '18:00:00',
          lateGraceMinutes: 15,
          halfDayMinutes: 240,
        }))
      );
    }

    res.json(
      rows.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        isWorkingDay: Boolean(r.isWorkingDay),
        fromTime: r.fromTime || '09:00:00',
        toTime: r.toTime || '18:00:00',
        lateGraceMinutes: Number(r.lateGraceMinutes) || 15,
        halfDayMinutes: Number(r.halfDayMinutes) || 240,
      }))
    );
  })
);

// PUT /api/users/:userId/schedule (Save 7-Day Custom Work Schedule - Admin / HR only)
router.put(
  '/:userId/schedule',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const { schedule } = req.body;

    if (!Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({ success: false, message: 'Schedule array is required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const s of schedule) {
        if (!s.dayOfWeek) continue;
        await conn.query(
          `INSERT INTO user_day_timings (userId, dayOfWeek, isWorkingDay, fromTime, toTime, lateGraceMinutes, halfDayMinutes)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             isWorkingDay = VALUES(isWorkingDay),
             fromTime = VALUES(fromTime),
             toTime = VALUES(toTime),
             lateGraceMinutes = VALUES(lateGraceMinutes),
             halfDayMinutes = VALUES(halfDayMinutes)`,
          [
            userId,
            s.dayOfWeek,
            Boolean(s.isWorkingDay),
            s.fromTime || '09:00:00',
            s.toTime || '18:00:00',
            Number(s.lateGraceMinutes) || 15,
            Number(s.halfDayMinutes) || 240,
          ]
        );
      }

      // Sync Monday timing with timings table
      const mon = schedule.find((d) => d.dayOfWeek === 'Monday');
      if (mon && mon.isWorkingDay) {
        await conn.query(
          `INSERT INTO timings (userId, fromTime, toTime) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE fromTime = VALUES(fromTime), toTime = VALUES(toTime)`,
          [userId, mon.fromTime, mon.toTime]
        );
      }

      await conn.commit();

      logAudit(req, {
        action: 'SCHEDULE_UPDATED',
        entityType: 'SCHEDULE',
        entityId: userId,
        description: `Updated 7-day weekly work schedule for employee ID: ${userId}`,
        details: { schedule },
      });

      res.json({ success: true, message: 'Custom weekly schedule saved successfully' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// GET /api/users/:userId/holidays (Custom User Holidays)
router.get(
  '/:userId/holidays',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);

    // Non-admin/HR users can only access their own holidays
    if (req.user.roleId === 3 && req.user.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [rows] = await pool.query(
      'SELECT id, holidayDate, title, isOptional FROM user_holidays WHERE userId = ? ORDER BY holidayDate ASC',
      [userId]
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        holidayDate: String(r.holidayDate).slice(0, 10),
        title: r.title,
        isOptional: Boolean(r.isOptional),
      }))
    );
  })
);

// POST /api/users/:userId/holidays (Add Custom User Holiday - Admin / HR only)
router.post(
  '/:userId/holidays',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const { holidayDate, title, isOptional } = req.body;

    if (!holidayDate) {
      return res.status(400).json({ success: false, message: 'holidayDate is required' });
    }

    const dateStr = String(holidayDate).slice(0, 10);
    await pool.query(
      `INSERT INTO user_holidays (userId, holidayDate, title, isOptional)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), isOptional = VALUES(isOptional)`,
      [userId, dateStr, title || 'Custom Holiday', Boolean(isOptional)]
    );

    logAudit(req, {
      action: 'USER_HOLIDAY_ADDED',
      entityType: 'HOLIDAY',
      entityId: userId,
      description: `Added personal holiday "${title || 'Custom Holiday'}" on ${dateStr} for employee ID: ${userId}`,
      details: { holidayDate: dateStr, title, isOptional },
    });

    res.json({ success: true, message: 'User holiday added successfully' });
  })
);

// DELETE /api/users/:userId/holidays/:id (Remove Custom User Holiday - Admin / HR only)
router.delete(
  '/:userId/holidays/:holidayId',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const holidayId = Number(req.params.holidayId);

    const [result] = await pool.query(
      'DELETE FROM user_holidays WHERE id = ? AND userId = ?',
      [holidayId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }

    logAudit(req, {
      action: 'USER_HOLIDAY_DELETED',
      entityType: 'HOLIDAY',
      entityId: userId,
      description: `Removed custom holiday ID: ${holidayId} for employee ID: ${userId}`,
    });

    res.json({ success: true, message: 'User holiday removed successfully' });
  })
);

// GET /api/users/:userId/leave-policy (Custom Leave Policy & Balances)
router.get(
  '/:userId/leave-policy',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);

    // Non-admin/HR users can only access their own policy
    if (req.user.roleId === 3 && req.user.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [policyRows] = await pool.query(
      'SELECT annualQuota, monthlyAccrual, sickLeaves, casualLeaves, earnedLeaves, carryForwardMax, fyStartMonth FROM user_leave_policies WHERE userId = ?',
      [userId]
    );

    const year = new Date().getFullYear();
    const [balRows] = await pool.query(
      'SELECT month, leaves, alloted, carried, used FROM leave_balances WHERE userId = ? AND year = ? ORDER BY month',
      [userId, year]
    );

    const policy = policyRows[0] || {
      annualQuota: 33.0,
      monthlyAccrual: 2.75,
      sickLeaves: 6.0,
      casualLeaves: 12.0,
      earnedLeaves: 15.0,
      carryForwardMax: 10.0,
      fyStartMonth: 4,
    };

    res.json({
      policy: {
        annualQuota: Number(policy.annualQuota) || 33.0,
        monthlyAccrual: Number(policy.monthlyAccrual) || 2.75,
        sickLeaves: Number(policy.sickLeaves) || 6.0,
        casualLeaves: Number(policy.casualLeaves) || 12.0,
        earnedLeaves: Number(policy.earnedLeaves) || 15.0,
        carryForwardMax: Number(policy.carryForwardMax) || 10.0,
        fyStartMonth: Number(policy.fyStartMonth) || 4,
      },
      balances: balRows.map((b) => ({
        month: b.month,
        monthName: MONTH_NAMES[b.month - 1] || `Month ${b.month}`,
        leaves: Number(b.leaves) || 0,
        alloted: Number(b.alloted) || 0,
        carried: Number(b.carried) || 0,
        used: Number(b.used) || 0,
      })),
    });
  })
);

// PUT /api/users/:userId/leave-policy (Update Custom Leave Policy & Balances - Admin / HR only)
router.put(
  '/:userId/leave-policy',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const { policy, balances } = req.body;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (policy) {
        const cl = Number(policy.casualLeaves) || 12.0;
        const sl = Number(policy.sickLeaves) || 6.0;
        const el = Number(policy.earnedLeaves) || 15.0;
        const total = Number(policy.annualQuota) || (cl + sl + el);
        const monthly = Number(policy.monthlyAccrual) || Number((total / 12).toFixed(2));
        const carryMax = Number(policy.carryForwardMax) || 10.0;

        await conn.query(
          `INSERT INTO user_leave_policies (userId, annualQuota, monthlyAccrual, sickLeaves, casualLeaves, earnedLeaves, carryForwardMax, fyStartMonth)
           VALUES (?, ?, ?, ?, ?, ?, ?, 4)
           ON DUPLICATE KEY UPDATE
             annualQuota = VALUES(annualQuota),
             monthlyAccrual = VALUES(monthlyAccrual),
             sickLeaves = VALUES(sickLeaves),
             casualLeaves = VALUES(casualLeaves),
             earnedLeaves = VALUES(earnedLeaves),
             carryForwardMax = VALUES(carryForwardMax)`,
          [userId, total, monthly, sl, cl, el, carryMax]
        );

        // Update current FY leave type balances
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
        const currentFY = `${startYear}-${startYear + 1}`;

        await conn.query(
          `INSERT INTO user_leave_type_balances (userId, tenantId, financialYear, leaveTypeCode, allotted, carried, used)
           VALUES (?, 1, ?, 'CL', ?, 0, 0)
           ON DUPLICATE KEY UPDATE allotted = VALUES(allotted)`,
          [userId, currentFY, cl]
        );
        await conn.query(
          `INSERT INTO user_leave_type_balances (userId, tenantId, financialYear, leaveTypeCode, allotted, carried, used)
           VALUES (?, 1, ?, 'SL', ?, 0, 0)
           ON DUPLICATE KEY UPDATE allotted = VALUES(allotted)`,
          [userId, currentFY, sl]
        );
        await conn.query(
          `INSERT INTO user_leave_type_balances (userId, tenantId, financialYear, leaveTypeCode, allotted, carried, used)
           VALUES (?, 1, ?, 'EL', ?, 0, 0)
           ON DUPLICATE KEY UPDATE allotted = VALUES(allotted)`,
          [userId, currentFY, el]
        );
      }

      if (Array.isArray(balances)) {
        const year = new Date().getFullYear();
        for (const b of balances) {
          const m = Number(b.month);
          if (!m || m < 1 || m > 12) continue;
          await conn.query(
            `INSERT INTO leave_balances (userId, month, year, leaves, alloted, carried, used)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               leaves = VALUES(leaves),
               alloted = VALUES(alloted),
               carried = VALUES(carried),
               used = VALUES(used)`,
            [
              userId,
              m,
              year,
              Number(b.leaves) || 0,
              Number(b.alloted) || 0,
              Number(b.carried) || 0,
              Number(b.used) || 0,
            ]
          );
        }
      }

      await conn.commit();

      logAudit(req, {
        action: 'LEAVE_POLICY_UPDATED',
        entityType: 'LEAVE',
        entityId: userId,
        description: `Updated customized leave quotas (CL: ${policy?.casualLeaves}, SL: ${policy?.sickLeaves}, EL: ${policy?.earnedLeaves}) for employee ID: ${userId}`,
        details: { policy },
      });

      res.json({ success: true, message: 'Custom leave policy and balances updated successfully' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
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

// PUT /api/users/timings  { userId, fromTime, toTime } - Admin / HR only
router.put(
  '/timings',
  requireAdminOrHR,
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

    logAudit(req, {
      action: 'TIMINGS_UPDATED',
      entityType: 'SCHEDULE',
      entityId: userId,
      description: `Updated shift timings (${fromTime} - ${toTime}) for employee ID: ${userId}`,
    });

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
      `SELECT id as userId, name, employeeId, department, designation FROM users ORDER BY name`
    );
    const [entries] = await pool.query(
      `SELECT a.userId, DATE_FORMAT(a.datetime, '%H:%i:%s') as entry, a.status, a.entryType
       FROM attendance a
       WHERE DATE(a.datetime) = ?
       ORDER BY a.datetime ASC`,
      [today]
    );

    const byUser = {};
    entries.forEach((e) => {
      if (!byUser[e.userId]) byUser[e.userId] = [];
      byUser[e.userId].push({ entry: e.entry, status: e.status, entryType: e.entryType });
    });

    const result = [];
    for (const u of users) {
      const userEntries = byUser[u.userId] || [];
      const timing = await getUserTiming(u.userId, today);
      const isPresent = userEntries.length > 0;
      const firstEntry = userEntries[0]?.entry || null;
      const lastEntry = userEntries.length > 1 ? userEntries[userEntries.length - 1]?.entry : null;

      result.push({
        userId: u.userId,
        name: u.name,
        employeeId: u.employeeId,
        department: u.department,
        designation: u.designation,
        entries: userEntries,
        isPresent,
        firstEntry,
        lastEntry,
        from_to_time: timing,
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
      `SELECT a.userId, a.datetime as punches, u.employeeId, u.name, u.department
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
        department: r.department,
        punches: toIso(r.punches),
      }))
    );
  })
);

// GET /api/users/:userId (Get employee profile details)
router.get(
  '/:userId',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);

    // Non-admin/HR users can only access their own profile
    if (req.user.roleId === 3 && req.user.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [rows] = await pool.query(
      `SELECT u.id as userId, u.name, u.email, u.employeeId, u.designation, u.department, u.roleId,
              r.roleName, t.fromTime, t.toTime, u.created_at
       FROM users u
       LEFT JOIN roles r ON r.id = u.roleId
       LEFT JOIN timings t ON t.userId = u.id
       WHERE u.id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];
    const currentYear = new Date().getFullYear();

    // Leave balances & policy
    const [leaves] = await pool.query(
      `SELECT COALESCE(SUM(leaves), 0) as totalLeaves FROM leave_balances WHERE userId = ? AND year = ?`,
      [userId, currentYear]
    );

    const [policy] = await pool.query(
      `SELECT annualQuota, monthlyAccrual, sickLeaves, casualLeaves FROM user_leave_policies WHERE userId = ?`,
      [userId]
    );

    // Salary Structure
    const [salary] = await pool.query(
      `SELECT id, basicSalary, hra, da FROM salary_structures WHERE userId = ?`,
      [userId]
    );

    // Recent punches (last 10)
    const [recentPunches] = await pool.query(
      `SELECT id, datetime, entryType, status, rawLine FROM attendance WHERE userId = ? ORDER BY datetime DESC LIMIT 10`,
      [userId]
    );

    res.json({
      ...user,
      totalLeaves: Number(leaves[0]?.totalLeaves) || 0,
      leavePolicy: policy[0] || null,
      salaryStructure: salary[0] || null,
      recentPunches: recentPunches.map((p) => ({
        id: p.id,
        datetime: toIso(p.datetime),
        entryType: p.entryType,
        status: p.status,
      })),
    });
  })
);

// PUT /api/users/:userId (Update employee - Admin / HR only)
router.put(
  '/:userId',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const { name, email, employeeId, designation, department, roleId, password, fromTime, toTime } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let sql = `UPDATE users SET name = ?, email = ?, employeeId = ?, designation = ?, department = ?, roleId = ?`;
      const params = [
        name.trim(),
        String(email).trim().toLowerCase(),
        employeeId || null,
        designation || null,
        department || null,
        Number(roleId) || 3,
      ];

      if (password && password.trim().length > 0) {
        const hashed = await bcrypt.hash(password.trim(), 10);
        sql += `, password = ?`;
        params.push(hashed);
      }

      sql += ` WHERE id = ?`;
      params.push(userId);

      await conn.query(sql, params);

      if (fromTime && toTime) {
        await conn.query(
          `INSERT INTO timings (userId, fromTime, toTime) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE fromTime = VALUES(fromTime), toTime = VALUES(toTime)`,
          [userId, fromTime, toTime]
        );
      }

      await conn.commit();

      logAudit(req, {
        action: 'USER_UPDATED',
        entityType: 'USER',
        entityId: userId,
        description: `Updated employee "${name.trim()}" (ID: ${userId}) profile details`,
        details: { name: name.trim(), email: String(email).trim().toLowerCase(), designation, department, roleId },
      });

      res.json({ success: true, message: 'Employee updated successfully' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// DELETE /api/users/:userId (Delete employee - Admin only)
router.delete(
  '/:userId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);

    // Prevent deleting main admin (id: 1)
    if (userId === 1) {
      return res.status(400).json({ success: false, message: 'Default System Administrator cannot be deleted' });
    }

    const [rows] = await pool.query('SELECT name, employeeId FROM users WHERE id = ?', [userId]);
    const empName = rows[0]?.name || `ID ${userId}`;

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    logAudit(req, {
      action: 'USER_DELETED',
      entityType: 'USER',
      entityId: userId,
      description: `Deleted employee "${empName}" (ID: ${userId})`,
    });

    res.json({ success: true, message: 'Employee deleted successfully' });
  })
);

// GET /api/users/:userId/attendance
router.get(
  '/:userId/attendance',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);

    // Non-admin/HR users can only access their own attendance
    if (req.user.roleId === 3 && req.user.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [rows] = await pool.query(
      'SELECT datetime FROM attendance WHERE userId = ? ORDER BY datetime ASC',
      [userId]
    );
    const timing = await getUserTiming(userId, todayStr());
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

    // Non-admin/HR users can only access their own monthly attendance
    if (req.user.roleId === 3 && req.user.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

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
