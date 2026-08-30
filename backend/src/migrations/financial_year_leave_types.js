import { pool } from '../db.js';

async function migrate() {
  console.log('Running Financial Year & Granular Leave Types Migration...');

  // 1. Create leave_types table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(255) NULL,
      defaultDays DECIMAL(5, 2) NOT NULL DEFAULT 12.00,
      isCarryForwardable BOOLEAN NOT NULL DEFAULT FALSE,
      maxCarryForward DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
      colorCode VARCHAR(20) NOT NULL DEFAULT '#10b981',
      icon VARCHAR(50) NOT NULL DEFAULT 'beach_access',
      paid BOOLEAN NOT NULL DEFAULT TRUE,
      status ENUM('active', 'inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created leave_types table');

  // Seed default leave types
  const LEAVE_TYPES = [
    {
      code: 'CL',
      name: 'Casual Leave',
      description: 'For personal matters, unplanned events, or family emergencies',
      defaultDays: 12.0,
      isCarryForwardable: false,
      maxCarryForward: 0.0,
      colorCode: '#10b981',
      icon: 'nature_people',
    },
    {
      code: 'SL',
      name: 'Sick Leave',
      description: 'For illness, medical checkups, or medical recovery',
      defaultDays: 6.0,
      isCarryForwardable: false,
      maxCarryForward: 0.0,
      colorCode: '#0284c7',
      icon: 'healing',
    },
    {
      code: 'EL',
      name: 'Earned Leave / Privilege Leave',
      description: 'Accrued annual vacation leave; eligible for year-end carry forward',
      defaultDays: 15.0,
      isCarryForwardable: true,
      maxCarryForward: 10.0,
      colorCode: '#8b5cf6',
      icon: 'flight_takeoff',
    },
    {
      code: 'COMP',
      name: 'Compensatory Off',
      description: 'Credits for working on weekends, holidays, or overtime shifts',
      defaultDays: 0.0,
      isCarryForwardable: false,
      maxCarryForward: 0.0,
      colorCode: '#f59e0b',
      icon: 'stars',
    },
    {
      code: 'ML',
      name: 'Maternity / Paternity Leave',
      description: 'Parental leave for childbirth and childcare',
      defaultDays: 90.0,
      isCarryForwardable: false,
      maxCarryForward: 0.0,
      colorCode: '#ec4899',
      icon: 'child_care',
    },
  ];

  for (const lt of LEAVE_TYPES) {
    await pool.query(
      `INSERT INTO leave_types (code, name, description, defaultDays, isCarryForwardable, maxCarryForward, colorCode, icon)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description),
                               defaultDays = VALUES(defaultDays), isCarryForwardable = VALUES(isCarryForwardable),
                               maxCarryForward = VALUES(maxCarryForward), colorCode = VALUES(colorCode), icon = VALUES(icon)`,
      [lt.code, lt.name, lt.description, lt.defaultDays, lt.isCarryForwardable, lt.maxCarryForward, lt.colorCode, lt.icon]
    );
  }
  console.log(`✓ Seeded ${LEAVE_TYPES.length} standard leave types`);

  // 2. Create user_leave_type_balances table for Financial Year tracking
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_leave_type_balances (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      tenantId INT DEFAULT 1,
      financialYear VARCHAR(20) NOT NULL,
      leaveTypeCode VARCHAR(20) NOT NULL,
      allotted DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
      carried DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
      used DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_fy_type (userId, financialYear, leaveTypeCode),
      INDEX idx_ultb_user (userId),
      INDEX idx_ultb_fy (financialYear),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created user_leave_type_balances table');

  // 3. Add columns to user_leave_policies if missing
  const [cols] = await pool.query("SHOW COLUMNS FROM user_leave_policies LIKE 'earnedLeaves'");
  if (cols.length === 0) {
    await pool.query('ALTER TABLE user_leave_policies ADD COLUMN earnedLeaves DECIMAL(5, 2) DEFAULT 15.00');
    console.log('✓ Added earnedLeaves column to user_leave_policies');
  }

  const [fyCols] = await pool.query("SHOW COLUMNS FROM user_leave_policies LIKE 'fyStartMonth'");
  if (fyCols.length === 0) {
    await pool.query('ALTER TABLE user_leave_policies ADD COLUMN fyStartMonth INT DEFAULT 4'); // Default April
    console.log('✓ Added fyStartMonth column to user_leave_policies');
  }

  // 4. Add leaveType column to leaves table if missing
  const [lCols] = await pool.query("SHOW COLUMNS FROM leaves LIKE 'leaveType'");
  if (lCols.length === 0) {
    await pool.query("ALTER TABLE leaves ADD COLUMN leaveType VARCHAR(50) DEFAULT 'CL'");
    console.log('✓ Added leaveType column to leaves table');
  }

  // 5. Initialize current Financial Year (FY 2026-2027) balances for all existing users
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const startYear = currentMonth >= 4 ? currentYear : currentYear - 1;
  const currentFY = `${startYear}-${startYear + 1}`;

  console.log(`Initializing leave balances for current Financial Year: ${currentFY}...`);

  const [users] = await pool.query('SELECT id, tenantId FROM users');
  for (const u of users) {
    // Check or insert policy
    const [pRows] = await pool.query('SELECT * FROM user_leave_policies WHERE userId = ?', [u.id]);
    let policy = pRows[0];
    if (!policy) {
      await pool.query(
        `INSERT INTO user_leave_policies (userId, annualQuota, monthlyAccrual, sickLeaves, casualLeaves, earnedLeaves, carryForwardMax, fyStartMonth)
         VALUES (?, 33.00, 2.75, 6.00, 12.00, 15.00, 10.00, 4)`,
        [u.id]
      );
      policy = { sickLeaves: 6, casualLeaves: 12, earnedLeaves: 15, carryForwardMax: 10 };
    }

    const clAllotted = Number(policy.casualLeaves) || 12.0;
    const slAllotted = Number(policy.sickLeaves) || 6.0;
    const elAllotted = Number(policy.earnedLeaves) || 15.0;

    // Seed CL
    await pool.query(
      `INSERT INTO user_leave_type_balances (userId, tenantId, financialYear, leaveTypeCode, allotted, carried, used)
       VALUES (?, ?, ?, 'CL', ?, 0, 0)
       ON DUPLICATE KEY UPDATE allotted = VALUES(allotted)`,
      [u.id, u.tenantId || 1, currentFY, clAllotted]
    );

    // Seed SL
    await pool.query(
      `INSERT INTO user_leave_type_balances (userId, tenantId, financialYear, leaveTypeCode, allotted, carried, used)
       VALUES (?, ?, ?, 'SL', ?, 0, 0)
       ON DUPLICATE KEY UPDATE allotted = VALUES(allotted)`,
      [u.id, u.tenantId || 1, currentFY, slAllotted]
    );

    // Seed EL
    await pool.query(
      `INSERT INTO user_leave_type_balances (userId, tenantId, financialYear, leaveTypeCode, allotted, carried, used)
       VALUES (?, ?, ?, 'EL', ?, 0, 0)
       ON DUPLICATE KEY UPDATE allotted = VALUES(allotted)`,
      [u.id, u.tenantId || 1, currentFY, elAllotted]
    );
  }

  console.log(`✓ Initialized ${currentFY} leave type balances for ${users.length} users`);
  console.log('\n🎉 Financial Year & Leave Types Database Migration Complete!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
