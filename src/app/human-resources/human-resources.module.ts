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


const routes: Routes = [
  { path: '', component: HrDashboardComponent },
  { path: 'dashboard', component: HrDashboardComponent },
  { path: 'analytics', component: HrAnalyticsComponent },
  { path: 'leaves', loadChildren: () => import('./leave-application/leave.module').then(m => m.LeaveModule) },
  { path: 'attendance', loadChildren: () => import('./user-attendance/user-attendance.module').then(m => m.UserAttendanceModule) },
  { path: 'user-attendance', loadChildren: () => import('./user-attendance/user-attendance.module').then(m => m.UserAttendanceModule) },
  { path: 'payroll', loadChildren: () => import('./payroll/payroll.module').then(m => m.PayrollModule) },

  { path: 'biometric', component: BiometricComponent },
  { path: 'biometric-punches', component: BiometricPunchesComponent },
  { path: 'punches', component: BiometricPunchesComponent }
];

@NgModule({
  declarations: [HrDashboardComponent, HrAnalyticsComponent, BiometricComponent, BiometricPunchesComponent, EmployeeSelectionDialogComponent],
  imports: [
    CommonModule,
    PinnacleCommonModule,
    RouterModule.forChild(routes),
    MaterialModule,
    
  ]
})
export class HumanResourcesModule { }
