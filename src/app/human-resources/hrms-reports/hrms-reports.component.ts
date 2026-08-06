import { Component, OnInit } from '@angular/core';
import { HrmsReportsService } from '../../../service/hrmsReportsService';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-hrms-reports',
  templateUrl: './hrms-reports.component.html',
  styleUrls: ['./hrms-reports.component.css']
})
export class HrmsReportsComponent implements OnInit {

  activeTab = 'daily';
  loading = false;

  // Daily Report
  dailyDate: string = this.getTodayDate();
  dailyReportData: any = null;

  // Monthly Report
  dateRange: Date[] = [this.getFirstDayOfMonthDate(), this.getLastDayOfMonthDate()];
  monthlyReportData: any = null;
  dateList: string[] = [];   // ✅ IMPORTANT

  constructor(
    private reportsService: HrmsReportsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTodayAttendance();
  }

  // ------------------ HELPERS ------------------

  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  getFirstDayOfMonthDate(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }

  getLastDayOfMonthDate(): Date {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }

  formatDateForAPI(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // ------------------ DAILY REPORT ------------------

  loadTodayAttendance(): void {
    this.loading = true;

    this.reportsService.getTodayAttendance().subscribe(
      (response) => {
        this.processTodayAttendanceData(response);
        this.loading = false;
      },
      () => {
        this.showError('Failed to load today\'s attendance');
        this.loading = false;
      }
    );
  }

  processTodayAttendanceData(users: any[]): void {

    const processedData = users.map(user => {

      const firstEntry = user.entries?.[0] || null;
      const lastEntry = user.entries?.[user.entries.length - 1] || null;

      return {
        employeeId: user.userId,
        employeeName: user.name,
        designation: '-',
        department: '-',
        daysPresent: user.entries ? user.entries.length : 0,
        firstPunch: firstEntry ? firstEntry.entry : null,
        lastPunch: lastEntry && user.entries.length > 1 ? lastEntry.entry : null,
      };
    });

    this.dailyReportData = {
      totalEmployees: users.length,
      presentEmployees: users.filter(u => u.entries?.length > 0).length,
      absentEmployees: users.filter(u => !u.entries || u.entries.length === 0).length,
      data: processedData
    };
  }

  loadDailyReport(): void {
    this.loadTodayAttendance();
  }

  // ------------------ MONTHLY REPORT ------------------

  loadMonthlyReport(): void {

    if (!this.dateRange || this.dateRange.length !== 2 || !this.dateRange[0] || !this.dateRange[1]) {
      this.showError('Please select a valid date range');
      return;
    }

    const startDate = this.formatDateForAPI(this.dateRange[0]);
    const endDate = this.formatDateForAPI(this.dateRange[1]);

    this.loading = true;
    this.monthlyReportData = null;

    this.reportsService.getMonthlyAttendanceReport(startDate, endDate).subscribe(
      (response) => {
        this.processMonthlyData(response, startDate, endDate);
        this.loading = false;
      },
      () => {
        this.showError('Failed to load monthly attendance report');
        this.loading = false;
      }
    );
  }

  processMonthlyData(rawData: any[], startDate: string, endDate: string): void {

    const start = new Date(startDate);
    const end = new Date(endDate);

    // ✅ Generate date columns
    this.dateList = [];
    let current = new Date(start);

    while (current <= end) {
      this.dateList.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    const userMap = new Map();

    // ✅ Group by user + date
    rawData.forEach(record => {

      const date = new Date(record.punches).toISOString().split('T')[0];

      if (!userMap.has(record.userId)) {
        userMap.set(record.userId, {
          employeeId: record.employeeId,
          employeeName: record.name,
          punchesByDate: {}
        });
      }

      const user = userMap.get(record.userId);

      if (!user.punchesByDate[date]) {
        user.punchesByDate[date] = [];
      }

      user.punchesByDate[date].push(record.punches);
    });

    // ✅ Build final rows
    const processedData = Array.from(userMap.values()).map(user => {

      let totalHours = 0;

      const row: any = {
        employeeName: user.employeeName,
        employeeId: user.employeeId
      };

      this.dateList.forEach(date => {

        const punches = user.punchesByDate[date];

        if (!punches || punches.length === 0) {
          row[date] = null;
        } else {

          punches.sort();

          const first = new Date(punches[0]);
          const last = new Date(punches[punches.length - 1]);

          // display
          row[date] = `${first.toLocaleTimeString()} - ${last.toLocaleTimeString()}`;

          // hours
          const diff = (last.getTime() - first.getTime()) / (1000 * 60 * 60);
          totalHours += diff;
        }
      });

      row.totalHours = totalHours.toFixed(2);

      return row;
    });

    this.monthlyReportData = {
      data: processedData,
      startDate,
      endDate
    };
  }

  // ------------------ EXPORT ------------------

  exportReport(type: string): void {

    let data: any[] = [];
    let filename = '';

    if (type === 'daily' && this.dailyReportData) {
      data = this.dailyReportData.data;
      filename = `daily-${this.dailyDate}`;
    }

    if (type === 'monthly' && this.monthlyReportData) {
      data = this.monthlyReportData.data;
      filename = `monthly-${this.monthlyReportData.startDate}-to-${this.monthlyReportData.endDate}`;
    }

    if (!data.length) return;

    this.downloadCSV(data, filename);
    this.showSuccess('Export successful');
  }

  downloadCSV(data: any[], filename: string): void {

    const headers = Object.keys(data[0]);

    const csv = [
      headers.join(','),
      ...data.map(row =>
        headers.map(h => `"${row[h] ?? ''}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();

    window.URL.revokeObjectURL(url);
  }

  // ------------------ UI ------------------

  onTabChange(tab: string): void {
    this.activeTab = tab;

    if (tab === 'daily' && !this.dailyReportData) {
      this.loadDailyReport();
    }

    if (tab === 'monthly' && !this.monthlyReportData) {
      this.loadMonthlyReport();
    }
  }

  showError(msg: string): void {
    this.snackBar.open(msg, 'Close', { duration: 5000 });
  }

  showSuccess(msg: string): void {
    this.snackBar.open(msg, 'Close', { duration: 3000 });
  }
}