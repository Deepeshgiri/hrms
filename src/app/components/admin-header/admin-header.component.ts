import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SharedAuthService } from 'src/app/service/shared-auth.service';
import { CoreService } from 'src/app/service/core.service';
import { SocketService } from 'src/app/service/socket.service';
import { AppConstants } from 'src/app/AppConstants';

@Component({
  standalone: false,
  selector: 'admin-header',
  template: `
    <header class="admin-header">
      <div class="header-left">
        <div class="brand-badge">
          <span class="brand-icon">🏢</span>
          <span class="app-title">HRMS Enterprise</span>
        </div>
      </div>

      <div class="header-center">
        <!-- Live Clock -->
        <div class="live-clock">
          <mat-icon class="clock-icon">schedule</mat-icon>
          <span>{{ currentTime }}</span>
        </div>

        <!-- Quick Web Punch Button -->
        <button 
          class="punch-btn" 
          [class.clocked-in]="isClockedIn"
          [disabled]="punchLoading"
          (click)="togglePunch()"
          [matTooltip]="isClockedIn ? 'Click to Clock Out' : 'Click to Clock In'"
        >
          <span class="punch-indicator"></span>
          <span class="punch-text">
            {{ punchLoading ? 'Logging...' : (isClockedIn ? 'Clock Out' : 'Clock In') }}
          </span>
          <span class="punch-time-badge" *ngIf="isClockedIn && firstPunchTime">
            Since {{ firstPunchTime.slice(0, 5) }}
          </span>
        </button>
      </div>

      <div class="header-right">
        <!-- Team Chat & Calling Icon -->
        <button class="header-icon-btn chat-nav-btn" routerLink="/users/human-resources/chat" matTooltip="Team Chat & Calls">
          <mat-icon style="color: #38bdf8;">forum</mat-icon>
          <span class="chat-badge" *ngIf="unreadMessagesCount > 0">{{ unreadMessagesCount }}</span>
        </button>

        <!-- User Profile Badge -->
        <div class="user-pill">
          <div class="user-avatar">{{ userInitials }}</div>
          <div class="user-meta">
            <span class="user-name">{{ userName }}</span>
            <span class="user-role">{{ roleName }}</span>
          </div>
        </div>

        <!-- Logout Button -->
        <button class="header-icon-btn logout-btn" (click)="logout()" matTooltip="Sign Out">
          <mat-icon>logout</mat-icon>
        </button>
      </div>
    </header>
  `,
  styles: [
    `
      .admin-header {
        background: #0f172a;
        color: #ffffff;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        position: sticky;
        top: 0;
        z-index: 100;
        border-bottom: 1px solid #1e293b;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.2);
      }

      .header-left {
        display: flex;
        align-items: center;
      }

      .brand-badge {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .brand-icon {
        font-size: 20px;
      }

      .app-title {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: #ffffff;
      }

      .header-center {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .live-clock {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 500;
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.05);
        padding: 6px 12px;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .clock-icon {
        font-size: 16px;
        height: 16px;
        width: 16px;
        color: #818cf8;
      }

      .punch-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 9999px;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid #059669;
        background: #065f46;
        color: #ecfdf5;
        transition: all 0.2s ease;
      }

      .punch-btn:hover {
        background: #047857;
        box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
      }

      .punch-btn.clocked-in {
        background: #7c2d12;
        border-color: #ea580c;
        color: #ffedd5;
      }

      .punch-btn.clocked-in:hover {
        background: #9a3412;
        box-shadow: 0 0 12px rgba(249, 115, 22, 0.3);
      }

      .punch-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 6px #10b981;
      }

      .punch-btn.clocked-in .punch-indicator {
        background: #f97316;
        box-shadow: 0 0 6px #f97316;
        animation: pulse 1.5s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.2); }
      }

      .punch-time-badge {
        font-size: 11px;
        background: rgba(0, 0, 0, 0.25);
        padding: 2px 6px;
        border-radius: 4px;
        margin-left: 2px;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .user-pill {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(255, 255, 255, 0.05);
        padding: 4px 12px 4px 6px;
        border-radius: 9999px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12.5px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .user-meta {
        display: flex;
        flex-direction: column;
      }

      .user-name {
        font-size: 13px;
        font-weight: 600;
        color: #f1f5f9;
        line-height: 1.2;
      }

      .user-role {
        font-size: 11px;
        color: #818cf8;
        font-weight: 500;
      }

      .header-icon-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: all 0.15s ease;
      }

      .header-icon-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      .logout-btn:hover {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }

      .chat-nav-btn {
        position: relative;
      }

      .chat-badge {
        position: absolute;
        top: 2px;
        right: 2px;
        background: #10b981;
        color: white;
        font-size: 10px;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 9999px;
        line-height: 1.2;
      }
    `,
  ],
})
export class AdminHeaderComponent implements OnInit, OnDestroy {
  userName = '';
  roleName = '';
  userInitials = '';
  currentTime = '';
  isClockedIn = false;
  firstPunchTime: string | null = null;
  punchLoading = false;
  unreadMessagesCount = 0;

  private clockInterval: any;
  private socketSub: any;

  constructor(
    private auth: SharedAuthService,
    private coreService: CoreService,
    private router: Router,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    const user = this.auth.getUser();
    this.userName = user?.name || user?.email || 'User';
    this.roleName = this.getRoleLabel(user?.roleId);
    this.userInitials = this.getInitials(this.userName);

    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);

    this.checkPunchStatus();

    this.socketSub = this.socketService.totalUnread$.subscribe((count) => {
      this.unreadMessagesCount = count;
    });
  }

  ngOnDestroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
    if (this.socketSub) {
      this.socketSub.unsubscribe();
    }
  }

  updateClock() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  checkPunchStatus() {
    this.coreService.getRequest(`${AppConstants.API_URL}attendance/my-status`).subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.isClockedIn = res.isClockedIn;
          this.firstPunchTime = res.firstPunchTime;
        }
      },
      error: () => {},
    });
  }

  togglePunch() {
    this.punchLoading = true;
    const type = this.isClockedIn ? 'Clock Out' : 'Clock In';
    this.coreService.postRequest(`${AppConstants.API_URL}attendance/punch`, { punchType: type }).subscribe({
      next: (res: any) => {
        this.punchLoading = false;
        if (res && res.success) {
          this.isClockedIn = res.isClockedIn;
          this.checkPunchStatus();
        }
      },
      error: () => {
        this.punchLoading = false;
      },
    });
  }

  getRoleLabel(roleId: number): string {
    switch (roleId) {
      case 1:
        return 'Administrator';
      case 2:
        return 'HR Manager';
      case 3:
        return 'Employee';
      case 4:
        return 'Finance';
      default:
        return 'Staff';
    }
  }

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || 'U').toUpperCase();
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
