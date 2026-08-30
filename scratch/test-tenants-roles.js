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
  return { token: res.data.token, user: res.data.user, tenant: res.data.tenant, permissions: res.data.permissions };
}

async function runMultiTenantAndCustomRolesTestSuite() {
  console.log('================================================================');
  console.log('   HRMS MULTI-TENANT & CUSTOM ROLES/PERMISSIONS TEST SUITE');
  console.log('================================================================\n');

  // 1. Admin Login
  console.log('1. Logging in as Admin...');
  const admin = await loginUser('admin@hrms.com', 'admin123');
  console.log(`   ✓ Admin logged in. Tenant: "${admin.tenant.name}" (${admin.tenant.subdomain})`);
  console.log(`   ✓ Admin has ${admin.permissions.length} effective permissions`);

  const headers = { Authorization: `Bearer ${admin.token}` };

  // 2. Multi-Tenant Organizations
  console.log('\n2. Testing Multi-Tenant API (GET & POST /api/tenants)...');
  const tenantsList = await request('/api/tenants', { headers });
  if (tenantsList.status !== 200 || !Array.isArray(tenantsList.data)) {
    throw new Error(`Failed to list tenants: ${JSON.stringify(tenantsList.data)}`);
  }
  console.log(`   ✓ Listed ${tenantsList.data.length} existing tenants/organizations`);

  const newSubdomain = `test-org-${Date.now()}`;
  const createTenantRes = await request('/api/tenants', {
    method: 'POST',
    headers,
    body: {
      name: 'TechNova Global Labs',
      subdomain: newSubdomain,
      plan: 'Enterprise'
    }
  });
  if (createTenantRes.status !== 201 || !createTenantRes.data.tenantId) {
    throw new Error(`Failed to create tenant: ${JSON.stringify(createTenantRes.data)}`);
  }
  const createdTenantId = createTenantRes.data.tenantId;
  console.log(`   ✓ Created new Organization "TechNova Global Labs" (ID: ${createdTenantId}, Subdomain: ${newSubdomain})`);

  // 3. Permissions Catalog
  console.log('\n3. Testing GET /api/roles/permissions/meta (Granular Permissions Catalog)...');
  const metaRes = await request('/api/roles/permissions/meta', { headers });
  if (metaRes.status !== 200 || !metaRes.data.categories) {
    throw new Error(`Failed to get permissions metadata: ${JSON.stringify(metaRes.data)}`);
  }
  console.log(`   ✓ Loaded ${metaRes.data.total} granular permissions across ${metaRes.data.categories.length} modules`);

  // 4. Create Custom Role for Tenant
  console.log('\n4. Testing POST /api/roles (Create Tenant-Customized Role)...');
  const tenantHeaders = {
    ...headers,
    'x-tenant-id': String(createdTenantId)
  };

  const customPerms = [
    'attendance.view_all',
    'attendance.punch',
    'leaves.view_all',
    'leaves.approve',
    'chat.use',
    'chat.call'
  ];

  const createRoleRes = await request('/api/roles', {
    method: 'POST',
    headers: tenantHeaders,
    body: {
      roleName: 'Department Supervisor',
      description: 'Supervises attendance and approves team leave requests',
      permissions: customPerms
    }
  });

  if (createRoleRes.status !== 201 || !createRoleRes.data.roleId) {
    throw new Error(`Failed to create custom role: ${JSON.stringify(createRoleRes.data)}`);
  }
  const customRoleId = createRoleRes.data.roleId;
  console.log(`   ✓ Created custom role "Department Supervisor" (ID: ${customRoleId}) with ${customPerms.length} assigned permissions`);

  // 5. Verify Roles List for Tenant
  console.log('\n5. Testing GET /api/roles (Verify Tenant Roles List)...');
  const rolesRes = await request('/api/roles', { headers: tenantHeaders });
  const createdRole = rolesRes.data.find(r => r.id === customRoleId);
  if (!createdRole || createdRole.permissionsCount !== customPerms.length) {
    throw new Error(`Custom role verification failed: ${JSON.stringify(createdRole)}`);
  }
  console.log(`   ✓ Verified role "${createdRole.roleName}" has ${createdRole.permissionsCount} active permissions`);

  // 6. Individual User Custom Permission Overrides
  console.log('\n6. Testing Individual User Permission Overrides (GET & PUT /api/roles/user/:id/permissions)...');
  const employeeId = 3; // Rahul Sharma

  // Fetch initial permissions
  const userPermsBefore = await request(`/api/roles/user/${employeeId}/permissions`, { headers });
  console.log(`   ✓ Employee #${employeeId} (${userPermsBefore.data.userName}) base role has ${userPermsBefore.data.rolePermissions.length} permissions`);

  // Apply custom individual overrides: GRANT payroll.manage_salary, and DENY attendance.punch
  const overridesPayload = {
    'payroll.manage_salary': true, // Grant extra permission
    'attendance.punch': false      // Deny base permission
  };

  const saveOverrideRes = await request(`/api/roles/user/${employeeId}/permissions`, {
    method: 'PUT',
    headers,
    body: { overrides: overridesPayload }
  });

  if (saveOverrideRes.status !== 200) {
    throw new Error(`Failed to save user permission overrides: ${JSON.stringify(saveOverrideRes.data)}`);
  }
  console.log('   ✓ Individual permission overrides saved successfully (Explicitly granted payroll.manage_salary, explicitly denied attendance.punch)');

  // Verify effective permissions resolution
  const userPermsAfter = await request(`/api/roles/user/${employeeId}/permissions`, { headers });
  const eff = userPermsAfter.data.effectivePermissions;

  const hasPayrollManage = eff.includes('payroll.manage_salary');
  const hasPunch = eff.includes('attendance.punch');

  if (!hasPayrollManage || hasPunch) {
    throw new Error(`Individual override verification failed! Effective: ${JSON.stringify(eff)}`);
  }
  console.log('   ✓ Effective permissions resolved accurately: Employee now individually HAS "payroll.manage_salary" and DOES NOT have "attendance.punch"');

  // Reset employee overrides for clean state
  await request(`/api/roles/user/${employeeId}/permissions`, {
    method: 'PUT',
    headers,
    body: { overrides: {} }
  });
  console.log('   ✓ Cleaned up test overrides');

  console.log('\n================================================================');
  console.log('   🎉 ALL MULTI-TENANT & CUSTOM ROLES TESTS PASSED! 🎉');
  console.log('================================================================\n');
}

runMultiTenantAndCustomRolesTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
