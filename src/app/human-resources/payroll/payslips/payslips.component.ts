import { Component, OnInit } from '@angular/core';
import { CoreService } from 'src/app/service/core.service';
import { AppConstants } from 'src/app/AppConstants';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-payslips',
  templateUrl: './payslips.component.html',
  styleUrls: ['./payslips.component.css']
})
export class PayslipsComponent implements OnInit {
  loading = false;
  payslips = [];
  employees = [];
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  selectedEmployee = null;
  
  months = [
    {value: 1, label: 'January'}, {value: 2, label: 'February'}, {value: 3, label: 'March'},
    {value: 4, label: 'April'}, {value: 5, label: 'May'}, {value: 6, label: 'June'},
    {value: 7, label: 'July'}, {value: 8, label: 'August'}, {value: 9, label: 'September'},
    {value: 10, label: 'October'}, {value: 11, label: 'November'}, {value: 12, label: 'December'}
  ];
  years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i);

  displayedColumns = ['employee', 'month', 'year', 'grossSalary', 'netSalary', 'status', 'actions'];

  constructor(
    private coreService: CoreService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadPayslips();
  }

  loadPayslips() {
    this.loading = true;
    const params = `month=${this.selectedMonth}&year=${this.selectedYear}${this.selectedEmployee ? '&userId=' + this.selectedEmployee : ''}`;
    
    this.coreService.getRequest(`${AppConstants.API_URL}hr/payroll/payslips?${params}`).subscribe({
      next: (data: any) => {
        this.payslips = data || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.showError('Failed to load payslips');
      }
    });
  }

  generateAllPayslips() {
    if (!confirm('Generate payslips for all employees? This will overwrite existing drafts.')) return;
    
    this.loading = true;
    this.coreService.postRequest(`${AppConstants.API_URL}hr/payroll/generate-all-payslips`, 
      { month: this.selectedMonth, year: this.selectedYear })
      .subscribe({
        next: (response: any) => {
          this.loadPayslips();
          this.showSuccess(response.message || 'Payslips generated successfully!');
        },
        error: (error) => {
          this.loading = false;
          this.showError('Failed to generate payslips');
        }
      });
  }
  
  updateStatus(payslip: any, status: string) {
    const paidDate = status === 'Paid' ? new Date().toISOString().split('T')[0] : null;
    
    this.coreService.putRequest(`${AppConstants.API_URL}hr/payroll/payslip/${payslip.id}/status`, 
      { status, paidDate })
      .subscribe({
        next: () => {
          payslip.status = status;
          payslip.paidDate = paidDate;
          this.showSuccess('Status updated successfully!');
        },
        error: () => this.showError('Failed to update status')
      });
  }
  
  downloadPayslip(payslip: any) {
    const url = `${AppConstants.API_URL}hr/payroll/payslip/${payslip.id}/download`;
    window.open(url, '_blank');
  }
  
  viewPayslip(payslip: any) {
    const url = `${AppConstants.API_URL}hr/payroll/payslip/${payslip.id}/download`;
    window.open(url, '_blank');
  }

  deletePayslip(payslip: any) {
    if (!confirm('Are you sure you want to delete this payslip?')) return;
    
    this.coreService.deleteRequest(`${AppConstants.API_URL}hr/payroll/payslip/${payslip.id}`)
      .subscribe({
        next: () => {
          this.loadPayslips();
          this.showSuccess('Payslip deleted successfully!');
        },
        error: () => this.showError('Failed to delete payslip')
      });
  }

  getMonthName(m: number) {
    return this.months.find(month => month.value === m)?.label || '';
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Paid': return 'success';
      case 'Processed': return 'primary';
      case 'Draft': return 'warn';
      default: return 'basic';
    }
  }

  private showSuccess(message: string) {
    this.snackBar.open(message, 'Close', { duration: 3000 });
  }

  private showError(message: string) {
    this.snackBar.open(message, 'Close', { duration: 5000 });
  }
}