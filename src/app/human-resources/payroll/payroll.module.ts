import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { PinnacleCommonModule } from 'src/app/pinnacle-common.module';
import { PayslipsComponent } from './payslips/payslips.component';
import { SalaryStructureComponent } from './salary-structure/salary-structure.component';
import { PayrollHomeComponent } from './payroll-home/payroll-home.component';
import { MaterialModule } from 'src/app/material.module';

const routes: Routes = [
  { path: '', component: PayrollHomeComponent },
  { path: 'payslips', component: PayslipsComponent },
  { path: 'salary-structure', component: SalaryStructureComponent }
];

@NgModule({
  declarations: [PayslipsComponent, SalaryStructureComponent, PayrollHomeComponent],
  imports: [CommonModule, PinnacleCommonModule, RouterModule.forChild(routes), MaterialModule]
})
export class PayrollModule { }
