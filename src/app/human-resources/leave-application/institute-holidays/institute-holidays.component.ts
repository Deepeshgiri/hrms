import { Component, OnInit } from '@angular/core';
import { DialogService } from 'src/app/service/dialog.service';
import { LeaveService } from '../leave.service';

@Component({
  selector: 'app-institute-holidays',
  templateUrl: './institute-holidays.component.html',
  styleUrls: ['./institute-holidays.component.css']
})
export class InstituteHolidaysComponent implements OnInit {

  loading: boolean
  holidays = []
  date

  constructor(private leaveService: LeaveService, private dialog: DialogService) { }

  ngOnInit(): void {
    this.getHolidays()
  }

  //Get Holidays
  getHolidays() {
    this.loading = true
    this.leaveService.getInstituteHolidays().subscribe((result: any) => {
      this.loading = false
      this.holidays = result
    })
  }

  // Delete Holiday 
  deleteHoliday(date, index) {

    this.dialog.showDialog({
      content: `Are you sure to delete "${date}"?`,
      callBack: () => {
        this.loading = true
        let dateDB = new Date(date + " UTC").toISOString().substring(0, 10)
        this.leaveService.deleteInstituteHoliday(dateDB).subscribe((result: any) => {
          this.loading = false
          if (result.success) {
            this.holidays.splice(index, 1)
          }
        })
      }
    })
  }

  //Submit
  submit() {
    let date = new Date(this.date + " UTC").toISOString().substring(0, 10)
    this.loading = true
    this.leaveService.addInstituteHoliday(date).subscribe((result: any) => {
      this.loading = false
      this.getHolidays()
      this.dialog.showDialog({ content: result.message })
    })
  }

}
