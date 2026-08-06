import { Component, OnInit, OnDestroy } from '@angular/core';
import { CoreService } from 'src/app/service/core.service';
import { AppConstants } from 'src/app/AppConstants';
import { permissionsObject ,Permissions} from '../user.modal';

@Component({
  standalone: false,
  selector: 'app-hr-dashboard',
  templateUrl: './hr-dashboard.component.html',
  styleUrls: ['./hr-dashboard.component.css']
})

export class HrDashboardComponent implements OnInit, OnDestroy {
  loading = true;
  stats = { totalEmployees: 0, presentToday: 0, onLeave: 0, pendingLeaves: 0, lateArrivals: 0 };
  refreshInterval: any;
  lastUpdated: Date = new Date();
  permissions: Permissions = permissionsObject
  constructor(private coreService: CoreService) { }

  ngOnInit(): void {
    this.loadDashboardStats();
    // Auto-refresh every 5 minutes
    this.refreshInterval = setInterval(() => {
      this.loadDashboardStats(false);
    }, 5 * 60 * 1000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadDashboardStats(showLoading = true): void {
    if (showLoading) this.loading = true;

    this.coreService.getRequest(`${AppConstants.API_URL}hr/dashboard-stats`).subscribe({
      next: (data: any) => {
        this.stats = data;
        this.lastUpdated = new Date();
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load dashboard stats:', error);
        this.loading = false;
      }
    });
  }

  refreshStats(): void {
    this.loadDashboardStats();
  }

  getAttendancePercentage(): number {
    if (this.stats.totalEmployees === 0) return 0;
    return Math.round((this.stats.presentToday / this.stats.totalEmployees) * 100);
  }

  getLeavePercentage(): number {
    if (this.stats.totalEmployees === 0) return 0;
    return Math.round((this.stats.onLeave / this.stats.totalEmployees) * 100);
  }
}