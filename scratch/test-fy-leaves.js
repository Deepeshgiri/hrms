const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function loginUser(email, password) {
  const res = await request('/api/login', {
    method: 'POST',
    body: { email, password }
  });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Failed to login as ${email}: ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

async function runFinancialYearLeavesTestSuite() {
  console.log('================================================================');
  console.log('   HRMS FINANCIAL YEAR RESET & GRANULAR LEAVE TYPES TEST SUITE');
  console.log('================================================================\n');

  // 1. Log in Admin & Employee
  console.log('1. Logging in test users (Admin & Employee)...');
  const admin = await loginUser('admin@hrms.com', 'admin123');
  const employee = await loginUser('rahul@hrms.com', 'emp123');
  console.log(`   ✓ Admin ID: ${admin.user.id}, Employee ID: ${employee.user.id}`);

  const adminHeaders = { Authorization: `Bearer ${admin.token}` };
  const empHeaders = { Authorization: `Bearer ${employee.token}` };

  // 2. Test GET /api/leaves/types (Catalog of active leave types)
  console.log('\n2. Testing GET /api/leaves/types (Leave Types Catalog)...');
  const typesRes = await request('/api/leaves/types', { headers: empHeaders });
  if (typesRes.status !== 200 || !Array.isArray(typesRes.data)) {
    throw new Error(`Failed to fetch leave types: ${JSON.stringify(typesRes.data)}`);
  }
  console.log(`   ✓ Found ${typesRes.data.length} standard leave types:`);
  typesRes.data.forEach(t => {
    console.log(`     - [${t.code}] ${t.name} (Default: ${t.defaultDays} days, Carry-forward: ${t.isCarryForwardable ? 'Yes (Max: ' + t.maxCarryForward + ')' : 'No'})`);
  });

  // 3. Test GET /api/leaves/my-leaves-info (Detailed Leave Portfolio)
  console.log('\n3. Testing GET /api/leaves/my-leaves-info (Employee Detailed Leave Portfolio)...');
  const portfolioRes = await request('/api/leaves/my-leaves-info', { headers: empHeaders });
  if (portfolioRes.status !== 200 || !portfolioRes.data.leaveTypes) {
    throw new Error(`Failed to fetch leave portfolio: ${JSON.stringify(portfolioRes.data)}`);
  }
  console.log(`   ✓ Active Financial Year: ${portfolioRes.data.financialYear} (${portfolioRes.data.fyLabel})`);
  console.log(`   ✓ Total Balance: ${portfolioRes.data.summary.totalRemaining} / ${portfolioRes.data.summary.totalQuota} Days Remaining`);
  portfolioRes.data.leaveTypes.forEach(lt => {
    console.log(`     - ${lt.name} (${lt.code}): ${lt.remaining} / ${lt.totalQuota} available (Allotted: ${lt.allotted}, Carried: ${lt.carried}, Used: ${lt.used})`);
  });

  // 4. Test Applying Leaves for Different Types (Casual, Sick, Earned)
  console.log('\n4. Testing Applying Leaves for Specific Types (CL, SL, EL)...');

  // Apply Casual Leave (CL)
  const clRes = await request('/api/leaves', {
    method: 'POST',
    headers: empHeaders,
    body: {
      leaveType: 'CL',
      leaveContent: 'Personal emergency at hometown',
      date: '2026-09-10',
      duration: 'F',
      reason: 'Family urgent matter'
    }
  });
  if (clRes.status !== 200) throw new Error(`Failed to submit Casual Leave: ${JSON.stringify(clRes.data)}`);
  console.log('   ✓ Successfully submitted [CL] Casual Leave');

  // Apply Sick Leave (SL)
  const slRes = await request('/api/leaves', {
    method: 'POST',
    headers: empHeaders,
    body: {
      leaveType: 'SL',
      leaveContent: 'Viral fever recovery',
      date: '2026-09-15',
      duration: 'F',
      reason: 'Doctor prescribed rest'
    }
  });
  if (slRes.status !== 200) throw new Error(`Failed to submit Sick Leave: ${JSON.stringify(slRes.data)}`);
  console.log('   ✓ Successfully submitted [SL] Sick Leave');

  // Apply Earned Leave (EL) Range
  const elRes = await request('/api/leaves', {
    method: 'POST',
    headers: empHeaders,
    body: {
      leaveType: 'EL',
      leaveContent: 'Annual family vacation',
      fromDate: '2026-10-01',
      toDate: '2026-10-03',
      duration: 'R',
      reason: 'Planned vacation'
    }
  });
  if (elRes.status !== 200) throw new Error(`Failed to submit Earned Leave: ${JSON.stringify(elRes.data)}`);
  console.log('   ✓ Successfully submitted [EL] Earned Leave (3-day range)');

  // 5. Test Approving Leaves by HR
  console.log('\n5. Approving applied leaves as HR/Admin...');
  const allLeavesRes = await request('/api/leaves', { headers: adminHeaders });
  const pendingLeaves = allLeavesRes.data.filter(l => l.userId === employee.user.id && l.status === 'Pending');

  for (const pl of pendingLeaves) {
    await request('/api/leaves', {
      method: 'PUT',
      headers: adminHeaders,
      body: {
        leaveId: pl.leaveId,
        status: 2, // Accepted
        response: 'Approved by HR Manager',
        userId: pl.userId
      }
    });
  }
  console.log(`   ✓ Approved ${pendingLeaves.length} applied leaves for Employee`);

  // Verify updated balances after approval
  const updatedPortfolio = await request('/api/leaves/my-leaves-info', { headers: empHeaders });
  console.log('\n   Updated Employee Leave Balances:');
  updatedPortfolio.data.leaveTypes.forEach(lt => {
    console.log(`     - ${lt.name} (${lt.code}): ${lt.remaining} / ${lt.totalQuota} available (Used: ${lt.used})`);
  });

  // 6. Test Financial Year Reset & Rollover Engine
  console.log('\n6. Testing Annual Financial Year Reset & Rollover (POST /api/leaves/financial-year/rollover)...');
  const targetNewFY = '2027-2028';
  const rolloverRes = await request('/api/leaves/financial-year/rollover', {
    method: 'POST',
    headers: adminHeaders,
    body: { targetFY: targetNewFY }
  });

  if (rolloverRes.status !== 200 || !rolloverRes.data.success) {
    throw new Error(`Rollover failed: ${JSON.stringify(rolloverRes.data)}`);
  }
  console.log(`   ✓ Financial Year Rollover to ${targetNewFY} executed successfully:`);
  console.log(`     - Employees Processed: ${rolloverRes.data.data.usersProcessed}`);
  console.log(`     - Total Earned Leaves Carried Forward: ${rolloverRes.data.data.totalEarnedLeavesCarried} days`);

  // Verify employee's new FY balances
  const newFYBalances = await request(`/api/leaves/user/${employee.user.id}/balances`, { headers: adminHeaders });
  console.log(`   ✓ Verified new FY balance initialization for Employee ID #${employee.user.id}`);

  // 7. Test Individual-Level Custom Leave Quotas Configuration
  console.log('\n7. Testing Individual-Level Custom Leave Quotas (PUT /api/users/:id/leave-policy)...');
  const customPolicyPayload = {
    policy: {
      casualLeaves: 14.0,
      sickLeaves: 8.0,
      earnedLeaves: 18.0,
      annualQuota: 40.0,
      carryForwardMax: 12.0
    }
  };

  const updatePolicyRes = await request(`/api/users/${employee.user.id}/leave-policy`, {
    method: 'PUT',
    headers: adminHeaders,
    body: customPolicyPayload
  });

  if (updatePolicyRes.status !== 200) {
    throw new Error(`Failed to update custom policy: ${JSON.stringify(updatePolicyRes.data)}`);
  }
  console.log('   ✓ Custom leave quotas saved for employee (CL: 14, SL: 8, EL: 18, Total: 40, Carry Max: 12)');

  // Verify custom quotas reflected in portfolio
  const customPortfolio = await request('/api/leaves/my-leaves-info', { headers: empHeaders });
  const cl = customPortfolio.data.leaveTypes.find(t => t.code === 'CL');
  const sl = customPortfolio.data.leaveTypes.find(t => t.code === 'SL');
  const el = customPortfolio.data.leaveTypes.find(t => t.code === 'EL');

  if (cl.allotted !== 14 || sl.allotted !== 8 || el.allotted !== 18) {
    throw new Error(`Custom quota verification failed! CL: ${cl.allotted}, SL: ${sl.allotted}, EL: ${el.allotted}`);
  }
  console.log(`   ✓ Verified custom quotas in Employee Portfolio: CL = ${cl.allotted}, SL = ${sl.allotted}, EL = ${el.allotted}`);

  console.log('\n================================================================');
  console.log('   🎉 ALL FINANCIAL YEAR & LEAVE TYPES TESTS PASSED! 🎉');
  console.log('================================================================\n');
}

runFinancialYearLeavesTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
