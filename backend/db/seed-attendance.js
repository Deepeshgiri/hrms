import mysql from 'mysql2/promise';
import { config } from 'dotenv';

config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'hrms',
  password: process.env.DB_PASSWORD || 'hrms123',
  database: process.env.DB_NAME || 'hrms',
  waitForConnections: true,
});

const DAYS = 35;
const pad = (n) => String(n).padStart(2, '0');

function punchDate(offsetDays, hour, minute = 0, second = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

async function seed() {
  const [users] = await pool.query('SELECT id, employeeId FROM users');

  const values = [];
  const balanceValues = [];

  const year = new Date().getFullYear();
  const monthNames = {};

  for (let u = 0; u < users.length; u++) {
    const { id, employeeId } = users[u];

    for (let d = 0; d <= DAYS; d++) {
      const weekday = new Date();
      weekday.setDate(weekday.getDate() - d);
      const dow = weekday.getDay();
      if (dow === 0) continue; // skip Sundays

      const baseHour = u % 4 === 0 ? 8 : 9; // some early birds
      const inMinute = (u * 7 + d * 3) % 45;

      // 60% chance of a lunch/break punch
      const breakPunch = Math.random() < 0.6;

      values.push([
        id,
        punchDate(d, baseHour, inMinute),
        'machine',
        'DS-1001',
        employeeId,
        `device DS-1001 user ${employeeId} ${punchDate(d, baseHour, inMinute)}`,
        'in',
      ]);
      if (breakPunch) {
        values.push([
          id,
          punchDate(d, 13, 0),
          'machine',
          'DS-1001',
          employeeId,
          `device DS-1001 user ${employeeId}`,
          'break',
        ]);
        values.push([
          id,
          punchDate(d, 14, 0),
          'machine',
          'DS-1001',
          employeeId,
          `device DS-1001 user ${employeeId}`,
          'break',
        ]);
      }
      values.push([
        id,
        punchDate(d, 18, 5 + u),
        'machine',
        'DS-1001',
        employeeId,
        `device DS-1001 user ${employeeId}`,
        'out',
      ]);
    }

    for (let m = 1; m <= 12; m++) {
      balanceValues.push([id, m, year, 2, 2, 0, 0]);
    }
  }

  const insertPunches = `INSERT INTO attendance
    (userId, datetime, entryType, deviceSN, enrollId, rawLine, status) VALUES ?`;

  const chunks = [];
  for (let i = 0; i < values.length; i += 500) {
    chunks.push(values.slice(i, i + 500));
  }
  for (const chunk of chunks) {
    await pool.query(insertPunches, [chunk]);
  }

  await pool.query(
    `INSERT INTO leave_balances (userId, month, year, leaves, alloted, carried, used) VALUES ?
     ON DUPLICATE KEY UPDATE leaves = VALUES(leaves), alloted = VALUES(alloted), carried = VALUES(carried), used = VALUES(used)`,
    [balanceValues]
  );

  console.log(`Seeded ${values.length} attendance punches and ${balanceValues.length} leave balances.`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
