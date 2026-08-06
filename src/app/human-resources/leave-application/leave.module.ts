import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LeaveHomeComponent } from './leave-home/leave-home.component';
import { RequestLeaveComponent } from './request-leave/request-leave.component';
import { UsersLeavesComponent } from './users-leaves/users-leaves.component';
import { EditLeaveComponent } from './edit-leave/edit-leave.component';
import { SetUsersLeavesCountComponent } from './set-users-leaves-count/set-users-leaves-count.component';
import { InstituteHolidaysComponent } from './institute-holidays/institute-holidays.component';
import { DefaultUserLeavesComponent } from './default-user-leaves/default-user-leaves.component';
import { AllotLeavesComponent } from './allot-leaves/allot-leaves.component';
import { CoreService } from '../../service/core.service';
import { PinnacleCommonModule } from '../../pinnacle-common.module';
import { MaterialModule } from '../../material.module';

const routes: Routes = [
    { path: "", component: LeaveHomeComponent },
    { path: "new-leave", component: RequestLeaveComponent },
    { path: "users-leaves", component: UsersLeavesComponent },
    { path: "set-users-leaves", component: SetUsersLeavesCountComponent },
    { path: "institute-holidays", component: InstituteHolidaysComponent },
    { path: "default-users-leaves", component: DefaultUserLeavesComponent },
    { path: "allot-leaves", component: AllotLeavesComponent },
];

@NgModule({
    declarations: [
        LeaveHomeComponent,
        RequestLeaveComponent,
        UsersLeavesComponent,
        EditLeaveComponent,
        SetUsersLeavesCountComponent,
        InstituteHolidaysComponent,
        DefaultUserLeavesComponent,
        AllotLeavesComponent
    ],
    imports: [
        CommonModule,
        HttpClientModule,
        PinnacleCommonModule,
        MaterialModule,
        RouterModule.forChild(routes)
    ],
    providers: [CoreService],
    exports: []
})
export class LeaveModule { }
