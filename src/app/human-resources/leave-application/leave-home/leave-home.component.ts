import { Component, OnInit } from '@angular/core';
import { DialogService } from 'src/app/service/dialog.service';
import { Leave, LeavesInfo } from '../leave.modal';
import { LeaveService } from '../leave.service';

@Component({
  standalone: false,
  selector: 'app-leave-home',
  templateUrl: './leave-home.component.html',
  styleUrls: ['./leave-home.component.css']
})
export class LeaveHomeComponent implements OnInit {

  loading: boolean = true
  leaves: Leave[]
  activeLeave: Leave
  leavesInfo:LeavesInfo

  modals = {
    editLeave: false,
    requestLeave: false
  }

  constructor(
    private leaveService: LeaveService,
    private dialog: DialogService
  ) { }

  ngOnInit(): void {
    this.getMyLeaves()
    this.getMyLeavesInfo()
  }

  //Get My Leaves
  getMyLeaves() {
    this.leaveService.getMyLeaves().subscribe({
      next: (leaves: Leave[]) => {
        this.leaves = leaves
        this.loading = false
      },
      error: () => {
        this.loading = false
        this.dialog.showDialog({ content: 'Failed to load leaves' })
      }
    })
  }

  //Get My Leaves Information
  getMyLeavesInfo(){
    this.leaveService.getMyLeavesInfo().subscribe({
      next: (leavesInfo:LeavesInfo) => this.leavesInfo = leavesInfo,
      error: () => this.dialog.showDialog({ content: 'Failed to load leave info' })
    })
  }

  //Show Edit Leave Modal
  editLeave(leave: Leave) {
    this.activeLeave = leave
    this.modals.editLeave = true
  }

  //Show Delete leaves comfirmation
  deleteLeave(leave: Leave) {
    this.dialog.showDialog({
      content: 'Are you sure to delete this leave?',
      callBack: () => {
        this.leaveService.deleteLeave(leave.leaveId).subscribe((result: any) => {

          if (result.success) {
            this.leaves.splice(this.leaves.indexOf(leave), 1)
          }

          this.dialog.showDialog({ content: result.message })

        })
      }
    })
  }

  applyLeave() {
    this.modals.requestLeave = true;
  }

}
