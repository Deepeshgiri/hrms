import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';
import { PinnacleCommonModule } from 'src/app/pinnacle-common.module';
import { PayslipsComponent } from './payslips/payslips.component';
import { SalaryStructureComponent } from './salary-structure/salary-structure.component';
import { PayrollHomeComponent } from './payroll-home/payroll-home.component';
import { MaterialModule } from 'src/app/material.module';
import { CoreService } from 'src/app/service/core.service';

const routes: Routes = [
  { path: '', component: PayrollHomeComponent },
  { path: 'payslips', component: PayslipsComponent },
  { path: 'salary-structure', component: SalaryStructureComponent }
];

@NgModule({
  declarations: [PayslipsComponent, SalaryStructureComponent, PayrollHomeComponent],
  imports: [CommonModule, HttpClientModule, PinnacleCommonModule, RouterModule.forChild(routes), MaterialModule],
  providers: [CoreService]
})
export class PayrollModule { }
