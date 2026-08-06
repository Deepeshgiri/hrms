import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UserAttendanceComponent } from './user-attendance/user-attendance.component';
import { UserAttendanceTodayComponent } from './user-attendance-today/user-attendance-today.component';
import { SetTimingsComponent } from './set-timings/set-timings.component';
import { ManualAttendanceComponent } from './manual-attendance/manual-attendance.component';
import { HrmsReportsComponent } from '../hrms-reports/hrms-reports.component';
import { CoreService } from '../../service/core.service';

const routes: Routes = [
    { path: "", component: UserAttendanceComponent },
    { path: "today", component: UserAttendanceTodayComponent },
    { path: "set-timings", component: SetTimingsComponent },
    { path: "users-leaves", loadComponent: () => import('./users-leaves/users-leaves.component').then(m => m.UsersLeavesComponent) },
    { path: "manual", component: ManualAttendanceComponent },
    { path: "reports", component: HrmsReportsComponent }
];

@NgModule({
    declarations: [
        UserAttendanceComponent, 
        UserAttendanceTodayComponent, 
        SetTimingsComponent, 
        ManualAttendanceComponent,
        HrmsReportsComponent
    ],
    imports: [
        CommonModule,
        HttpClientModule,
        RouterModule.forChild(routes)
    ],
    providers: [CoreService],
    exports: []
})
export class UserAttendanceModule { }
