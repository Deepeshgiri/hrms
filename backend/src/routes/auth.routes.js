import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { signToken } from '../auth.js';
import { asyncHandler } from '../helpers.js';

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
      'SELECT id, name, email, password, employeeId, designation, department, roleId, tenantId FROM users WHERE email = ? LIMIT 1',
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

    res.json({
      success: true,
      token,
      tenantId: user.tenantId,
      user: safeUser,
    });
  })
);

export default router;
