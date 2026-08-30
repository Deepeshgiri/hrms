import { Component, OnInit, OnDestroy } from '@angular/core';
import { CoreService } from 'src/app/service/core.service';
import { SharedAuthService } from 'src/app/service/shared-auth.service';
import { AppConstants } from 'src/app/AppConstants';

@Component({
  standalone: false,
  selector: 'app-hr-dashboard',
  templateUrl: './hr-dashboard.component.html',
  styleUrls: ['./hr-dashboard.component.css']
})
export class HrDashboardComponent implements OnInit, OnDestroy {
  loading = true;
  stats = {
    totalEmployees: 0,
    presentToday: 0,
    onLeave: 0,
    pendingLeaves: 0,
    lateArrivals: 0,
  };

  payrollStats = {
    totalEmployees: 0,
    processedPayslips: 0,
    pendingPayslips: 0,
    totalPayroll: 0,
  };

  recentPunches: any[] = [];
  pendingLeaves: any[] = [];
  currentUser: any = null;
  greeting = 'Welcome';
  todayDate = new Date();

  // Employee specific data
  myLeavesInfo: any = null;
  myRecentPayslip: any = null;
  upcomingHolidays: any[] = [];
  myTodayPunches: any[] = [];

  // Clock status for logged in user
  isClockedIn = false;
  punchStatusLoading = false;
  firstPunchTime: string | null = null;

  refreshInterval: any;
  lastUpdated: Date = new Date();

  constructor(
    private coreService: CoreService,
    public auth: SharedAuthService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.auth.getUser() || { name: 'Staff', roleId: 3 };
    this.setGreeting();
    this.loadAllDashboardData();

    // Auto-refresh every 2 minutes
    this.refreshInterval = setInterval(() => {
      this.loadAllDashboardData(false);
    }, 2 * 60 * 1000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  setGreeting(): void {
    const hr = new Date().getHours();
    if (hr < 12) this.greeting = 'Good Morning';
    else if (hr < 18) this.greeting = 'Good Afternoon';
    else this.greeting = 'Good Evening';
  }

  loadAllDashboardData(showLoading = true): void {
    if (showLoading) this.loading = true;

    // Check user punch status
    this.checkPunchStatus();

    // Load upcoming company holidays
    this.coreService.getRequest(`${AppConstants.API_URL}leaves/institute-holidays`).subscribe({
      next: (holidays: any[]) => {
        this.upcomingHolidays = (holidays || []).slice(0, 4);
      },
      error: () => {}
    });

    if (this.auth.isEmployee()) {
      // Employee self-service data
      this.coreService.getRequest(`${AppConstants.API_URL}leaves/my-leaves-info`).subscribe({
        next: (info: any) => {
          this.myLeavesInfo = info;
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });

      this.coreService.getRequest(`${AppConstants.API_URL}hr/payroll/payslips`).subscribe({
        next: (payslips: any[]) => {
          if (payslips && payslips.length > 0) {
            this.myRecentPayslip = payslips[0];
          }
        },
        error: () => {}
      });

      this.coreService.getRequest(`${AppConstants.API_URL}attendance/my-history`).subscribe({
        next: (res: any) => {
          this.myTodayPunches = (res?.history || []).slice(0, 5);
        },
        error: () => {}
      });

    } else {
      // Admin / HR data
      this.coreService.getRequest(`${AppConstants.API_URL}hr/dashboard-stats`).subscribe({
        next: (data: any) => {
          this.stats = data || this.stats;
          this.lastUpdated = new Date();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        }
      });

      this.coreService.getRequest(`${AppConstants.API_URL}hr/payroll/stats`).subscribe({
        next: (data: any) => {
          this.payrollStats = data || this.payrollStats;
        },
        error: () => {}
      });

      this.coreService.getRequest(`${AppConstants.API_URL}bio/punches/recent?mapped=known`).subscribe({
        next: (data: any) => {
          this.recentPunches = (data.punches || []).slice(0, 5);
        },
        error: () => {}
      });

      this.coreService.getRequest(`${AppConstants.API_URL}leaves`).subscribe({
        next: (leaves: any[]) => {
          this.pendingLeaves = (leaves || []).filter(l => l.status === 'Pending').slice(0, 5);
        },
        error: () => {}
      });
    }
  }

  checkPunchStatus(): void {
    this.coreService.getRequest(`${AppConstants.API_URL}attendance/my-status`).subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.isClockedIn = res.isClockedIn;
          this.firstPunchTime = res.firstPunchTime;
        }
      },
      error: () => {}
    });
  }

  togglePunch(): void {
    this.punchStatusLoading = true;
    const type = this.isClockedIn ? 'Clock Out' : 'Clock In';
    this.coreService.postRequest(`${AppConstants.API_URL}attendance/punch`, { punchType: type }).subscribe({
      next: (res: any) => {
        this.punchStatusLoading = false;
        if (res && res.success) {
          this.isClockedIn = res.isClockedIn;
          this.checkPunchStatus();
          this.loadAllDashboardData(false);
        }
      },
      error: () => {
        this.punchStatusLoading = false;
      }
    });
  }

  approveLeave(leave: any): void {
    this.coreService.putRequest(`${AppConstants.API_URL}leaves/`, {
      leaveId: leave.leaveId,
      status: 2,
      response: 'Approved by HR Manager',
      userId: leave.userId
    }).subscribe({
      next: () => {
        this.loadAllDashboardData(false);
      },
      error: (err: any) => {
        alert(err.error?.message || 'Failed to approve leave');
      }
    });
  }

  rejectLeave(leave: any): void {
    const reason = prompt('Please provide reason for rejection:', 'Not approved');
    if (reason === null) return;

    this.coreService.putRequest(`${AppConstants.API_URL}leaves/`, {
      leaveId: leave.leaveId,
      status: 3,
      response: reason || 'Rejected',
      userId: leave.userId
    }).subscribe({
      next: () => {
        this.loadAllDashboardData(false);
      },
      error: (err: any) => {
        alert(err.error?.message || 'Failed to reject leave');
      }
    });
  }

  getAttendancePercentage(): number {
    if (!this.stats.totalEmployees) return 0;
    return Math.round((this.stats.presentToday / this.stats.totalEmployees) * 100);
  }

  getLeavePercentage(): number {
    if (!this.stats.totalEmployees) return 0;
    return Math.round((this.stats.onLeave / this.stats.totalEmployees) * 100);
  }
}