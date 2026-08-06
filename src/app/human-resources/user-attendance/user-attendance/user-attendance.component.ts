import { Component, OnInit } from '@angular/core';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { AppConstants } from '../../../../AppConstants';
import { CoreService } from '../../../../service/core.service';
import { DateTimeFormatService } from '../../../../service/DateTimeFormatService';
import { DialogService } from '../../../../service/dialog.service';
import { permissionsObject, Permissions } from '../../../user.modal';
import { UsersService } from '../../../users.service';

@Component({
  selector: 'app-user-attendance',
  templateUrl: './user-attendance.component.html',
  styleUrls: ['./user-attendance.component.css']
})
export class UserAttendanceComponent implements OnInit {
  loading: boolean = true
  users: any[] = []
  events: any[] = []
  monthlyAttendance: any[] = []
  masterMonthlyAttendance: any[] = []

  monthlyDate = new Date()

  calendarOptions: CalendarOptions = {
  plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    footerToolbar: {
      center: 'title',
    },
    eventClick: this.handleDateClick.bind(this),
    events: this.events,
  };

  permissions: Permissions = permissionsObject

  constructor(
    private coreService: CoreService,
    private dialog: DialogService,
    private dateTimeService: DateTimeFormatService,
    private usersService: UsersService
  ) { }

  async ngOnInit() {
    this.getAttendance()
    this.getUsers()
    this.permissions = await this.usersService.getUserPermissions()
  }

  //Get Users
  getUsers() {
    this.coreService.getRequest(AppConstants.API_URL + "users").subscribe((users: any) => {
      this.users = users
    })
  }

  // Load Attendance 
  loadAttendance(userId: string) {
    this.loading = true
    this.coreService.getRequest(AppConstants.API_URL + `users/${userId}/attendance`).subscribe((data: any) => {
      const daysObj: { [key: string]: any[] } = {}
      const entries = data.entries
      const fromToTime = data.from_to_time
      entries.forEach((d: any) => {
        const date = new Date(d.datetime)
        const dmy = "" + date.getDate() + (date.getMonth() + 1) + date.getFullYear()
        dmy in daysObj ? daysObj[dmy].push(d.datetime) : daysObj[dmy] = [d.datetime]
      })
      this.events.length = 0
      this.insertEvents(daysObj, fromToTime)
      this.loading = false
    })
  }

  //Load Monthly attendance
  loadMonthlyAttendance(userId: string) {
    this.loading = true
    this.coreService.getRequest(AppConstants.API_URL + `users/${userId}/monthly-attendance`).subscribe((data: any) => {
      this.monthlyAttendance = data
      this.masterMonthlyAttendance = [...data]
      this.filterMonthlyAttendance()
      this.loading = false
    })
  }

  //Get FIrst and last entry
  getFirstAndLastEntries(array: string): string {
    if (array) {
      let entries = array.split(",");
      return entries[0] + " - " + entries[entries.length - 1]
    }
    return ''
  }

  //get minutes spent 
  getMinutesSpent(date: string, datetime: string): number {
    let entries = datetime.split(",");
    let entry = new Date(date + " " + entries[0].substr(0, 5));
    let exit = new Date(date + " " + entries[entries.length - 1].substr(0, 5));
    let differnceInMinutes = (exit.getTime() - entry.getTime()) / 1000 / 60
    return differnceInMinutes
  }

  //change date and filter attendance
  changeDate(direction: string) {
    let month = 0

    if (direction == 'next') {
      month = this.monthlyDate.getMonth() + 1
    } else {
      month = this.monthlyDate.getMonth() - 1
    }

    this.monthlyDate.setMonth(month);

    this.filterMonthlyAttendance()

  }

  //Filter attendance 
  filterMonthlyAttendance() {
    this.monthlyAttendance = this.masterMonthlyAttendance.filter(m => {
      return this.dateTimeService.getFormattedDate(m.date).slice(3) ==
        this.dateTimeService.getFormattedDate(this.monthlyDate).slice(3)
    })
  }

  //On click on date entry show popup 
  handleDateClick(data: any) {
    const date = this.dateTimeService.getFormattedDate(data.event.start)
    this.dialog.showDialog({ content: data.event.extendedProps.message, title: date + " Details" })
  }

  //get attendance
  getAttendance() {
    this.coreService.getRequest(AppConstants.API_URL + "users/attendance").subscribe((data: any) => {
      const daysObj: { [key: string]: any[] } = {}
      const entries = data.entries
      const fromToTime = data.from_to_time
      entries.forEach((d: any) => {
        const date = new Date(d.datetime)
        const dmy = "" + date.getDate() + (date.getMonth() + 1) + date.getFullYear()
        dmy in daysObj ? daysObj[dmy].push(d.datetime) : daysObj[dmy] = [d.datetime]
      })
      this.insertEvents(daysObj, fromToTime)
    })
    this.loading = false
  }

  //Insert events
  insertEvents(daysObj: { [key: string]: any[] }, fromToTime: any) {
    for (let key in daysObj) {
      let msg = this.getHourAndMinutes(daysObj[key])
      const color = this.getColor(daysObj[key][0], fromToTime)
      this.events.push({
        title: 'Entry',
        date: daysObj[key][0],
        end: daysObj[key][daysObj[key].length - 1],
        message: msg,
        backgroundColor: color
      })
    }
  }
  // get hours and minutes from date
  getHourAndMinutes(dates: any[]): string {
    let msg = ""
    for (let date of dates) {
      let dt = new Date(date)
      var hours = dt.getHours()
      var minutes = dt.getMinutes().toString().padStart(2, "0")
      var ampm = hours >= 12 ? 'PM' : 'AM'
      hours = (hours % 12)
      msg += hours.toString().padStart(2, "0") + ":" + minutes + " " + ampm + "<br>"
    }
    return msg
  }

  // get color based on if late or early
  getColor(entryDate: string, fromToTime: any): string {
    if (!fromToTime)
      return "black"
    const fromTime = fromToTime.fromTime
    let entryDateTime = new Date(entryDate)
    let fromDateTime = new Date(entryDate)
    fromDateTime.setHours(fromTime.split(":")[0])
    fromDateTime.setMinutes(fromTime.split(":")[1])
    fromDateTime.setSeconds(fromTime.split(":")[2])

    let difference = (entryDateTime.getTime() - fromDateTime.getTime()) / 1000

    if (difference <= 0)
      return "green"
    else if (difference <= 300)
      return "orange"
    else
      return "red"
  }

}
