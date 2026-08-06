import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-salary-structure-form',
  templateUrl: './salary-structure-form.component.html',
  styleUrls: ['./salary-structure-form.component.css']
})
export class SalaryStructureFormComponent {

  constructor(
    public dialogRef: MatDialogRef<SalaryStructureFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

  addAllowance() {
    this.data.salaryForm.allowances.push({ name: '', amount: 0 });
  }

  removeAllowance(index: number) {
    this.data.salaryForm.allowances.splice(index, 1);
  }

  addDeduction() {
    this.data.salaryForm.deductions.push({ name: '', amount: 0 });
  }

  removeDeduction(index: number) {
    this.data.salaryForm.deductions.splice(index, 1);
  }

  getGrossSalary(): number {
    const basic = parseFloat(this.data.salaryForm.basicSalary) || 0;
    const hra = parseFloat(this.data.salaryForm.hra) || 0;
    const da = parseFloat(this.data.salaryForm.da) || 0;
    const allowances = this.data.salaryForm.allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    return basic + hra + da + allowances;
  }

  getTotalDeductions(): number {
    return this.data.salaryForm.deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  }

  getNetSalary(): number {
    return this.getGrossSalary() - this.getTotalDeductions();
  }
}
