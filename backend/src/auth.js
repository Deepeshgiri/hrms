import jwt from 'jsonwebtoken';

const FALLBACK_SECRET = 'hrms-super-secret-key';
export const JWT_SECRET = process.env.JWT_SECRET || FALLBACK_SECRET;
export const JWT_EXPIRES = process.env.JWT_EXPIRES || '12h';

// Fail fast in production when a default/weak secret is in use.
if (process.env.NODE_ENV === 'production' && (JWT_SECRET === FALLBACK_SECRET || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a strong value (>= 32 chars) in production');
}
if (JWT_SECRET === FALLBACK_SECRET) {
  console.warn('[auth] WARNING: Using default JWT_SECRET. Set a strong JWT_SECRET in backend/.env before production.');
}

export const signToken = (user) =>
  jwt.sign(
    {
      userId: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId || 3,
      tenantId: user.tenantId || 1,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

export const authMiddleware = (req, res, next) => {
  // Prefer the Authorization header.
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // Legacy fallback: query-string token (required for browser-direct downloads).
  // Only honoured on GET so it never appears in POST bodies/logs of mutations.
  if (!token && req.method === 'GET' && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Role-Based Access Control (RBAC) middleware factory
 * Role IDs: 1: Admin, 2: HR Manager, 3: Employee, 4: Finance
 */
export const requireRoles = (allowedRoleIds = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const userRoleId = Number(req.user.roleId);
  if (!allowedRoleIds.includes(userRoleId)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You do not have permission to access this resource',
    });
  }

  next();
};

export const requireAdmin = requireRoles([1]);
export const requireAdminOrHR = requireRoles([1, 2]);
export const requireFinanceOrAdmin = requireRoles([1, 2, 4]);
