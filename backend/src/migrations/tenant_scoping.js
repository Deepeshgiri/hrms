import { pool } from '../db.js';

async function migrate() {
  console.log('Running Multi-Tenant Data Scoping Migration...');

  // 1. Add tenantId column to all user-owned tables (idempotent)
  const childTables = [
    { table: 'timings', joinCol: 'userId' },
    { table: 'attendance', joinCol: 'userId' },
    { table: 'leaves', joinCol: 'userId' },
    { table: 'leave_balances', joinCol: 'userId' },
    { table: 'user_day_timings', joinCol: 'userId' },
    { table: 'user_leave_policies', joinCol: 'userId' },
    { table: 'salary_structures', joinCol: 'userId' },
    { table: 'payslips', joinCol: 'userId' },
    { table: 'biometric_devices', joinCol: null },
    { table: 'institute_holidays', joinCol: null },
    { table: 'audit_logs', joinCol: 'userId' },
  ];

  for (const { table, joinCol } of childTables) {
    const [cols] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE 'tenantId'`);
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN tenantId INT NOT NULL DEFAULT 1`);
      console.log(`✓ Added tenantId column to ${table}`);
    }

    // Backfill from owning user for user-linked tables
    if (joinCol) {
      await pool.query(
        `UPDATE ${table} c
         JOIN users u ON u.id = c.${joinCol}
         SET c.tenantId = u.tenantId
         WHERE c.tenantId = 1`
      );
    }
  }
  console.log('✓ Backfilled tenantId from owning users');

  // 2. Indexes on the hot query paths
  const indexTargets = [
    'attendance',
    'leaves',
    'leave_balances',
    'user_day_timings',
    'salary_structures',
    'payslips',
    'timings',
  ];
  for (const table of indexTargets) {
    try {
      await pool.query(
        `ALTER TABLE ${table} ADD INDEX idx_${table}_tenant (tenantId)`
      );
      console.log(`✓ Added tenant index on ${table}`);
    } catch {
      // index already exists
    }
  }

  // 3. Ensure tenants table has a token/secret? Not needed. Just verify it exists.
  const [tenantRows] = await pool.query('SELECT COUNT(*) as c FROM tenants');
  console.log(`✓ Tenant scoping migration complete (${tenantRows[0].c} tenants)`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
