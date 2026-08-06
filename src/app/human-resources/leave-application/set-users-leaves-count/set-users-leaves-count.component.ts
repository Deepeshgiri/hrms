import { Component, OnInit } from '@angular/core';
import { AppConstants } from '../../../AppConstants';
import { CoreService } from '../../../service/core.service';
import { DialogService } from '../../../service/dialog.service';
import { LeaveService } from '../leave.service';

@Component({
  standalone: false,
  selector: 'app-set-users-leaves-count',
  templateUrl: './set-users-leaves-count.component.html',
  styleUrls: ['./set-users-leaves-count.component.css']
})
export class SetUsersLeavesCountComponent implements OnInit {

  userId: string = "";
  activeLeave: any;
  users: any[] = [];

  loading: boolean = true;

  constructor(
    private leaveService: LeaveService,
    private coreService: CoreService,
    private dialog: DialogService
  ) { }

  ngOnInit(): void {
    this.coreService.getRequest(AppConstants.API_URL + "leaves/users-leaves").
      subscribe((users: any) => {
        this.loading = false;
        this.users = users;
      });
  }

  loadLeaves(): void {
    if (this.userId === "") {
      this.activeLeave = [];
      return;
    }
    const user = this.users.find(u => u.userId === this.userId);
    if (user) {
      this.activeLeave = user.leaves;
    }
  }

  updateLeave(): void {
    this.loading = true;
    const url = AppConstants.API_URL + "leaves/user-leave";
    const data = {
      userId: this.userId,
      leave: this.activeLeave
    };
    this.coreService.putRequest(url, data).subscribe((data: any) => {
      this.loading = false;
    });
  }

  reCalculate(): void {
    this.loading = true;
    this.leaveService.reCalculateLeaves().subscribe((result: any) => {
      this.dialog.showDialog({ content: result.message });
      this.loading = false;
    });
  }
}
