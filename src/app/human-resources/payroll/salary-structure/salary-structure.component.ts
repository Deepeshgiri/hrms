import { Component, OnInit } from '@angular/core';
import { CoreService } from 'src/app/service/core.service';
import { AppConstants } from 'src/app/AppConstants';

@Component({
  selector: 'app-salary-structure',
  templateUrl: './salary-structure.component.html',
  styleUrls: ['./salary-structure.component.css']
})
export class SalaryStructureComponent implements OnInit {
  loading = false;
  salaryStructures = [];
  employees = [];
  showSalaryForm = false;
  editMode = false;
  
  salaryForm = {
    userId: null,
    basicSalary: 0,
    hra: 0,
    da: 0,
    allowances: [],
    deductions: []
  };

  constructor(private coreService: CoreService) {}

  ngOnInit() {
    this.loadSalaryStructures();
    this.loadEmployees();
  }
  
  loadSalaryStructures() {
    this.loading = true;
    this.coreService.getRequest(`${AppConstants.API_URL}hr/payroll/salary-structures`)
      .subscribe((data: any) => { 
        this.salaryStructures = data || [];
        this.loading = false;
      }, () => { this.loading = false; });
  }
  
  loadEmployees() {
    this.coreService.getRequest(`${AppConstants.API_URL}users`)
      .subscribe((data: any) => { this.employees = data || []; });
  }
  
  editSalary(salary: any) {
    this.salaryForm = { 
      ...salary,
      allowances: salary.allowances || [],
      deductions: salary.deductions || []
    };
    this.editMode = true;
    this.showSalaryForm = true;
  }
  
  saveSalary() {
    if (!this.salaryForm.userId) {
      alert('Please select an employee');
      return;
    }
    
    this.loading = true;
    this.coreService.postRequest(`${AppConstants.API_URL}hr/payroll/salary-structure`, this.salaryForm)
      .subscribe(() => {
        this.loadSalaryStructures();
        this.closeSalaryForm();
        alert('Salary structure saved successfully!');
      }, (error) => { 
        this.loading = false;
        alert('Error saving salary structure: ' + (error.error?.message || 'Unknown error'));
      });
  }
  
  closeSalaryForm() {
    this.showSalaryForm = false;
    this.resetForm();
  }
  
  resetForm() {
    this.salaryForm = {
      userId: null,
      basicSalary: 0,
      hra: 0,
      da: 0,
      allowances: [],
      deductions: []
    };
    this.editMode = false;
  }
  
  addAllowance() {
    this.salaryForm.allowances.push({ name: '', amount: 0 });
  }
  
  removeAllowance(index: number) {
    this.salaryForm.allowances.splice(index, 1);
  }
  
  addDeduction() {
    this.salaryForm.deductions.push({ name: '', amount: 0 });
  }
  
  removeDeduction(index: number) {
    this.salaryForm.deductions.splice(index, 1);
  }
  
  getGrossSalary(): number {
    const basic = parseFloat(this.salaryForm.basicSalary.toString()) || 0;
    const hra = parseFloat(this.salaryForm.hra.toString()) || 0;
    const da = parseFloat(this.salaryForm.da.toString()) || 0;
    const allowances = this.getAllowancesTotalForm();
    return basic + hra + da + allowances;
  }
  
  getTotalDeductions(): number {
    return this.getDeductionsTotalForm();
  }
  
  getNetSalaryForm(): number {
    return this.getGrossSalary() - this.getTotalDeductions();
  }
  
  getAllowancesTotalForm(): number {
    return this.salaryForm.allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  }
  
  getDeductionsTotalForm(): number {
    return this.salaryForm.deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  }
  
  getAllowancesTotal(allowances: any): number {
    if (!allowances || !Array.isArray(allowances)) return 0;
    return allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  }
  
  getDeductionsTotal(deductions: any): number {
    if (!deductions || !Array.isArray(deductions)) return 0;
    return deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  }
  
  getNetSalary(salary: any): number {
    const basic = parseFloat(salary.basicSalary) || 0;
    const hra = parseFloat(salary.hra) || 0;
    const da = parseFloat(salary.da) || 0;
    const allowances = this.getAllowancesTotal(salary.allowances);
    const deductions = this.getDeductionsTotal(salary.deductions);
    return basic + hra + da + allowances - deductions;
  }
}