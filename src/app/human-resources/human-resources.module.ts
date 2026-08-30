import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { PinnacleCommonModule } from 'src/app/pinnacle-common.module';
import { HrAnalyticsComponent } from './hr-analytics.component';
import { HrDashboardComponent } from './hr-dashboard.component';
import { MaterialModule } from 'src/app/material.module';
import { BiometricComponent } from './biometric/biometric.component';
import { BiometricPunchesComponent } from './biometric-punches/biometric-punches.component';
import { EmployeeSelectionDialogComponent } from './biometric-punches/employee-selection-dialog.component';
import { ShellComponent } from 'src/app/components/shell/shell.component';
import { EmployeesComponent } from './employees/employees.component';
import { EmployeeCustomizationDialogComponent } from './employees/employee-customization-dialog.component';
import { AuditLogsComponent } from './audit-logs/audit-logs.component';
import { ChatComponent } from './chat/chat.component';
import { RolesPermissionsComponent } from './roles-permissions/roles-permissions.component';
import { roleGuard } from 'src/app/guards/role.guard';

const routes: Routes = [
  {
    path: '', component: ShellComponent,
    children: [
      { path: '', component: HrDashboardComponent },
      { path: 'dashboard', component: HrDashboardComponent },
      { path: 'chat', component: ChatComponent },
      { path: 'roles-permissions', component: RolesPermissionsComponent, canActivate: [roleGuard], data: { roles: [1, 2] } },
      { path: 'analytics', component: HrAnalyticsComponent, canActivate: [roleGuard], data: { roles: [1, 2, 4] } },
      { path: 'employees', component: EmployeesComponent, canActivate: [roleGuard], data: { roles: [1, 2] } },
      { path: 'leaves', loadChildren: () => import('./leave-application/leave.module').then(m => m.LeaveModule) },
      { path: 'attendance', loadChildren: () => import('./user-attendance/user-attendance.module').then(m => m.UserAttendanceModule) },
      { path: 'user-attendance', loadChildren: () => import('./user-attendance/user-attendance.module').then(m => m.UserAttendanceModule) },
      { path: 'payroll', loadChildren: () => import('./payroll/payroll.module').then(m => m.PayrollModule) },
      { path: 'biometric', component: BiometricComponent, canActivate: [roleGuard], data: { roles: [1, 2] } },
      { path: 'biometric-punches', component: BiometricPunchesComponent, canActivate: [roleGuard], data: { roles: [1, 2] } },
      { path: 'punches', component: BiometricPunchesComponent, canActivate: [roleGuard], data: { roles: [1, 2] } },
      { path: 'audit-logs', component: AuditLogsComponent, canActivate: [roleGuard], data: { roles: [1, 2] } },
      { path: 'logs', component: AuditLogsComponent, canActivate: [roleGuard], data: { roles: [1, 2] } },
    ]
  }
];

@NgModule({
  declarations: [
    HrDashboardComponent,
    HrAnalyticsComponent,
    BiometricComponent,
    BiometricPunchesComponent,
    EmployeeSelectionDialogComponent,
    EmployeesComponent,
    EmployeeCustomizationDialogComponent,
    AuditLogsComponent,
    ChatComponent,
    RolesPermissionsComponent,
  ],
  imports: [
    CommonModule,
    PinnacleCommonModule,
    RouterModule.forChild(routes),
    MaterialModule,
  ]
})
export class HumanResourcesModule { }
