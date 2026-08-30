import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SharedAuthService } from 'src/app/service/shared-auth.service';
import { CoreService } from 'src/app/service/core.service';
import { SocketService } from 'src/app/service/socket.service';
import { AppConstants } from 'src/app/AppConstants';

@Component({
  standalone: false,
  selector: 'admin-sidebar',
  template: `
    <nav class="admin-sidebar">

      <!-- ================= EMPLOYEE SELF SERVICE MENU ================= -->
      <ng-container *ngIf="auth.isEmployee()">
        <div class="sidebar-section-title">Communication</div>
        <a routerLink="/users/human-resources/chat" routerLinkActive="active" class="menu-item-badge">
          <mat-icon style="color: #38bdf8;">forum</mat-icon>
          <span>Team Chat & Calls</span>
          <span class="badge" *ngIf="unreadMessagesCount > 0">{{ unreadMessagesCount }}</span>
        </a>

        <div class="sidebar-section-title">Self Service</div>
        <a routerLink="/users/human-resources/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <mat-icon>dashboard</mat-icon>
          <span>My Dashboard</span>
        </a>
        <a routerLink="/users/human-resources/attendance" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <mat-icon>calendar_view_month</mat-icon>
          <span>My Attendance</span>
        </a>
        <a routerLink="/users/human-resources/leaves" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <mat-icon>event</mat-icon>
          <span>My Leaves</span>
        </a>
        <a routerLink="/users/human-resources/payroll/payslips" routerLinkActive="active">
          <mat-icon>receipt_long</mat-icon>
          <span>My Payslips</span>
        </a>
        <a routerLink="/users/human-resources/leaves/institute-holidays" routerLinkActive="active">
          <mat-icon>event_available</mat-icon>
          <span>Company Holidays</span>
        </a>
      </ng-container>

      <!-- ================= HR / ADMIN MENU ================= -->
      <ng-container *ngIf="auth.isAdminOrHR()">
        <!-- Core -->
        <div class="sidebar-section-title">Core</div>
        <a routerLink="/users/human-resources/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <mat-icon>dashboard</mat-icon>
          <span>Dashboard</span>
        </a>
        <a routerLink="/users/human-resources/chat" routerLinkActive="active" class="menu-item-badge">
          <mat-icon style="color: #38bdf8;">forum</mat-icon>
          <span>Team Chat & Calls</span>
          <span class="badge" *ngIf="unreadMessagesCount > 0">{{ unreadMessagesCount }}</span>
        </a>
        <a routerLink="/users/human-resources/roles-permissions" routerLinkActive="active">
          <mat-icon style="color: #a78bfa;">shield</mat-icon>
          <span>Roles & Permissions</span>
        </a>
        <a routerLink="/users/human-resources/analytics" routerLinkActive="active">
          <mat-icon>bar_chart</mat-icon>
          <span>Analytics</span>
        </a>
        <a routerLink="/users/human-resources/employees" routerLinkActive="active">
          <mat-icon>people_alt</mat-icon>
          <span>Employees</span>
        </a>

        <!-- Time & Attendance -->
        <div class="sidebar-section-title">Time & Attendance</div>
        <a routerLink="/users/human-resources/attendance" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <mat-icon>calendar_view_month</mat-icon>
          <span>Attendance Sheet</span>
        </a>
        <a routerLink="/users/human-resources/attendance/today" routerLinkActive="active">
          <mat-icon>today</mat-icon>
          <span>Today's Roster</span>
        </a>
        <a routerLink="/users/human-resources/attendance/manual" routerLinkActive="active">
          <mat-icon>edit_calendar</mat-icon>
          <span>Manual Entry</span>
        </a>
        <a routerLink="/users/human-resources/attendance/set-timings" routerLinkActive="active">
          <mat-icon>access_time</mat-icon>
          <span>Shift Timings</span>
        </a>

        <!-- Leaves -->
        <div class="sidebar-section-title">Leaves</div>
        <a routerLink="/users/human-resources/leaves" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <mat-icon>event</mat-icon>
          <span>My Leaves</span>
        </a>
        <a routerLink="/users/human-resources/leaves/users-leaves" routerLinkActive="active" class="menu-item-badge">
          <mat-icon>how_to_reg</mat-icon>
          <span>Leave Approvals</span>
          <span class="badge" *ngIf="pendingLeavesCount > 0">{{ pendingLeavesCount }}</span>
        </a>
        <a routerLink="/users/human-resources/leaves/institute-holidays" routerLinkActive="active">
          <mat-icon>event_available</mat-icon>
          <span>Company Holidays</span>
        </a>
        <a routerLink="/users/human-resources/leaves/allot-leaves" routerLinkActive="active">
          <mat-icon>assignment_ind</mat-icon>
          <span>Leave Quotas</span>
        </a>

        <!-- Payroll -->
        <div class="sidebar-section-title">Payroll</div>
        <a routerLink="/users/human-resources/payroll" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <mat-icon>payments</mat-icon>
          <span>Payroll Summary</span>
        </a>
        <a routerLink="/users/human-resources/payroll/payslips" routerLinkActive="active">
          <mat-icon>receipt_long</mat-icon>
          <span>Payslips</span>
        </a>
        <a routerLink="/users/human-resources/payroll/salary-structure" routerLinkActive="active">
          <mat-icon>account_balance_wallet</mat-icon>
          <span>Salary Structures</span>
        </a>

        <!-- Biometrics & Reports -->
        <div class="sidebar-section-title">Biometrics & Reports</div>
        <a routerLink="/users/human-resources/biometric" routerLinkActive="active">
          <mat-icon>fingerprint</mat-icon>
          <span>Biometric Devices</span>
        </a>
        <a routerLink="/users/human-resources/punches" routerLinkActive="active">
          <mat-icon>schedule</mat-icon>
          <span>Punch Logs</span>
        </a>
        <a routerLink="/users/human-resources/attendance/reports" routerLinkActive="active">
          <mat-icon>description</mat-icon>
          <span>HR Reports</span>
        </a>
        <a routerLink="/users/human-resources/audit-logs" routerLinkActive="active">
          <mat-icon style="color: #818cf8;">troubleshoot</mat-icon>
          <span>Live Audit Logs</span>
        </a>
      </ng-container>

      <!-- ================= FINANCE MENU ================= -->
      <ng-container *ngIf="auth.isFinance()">
        <div class="sidebar-section-title">Core</div>
        <a routerLink="/users/human-resources/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <mat-icon>dashboard</mat-icon>
          <span>Dashboard</span>
        </a>
        <a routerLink="/users/human-resources/chat" routerLinkActive="active" class="menu-item-badge">
          <mat-icon style="color: #38bdf8;">forum</mat-icon>
          <span>Team Chat & Calls</span>
          <span class="badge" *ngIf="unreadMessagesCount > 0">{{ unreadMessagesCount }}</span>
        </a>

        <div class="sidebar-section-title">Payroll & Finance</div>
        <a routerLink="/users/human-resources/payroll" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <mat-icon>payments</mat-icon>
          <span>Payroll Summary</span>
        </a>
        <a routerLink="/users/human-resources/payroll/payslips" routerLinkActive="active">
          <mat-icon>receipt_long</mat-icon>
          <span>Payslips</span>
        </a>
        <a routerLink="/users/human-resources/payroll/salary-structure" routerLinkActive="active">
          <mat-icon>account_balance_wallet</mat-icon>
          <span>Salary Structures</span>
        </a>
        <a routerLink="/users/human-resources/attendance/reports" routerLinkActive="active">
          <mat-icon>description</mat-icon>
          <span>Reports</span>
        </a>

        <div class="sidebar-section-title">Self Service</div>
        <a routerLink="/users/human-resources/attendance" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <mat-icon>calendar_view_month</mat-icon>
          <span>My Attendance</span>
        </a>
        <a routerLink="/users/human-resources/leaves" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <mat-icon>event</mat-icon>
          <span>My Leaves</span>
        </a>
        <a routerLink="/users/human-resources/leaves/institute-holidays" routerLinkActive="active">
          <mat-icon>event_available</mat-icon>
          <span>Company Holidays</span>
        </a>
      </ng-container>

      <div class="sidebar-footer">
        <a class="logout-link" (click)="logout()">
          <mat-icon>logout</mat-icon>
          <span>Sign Out</span>
        </a>
      </div>
    </nav>
  `,
  styles: [
    `
      .admin-sidebar {
        width: 240px;
        background: #0f172a;
        height: calc(100vh - 60px);
        display: flex;
        flex-direction: column;
        padding: 12px 0 20px 0;
        overflow-y: auto;
        border-right: 1px solid #1e293b;
      }

      .sidebar-section-title {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #475569;
        padding: 14px 20px 6px 20px;
      }

      .admin-sidebar a {
        color: #94a3b8;
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 9px 20px;
        font-size: 13.5px;
        font-weight: 500;
        transition: all 0.15s ease;
        cursor: pointer;
        border-left: 3px solid transparent;
        margin: 1px 0;
      }

      .admin-sidebar a:hover {
        background: rgba(255, 255, 255, 0.04);
        color: #f1f5f9;
      }

      .admin-sidebar a.active {
        background: rgba(79, 70, 229, 0.12);
        color: #818cf8;
        border-left-color: #6366f1;
        font-weight: 600;
      }

      .admin-sidebar a.active mat-icon {
        color: #818cf8;
      }

      .admin-sidebar mat-icon {
        font-size: 19px;
        height: 19px;
        width: 19px;
        color: #64748b;
        transition: color 0.15s;
      }

      .menu-item-badge {
        justify-content: flex-start;
      }

      .badge {
        margin-left: auto;
        background: #10b981;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 9999px;
      }

      .sidebar-footer {
        margin-top: auto;
        padding-top: 16px;
        border-top: 1px solid #1e293b;
      }

      .logout-link {
        color: #f87171 !important;
      }

      .logout-link:hover {
        background: rgba(239, 68, 68, 0.1) !important;
        color: #ef4444 !important;
      }

      .logout-link mat-icon {
        color: #f87171 !important;
      }
    `,
  ],
})
export class AdminSidebarComponent implements OnInit {
  pendingLeavesCount = 0;
  unreadMessagesCount = 0;

  constructor(
    public auth: SharedAuthService,
    private coreService: CoreService,
    private router: Router,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    if (this.auth.isAdminOrHR()) {
      this.loadPendingLeaves();
    }
    this.socketService.totalUnread$.subscribe((count) => {
      this.unreadMessagesCount = count;
    });
  }

  loadPendingLeaves() {
    this.coreService.getRequest(`${AppConstants.API_URL}leaves/pending-leaves-count`).subscribe({
      next: (count: any) => {
        this.pendingLeavesCount = Number(count) || 0;
      },
      error: () => {},
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
