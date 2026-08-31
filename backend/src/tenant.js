/**
 * Tenant resolution helpers.
 *
 * The tenant is ALWAYS derived from the authenticated user's JWT (`req.user.tenantId`).
 * Only a super admin (roleId === 1) may impersonate another tenant via the
 * `X-Tenant-ID` header. Regular users can never escape their own tenant, even if
 * they send a forged header.
 */
export const currentTenant = (req) => {
  const userTenantId = Number(req.user?.tenantId) || 1;

  if (Number(req.user?.roleId) === 1) {
    const headerTenant = Number(req.headers['x-tenant-id']);
    if (headerTenant > 0) return headerTenant;
  }

  return userTenantId;
};

/**
 * SQL fragment asserting the current tenant scope on an alias.
 * Only aliases for tables that have a `tenantId` column are valid targets.
 */
export const tenantScope = (alias = 'u') => {
  const a = alias ? `${alias}.` : '';
  return `${a}tenantId = ?`;
};
