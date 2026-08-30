import { pool } from '../db.js';

async function migrate() {
  console.log('Running individual customizations database migration...');

  // 1. user_day_timings
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_day_timings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      dayOfWeek ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
      isWorkingDay BOOLEAN DEFAULT TRUE,
      fromTime TIME DEFAULT '09:00:00',
      toTime TIME DEFAULT '18:00:00',
      lateGraceMinutes INT DEFAULT 15,
      halfDayMinutes INT DEFAULT 240,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_day (userId, dayOfWeek),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created user_day_timings table');

  // 2. user_holidays
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_holidays (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      holidayDate DATE NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT 'Custom Holiday',
      isOptional BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_holiday (userId, holidayDate),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created user_holidays table');

  // 3. user_leave_policies
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_leave_policies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      annualQuota DECIMAL(5,1) DEFAULT 18.0,
      monthlyAccrual DECIMAL(5,1) DEFAULT 1.5,
      sickLeaves DECIMAL(5,1) DEFAULT 6.0,
      casualLeaves DECIMAL(5,1) DEFAULT 12.0,
      carryForwardMax DECIMAL(5,1) DEFAULT 5.0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_policy (userId),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✓ Created user_leave_policies table');

  // Seed default daily schedules for existing users if empty
  const [users] = await pool.query('SELECT id FROM users');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  for (const u of users) {
    // Policy
    await pool.query(`
      INSERT INTO user_leave_policies (userId, annualQuota, monthlyAccrual, sickLeaves, casualLeaves)
      VALUES (?, 18.0, 1.5, 6.0, 12.0)
      ON DUPLICATE KEY UPDATE annualQuota = annualQuota
    `, [u.id]);

    // Timings per day
    for (const d of days) {
      const isWork = d !== 'Sunday';
      const fromTime = isWork ? (d === 'Saturday' ? '10:00:00' : '09:00:00') : '00:00:00';
      const toTime = isWork ? (d === 'Saturday' ? '14:00:00' : '18:00:00') : '00:00:00';
      await pool.query(`
        INSERT INTO user_day_timings (userId, dayOfWeek, isWorkingDay, fromTime, toTime, lateGraceMinutes)
        VALUES (?, ?, ?, ?, ?, 15)
        ON DUPLICATE KEY UPDATE isWorkingDay = VALUES(isWorkingDay)
      `, [u.id, d, isWork, fromTime, toTime]);
    }
  }

  console.log('✓ Successfully seeded day-by-day schedules & policies for all users');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
