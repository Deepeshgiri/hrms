import { Component, OnInit } from '@angular/core';
import { DialogService } from 'src/app/service/dialog.service';
import { Leave } from '../leave.modal';
import { LeaveService } from '../leave.service';

@Component({
  selector: 'app-users-leaves',
  templateUrl: './users-leaves.component.html',
  styleUrls: ['./users-leaves.component.css']
})
export class UsersLeavesComponent implements OnInit {

  loading: boolean = true
  leaves: Leave[]
  activeLeave: Leave
  response: string
  modals = {
    responseModal: false
  }

  constructor(private leaveService: LeaveService, private dialog: DialogService) { }

  ngOnInit(): void {
    this.getUsersLeaves()
  }

  //Get users leaves
  getUsersLeaves() {
    this.leaveService.getUsersLeaves().subscribe({
      next: (leaves: Leave[]) => {
        this.leaves = leaves
        this.loading = false
      },
      error: () => {
        this.loading = false
        this.dialog.showDialog({ content: 'Failed to load users leaves' })
      }
    })
  }
//accept or reject leave
  acceptRejectLeave(status,userId) {
    this.loading = true

    this.leaveService.acceptRejectLeave(this.activeLeave.leaveId, status, this.response,userId)
      .subscribe({
        next: (result: any) => {
          this.loading = false
          if (result.success) {
            this.activeLeave.status = status == 2 ? "Accepted" : "Rejected"
            this.modals.responseModal = false
          } else {
            this.dialog.showDialog({ content: result.message })
          }
        },
        error: () => {
          this.loading = false
          this.dialog.showDialog({ content: 'Failed to update leave status' })
        }
      })
  }

  //Show Leave content in dialog
  showLeaveContent(content){
    this.dialog.showDialog({content})
  }

}
