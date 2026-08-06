import { Component, OnInit } from '@angular/core';
import { CoreService } from 'src/app/service/core.service';
import { AppConstants } from 'src/app/AppConstants';

@Component({
  selector: 'app-payroll-home',
  templateUrl: './payroll-home.component.html',
  styleUrls: ['./payroll-home.component.css']
})
export class PayrollHomeComponent implements OnInit {
  loading = false;
  stats = {
    totalEmployees: 0,
    processedPayslips: 0,
    pendingPayslips: 0,
    totalPayroll: 0
  };

  constructor(private coreService: CoreService) {}

  ngOnInit() {
    this.loadPayrollStats();
  }

  loadPayrollStats() {
    this.loading = true;
    this.coreService.getRequest(`${AppConstants.API_URL}hr/payroll/stats`)
      .subscribe((data: any) => {
        this.stats = data || this.stats;
        this.loading = false;
      }, () => { this.loading = false; });
  }
}