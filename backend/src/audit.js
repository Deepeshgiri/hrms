import { pool } from './db.js';

const ROLE_NAMES = {
  1: 'Admin',
  2: 'HR Manager',
  3: 'Employee',
  4: 'Finance',
};

/**
 * Logs an action to the audit_logs table.
 * Asynchronous & non-blocking so failures will not interrupt business logic.
 */
export async function logAudit(req, { action, entityType, entityId = null, description, details = null }) {
  try {
    const user = req?.user || {};
    const userId = user.userId || user.id || null;
    const userName = user.name || 'System / Anonymous';
    const userEmail = user.email || null;
    const userRole = user.roleName || ROLE_NAMES[user.roleId] || 'User';

    const ipAddress =
      req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      '127.0.0.1';

    const userAgent = (req?.headers?.['user-agent'] || '').slice(0, 255);

    const jsonDetails = details ? JSON.stringify(details) : null;

    await pool.query(
      `INSERT INTO audit_logs (userId, userName, userEmail, userRole, action, entityType, entityId, description, details, ipAddress, userAgent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userName,
        userEmail,
        userRole,
        action,
        entityType,
        entityId ? String(entityId) : null,
        description,
        jsonDetails,
        ipAddress,
        userAgent,
      ]
    );
  } catch (err) {
    console.error('Audit logging error:', err.message);
  }
}
