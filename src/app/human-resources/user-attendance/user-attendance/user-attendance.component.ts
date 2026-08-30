import { Component, OnInit } from '@angular/core';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { AppConstants } from '../../../AppConstants';
import { CoreService } from '../../../service/core.service';
import { SharedAuthService } from '../../../service/shared-auth.service';
import { DateTimeFormatService } from '../../../service/DateTimeFormatService';
import { DialogService } from '../../../service/dialog.service';

@Component({
  standalone: false,
  selector: 'app-user-attendance',
  templateUrl: './user-attendance.component.html',
  styleUrls: ['./user-attendance.component.css']
})
export class UserAttendanceComponent implements OnInit {
  loading: boolean = true;
  users: any[] = [];
  events: any[] = [];
  monthlyAttendance: any[] = [];
  masterMonthlyAttendance: any[] = [];
  selectedUserId: any = null;

  monthlyDate = new Date();

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth'
    },
    eventClick: this.handleDateClick.bind(this),
    events: this.events,
  };

  constructor(
    private coreService: CoreService,
    public auth: SharedAuthService,
    private dialog: DialogService,
    private dateTimeService: DateTimeFormatService
  ) { }

  ngOnInit() {
    const user = this.auth.getUser();
    if (this.auth.isEmployee() && user) {
      this.selectedUserId = user.id || user.userId;
      this.loadAttendance(this.selectedUserId);
      this.loadMonthlyAttendance(this.selectedUserId);
    } else {
      this.getUsers();
      this.getAttendance();
    }
  }

  getUsers() {
    this.coreService.getRequest(AppConstants.API_URL + "users").subscribe((users: any) => {
      this.users = users || [];
    });
  }

  onUserSelect(userId: any) {
    if (!userId || userId === 'Select User') return;
    this.selectedUserId = userId;
    this.loadAttendance(userId);
    this.loadMonthlyAttendance(userId);
  }

  loadAttendance(userId: string) {
    this.loading = true;
    this.coreService.getRequest(AppConstants.API_URL + `users/${userId}/attendance`).subscribe({
      next: (data: any) => {
        const daysObj: { [key: string]: any[] } = {};
        const entries = data?.entries || [];
        const fromToTime = data?.from_to_time;
        entries.forEach((d: any) => {
          const date = new Date(d.datetime);
          const dmy = "" + date.getDate() + (date.getMonth() + 1) + date.getFullYear();
          dmy in daysObj ? daysObj[dmy].push(d.datetime) : daysObj[dmy] = [d.datetime];
        });
        this.events = [];
        this.insertEvents(daysObj, fromToTime);
        this.calendarOptions.events = [...this.events];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadMonthlyAttendance(userId: string) {
    this.loading = true;
    this.coreService.getRequest(AppConstants.API_URL + `users/${userId}/monthly-attendance`).subscribe({
      next: (data: any) => {
        this.monthlyAttendance = data || [];
        this.masterMonthlyAttendance = [...(data || [])];
        this.filterMonthlyAttendance();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getFirstAndLastEntries(array: string): string {
    if (array) {
      let entries = array.split(",");
      return entries[0] + " - " + entries[entries.length - 1];
    }
    return '';
  }

  getMinutesSpent(date: string, datetime: string): string {
    if (!datetime) return '-';
    let entries = datetime.split(",");
    if (entries.length < 2) return '-';
    let entry = new Date(date + " " + entries[0].substr(0, 5));
    let exit = new Date(date + " " + entries[entries.length - 1].substr(0, 5));
    let differnceInMinutes = Math.round((exit.getTime() - entry.getTime()) / 1000 / 60);
    const hrs = Math.floor(differnceInMinutes / 60);
    const mins = differnceInMinutes % 60;
    return `${hrs}h ${mins}m`;
  }

  changeDate(direction: string) {
    let month = 0;
    if (direction == 'next') {
      month = this.monthlyDate.getMonth() + 1;
    } else {
      month = this.monthlyDate.getMonth() - 1;
    }
    this.monthlyDate.setMonth(month);
    this.filterMonthlyAttendance();
  }

  filterMonthlyAttendance() {
    this.monthlyAttendance = this.masterMonthlyAttendance.filter(m => {
      return this.dateTimeService.getFormattedDate(m.date).slice(3) ==
        this.dateTimeService.getFormattedDate(this.monthlyDate).slice(3);
    });
  }

  handleDateClick(data: any) {
    const date = this.dateTimeService.getFormattedDate(data.event.start);
    this.dialog.showDialog({ content: data.event.extendedProps.message, title: date + " Punches" });
  }

  getAttendance() {
    this.coreService.getRequest(AppConstants.API_URL + "users/attendance").subscribe({
      next: (data: any) => {
        const daysObj: { [key: string]: any[] } = {};
        const entries = data?.entries || [];
        const fromToTime = data?.from_to_time;
        entries.forEach((d: any) => {
          const date = new Date(d.datetime);
          const dmy = "" + date.getDate() + (date.getMonth() + 1) + date.getFullYear();
          dmy in daysObj ? daysObj[dmy].push(d.datetime) : daysObj[dmy] = [d.datetime];
        });
        this.events = [];
        this.insertEvents(daysObj, fromToTime);
        this.calendarOptions.events = [...this.events];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  insertEvents(daysObj: { [key: string]: any[] }, fromToTime: any) {
    for (let key in daysObj) {
      let msg = this.getHourAndMinutes(daysObj[key]);
      const color = this.getColor(daysObj[key][0], fromToTime);
      this.events.push({
        title: 'Present',
        date: daysObj[key][0],
        message: msg,
        backgroundColor: color,
        borderColor: color
      });
    }
  }

  getHourAndMinutes(dates: any[]): string {
    let msg = "";
    for (let date of dates) {
      let dt = new Date(date);
      var hours = dt.getHours();
      var minutes = dt.getMinutes().toString().padStart(2, "0");
      var ampm = hours >= 12 ? 'PM' : 'AM';
      hours = (hours % 12) || 12;
      msg += hours.toString().padStart(2, "0") + ":" + minutes + " " + ampm + "<br>";
    }
    return msg;
  }

  getColor(entryDate: string, fromToTime: any): string {
    if (!fromToTime) return "#10b981";
    const fromTime = fromToTime.fromTime || '09:00:00';
    let entryDateTime = new Date(entryDate);
    let fromDateTime = new Date(entryDate);
    fromDateTime.setHours(Number(fromTime.split(":")[0]));
    fromDateTime.setMinutes(Number(fromTime.split(":")[1]));
    fromDateTime.setSeconds(Number(fromTime.split(":")[2] || 0));

    let difference = (entryDateTime.getTime() - fromDateTime.getTime()) / 1000;

    if (difference <= 0) return "#10b981"; // green on time
    else if (difference <= 300) return "#f59e0b"; // orange slight late
    else return "#ef4444"; // red late
  }
}
