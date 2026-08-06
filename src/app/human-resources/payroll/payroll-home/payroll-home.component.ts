import { Component, OnInit } from '@angular/core';
import { CoreService } from '../../../service/core.service';
import { AppConstants } from '../../../AppConstants';

@Component({
  selector: 'app-payroll-home',
  templateUrl: './payroll-home.component.html',
  styleUrls: ['./payroll-home.component.css']
})
export class PayrollHomeComponent implements OnInit {
  loading: boolean = false;
  stats = {
    totalEmployees: 0,
    processedPayslips: 0,
    pendingPayslips: 0,
    totalPayroll: 0
  };

  constructor(private coreService: CoreService) {}

  ngOnInit(): void {
    this.loadPayrollStats();
  }

  loadPayrollStats(): void {
    this.loading = true;
    this.coreService.getRequest(`${AppConstants.API_URL}hr/payroll/stats`)
      .subscribe({
        next: (data: any) => {
          this.stats = data || this.stats;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });
  }
}
