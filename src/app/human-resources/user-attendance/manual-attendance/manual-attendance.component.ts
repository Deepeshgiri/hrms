import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { CoreService } from 'src/app/service/core.service';
import { AppConstants } from 'src/app/AppConstants';

@Component({
  selector: 'app-manual-attendance',
  templateUrl: './manual-attendance.component.html',
  styleUrls: ['./manual-attendance.component.css']
})
export class ManualAttendanceComponent implements OnInit {
  users: any[] = [];
  loading = false;
  selectedUserId = '';
  selectedDate: Date = new Date();
  checkInTime = '09:00';
  checkOutTime = '18:00';
  status = 'Present';
  remarks = '';
  useCheckIn = false;
  useCheckOut = false;

  constructor(
    private coreService: CoreService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit() {
    console.log('ManualAttendanceComponent initialized');
    this.loadUsers();
  }

  loadUsers() {
    this.coreService.getRequest(`${AppConstants.API_URL}users`).subscribe({
      next: (data: any) => this.users = data,
      error: (err) => console.error('Error loading users:', err)
    });
  }

  onSubmit() {
    if (!this.selectedUserId || !this.selectedDate) {
      this.snackBar.open('Please select employee and date', 'Close', { duration: 3000 });
      return;
    }

    this.loading = true;
    const data = {
      userId: this.selectedUserId,
      date: this.formatDate(this.selectedDate),
      checkIn: this.useCheckIn ? this.checkInTime : null,
      checkOut: this.useCheckOut ? this.checkOutTime : null,
      status: this.status,
      remarks: this.remarks
    };

    console.log('Submitting attendance data:', data);

    this.coreService.postRequest(`${AppConstants.API_URL}hr/attendance/manual`, data).subscribe({
      next: (response: any) => {
        this.snackBar.open(response.message, 'Close', { duration: 3000 });
        this.resetForm();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error saving attendance:', err);
        this.snackBar.open(err.error?.error || 'Error saving attendance', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  formatDate(date: Date): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatTime(timeString: string): string {
    return timeString || '';
  }

  resetForm() {
    this.selectedUserId = '';
    this.selectedDate = new Date();
    this.checkInTime = '09:00';
    this.checkOutTime = '18:00';
    this.status = 'Present';
    this.remarks = '';
    this.useCheckIn = false;
    this.useCheckOut = false;
  }

  getSelectedUserName(): string {
    const user = this.users.find(u => u.userId == this.selectedUserId);
    return user ? `${user.name} (${user.employeeId})` : '';
  }

  onCheckInTimeChange(event: any) {
    this.checkInTime = event.target.value;
  }

  onCheckOutTimeChange(event: any) {
    this.checkOutTime = event.target.value;
  }
}