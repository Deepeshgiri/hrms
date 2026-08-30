import express from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAdmin, requireAdminOrHR } from '../auth.js';
import { asyncHandler, toIso } from '../helpers.js';
import { getUserEffectivePermissions } from '../permissions.js';
import { logAudit } from '../audit.js';

const router = express.Router();
router.use(authMiddleware);

// GET /api/roles/permissions/meta - Full structured catalog of all permissions
router.get(
  '/permissions/meta',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM permissions ORDER BY category, id');

    const byCategory = {};
    rows.forEach((p) => {
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push({
        id: p.id,
        key: p.permissionKey,
        name: p.name,
        category: p.category,
        description: p.description,
      });
    });

    const categories = Object.keys(byCategory).map((cat) => ({
      category: cat,
      permissions: byCategory[cat],
    }));

    res.json({
      total: rows.length,
      categories,
      allPermissions: rows,
    });
  })
);

// GET /api/roles - List all roles for active tenant
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId || 1;

    const [roles] = await pool.query(
      `SELECT r.id, r.roleName, r.description, r.isSystemRole, r.tenantId,
              (SELECT COUNT(*) FROM users u WHERE u.roleId = r.id AND (u.tenantId = ? OR u.tenantId = 1)) as memberCount
       FROM roles r
       WHERE r.tenantId = ? OR r.tenantId = 1 OR r.isSystemRole = TRUE
       ORDER BY r.id ASC`,
      [Number(tenantId), Number(tenantId)]
    );

    const result = [];

    for (const r of roles) {
      // Fetch permissions assigned to this role
      const [permRows] = await pool.query(
        `SELECT permissionKey FROM role_permissions WHERE roleId = ? AND (tenantId = ? OR tenantId = 1)`,
        [r.id, Number(tenantId)]
      );

      result.push({
        id: r.id,
        roleName: r.roleName,
        description: r.description || `${r.roleName} role`,
        isSystemRole: Boolean(r.isSystemRole),
        tenantId: r.tenantId,
        memberCount: Number(r.memberCount) || 0,
        permissions: permRows.map((p) => p.permissionKey),
        permissionsCount: permRows.length,
      });
    }

    res.json(result);
  })
);

// POST /api/roles - Create Custom Role for Tenant
router.post(
  '/',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId || 1;
    const { roleName, description, permissions = [] } = req.body;

    if (!roleName || !roleName.trim()) {
      return res.status(400).json({ success: false, message: 'roleName is required' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [roleResult] = await conn.query(
        `INSERT INTO roles (roleName, description, isSystemRole, tenantId) VALUES (?, ?, FALSE, ?)`,
        [roleName.trim(), description || '', Number(tenantId)]
      );

      const newRoleId = roleResult.insertId;

      for (const pKey of permissions) {
        if (pKey) {
          await conn.query(
            `INSERT IGNORE INTO role_permissions (tenantId, roleId, permissionKey) VALUES (?, ?, ?)`,
            [Number(tenantId), newRoleId, pKey]
          );
        }
      }

      await conn.commit();

      logAudit(req, {
        action: 'ROLE_CREATED',
        entityType: 'ROLE',
        entityId: newRoleId,
        description: `Created custom role "${roleName.trim()}" with ${permissions.length} permissions`,
        details: { roleName: roleName.trim(), description, permissions },
      });

      res.status(201).json({
        success: true,
        message: 'Custom role created successfully',
        roleId: newRoleId,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// PUT /api/roles/:id - Update Role and Permissions
router.put(
  '/:id',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const roleId = Number(req.params.id);
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId || 1;
    const { roleName, description, permissions = [] } = req.body;

    const [existing] = await pool.query('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (roleName) {
        await conn.query(
          `UPDATE roles SET roleName = ?, description = COALESCE(?, description) WHERE id = ?`,
          [roleName.trim(), description, roleId]
        );
      }

      // Replace permissions for this tenant & role
      await conn.query(
        `DELETE FROM role_permissions WHERE roleId = ? AND tenantId = ?`,
        [roleId, Number(tenantId)]
      );

      for (const pKey of permissions) {
        if (pKey) {
          await conn.query(
            `INSERT INTO role_permissions (tenantId, roleId, permissionKey) VALUES (?, ?, ?)`,
            [Number(tenantId), roleId, pKey]
          );
        }
      }

      await conn.commit();

      logAudit(req, {
        action: 'ROLE_UPDATED',
        entityType: 'ROLE',
        entityId: roleId,
        description: `Updated permissions (${permissions.length} active) for role ID: ${roleId}`,
      });

      res.json({ success: true, message: 'Role permissions updated successfully' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// DELETE /api/roles/:id - Delete Custom Role
router.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const roleId = Number(req.params.id);

    if (roleId <= 4) {
      return res.status(400).json({ success: false, message: 'Default System Roles (Admin, HR, Employee, Finance) cannot be deleted' });
    }

    const [result] = await pool.query('DELETE FROM roles WHERE id = ? AND isSystemRole = FALSE', [roleId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Role not found or cannot be deleted' });
    }

    await pool.query('DELETE FROM role_permissions WHERE roleId = ?', [roleId]);

    logAudit(req, {
      action: 'ROLE_DELETED',
      entityType: 'ROLE',
      entityId: roleId,
      description: `Deleted custom role ID: ${roleId}`,
    });

    res.json({ success: true, message: 'Custom role deleted successfully' });
  })
);

// GET /api/roles/user/:userId/permissions - Individual User Permissions & Custom Overrides
router.get(
  '/user/:userId/permissions',
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId || 1;

    const [userRows] = await pool.query('SELECT id, name, roleId, tenantId FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userRows[0];
    const permData = await getUserEffectivePermissions(user.id, user.roleId, tenantId);

    res.json({
      userId: user.id,
      userName: user.name,
      roleId: user.roleId,
      tenantId,
      ...permData,
    });
  })
);

// PUT /api/roles/user/:userId/permissions - Save Individual User Custom Permission Overrides
router.put(
  '/user/:userId/permissions',
  requireAdminOrHR,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId || 1;
    const { overrides = {} } = req.body; // { 'payroll.manage_salary': true, 'audit.view': false }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Clear existing overrides for this user & tenant
      await conn.query(
        `DELETE FROM user_permissions WHERE userId = ? AND tenantId = ?`,
        [userId, Number(tenantId)]
      );

      for (const [permKey, isGranted] of Object.entries(overrides)) {
        if (isGranted !== null && isGranted !== undefined) {
          await conn.query(
            `INSERT INTO user_permissions (tenantId, userId, permissionKey, isGranted) VALUES (?, ?, ?, ?)`,
            [Number(tenantId), userId, permKey, Boolean(isGranted)]
          );
        }
      }

      await conn.commit();

      logAudit(req, {
        action: 'USER_PERMISSIONS_OVERRIDDEN',
        entityType: 'USER',
        entityId: userId,
        description: `Configured individual permission overrides for employee ID: ${userId}`,
        details: { overrides },
      });

      res.json({ success: true, message: 'Individual employee permissions customized successfully' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

export default router;
