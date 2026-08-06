import { Component, OnInit } from '@angular/core';
import { AppConstants } from 'src/app/AppConstants';
import { CoreService } from 'src/app/service/core.service';
import { DialogService } from 'src/app/service/dialog.service';
import { LeaveService } from '../leave.service';

@Component({
  selector: 'app-set-users-leaves-count',
  templateUrl: './set-users-leaves-count.component.html',
  styleUrls: ['./set-users-leaves-count.component.css']
})
export class SetUsersLeavesCountComponent implements OnInit {

  userId = ""
  activeLeave
  users = []

  loading: boolean = true


  constructor(
    private leaveService: LeaveService,
    private coreService: CoreService,
    private dialog: DialogService
  ) { }

  ngOnInit(): void {
    this.coreService.getRequest(AppConstants.API_URL + "leaves/users-leaves").
      subscribe((users: any) => {
        this.loading = false
        this.users = users
      })
  }

  //Load Leaves
  loadLeaves() {
    if (this.userId == "") {
      return this.activeLeave = []
    }
    let user = this.users.find(u => u.userId == this.userId)
    this.activeLeave = user.leaves
  }

  // Update Leave
  updateLeave() {
    this.loading = true
    const url = AppConstants.API_URL + "leaves/user-leave"
    const data = {
      userId: this.userId,
      leave: this.activeLeave
    }
    this.coreService.putRequest(url, data).subscribe((data: any) => {
      this.loading = false
    })
  }

  // Recalculate leaves
  reCalculate() {
    this.loading = true
    this.leaveService.reCalculateLeaves().subscribe((result: any) => {
      this.dialog.showDialog({ content: result.message })
      this.loading = false
    })
  }

}
