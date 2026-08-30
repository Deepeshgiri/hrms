import { pool } from '../db.js';

async function migrate() {
  console.log('Running Multi-Tenant & Custom Roles/Permissions Migration...');

  // 1. Create tenants table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      subdomain VARCHAR(100) NOT NULL UNIQUE,
      plan VARCHAR(50) DEFAULT 'Enterprise',
      status ENUM('active', 'suspended', 'trial') DEFAULT 'active',
      logo VARCHAR(255) NULL,
      settings JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created tenants table');

  // Seed default tenants if empty
  const [tenantRows] = await pool.query('SELECT id FROM tenants');
  if (tenantRows.length === 0) {
    await pool.query(`
      INSERT INTO tenants (id, name, subdomain, plan, status) VALUES
      (1, 'HRMS Enterprise (HQ)', 'hq', 'Enterprise', 'active'),
      (2, 'Pinnacle Educare', 'pinnacle', 'Enterprise', 'active'),
      (3, 'Acme Global Corp', 'acme', 'Pro', 'active')
    `);
    console.log('✓ Seeded default tenants');
  }

  // 2. Ensure tenantId in roles table
  const [roleCols] = await pool.query("SHOW COLUMNS FROM roles LIKE 'tenantId'");
  if (roleCols.length === 0) {
    await pool.query('ALTER TABLE roles ADD COLUMN tenantId INT DEFAULT 1');
  }

  const [descCols] = await pool.query("SHOW COLUMNS FROM roles LIKE 'description'");
  if (descCols.length === 0) {
    await pool.query('ALTER TABLE roles ADD COLUMN description VARCHAR(255) NULL');
  }

  const [sysCols] = await pool.query("SHOW COLUMNS FROM roles LIKE 'isSystemRole'");
  if (sysCols.length === 0) {
    await pool.query('ALTER TABLE roles ADD COLUMN isSystemRole BOOLEAN DEFAULT TRUE');
  }

  // 3. Create permissions catalog table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      permissionKey VARCHAR(100) NOT NULL UNIQUE,
      name VARCHAR(150) NOT NULL,
      category VARCHAR(100) NOT NULL,
      description VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created permissions catalog table');

  // Seed permissions
  const PERMISSIONS = [
    // Staff & Users
    { key: 'users.view', name: 'View Staff Directory', category: 'Staff & Core', desc: 'View staff directory, profiles and departments' },
    { key: 'users.create', name: 'Create Staff Member', category: 'Staff & Core', desc: 'Onboard and add new staff members' },
    { key: 'users.edit', name: 'Edit Staff Profile', category: 'Staff & Core', desc: 'Modify employee personal and job details' },
    { key: 'users.delete', name: 'Delete Staff Member', category: 'Staff & Core', desc: 'Remove employee accounts' },
    { key: 'users.customize', name: 'Individual Customizations', category: 'Staff & Core', desc: 'Configure custom schedules, holidays, and leave quota per employee' },

    // Attendance
    { key: 'attendance.view_all', name: 'View All Attendance', category: 'Time & Attendance', desc: 'View complete attendance sheet and rosters' },
    { key: 'attendance.punch', name: 'Web Clock In/Out', category: 'Time & Attendance', desc: 'Punch attendance from web portal' },
    { key: 'attendance.manual', name: 'Manual Attendance Entry', category: 'Time & Attendance', desc: 'Add or adjust manual attendance logs' },
    { key: 'attendance.timings', name: 'Manage Shift Timings', category: 'Time & Attendance', desc: 'Set organization and weekly shift timings' },
    { key: 'attendance.reports', name: 'Attendance & HR Reports', category: 'Time & Attendance', desc: 'Generate and export attendance analytics' },

    // Leaves
    { key: 'leaves.view_all', name: 'View All Leaves', category: 'Leaves', desc: 'View organization-wide leave requests and balances' },
    { key: 'leaves.apply', name: 'Apply for Leave', category: 'Leaves', desc: 'Submit personal leave requests' },
    { key: 'leaves.approve', name: 'Approve/Reject Leaves', category: 'Leaves', desc: 'Accept or decline staff leave applications' },
    { key: 'leaves.allot', name: 'Allot Leave Quotas', category: 'Leaves', desc: 'Configure monthly and annual leave allotments' },
    { key: 'leaves.holidays', name: 'Manage Holidays', category: 'Leaves', desc: 'Create and remove company holiday dates' },

    // Payroll
    { key: 'payroll.view_all', name: 'View Payroll & Stats', category: 'Payroll', desc: 'Access organization payroll dashboard and stats' },
    { key: 'payroll.manage_salary', name: 'Manage Salary Structures', category: 'Payroll', desc: 'Set basic salary, HRA, allowances, and deductions' },
    { key: 'payroll.generate_payslips', name: 'Generate Payslips', category: 'Payroll', desc: 'Batch compute and generate monthly payslips' },
    { key: 'payroll.download_payslips', name: 'Download Payslips', category: 'Payroll', desc: 'Download official payslip PDF/HTML' },

    // Biometrics & Logs
    { key: 'biometric.manage', name: 'Manage Biometric Devices', category: 'Biometrics & Logs', desc: 'Register and manage biometric punch devices' },
    { key: 'audit.view', name: 'View Live Audit Logs', category: 'Biometrics & Logs', desc: 'Access real-time system audit logs and inspector' },
    { key: 'audit.export', name: 'Export Audit Logs', category: 'Biometrics & Logs', desc: 'Export full audit logs as CSV' },

    // Communication
    { key: 'chat.use', name: 'Team Chat & Direct Messages', category: 'Communication', desc: 'Send direct 1-to-1 messages and media' },
    { key: 'chat.create_group', name: 'Create Group Chats', category: 'Communication', desc: 'Create multi-user team groups' },
    { key: 'chat.call', name: 'WebRTC Audio & Video Calling', category: 'Communication', desc: 'Make P2P voice and video calls' },

    // Administration & Roles
    { key: 'roles.manage', name: 'Manage Roles & Permissions', category: 'Administration', desc: 'Create custom roles and configure permission matrices' },
    { key: 'tenant.manage', name: 'Manage Tenant & Organizations', category: 'Administration', desc: 'Manage organization profile and tenant settings' },
  ];

  for (const p of PERMISSIONS) {
    await pool.query(
      `INSERT INTO permissions (permissionKey, name, category, description)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), description = VALUES(description)`,
      [p.key, p.name, p.category, p.desc]
    );
  }
  console.log(`✓ Seeded ${PERMISSIONS.length} permissions`);

  // 4. Create role_permissions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT DEFAULT 1,
      roleId INT NOT NULL,
      permissionKey VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_tenant_role_perm (tenantId, roleId, permissionKey),
      INDEX idx_rp_role (roleId),
      INDEX idx_rp_tenant (tenantId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created role_permissions table');

  // 5. Create user_permissions table for Individual-level Custom Overrides
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT DEFAULT 1,
      userId INT NOT NULL,
      permissionKey VARCHAR(100) NOT NULL,
      isGranted BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_perm (tenantId, userId, permissionKey),
      INDEX idx_up_user (userId),
      INDEX idx_up_tenant (tenantId),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created user_permissions (individual overrides) table');

  // 6. Populate default role permissions for tenant 1
  const allPermKeys = PERMISSIONS.map((p) => p.key);

  // Admin (Role 1) - All permissions
  for (const k of allPermKeys) {
    await pool.query(
      `INSERT IGNORE INTO role_permissions (tenantId, roleId, permissionKey) VALUES (1, 1, ?)`,
      [k]
    );
  }

  // HR Manager (Role 2)
  const hrPerms = allPermKeys.filter(
    (k) => !k.startsWith('tenant.') && k !== 'users.delete'
  );
  for (const k of hrPerms) {
    await pool.query(
      `INSERT IGNORE INTO role_permissions (tenantId, roleId, permissionKey) VALUES (1, 2, ?)`,
      [k]
    );
  }

  // Employee (Role 3)
  const empPerms = [
    'attendance.punch',
    'leaves.apply',
    'payroll.download_payslips',
    'chat.use',
    'chat.call',
  ];
  for (const k of empPerms) {
    await pool.query(
      `INSERT IGNORE INTO role_permissions (tenantId, roleId, permissionKey) VALUES (1, 3, ?)`,
      [k]
    );
  }

  // Finance (Role 4)
  const finPerms = [
    'payroll.view_all',
    'payroll.manage_salary',
    'payroll.generate_payslips',
    'payroll.download_payslips',
    'attendance.reports',
    'attendance.punch',
    'leaves.apply',
    'chat.use',
    'chat.call',
  ];
  for (const k of finPerms) {
    await pool.query(
      `INSERT IGNORE INTO role_permissions (tenantId, roleId, permissionKey) VALUES (1, 4, ?)`,
      [k]
    );
  }

  console.log('✓ Seeded role_permissions for Admin, HR, Employee, Finance');
  console.log('\n🎉 Multi-Tenant & Granular Permission Architecture successfully migrated!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
