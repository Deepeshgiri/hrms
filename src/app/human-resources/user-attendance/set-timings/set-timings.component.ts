import { Component, OnInit } from '@angular/core';
import { AppConstants } from '../../../AppConstants';
import { CoreService } from '../../../service/core.service';
import { DialogService } from '../../../service/dialog.service';

@Component({
  standalone: false,
  selector: 'app-set-timings',
  templateUrl: './set-timings.component.html',
  styleUrls: ['./set-timings.component.css']
})
export class SetTimingsComponent implements OnInit {
  loading: boolean = false;
  saving: boolean = false;

  users: any[] = [];
  timings: any[] = [];
  selectedUserId: any = null;
  selectedUserName: string = '';

  schedule: any[] = [];

  constructor(
    private coreService: CoreService,
    private dialog: DialogService
  ) {}

  ngOnInit(): void {
    this.getUsers();
    this.getTimings();
  }

  getUsers() {
    this.loading = true;
    this.coreService.getRequest(AppConstants.API_URL + "users").subscribe({
      next: (users: any) => {
        this.users = users || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getTimings() {
    this.coreService.getRequest(AppConstants.API_URL + "users/timings").subscribe({
      next: (result: any) => {
        this.timings = result || [];
      },
      error: () => {}
    });
  }

  onUserSelect(userId: any) {
    if (!userId) {
      this.selectedUserId = null;
      this.selectedUserName = '';
      this.schedule = [];
      return;
    }
    this.selectedUserId = userId;
    const user = this.users.find(u => u.userId == userId || u.id == userId);
    this.selectedUserName = user ? user.name : '';
    this.loadUserSchedule(userId);
  }

  loadUserSchedule(userId: any) {
    this.loading = true;
    this.coreService.getRequest(`${AppConstants.API_URL}users/${userId}/schedule`).subscribe({
      next: (data: any[]) => {
        this.schedule = data || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  saveSchedule() {
    if (!this.selectedUserId) return;
    this.saving = true;
    this.coreService.putRequest(`${AppConstants.API_URL}users/${this.selectedUserId}/schedule`, {
      schedule: this.schedule
    }).subscribe({
      next: () => {
        this.saving = false;
        this.dialog.showDialog({ content: `Custom weekly schedule saved for ${this.selectedUserName}!` });
        this.getTimings();
      },
      error: (err: any) => {
        this.saving = false;
        this.dialog.showDialog({ content: err.error?.message || 'Failed to save schedule' });
      }
    });
  }

  applyAllWeekdays(fromTime: string, toTime: string) {
    this.schedule.forEach(s => {
      if (s.dayOfWeek !== 'Sunday') {
        s.fromTime = fromTime;
        s.toTime = toTime;
        s.isWorkingDay = true;
      }
    });
  }
}