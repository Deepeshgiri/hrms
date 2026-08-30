import { Component, OnInit } from '@angular/core';
import { CoreService } from 'src/app/service/core.service';
import { AppConstants } from 'src/app/AppConstants';

export interface Employee {
  userId: number;
  id?: number;
  name: string;
  email: string;
  employeeId: string;
  designation: string;
  department: string;
  roleId: number;
  roleName?: string;
  fromTime?: string;
  toTime?: string;
  created_at?: string;
}

@Component({
  standalone: false,
  selector: 'app-employees',
  templateUrl: './employees.component.html',
  styleUrls: ['./employees.component.css']
})
export class EmployeesComponent implements OnInit {
  employees: Employee[] = [];
  filteredEmployees: Employee[] = [];
  departments: string[] = [];
  roles: any[] = [];

  loading: boolean = false;
  searchQuery: string = '';
  selectedDepartment: string = '';
  selectedRole: string = '';
  viewMode: 'grid' | 'table' = 'grid';

  // Modals
  modals = {
    add: false,
    edit: false,
    profile: false,
    delete: false,
    customization: false,
  };

  // Form Model
  employeeForm = {
    userId: 0,
    name: '',
    email: '',
    password: '',
    employeeId: '',
    department: 'Engineering',
    designation: '',
    roleId: 3,
    fromTime: '09:00:00',
    toTime: '18:00:00',
    annualQuota: 18,
    monthlyAccrual: 1.5,
  };

  formError: string = '';
  formSubmitting: boolean = false;

  // Active Selected Employee for View Profile / Delete / Customization
  selectedEmployee: any = null;
  employeeProfileData: any = null;
  profileLoading: boolean = false;

  constructor(private coreService: CoreService) {}

  ngOnInit(): void {
    this.loadEmployees();
    this.loadMeta();
  }

  loadMeta(): void {
    this.coreService.getRequest(`${AppConstants.API_URL}users/meta/departments`).subscribe({
      next: (depts: string[]) => {
        this.departments = depts || [];
      },
      error: () => {},
    });

    this.coreService.getRequest(`${AppConstants.API_URL}users/meta/roles`).subscribe({
      next: (roles: any[]) => {
        this.roles = roles || [];
      },
      error: () => {},
    });
  }

  loadEmployees(): void {
    this.loading = true;
    this.coreService.getRequest(`${AppConstants.API_URL}users`).subscribe({
      next: (data: Employee[]) => {
        this.employees = data || [];
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    let result = [...this.employees];

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(
        e =>
          e.name?.toLowerCase().includes(q) ||
          e.email?.toLowerCase().includes(q) ||
          e.employeeId?.toLowerCase().includes(q) ||
          e.designation?.toLowerCase().includes(q)
      );
    }

    if (this.selectedDepartment) {
      result = result.filter(e => e.department === this.selectedDepartment);
    }

    if (this.selectedRole) {
      result = result.filter(e => String(e.roleId) === String(this.selectedRole));
    }

    this.filteredEmployees = result;
  }

  openAddModal(): void {
    this.employeeForm = {
      userId: 0,
      name: '',
      email: '',
      password: 'emp123',
      employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      department: this.departments[0] || 'Engineering',
      designation: '',
      roleId: 3,
      fromTime: '09:00:00',
      toTime: '18:00:00',
      annualQuota: 18,
      monthlyAccrual: 1.5,
    };
    this.formError = '';
    this.modals.add = true;
  }

  openEditModal(emp: Employee): void {
    this.employeeForm = {
      userId: emp.userId,
      name: emp.name,
      email: emp.email,
      password: '',
      employeeId: emp.employeeId,
      department: emp.department || 'General',
      designation: emp.designation || '',
      roleId: emp.roleId || 3,
      fromTime: emp.fromTime || '09:00:00',
      toTime: emp.toTime || '18:00:00',
      annualQuota: 18,
      monthlyAccrual: 1.5,
    };
    this.formError = '';
    this.modals.edit = true;
  }

  openCustomizationModal(emp: Employee): void {
    this.selectedEmployee = emp;
    this.modals.customization = true;
  }

  saveAddEmployee(): void {
    if (!this.employeeForm.name || !this.employeeForm.email) {
      this.formError = 'Name and email are required';
      return;
    }

    this.formSubmitting = true;
    this.formError = '';

    this.coreService.postRequest(`${AppConstants.API_URL}users`, this.employeeForm).subscribe({
      next: () => {
        this.formSubmitting = false;
        this.modals.add = false;
        this.loadEmployees();
      },
      error: (err: any) => {
        this.formSubmitting = false;
        this.formError = err.error?.message || 'Failed to create employee';
      }
    });
  }

  saveEditEmployee(): void {
    if (!this.employeeForm.name || !this.employeeForm.email) {
      this.formError = 'Name and email are required';
      return;
    }

    this.formSubmitting = true;
    this.formError = '';

    this.coreService.putRequest(`${AppConstants.API_URL}users/${this.employeeForm.userId}`, this.employeeForm).subscribe({
      next: () => {
        this.formSubmitting = false;
        this.modals.edit = false;
        this.loadEmployees();
      },
      error: (err: any) => {
        this.formSubmitting = false;
        this.formError = err.error?.message || 'Failed to update employee';
      }
    });
  }

  viewProfile(emp: Employee): void {
    this.selectedEmployee = emp;
    this.modals.profile = true;
    this.profileLoading = true;

    this.coreService.getRequest(`${AppConstants.API_URL}users/${emp.userId}`).subscribe({
      next: (data: any) => {
        this.employeeProfileData = data;
        this.profileLoading = false;
      },
      error: () => {
        this.profileLoading = false;
      }
    });
  }

  confirmDelete(emp: Employee): void {
    this.selectedEmployee = emp;
    this.modals.delete = true;
  }

  executeDelete(): void {
    if (!this.selectedEmployee) return;

    this.coreService.deleteRequest(`${AppConstants.API_URL}users/${this.selectedEmployee.userId}`).subscribe({
      next: () => {
        this.modals.delete = false;
        this.loadEmployees();
      },
      error: (err: any) => {
        alert(err.error?.message || 'Failed to delete employee');
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || 'U').toUpperCase();
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#14b8a6', '#f97316', '#6366f1'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
}
