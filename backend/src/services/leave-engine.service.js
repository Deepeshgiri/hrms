import { pool } from '../db.js';

/**
 * Calculates the Financial Year representation for any given date
 * Default start month is 4 (April)
 */
export function getFinancialYearInfo(date = new Date(), startMonth = 4) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12

  const startYear = month >= startMonth ? year : year - 1;
  const endYear = startYear + 1;
  const fyString = `${startYear}-${endYear}`;

  const startMonthStr = String(startMonth).padStart(2, '0');
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endMonthStr = String(endMonth).padStart(2, '0');

  // Days in end month
  const lastDay = new Date(endYear, endMonth, 0).getDate();

  return {
    fyString,
    startYear,
    endYear,
    startDate: `${startYear}-${startMonthStr}-01`,
    endDate: `${endYear}-${endMonthStr}-${String(lastDay).padStart(2, '0')}`,
    label: `FY ${fyString} (${getMonthName(startMonth)} ${startYear} - ${getMonthName(endMonth)} ${endYear})`,
  };
}

function getMonthName(m) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[m - 1] || 'Apr';
}

/**
 * Ensures that an individual employee has all leave type balances initialized for a specific Financial Year.
 * If not initialized, it automatically computes carry-forward from previous FY and allots new quotas.
 */
export async function ensureUserFinancialYearBalances(userId, tenantId = 1, targetFY = null) {
  const currentFYInfo = getFinancialYearInfo();
  const fy = targetFY || currentFYInfo.fyString;

  // Check if already initialized for this FY
  const [existing] = await pool.query(
    'SELECT * FROM user_leave_type_balances WHERE userId = ? AND financialYear = ?',
    [Number(userId), fy]
  );

  if (existing.length >= 3) {
    return existing;
  }

  // 1. Fetch user's individual leave policy
  const [pRows] = await pool.query('SELECT * FROM user_leave_policies WHERE userId = ?', [Number(userId)]);
  let policy = pRows[0];
  if (!policy) {
    await pool.query(
      `INSERT INTO user_leave_policies (userId, annualQuota, monthlyAccrual, sickLeaves, casualLeaves, earnedLeaves, carryForwardMax, fyStartMonth)
       VALUES (?, 33.00, 2.75, 6.00, 12.00, 15.00, 10.00, 4)
       ON DUPLICATE KEY UPDATE annualQuota = annualQuota`,
      [Number(userId)]
    );
    policy = { sickLeaves: 6, casualLeaves: 12, earnedLeaves: 15, carryForwardMax: 10 };
  }

  const clAllot = Number(policy.casualLeaves) || 12.0;
  const slAllot = Number(policy.sickLeaves) || 6.0;
  const elAllot = Number(policy.earnedLeaves) || 15.0;
  const maxCarry = Number(policy.carryForwardMax) || 10.0;

  // 2. Check previous Financial Year to compute carry-forward
  const [startYearStr, endYearStr] = fy.split('-');
  const prevFY = `${Number(startYearStr) - 1}-${Number(endYearStr) - 1}`;

  const [prevEL] = await pool.query(
    `SELECT allotted, carried, used FROM user_leave_type_balances WHERE userId = ? AND financialYear = ? AND leaveTypeCode = 'EL'`,
    [Number(userId), prevFY]
  );

  let carriedEL = 0.0;
  if (prevEL.length > 0) {
    const prevAvailable = Number(prevEL[0].allotted) + Number(prevEL[0].carried) - Number(prevEL[0].used);
    carriedEL = Math.min(Math.max(0, prevAvailable), maxCarry);
  }

  // 3. Insert or Update user_leave_type_balances for CL, SL, EL
  const typesToAllot = [
    { code: 'CL', allotted: clAllot, carried: 0.0 },
    { code: 'SL', allotted: slAllot, carried: 0.0 },
    { code: 'EL', allotted: elAllot, carried: carriedEL },
    { code: 'COMP', allotted: 0.0, carried: 0.0 },
  ];

  for (const t of typesToAllot) {
    await pool.query(
      `INSERT INTO user_leave_type_balances (userId, tenantId, financialYear, leaveTypeCode, allotted, carried, used)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE allotted = VALUES(allotted), carried = VALUES(carried)`,
      [Number(userId), Number(tenantId), fy, t.code, t.allotted, t.carried]
    );
  }

  // 4. Initialize monthly distribution in leave_balances for that FY year
  const startYr = Number(startYearStr);
  const monthlyAccrual = Number(((clAllot + slAllot + elAllot) / 12).toFixed(2));

  for (let m = 1; m <= 12; m++) {
    const yr = m >= 4 ? startYr : startYr + 1;
    await pool.query(
      `INSERT INTO leave_balances (userId, month, year, leaves, alloted, carried, used, tenantId)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?)
       ON DUPLICATE KEY UPDATE alloted = VALUES(alloted)`,
      [Number(userId), m, yr, monthlyAccrual, monthlyAccrual, Number(tenantId)]
    );
  }

  const [created] = await pool.query(
    'SELECT * FROM user_leave_type_balances WHERE userId = ? AND financialYear = ?',
    [Number(userId), fy]
  );
  return created;
}

