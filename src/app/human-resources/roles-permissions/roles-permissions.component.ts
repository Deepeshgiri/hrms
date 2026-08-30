import { Component, OnInit } from '@angular/core';
import { CoreService } from 'src/app/service/core.service';
import { SharedAuthService } from 'src/app/service/shared-auth.service';
import { AppConstants } from 'src/app/AppConstants';

@Component({
  standalone: false,
  selector: 'app-roles-permissions',
  templateUrl: './roles-permissions.component.html',
  styleUrls: ['./roles-permissions.component.css']
})
export class RolesPermissionsComponent implements OnInit {
  loading: boolean = false;
  roles: any[] = [];
  permissionCategories: any[] = [];
  allPermissions: any[] = [];
  selectedRole: any = null;

  // Active Tenant
  tenants: any[] = [];
  currentTenant: any = null;

  // Create / Edit Role Modal
  roleModal: boolean = false;
  isEditing: boolean = false;
  roleForm = {
    id: 0,
    roleName: '',
    description: '',
    permissions: [] as string[]
  };

  constructor(
    private coreService: CoreService,
    public auth: SharedAuthService
  ) {}

  ngOnInit(): void {
    this.loadTenants();
    this.loadPermissionsMeta();
    this.loadRoles();
  }

  loadTenants(): void {
    this.coreService.getRequest(`${AppConstants.API_URL}tenants`).subscribe({
      next: (data: any[]) => {
        this.tenants = data || [];
        this.currentTenant = this.tenants.find(t => t.id === (this.auth.getUser()?.tenantId || 1)) || this.tenants[0];
      },
      error: () => {}
    });
  }

  loadPermissionsMeta(): void {
    this.coreService.getRequest(`${AppConstants.API_URL}roles/permissions/meta`).subscribe({
      next: (res: any) => {
        this.permissionCategories = res.categories || [];
        this.allPermissions = res.allPermissions || [];
      },
      error: () => {}
    });
  }

  loadRoles(): void {
    this.loading = true;
    this.coreService.getRequest(`${AppConstants.API_URL}roles`).subscribe({
      next: (data: any[]) => {
        this.roles = data || [];
        if (!this.selectedRole && this.roles.length > 0) {
          this.selectedRole = this.roles[0];
        } else if (this.selectedRole) {
          this.selectedRole = this.roles.find(r => r.id === this.selectedRole.id) || this.roles[0];
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  selectRole(role: any): void {
    this.selectedRole = role;
  }

  openCreateRoleModal(): void {
    this.isEditing = false;
    this.roleForm = {
      id: 0,
      roleName: '',
      description: '',
      permissions: ['attendance.punch', 'leaves.apply', 'chat.use', 'chat.call']
    };
    this.roleModal = true;
  }

  openEditRoleModal(role: any): void {
    this.isEditing = true;
    this.roleForm = {
      id: role.id,
      roleName: role.roleName,
      description: role.description || '',
      permissions: [...(role.permissions || [])]
    };
    this.roleModal = true;
  }

  togglePermissionInForm(key: string): void {
    const idx = this.roleForm.permissions.indexOf(key);
    if (idx > -1) {
      this.roleForm.permissions.splice(idx, 1);
    } else {
      this.roleForm.permissions.push(key);
    }
  }

  toggleCategoryInForm(category: any): void {
    const keys = category.permissions.map((p: any) => p.key);
    const allSelected = keys.every((k: string) => this.roleForm.permissions.includes(k));

    if (allSelected) {
      this.roleForm.permissions = this.roleForm.permissions.filter(k => !keys.includes(k));
    } else {
      keys.forEach((k: string) => {
        if (!this.roleForm.permissions.includes(k)) this.roleForm.permissions.push(k);
      });
    }
  }

  isCategoryFullySelected(category: any): boolean {
    const keys = category.permissions.map((p: any) => p.key);
    return keys.every((k: string) => this.roleForm.permissions.includes(k));
  }

  saveRole(): void {
    if (!this.roleForm.roleName.trim()) return;

    if (this.isEditing) {
      this.coreService.putRequest(`${AppConstants.API_URL}roles/${this.roleForm.id}`, this.roleForm).subscribe({
        next: () => {
          this.roleModal = false;
          this.loadRoles();
        }
      });
    } else {
      this.coreService.postRequest(`${AppConstants.API_URL}roles`, this.roleForm).subscribe({
        next: () => {
          this.roleModal = false;
          this.loadRoles();
        }
      });
    }
  }

  deleteRole(role: any): void {
    if (confirm(`Delete custom role "${role.roleName}"?`)) {
      this.coreService.deleteRequest(`${AppConstants.API_URL}roles/${role.id}`).subscribe({
        next: () => {
          this.selectedRole = null;
          this.loadRoles();
        }
      });
    }
  }

  switchTenant(tenant: any): void {
    this.currentTenant = tenant;
    this.loadRoles();
  }

  getRoleBadgeColor(roleName: string): string {
    const name = (roleName || '').toLowerCase();
    if (name.includes('admin')) return '#4f46e5';
    if (name.includes('hr')) return '#0ea5e9';
    if (name.includes('finance')) return '#f59e0b';
    if (name.includes('lead') || name.includes('manager')) return '#8b5cf6';
    return '#10b981';
  }
}
