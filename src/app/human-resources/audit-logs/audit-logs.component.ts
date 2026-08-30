import { Component, OnInit, OnDestroy } from '@angular/core';
import { CoreService } from 'src/app/service/core.service';
import { AppConstants } from 'src/app/AppConstants';

@Component({
  standalone: false,
  selector: 'app-audit-logs',
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.css']
})
export class AuditLogsComponent implements OnInit, OnDestroy {
  loading: boolean = false;
  logs: any[] = [];
  filteredLogs: any[] = [];
  totalLogs: number = 0;
  users: any[] = [];

  stats = {
    todayLogs: 0,
    userChangesToday: 0,
    leaveActionsToday: 0,
    payrollActionsToday: 0,
    attendanceActionsToday: 0,
    topActions: []
  };

  // Filters
  searchQuery: string = '';
  selectedCategory: string = 'ALL';
  selectedUserId: any = '';
  startDate: string = '';
  endDate: string = '';

  // Live Auto-Refresh (Polling every 5s)
  isLive: boolean = true;
  pollInterval: any = null;
  lastUpdated: Date = new Date();

  // Inspect Modal
  inspectModal: boolean = false;
  selectedLog: any = null;

  constructor(private coreService: CoreService) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadUsers();
    this.loadLogs();
    this.startLivePolling();
  }

  ngOnDestroy(): void {
    this.stopLivePolling();
  }

  startLivePolling(): void {
    this.isLive = true;
    this.pollInterval = setInterval(() => {
      if (this.isLive) {
        this.loadLogs(true);
        this.loadStats();
      }
    }, 5000);
  }

  stopLivePolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  toggleLive(): void {
    this.isLive = !this.isLive;
  }

  loadUsers(): void {
    this.coreService.getRequest(`${AppConstants.API_URL}users`).subscribe({
      next: (data: any[]) => {
        this.users = data || [];
      },
      error: () => {}
    });
  }

  loadStats(): void {
    this.coreService.getRequest(`${AppConstants.API_URL}logs/stats`).subscribe({
      next: (res: any) => {
        if (res) this.stats = res;
      },
      error: () => {}
    });
  }

  loadLogs(isSilent: boolean = false): void {
    if (!isSilent) this.loading = true;

    let url = `${AppConstants.API_URL}logs?limit=150`;
    if (this.selectedUserId) url += `&userId=${this.selectedUserId}`;
    if (this.startDate) url += `&startDate=${this.startDate}`;
    if (this.endDate) url += `&endDate=${this.endDate}`;
    if (this.selectedCategory !== 'ALL') url += `&entityType=${this.selectedCategory}`;

    this.coreService.getRequest(url).subscribe({
      next: (res: any) => {
        this.logs = res.logs || [];
        this.totalLogs = res.total || this.logs.length;
        this.applySearchFilter();
        this.lastUpdated = new Date();
        if (!isSilent) this.loading = false;
      },
      error: () => {
        if (!isSilent) this.loading = false;
      }
    });
  }

  setCategory(cat: string): void {
    this.selectedCategory = cat;
    this.loadLogs();
  }

  applySearchFilter(): void {
    if (!this.searchQuery) {
      this.filteredLogs = [...this.logs];
      return;
    }
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredLogs = this.logs.filter(l =>
      l.description?.toLowerCase().includes(q) ||
      l.userName?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.entityType?.toLowerCase().includes(q) ||
      l.userEmail?.toLowerCase().includes(q)
    );
  }

  inspectLog(log: any): void {
    this.selectedLog = log;
    this.inspectModal = true;
  }

  exportCsv(): void {
    window.open(`${AppConstants.API_URL}logs/export`, '_blank');
  }

  getActionBadgeClass(action: string): string {
    if (!action) return 'default';
    const a = action.toUpperCase();
    if (a.includes('CREATED') || a.includes('ADDED') || a.includes('APPROVED')) return 'badge-success';
    if (a.includes('DELETED') || a.includes('REJECTED')) return 'badge-danger';
    if (a.includes('UPDATED') || a.includes('SAVED')) return 'badge-primary';
    if (a.includes('PUNCH') || a.includes('CLOCK')) return 'badge-info';
    return 'badge-secondary';
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#14b8a6', '#f97316', '#6366f1'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  getInitials(name: string): string {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || 'S').toUpperCase();
  }

  getJsonString(data: any): string {
    if (!data) return 'No additional payload';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }
}
