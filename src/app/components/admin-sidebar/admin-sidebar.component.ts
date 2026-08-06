import { Component } from '@angular/core';

@Component({
  standalone: false,
  selector: 'admin-sidebar',
  template: `
    <nav class="admin-sidebar">
      <a routerLink="/users/human-resources/dashboard" routerLinkActive="active">
        <mat-icon>dashboard</mat-icon>
        <span>Dashboard</span>
      </a>
      <a routerLink="/users/human-resources/analytics" routerLinkActive="active">
        <mat-icon>bar_chart</mat-icon>
        <span>Analytics</span>
      </a>
      <a routerLink="/users/human-resources/leaves" routerLinkActive="active">
        <mat-icon>event</mat-icon>
        <span>Leaves</span>
      </a>
      <a routerLink="/users/human-resources/attendance" routerLinkActive="active">
        <mat-icon>how_to_reg</mat-icon>
        <span>Attendance</span>
      </a>
      <a routerLink="/users/human-resources/payroll" routerLinkActive="active">
        <mat-icon>payments</mat-icon>
        <span>Payroll</span>
      </a>
      <a routerLink="/users/human-resources/biometric" routerLinkActive="active">
        <mat-icon>fingerprint</mat-icon>
        <span>Biometric Devices</span>
      </a>
      <a routerLink="/users/human-resources/punches" routerLinkActive="active">
        <mat-icon>schedule</mat-icon>
        <span>Biometric Punches</span>
      </a>
      <a routerLink="/users/human-resources/attendance/reports" routerLinkActive="active">
        <mat-icon>description</mat-icon>
        <span>Reports</span>
      </a>
    </nav>
  `,
  styles: [
    `
      .admin-sidebar {
        width: 220px;
        background: #263238;
        min-height: calc(100vh - 56px);
        display: flex;
        flex-direction: column;
        padding: 8px 0;
      }
      .admin-sidebar a {
        color: rgba(255, 255, 255, 0.85);
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        font-size: 14px;
        transition: background 0.2s;
      }
      .admin-sidebar a:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .admin-sidebar a.active {
        background: #3f51b5;
        color: #fff;
      }
      .admin-sidebar mat-icon {
        font-size: 20px;
        height: 20px;
        width: 20px;
      }
    `,
  ],
})
export class AdminSidebarComponent {}
