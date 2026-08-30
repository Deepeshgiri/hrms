import express from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAdmin } from '../auth.js';
import { asyncHandler, toIso } from '../helpers.js';
import { logAudit } from '../audit.js';

const router = express.Router();
router.use(authMiddleware);

// GET /api/tenants - List all organizations/tenants
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [tenants] = await pool.query(`
      SELECT t.id, t.name, t.subdomain, t.plan, t.status, t.logo, t.created_at,
             (SELECT COUNT(*) FROM users u WHERE u.tenantId = t.id) as userCount,
             (SELECT COUNT(*) FROM roles r WHERE r.tenantId = t.id OR r.tenantId = 1) as roleCount
      FROM tenants t
      ORDER BY t.id ASC
    `);

    res.json(
      tenants.map((t) => ({
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
        plan: t.plan,
        status: t.status,
        logo: t.logo,
        userCount: Number(t.userCount) || 0,
        roleCount: Number(t.roleCount) || 0,
        created_at: toIso(t.created_at),
      }))
    );
  })
);

// GET /api/tenants/current - Get active tenant details
router.get(
  '/current',
  asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId || 1;

    const [rows] = await pool.query('SELECT * FROM tenants WHERE id = ?', [Number(tenantId)]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    const t = rows[0];
    res.json({
      id: t.id,
      name: t.name,
      subdomain: t.subdomain,
      plan: t.plan,
      status: t.status,
      logo: t.logo,
      settings: t.settings ? JSON.parse(t.settings) : {},
      created_at: toIso(t.created_at),
    });
  })
);

// POST /api/tenants - Create new Organization/Tenant (Admin only)
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, subdomain, plan = 'Enterprise' } = req.body;

    if (!name || !subdomain) {
      return res.status(400).json({ success: false, message: 'Name and subdomain are required' });
    }

    const cleanSub = String(subdomain).trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

    const [existing] = await pool.query('SELECT id FROM tenants WHERE subdomain = ?', [cleanSub]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'An organization with this subdomain already exists' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [tenantResult] = await conn.query(
        `INSERT INTO tenants (name, subdomain, plan, status) VALUES (?, ?, ?, 'active')`,
        [name.trim(), cleanSub, plan]
      );
      const newTenantId = tenantResult.insertId;

      // Copy default role_permissions from tenant 1 to new tenant
      const [defaultPerms] = await conn.query(
        `SELECT roleId, permissionKey FROM role_permissions WHERE tenantId = 1`
      );

      for (const p of defaultPerms) {
        await conn.query(
          `INSERT IGNORE INTO role_permissions (tenantId, roleId, permissionKey) VALUES (?, ?, ?)`,
          [newTenantId, p.roleId, p.permissionKey]
        );
      }

      await conn.commit();

      logAudit(req, {
        action: 'TENANT_CREATED',
        entityType: 'TENANT',
        entityId: newTenantId,
        description: `Created new organization/tenant "${name.trim()}" (${cleanSub})`,
        details: { name: name.trim(), subdomain: cleanSub, plan },
      });

      res.status(201).json({
        success: true,
        message: 'Organization created successfully',
        tenantId: newTenantId,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  })
);

// PUT /api/tenants/:id - Update tenant (Admin only)
router.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tenantId = Number(req.params.id);
    const { name, plan, status } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    await pool.query(
      `UPDATE tenants SET name = ?, plan = COALESCE(?, plan), status = COALESCE(?, status) WHERE id = ?`,
      [name.trim(), plan, status, tenantId]
    );

    logAudit(req, {
      action: 'TENANT_UPDATED',
      entityType: 'TENANT',
      entityId: tenantId,
      description: `Updated organization "${name.trim()}" (Tenant ID: ${tenantId})`,
    });

    res.json({ success: true, message: 'Organization updated successfully' });
  })
);

export default router;
