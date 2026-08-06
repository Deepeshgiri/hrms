import { Injectable } from '@angular/core';
import { AppConstants } from '../AppConstants';
import { CoreService } from './core.service';

@Injectable({
  providedIn: 'root',
})
export class HrmsReportsService {
  constructor(private coreService: CoreService) {}

  getTodayAttendance() {
    return this.coreService.getRequest(`${AppConstants.API_URL}users/attendance/today`);
  }

  getMonthlyAttendanceReport(startDate: string, endDate: string) {
    return this.coreService.getRequest(
      `${AppConstants.API_URL}users/attendance/monthly?startDate=${startDate}&endDate=${endDate}`
    );
  }
}
