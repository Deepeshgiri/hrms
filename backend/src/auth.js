import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'hrms-super-secret-key';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '12h';

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
  let token = req.query.token;

  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
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
