import { pool } from '../db.js';

async function migrate() {
  console.log('Running audit logs database migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      userId INT NULL,
      userName VARCHAR(255) NULL,
      userEmail VARCHAR(255) NULL,
      userRole VARCHAR(50) NULL,
      action VARCHAR(100) NOT NULL,
      entityType VARCHAR(50) NOT NULL,
      entityId VARCHAR(100) NULL,
      description TEXT NOT NULL,
      details JSON NULL,
      ipAddress VARCHAR(64) NULL,
      userAgent VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_user (userId),
      INDEX idx_audit_action (action),
      INDEX idx_audit_entity (entityType),
      INDEX idx_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log('✓ Created audit_logs table successfully');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
