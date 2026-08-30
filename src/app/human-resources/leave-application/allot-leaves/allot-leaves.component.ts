import { Component, OnInit } from '@angular/core';
import { AppConstants } from 'src/app/AppConstants';
import { CoreService } from 'src/app/service/core.service';
import { LeaveService } from '../leave.service';

@Component({
  standalone: false,
  selector: 'app-allot-leaves',
  templateUrl: './allot-leaves.component.html',
  styleUrls: ['./allot-leaves.component.css']
})
export class AllotLeavesComponent implements OnInit {

  userId = ""
  activeLeave = []
  users = []

  loading: boolean = true


  constructor(private leaveService: LeaveService, private coreService: CoreService) { }

  ngOnInit(): void {
    this.coreService.getRequest(AppConstants.API_URL + "leaves/users-leaves-for-allot/").
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
    let user = this.users.find(u => String(u.userId) == String(this.userId))
    this.activeLeave = user.leaves
  }
  
  // Allot leave to user
  updateLeave() {  
    this.loading = true
    const url = AppConstants.API_URL + "leaves/user-leave-allot"
    const data = {
      userId: this.userId,
      leave: this.activeLeave
    }
    this.coreService.putRequest(url, data).subscribe((data: any) => {
      this.loading = false
    })
  }

}
