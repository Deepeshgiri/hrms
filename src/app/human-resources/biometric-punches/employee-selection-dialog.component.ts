import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BiometricUser } from './biometric.modal';

@Component({
  selector: 'app-employee-selection-dialog',
  template: `
    <h2 mat-dialog-title>Map Employee to Biometric Punch</h2>
    
    <mat-dialog-content>
      <div class="punch-info">
        <p><strong>Enroll ID:</strong> {{data.punch.enrollId}}</p>
        <p><strong>Device:</strong> {{data.punch.deviceSN}}</p>
        <p><strong>Date:</strong> {{data.punch.datetime | date:'dd/MM/yyyy HH:mm:ss'}}</p>
      </div>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Select Employee</mat-label>
        <mat-select [(ngModel)]="selectedUserId">
          <mat-option *ngFor="let user of data.users" [value]="user.userId">
            {{user.name}} (ID: {{user.userId}})
            <span *ngIf="user.employeeId" class="employee-id">- {{user.employeeId}}</span>
          </mat-option>
        </mat-select>
      </mat-form-field>

      <div class="user-count">
        Total employees: {{data.users.length}}
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onConfirm()" [disabled]="!selectedUserId">
        Map Employee
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .punch-info {
      background-color: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    .punch-info p {
      margin: 4px 0;
      font-size: 14px;
    }
    .full-width {
      width: 100%;
    }
    .employee-id {
      font-size: 12px;
      color: #999;
    }
    .user-count {
      margin-top: 12px;
      font-size: 12px;
      color: #666;
    }
    mat-dialog-actions {
      padding: 16px 0 0 0;
    }
  `]
})
export class EmployeeSelectionDialogComponent implements OnInit {
  selectedUserId: number | null = null;

  constructor(
    public dialogRef: MatDialogRef<EmployeeSelectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { users: BiometricUser[], punch: any }
  ) { }

  ngOnInit() {
    if (this.data.users && this.data.users.length > 0) {
      this.selectedUserId = this.data.users[0].userId;
    }
  }

  onConfirm() {
    if (this.selectedUserId) {
      this.dialogRef.close({ userId: this.selectedUserId });
    }
  }

  onCancel() {
    this.dialogRef.close();
  }
}
