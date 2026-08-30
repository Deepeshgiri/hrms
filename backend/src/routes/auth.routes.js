import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { signToken } from '../auth.js';
import { asyncHandler } from '../helpers.js';
import { getUserEffectivePermissions } from '../permissions.js';

const router = express.Router();

// POST /api/login  { email, password }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.password, u.employeeId, u.designation, u.department, u.roleId, u.tenantId,
              t.name as tenantName, t.subdomain as tenantSubdomain, r.roleName
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenantId
       LEFT JOIN roles r ON r.id = u.roleId
       WHERE u.email = ? LIMIT 1`,
      [String(email).toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];

    const match = await bcrypt.compare(String(password), user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken(user);
    const { password: _pwd, ...safeUser } = user;

    // Fetch user's effective permissions (Base Role Perms + Individual Overrides)
    const { effectivePermissions, isSuperAdmin } = await getUserEffectivePermissions(
      user.id,
      user.roleId,
      user.tenantId || 1
    );

    res.json({
      success: true,
      token,
      tenantId: user.tenantId || 1,
      tenant: {
        id: user.tenantId || 1,
        name: user.tenantName || 'HRMS Enterprise',
        subdomain: user.tenantSubdomain || 'hq',
      },
      permissions: effectivePermissions,
      isSuperAdmin,
      user: {
        ...safeUser,
        permissions: effectivePermissions,
      },
    });
  })
);

export default router;
