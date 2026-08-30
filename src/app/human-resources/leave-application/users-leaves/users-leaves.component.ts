import { Component, OnInit } from '@angular/core';
import { DialogService } from 'src/app/service/dialog.service';
import { Leave } from '../leave.modal';
import { LeaveService } from '../leave.service';

@Component({
  standalone: false,
  selector: 'app-users-leaves',
  templateUrl: './users-leaves.component.html',
  styleUrls: ['./users-leaves.component.css']
})
export class UsersLeavesComponent implements OnInit {
  loading: boolean = true;
  leaves: Leave[] = [];
  filteredLeaves: Leave[] = [];
  activeLeave: Leave;
  response: string = '';
  selectedFilter: string = 'All';
  searchQuery: string = '';

  modals = {
    responseModal: false
  };

  constructor(private leaveService: LeaveService, private dialog: DialogService) { }

  ngOnInit(): void {
    this.getUsersLeaves();
  }

  getUsersLeaves() {
    this.loading = true;
    this.leaveService.getUsersLeaves().subscribe({
      next: (leaves: Leave[]) => {
        this.leaves = leaves || [];
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.dialog.showDialog({ content: 'Failed to load users leaves' });
      }
    });
  }

  setFilter(filter: string) {
    this.selectedFilter = filter;
    this.applyFilter();
  }

  applyFilter() {
    let list = this.leaves;
    if (this.selectedFilter !== 'All') {
      list = list.filter(l => l.status === this.selectedFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(l =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.reason && l.reason.toLowerCase().includes(q)) ||
        (l.leaveContent && l.leaveContent.toLowerCase().includes(q))
      );
    }
    this.filteredLeaves = list;
  }

  quickApprove(leave: Leave) {
    this.loading = true;
    this.leaveService.acceptRejectLeave(leave.leaveId, 2, 'Approved by HR', leave.userId).subscribe({
      next: (result: any) => {
        this.loading = false;
        if (result.success) {
          leave.status = 'Accepted';
          leave.response = 'Approved by HR';
          this.applyFilter();
        }
      },
      error: () => {
        this.loading = false;
        this.dialog.showDialog({ content: 'Failed to approve leave' });
      }
    });
  }

  quickReject(leave: Leave) {
    const reason = prompt('Please provide reason for rejection:', 'Not approved');
    if (reason === null) return;

    this.loading = true;
    this.leaveService.acceptRejectLeave(leave.leaveId, 3, reason || 'Rejected by HR', leave.userId).subscribe({
      next: (result: any) => {
        this.loading = false;
        if (result.success) {
          leave.status = 'Rejected';
          leave.response = reason || 'Rejected by HR';
          this.applyFilter();
        }
      },
      error: () => {
        this.loading = false;
        this.dialog.showDialog({ content: 'Failed to reject leave' });
      }
    });
  }

  openResponseModal(leave: Leave) {
    this.activeLeave = leave;
    this.response = leave.response || '';
    this.modals.responseModal = true;
  }

  acceptRejectLeave(status: number, userId: number) {
    this.loading = true;
    this.leaveService.acceptRejectLeave(this.activeLeave.leaveId, status, this.response, userId)
      .subscribe({
        next: (result: any) => {
          this.loading = false;
          if (result.success) {
            this.activeLeave.status = status === 2 ? 'Accepted' : 'Rejected';
            this.activeLeave.response = this.response;
            this.modals.responseModal = false;
            this.applyFilter();
          } else {
            this.dialog.showDialog({ content: result.message });
          }
        },
        error: () => {
          this.loading = false;
          this.dialog.showDialog({ content: 'Failed to update leave status' });
        }
      });
  }

  showLeaveContent(content: string) {
    this.dialog.showDialog({ content });
  }
}
