import { pool } from './db.js';

/**
 * Resolves the effective permissions for a user:
 * Base Role Permissions (tenant-scoped) + Individual User Overrides (Grant / Deny)
 */
export async function getUserEffectivePermissions(userId, roleId, tenantId = 1) {
  // If Super Admin (roleId === 1), grant all permissions
  if (Number(roleId) === 1) {
    const [allPerms] = await pool.query('SELECT permissionKey FROM permissions');
    const allKeys = allPerms.map((p) => p.permissionKey);
    return {
      rolePermissions: allKeys,
      userOverrides: {},
      effectivePermissions: allKeys,
      isSuperAdmin: true,
    };
  }

  // 1. Fetch base role permissions for this tenant (or fallback to global tenant 1)
  const [rolePermRows] = await pool.query(
    `SELECT permissionKey FROM role_permissions WHERE roleId = ? AND (tenantId = ? OR tenantId = 1)`,
    [Number(roleId), Number(tenantId)]
  );
  const rolePermissions = Array.from(new Set(rolePermRows.map((r) => r.permissionKey)));

  // 2. Fetch individual user permission overrides
  const [userOverrideRows] = await pool.query(
    `SELECT permissionKey, isGranted FROM user_permissions WHERE userId = ? AND tenantId = ?`,
    [Number(userId), Number(tenantId)]
  );

  const userOverrides = {};
  const effectiveSet = new Set(rolePermissions);

  for (const row of userOverrideRows) {
    const isGranted = Boolean(row.isGranted);
    userOverrides[row.permissionKey] = isGranted;

    if (isGranted) {
      effectiveSet.add(row.permissionKey); // Explicit grant
    } else {
      effectiveSet.delete(row.permissionKey); // Explicit deny
    }
  }

  return {
    rolePermissions,
    userOverrides,
    effectivePermissions: Array.from(effectiveSet),
    isSuperAdmin: false,
  };
}

/**
 * Checks whether a user object possesses a specific permission
 */
export function hasPermission(user, permissionKey) {
  if (!user) return false;
  if (Number(user.roleId) === 1) return true; // Superadmin bypass
  if (!user.permissions || !Array.isArray(user.permissions)) return false;
  return user.permissions.includes('*') || user.permissions.includes(permissionKey);
}

/**
 * Express Middleware factory to require a specific permission
 */
export const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Super Admin bypass
    if (Number(req.user.roleId) === 1) {
      return next();
    }

    try {
      const tenantId = req.headers['x-tenant-id'] || req.user.tenantId || 1;
      const { effectivePermissions } = await getUserEffectivePermissions(
        req.user.userId,
        req.user.roleId,
        tenantId
      );

      if (effectivePermissions.includes(permissionKey) || effectivePermissions.includes('*')) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Access denied: Missing required permission '${permissionKey}'`,
        requiredPermission: permissionKey,
      });
    } catch (err) {
      console.error('Permission check error:', err);
      return res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};
