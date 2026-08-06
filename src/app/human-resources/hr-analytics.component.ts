import { Component, OnInit } from '@angular/core';

import { Chart, registerables } from 'chart.js';
import { AppConstants } from 'src/app/AppConstants';
import { CoreService } from 'src/app/service/core.service';

Chart.register(...registerables);

interface OverviewData {
  averageRating: number;
  totalReviews: number;
  performanceDistribution: any;
}

@Component({
  standalone: false,
  selector: 'app-hr-analytics',
  templateUrl: './hr-analytics.component.html',
  styleUrls: ['./hr-analytics.component.css']
})
export class HrAnalyticsComponent implements OnInit {
  loading = false;
  dashboardStats = {
    totalEmployees: 0,
    presentToday: 0,
    onLeave: 0,
    pendingLeaves: 0,
    lateArrivals: 0
  };
  
  attendanceData = [];
  leaveData = [];
  overviewData: OverviewData = {
    averageRating: 0,
    totalReviews: 0,
    performanceDistribution: {}
  };
  
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  
  months = [
    {value: 1, label: 'January'}, {value: 2, label: 'February'}, {value: 3, label: 'March'},
    {value: 4, label: 'April'}, {value: 5, label: 'May'}, {value: 6, label: 'June'},
    {value: 7, label: 'July'}, {value: 8, label: 'August'}, {value: 9, label: 'September'},
    {value: 10, label: 'October'}, {value: 11, label: 'November'}, {value: 12, label: 'December'}
  ];
  
  years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i);
  
  attendanceChart: any;
  leaveChart: any;
  performanceChart: any;

  constructor(private coreService: CoreService) {}

  ngOnInit() {
    this.loadDashboardStats();
    this.loadAttendanceAnalytics();
    this.loadLeaveAnalytics();
    this.loadOverviewAnalytics();
  }

  loadDashboardStats() {
    this.loading = true;
    this.coreService.getRequest(`${AppConstants.API_URL}hr/dashboard-stats`).subscribe({
      next: (data: any) => {
        this.dashboardStats = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        console.error('Failed to load dashboard stats');
      }
    });
  }

  loadAttendanceAnalytics() {
    const params = `month=${this.selectedMonth}&year=${this.selectedYear}`;
    this.coreService.getRequest(`${AppConstants.API_URL}hr/analytics/attendance?${params}`).subscribe({
      next: (data: any) => {
        this.attendanceData = data;
        this.createAttendanceChart();
      },
      error: () => console.error('Failed to load attendance analytics')
    });
  }

  loadLeaveAnalytics() {
    this.coreService.getRequest(`${AppConstants.API_URL}hr/analytics/leaves?year=${this.selectedYear}`).subscribe({
      next: (data: any) => {
        this.leaveData = data;
        this.createLeaveChart();
      },
      error: () => console.error('Failed to load leave analytics')
    });
  }

  loadOverviewAnalytics() {
    this.coreService.getRequest(`${AppConstants.API_URL}hr/analytics/overview`).subscribe({
      next: (data: any) => {
        this.overviewData = data;
        this.createPerformanceChart();
      },
      error: () => console.error('Failed to load overview analytics')
    });
  }

  createAttendanceChart() {
    const ctx = document.getElementById('attendanceChart') as HTMLCanvasElement;
    if (!ctx) return;

    // Dynamically set chart width
    const container = ctx.parentElement;
    if (container) {
      const chartWidth = Math.max(this.attendanceData.length * 40, 800); // 40px per bar, min 800px
      container.style.width = chartWidth + 'px';
    }

    if (this.attendanceChart) {
      this.attendanceChart.destroy();
    }

    const labels = this.attendanceData.map(d => d.name);
    const presentDays = this.attendanceData.map(d => d.presentDays);
    const leaveDays = this.attendanceData.map(d => d.leaveDays);

    this.attendanceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Present Days',
            data: presentDays,
            backgroundColor: '#4CAF50',
            borderColor: '#45a049',
            borderWidth: 1
          },
          {
            label: 'Leave Days',
            data: leaveDays,
            backgroundColor: '#FF9800',
            borderColor: '#f57c00',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Attendance Overview - ${this.getMonthName(this.selectedMonth)} ${this.selectedYear}`
          },
          legend: {
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Days'
            }
          }
        }
      }
    });
  }

  createLeaveChart() {
    const ctx = document.getElementById('leaveChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.leaveChart) {
      this.leaveChart.destroy();
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const labels = this.leaveData.map(d => monthNames[d.month - 1]);
    const approved = this.leaveData.map(d => d.approved);
    const pending = this.leaveData.map(d => d.pending);
    const rejected = this.leaveData.map(d => d.rejected);

    this.leaveChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Approved',
            data: approved,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            tension: 0.4
          },
          {
            label: 'Pending',
            data: pending,
            borderColor: '#FF9800',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            tension: 0.4
          },
          {
            label: 'Rejected',
            data: rejected,
            borderColor: '#F44336',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `Leave Trends - ${this.selectedYear}`
          },
          legend: {
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Leaves'
            }
          }
        }
      }
    });
  }

  createPerformanceChart() {
    const ctx = document.getElementById('performanceChart') as HTMLCanvasElement;
    if (!ctx) return;

    if (this.performanceChart) {
      this.performanceChart.destroy();
    }

    this.performanceChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Excellent (4.5-5)', 'Good (3.5-4.4)', 'Average (2.5-3.4)', 'Below Average (<2.5)'],
        datasets: [{
          data: [25, 45, 25, 5], // Sample data - replace with actual performance distribution
          backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#F44336'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Performance Rating Distribution'
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  onFilterChange() {
    this.loadAttendanceAnalytics();
    this.loadLeaveAnalytics();
  }

  getMonthName(month: number): string {
    return this.months.find(m => m.value === month)?.label || '';
  }

  getAttendancePercentage(): number {
    if (this.dashboardStats.totalEmployees === 0) return 0;
    return Math.round((this.dashboardStats.presentToday / this.dashboardStats.totalEmployees) * 100);
  }

  getLeavePercentage(): number {
    if (this.dashboardStats.totalEmployees === 0) return 0;
    return Math.round((this.dashboardStats.onLeave / this.dashboardStats.totalEmployees) * 100);
  }
}