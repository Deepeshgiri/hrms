import { Component } from '@angular/core';

@Component({
  standalone: false,
  selector: 'admin-header',
  template: `
    <header class="admin-header">
      <div class="header-left">
        <span class="app-title">HRMS</span>
      </div>
      <div class="header-right">
        <button mat-icon-button matTooltip="Dashboard" routerLink="/users/human-resources/dashboard">
          <mat-icon>dashboard</mat-icon>
        </button>
      </div>
    </header>
  `,
  styles: [
    `
      .admin-header {
        background: #3f51b5;
        color: #fff;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
      }
      .app-title {
        font-size: 20px;
        font-weight: 500;
      }
      .header-right button {
        color: #fff;
      }
    `,
  ],
})
export class AdminHeaderComponent {}
