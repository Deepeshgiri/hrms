import { NgModule } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { PayslipsComponent } from './payslips/payslips.component';
import { SalaryStructureComponent } from './salary-structure/salary-structure.component';
import { PayrollHomeComponent } from './payroll-home/payroll-home.component';
import { CoreService } from '../../service/core.service';
import { LoadingComponent } from '../../components/loading/loading.component';

const routes: Routes = [
  { path: '', component: PayrollHomeComponent },
  { path: 'payslips', component: PayslipsComponent },
  { path: 'salary-structure', component: SalaryStructureComponent }
];

@NgModule({
  declarations: [PayslipsComponent, SalaryStructureComponent, PayrollHomeComponent],
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatDividerModule,
    MatListModule,
    MatCardModule,
    MatButtonModule,
    DecimalPipe,
    LoadingComponent,
    RouterModule.forChild(routes)
  ],
  providers: [CoreService]
})
export class PayrollModule { }
