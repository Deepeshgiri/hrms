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

async function runAuditLogsTestSuite() {
  console.log('========================================================');
  console.log('   HRMS AUDIT LOGGING & LIVE MONITOR TEST SUITE');
  console.log('========================================================\n');

  // 1. Admin Login
  const admin = await loginUser('admin@hrms.com', 'admin123');
  const adminHeaders = { Authorization: `Bearer ${admin.token}` };
  console.log('1. Admin logged in.');

  // 2. Trigger Action: Create Employee
  console.log('\n2. Triggering Action: Create Employee...');
  const testEmail = `audit_test_${Date.now()}@hrms.com`;
  const empRes = await request('/api/users', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'Audit Log Test Subject',
      email: testEmail,
      password: 'password123',
      employeeId: `AUDIT-${Date.now().toString().slice(-4)}`,
      designation: 'QA Engineer',
      department: 'Engineering',
      roleId: 3
    }
  });
  if (empRes.status !== 201) throw new Error(`Create user failed: ${JSON.stringify(empRes.data)}`);
  const testUserId = empRes.data.userId;
  console.log(`   ✓ Created employee ID: ${testUserId}`);

  // 3. Trigger Action: Configure Salary
  console.log('\n3. Triggering Action: Configure Salary Structure...');
  const salRes = await request('/api/hr/payroll/salary-structure', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      userId: testUserId,
      basicSalary: 60000,
      hra: 20000,
      da: 5000,
      allowances: [{ name: 'Transport', amount: 3000 }],
      deductions: [{ name: 'Tax', amount: 4000 }]
    }
  });
  if (salRes.status !== 200) throw new Error(`Salary setup failed: ${JSON.stringify(salRes.data)}`);
  console.log('   ✓ Salary structure configured');

  // 4. Trigger Action: Employee Web Punch
  console.log('\n4. Triggering Action: Employee Web Clock-In...');
  const emp = await loginUser(testEmail, 'password123');
  const empHeaders = { Authorization: `Bearer ${emp.token}` };

  const punchRes = await request('/api/attendance/punch', {
    method: 'POST',
    headers: empHeaders,
    body: { punchType: 'Clock In', note: 'Audit Log Verification Punch' }
  });
  if (punchRes.status !== 200) throw new Error(`Punch failed: ${JSON.stringify(punchRes.data)}`);
  console.log('   ✓ Employee clocked in');

  // 5. Trigger Action: Employee Apply Leave
  console.log('\n5. Triggering Action: Employee Apply Leave...');
  const leaveRes = await request('/api/leaves', {
    method: 'POST',
    headers: empHeaders,
    body: {
      leaveContent: 'Sick Leave',
      date: new Date().toISOString().slice(0, 10),
      reason: 'Fever and medical checkup',
      duration: 'F'
    }
  });
  if (leaveRes.status !== 200) throw new Error(`Apply leave failed: ${JSON.stringify(leaveRes.data)}`);
  console.log('   ✓ Employee applied for leave');

  // 6. Verify Logs API (GET /api/logs)
  console.log('\n6. Verifying Audit Logs API & Recorded Details...');
  const logsRes = await request('/api/logs?limit=10', { headers: adminHeaders });
  if (logsRes.status !== 200 || !logsRes.data.logs || logsRes.data.logs.length === 0) {
    throw new Error(`Failed to fetch logs: ${JSON.stringify(logsRes.data)}`);
  }
  console.log(`   ✓ Retrieved ${logsRes.data.logs.length} recent audit logs (Total in DB: ${logsRes.data.total})`);

  const recentActions = logsRes.data.logs.map(l => ({
    time: l.created_at,
    user: `${l.userName} (${l.userRole})`,
    action: l.action,
    desc: l.description,
    hasDetails: !!l.details
  }));

  console.log('\n   Recent Recorded Audit Logs:');
  recentActions.slice(0, 5).forEach((l, i) => {
    console.log(`   [${i + 1}] [${l.action}] by ${l.user} -> "${l.desc}" (Payload Diff: ${l.hasDetails})`);
  });

  // Verify specific action types exist
  const actionsList = logsRes.data.logs.map(l => l.action);
  const hasUserCreated = actionsList.includes('USER_CREATED');
  const hasSalarySaved = actionsList.includes('SALARY_STRUCTURE_SAVED');
  const hasPunchIn = actionsList.includes('PUNCH_CLOCK_IN');
  const hasLeaveApplied = actionsList.includes('LEAVE_APPLIED');

  if (!hasUserCreated || !hasSalarySaved || !hasPunchIn || !hasLeaveApplied) {
    throw new Error(`Expected all actions to be recorded, got: ${actionsList.join(', ')}`);
  }
  console.log('   ✓ Verified all 4 test actions (USER_CREATED, SALARY_STRUCTURE_SAVED, PUNCH_CLOCK_IN, LEAVE_APPLIED) were recorded perfectly!');

  // 7. Verify Stats API
  console.log('\n7. Verifying Audit Stats API (GET /api/logs/stats)...');
  const statsRes = await request('/api/logs/stats', { headers: adminHeaders });
  if (statsRes.status !== 200 || statsRes.data.todayLogs <= 0) {
    throw new Error(`Stats verification failed: ${JSON.stringify(statsRes.data)}`);
  }
  console.log(`   ✓ Stats returned: Today's Logs: ${statsRes.data.todayLogs}, User Changes: ${statsRes.data.userChangesToday}, Leave Actions: ${statsRes.data.leaveActionsToday}`);

  // 8. Cleanup Test User
  console.log('\n8. Cleaning up test employee...');
  const delRes = await request(`/api/users/${testUserId}`, {
    method: 'DELETE',
    headers: adminHeaders
  });
  console.log(`   ✓ Cleaned up test user: ${delRes.data.message}`);

  console.log('\n========================================================');
  console.log('   🎉 AUDIT LOGGING & LIVE MONITOR TESTS PASSED! 🎉');
  console.log('========================================================\n');
}

runAuditLogsTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
