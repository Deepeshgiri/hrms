import { Component, OnInit } from '@angular/core';
import { AppConstants } from 'src/app/AppConstants';
import { CoreService } from 'src/app/service/core.service';
import { DateTimeFormatService } from 'src/app/service/DateTimeFormatService';

@Component({
  selector: 'app-user-attendance-today',
  templateUrl: './user-attendance-today.component.html',
  styleUrls: ['./user-attendance-today.component.css']
})
export class UserAttendanceTodayComponent implements OnInit {

  loading: boolean = true
  attendance = []

  constructor(private coreService: CoreService, private dateTimeService: DateTimeFormatService) { }

  ngOnInit(): void {
    this.getTodaysAttendance()
  }

  // Get todays attendace 
  getTodaysAttendance() {
    this.coreService.getRequest(AppConstants.API_URL + "users/attendance/today").subscribe((data: any) => {
      this.attendance = data
      this.loading = false
    })
  }

  // get entry color based on if users was late or early or on time  
  getEntryColor(entryTime, fromToTime, entryIndex, totalEntries) {
    if(!fromToTime)
      return "black"
    const entryDateTime = new Date(this.dateTimeService.getFormattedDate(new Date()) + " " + entryTime)
    let difference = 0

    // If First Entry
    if (entryIndex == 0) {
      const fromDateTime = new Date(this.dateTimeService.getFormattedDate(new Date()) + " " + fromToTime.fromTime)
      difference = (entryDateTime.getTime() - fromDateTime.getTime()) / 1000
    }
    //If Last Entry
    else if (entryIndex == totalEntries - 1) {
      const toDateTime = new Date(this.dateTimeService.getFormattedDate(new Date()) + " " + fromToTime.toTime)
      difference = (toDateTime.getTime() - entryDateTime.getTime()) / 1000
    }
    // If any entries between first and last
    else {
      return "#888"
    }

    if (difference <= 0)
      return "green"
    else if (difference <= 300)
      return "orange"
    else
      return "red"
  }

}
