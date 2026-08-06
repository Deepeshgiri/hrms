import { NgModule, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { AppConstants } from 'src/app/AppConstants';
import { CoreService } from 'src/app/service/core.service';
import {PinnacleCommonModule} from 'src/app/pinnacle-common.module';

@Component({
 templateUrl: './analytics-component.html',
 standalone: false,
})
class AnalyticsComponent implements OnInit {
  loading = false;
  overview: any = {};
  attendanceReport = [];
  leaveAnalytics = [];
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();

  constructor(private coreService: CoreService) {}

  ngOnInit() {
    this.loadOverview();
    this.loadLeaveAnalytics();
  }

  loadOverview() {
    this.coreService.getRequest(`${AppConstants.API_URL}hr/analytics/overview`)
      .subscribe((data: any) => { this.overview = data; });
  }

  loadAttendanceReport() {
    this.loading = true;
    this.coreService.getRequest(`${AppConstants.API_URL}hr/analytics/attendance?month=${this.selectedMonth}&year=${this.selectedYear}`)
      .subscribe((data: any) => { this.attendanceReport = data; this.loading = false; });
  }

  loadLeaveAnalytics() {
    this.coreService.getRequest(`${AppConstants.API_URL}hr/analytics/leaves?year=${this.selectedYear}`)
      .subscribe((data: any) => { this.leaveAnalytics = data; });
  }

  getAttendancePercentage(r: any) {
    const total = 30; // Assuming 30 days in month
    return ((r.presentDays / total) * 100).toFixed(1);
  }

  getMonthName(m: number) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[m - 1];
  }
}

const routes: Routes = [{ path: '', component: AnalyticsComponent }];

@NgModule({
  declarations: [AnalyticsComponent],
  imports: [CommonModule, PinnacleCommonModule, RouterModule.forChild(routes)]
})
export class AnalyticsModule { }
