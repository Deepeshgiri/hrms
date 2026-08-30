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
import { PinnacleCommonModule } from '../../pinnacle-common.module';
import { MaterialModule } from '../../material.module';
import { FullCalendarModule } from '@fullcalendar/angular';
import { roleGuard } from 'src/app/guards/role.guard';

const routes: Routes = [
    { path: "", component: UserAttendanceComponent },
    { path: "today", component: UserAttendanceTodayComponent, canActivate: [roleGuard], data: { roles: [1, 2] } },
    { path: "set-timings", component: SetTimingsComponent, canActivate: [roleGuard], data: { roles: [1, 2] } },
    { path: "users-leaves", loadComponent: () => import('./users-leaves/users-leaves.component').then(m => m.UsersLeavesComponent), canActivate: [roleGuard], data: { roles: [1, 2] } },
    { path: "manual", component: ManualAttendanceComponent, canActivate: [roleGuard], data: { roles: [1, 2] } },
    { path: "reports", component: HrmsReportsComponent, canActivate: [roleGuard], data: { roles: [1, 2, 4] } }
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
        PinnacleCommonModule,
        MaterialModule,
        FullCalendarModule,
        RouterModule.forChild(routes)
    ],
    providers: [CoreService],
    exports: []
})
export class UserAttendanceModule { }
