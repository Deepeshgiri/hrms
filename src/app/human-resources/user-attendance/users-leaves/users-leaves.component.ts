import { Component, OnInit } from '@angular/core';
import { AppConstants } from 'src/app/AppConstants';
import { CoreService } from 'src/app/service/core.service';

@Component({
  selector: 'app-users-leaves',
  templateUrl: './users-leaves.component.html',
  styleUrls: ['./users-leaves.component.css']
})
export class UsersLeavesComponent implements OnInit {

  loading: boolean = true;
  usersLeaves = []
  date = new Date()

  constructor(private coreService: CoreService) { }

  ngOnInit(): void {
    this.date.setDate(1);
    this.filterLeaves()
  }

  //Get Users leaves
  getUsersLeaves(month, year) {
    const url = AppConstants.API_URL + "leaves/all-users-leaves?month=" + month + "&year=" + year
    this.coreService.getRequest(url).subscribe((data: any) => {
      this.usersLeaves = data
      this.loading = false
    })
  }
  //Change Date and filter on clicking next and prev icons
  changeDate(direction) {
    let date = new Date(this.date);
    if (direction == 'next') {
      date.setMonth(date.getMonth() + 1);
      this.date = date
    } else {
      date.setMonth(date.getMonth() - 1);
      this.date = date
    }
    this.filterLeaves()
  }

  //Filter Leaves
  filterLeaves() {
    this.getUsersLeaves(this.date.getMonth(), this.date.getFullYear())
  }

}