/**
 * Returns detailed leave balances grouped by leave type with live used days and remaining balances
 */
export async function getUserDetailedLeaveBalances(userId, targetFY = null) {
  const fyInfo = getFinancialYearInfo();
  const fy = targetFY || fyInfo.fyString;

  // Resolve the user's tenant and ensure balances are initialized for it
  const [userRows] = await pool.query('SELECT id, tenantId FROM users WHERE id = ?', [Number(userId)]);
  const userTenantId = userRows.length > 0 ? userRows[0].tenantId || 1 : 1;

  await ensureUserFinancialYearBalances(userId, userTenantId, fy);

  // 1. Fetch catalog of active leave types
  const [types] = await pool.query('SELECT * FROM leave_types WHERE status = "active" ORDER BY id ASC');

  // 2. Fetch balances for this FY
  const [balances] = await pool.query(
    'SELECT * FROM user_leave_type_balances WHERE userId = ? AND financialYear = ?',
    [Number(userId), fy]
  );

  const balanceMap = {};
  balances.forEach((b) => {
    balanceMap[b.leaveTypeCode] = b;
  });

  // 3. Compute live usage from leaves table for this FY
  const [usageRows] = await pool.query(
    `SELECT
       COALESCE(l.leaveType, 'CL') as leaveType,
       SUM(CASE WHEN l.duration = 'H' THEN 0.5 ELSE (DATEDIFF(COALESCE(l.toDate, l.date), COALESCE(l.fromDate, l.date)) + 1) END) as usedDays
     FROM leaves l
     WHERE l.userId = ? AND l.status = 'Accepted'
       AND COALESCE(l.fromDate, l.date) >= ? AND COALESCE(l.toDate, l.date) <= ?
     GROUP BY COALESCE(l.leaveType, 'CL')`,
    [Number(userId), fyInfo.startDate, fyInfo.endDate]
  );

  const usageMap = {};
  usageRows.forEach((u) => {
    usageMap[u.leaveType] = Number(u.usedDays) || 0;
  });

  let totalAllotted = 0;
  let totalCarried = 0;
  let totalUsed = 0;
  let totalRemaining = 0;

  const leaveTypesList = types.map((t) => {
    const bal = balanceMap[t.code] || { allotted: 0, carried: 0, used: 0 };
    const allotted = Number(bal.allotted) || 0;
    const carried = Number(bal.carried) || 0;
    const totalQuota = allotted + carried;
    const used = usageMap[t.code] !== undefined ? usageMap[t.code] : Number(bal.used) || 0;
    const remaining = Math.max(0, totalQuota - used);

    totalAllotted += allotted;
    totalCarried += carried;
    totalUsed += used;
    totalRemaining += remaining;

    return {
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      colorCode: t.colorCode,
      icon: t.icon,
      isCarryForwardable: Boolean(t.isCarryForwardable),
      maxCarryForward: Number(t.maxCarryForward) || 0,
      allotted,
      carried,
      totalQuota,
      used,
      remaining,
    };
  });

  return {
    userId: Number(userId),
    financialYear: fy,
    fyLabel: fyInfo.label,
    startDate: fyInfo.startDate,
    endDate: fyInfo.endDate,
    leaveTypes: leaveTypesList,
    summary: {
      totalAllotted,
      totalCarried,
      totalQuota: totalAllotted + totalCarried,
      totalUsed,
      totalRemaining,
    },
  };
}

/**
 * Executes Annual Financial Year Reset and Rollover across all users for a tenant
 */
export async function executeFinancialYearRollover(tenantId = 1, targetFY = null) {
  const fyInfo = getFinancialYearInfo();
  const nextFY = targetFY || `${fyInfo.startYear + 1}-${fyInfo.endYear + 1}`;

  const [users] = await pool.query('SELECT id, name, tenantId FROM users WHERE tenantId = ?', [Number(tenantId)]);

  const results = [];
  let totalCarried = 0;

  for (const u of users) {
    const balances = await ensureUserFinancialYearBalances(u.id, tenantId, nextFY);
    const el = balances.find((b) => b.leaveTypeCode === 'EL');
    const carried = el ? Number(el.carried) : 0;
    totalCarried += carried;

    results.push({
      userId: u.id,
      name: u.name,
      carriedEL: carried,
      newFY: nextFY,
    });
  }

  return {
    success: true,
    targetFinancialYear: nextFY,
    usersProcessed: users.length,
    totalEarnedLeavesCarried: totalCarried,
    details: results,
  };
}
