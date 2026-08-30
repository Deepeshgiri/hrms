import { Component, OnInit } from '@angular/core';
import { DialogService } from 'src/app/service/dialog.service';
import { Leave, LeavesInfo } from '../leave.modal';
import { LeaveService } from '../leave.service';
import { SharedAuthService } from 'src/app/service/shared-auth.service';

@Component({
  standalone: false,
  selector: 'app-leave-home',
  templateUrl: './leave-home.component.html',
  styleUrls: ['./leave-home.component.css']
})
export class LeaveHomeComponent implements OnInit {
  loading: boolean = true;
  leaves: Leave[] = [];
  activeLeave: Leave | null = null;
  leavesInfo: LeavesInfo | null = null;

  modals = {
    editLeave: false,
    requestLeave: false
  };

  rollingOver: boolean = false;

  constructor(
    private leaveService: LeaveService,
    private dialog: DialogService,
    public auth: SharedAuthService
  ) {}

  ngOnInit(): void {
    this.getMyLeaves();
    this.getMyLeavesInfo();
  }

  getMyLeaves(): void {
    this.leaveService.getMyLeaves().subscribe({
      next: (leaves: Leave[]) => {
        this.leaves = leaves || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.dialog.showDialog({ content: 'Failed to load leaves' });
      }
    });
  }

  getMyLeavesInfo(): void {
    this.leaveService.getMyLeavesInfo().subscribe({
      next: (leavesInfo: LeavesInfo) => {
        this.leavesInfo = leavesInfo;
      },
      error: () => {
        this.dialog.showDialog({ content: 'Failed to load leave portfolio' });
      }
    });
  }

  editLeave(leave: Leave): void {
    this.activeLeave = leave;
    this.modals.editLeave = true;
  }

  deleteLeave(leave: Leave): void {
    this.dialog.showDialog({
      content: 'Are you sure you want to delete/cancel this leave request?',
      callBack: () => {
        this.leaveService.deleteLeave(leave.leaveId).subscribe((result: any) => {
          if (result.success) {
            this.leaves = this.leaves.filter(l => l.leaveId !== leave.leaveId);
            this.getMyLeavesInfo();
          }
          this.dialog.showDialog({ content: result.message });
        });
      }
    });
  }

  applyLeave(): void {
    this.modals.requestLeave = true;
  }

  onLeaveSubmitted(): void {
    this.modals.requestLeave = false;
    this.getMyLeaves();
    this.getMyLeavesInfo();
  }

  triggerFinancialYearRollover(): void {
    if (!confirm('Execute Financial Year Leave Reset & Annual Auto-Allotment for the organization? This will carry forward eligible Earned Leaves and allot fresh annual quotas.')) {
      return;
    }
    this.rollingOver = true;
    this.leaveService.rolloverFinancialYear().subscribe({
      next: (res: any) => {
        this.rollingOver = false;
        this.dialog.showDialog({
          content: res.message || 'Financial Year leave rollover completed successfully!'
        });
        this.getMyLeavesInfo();
      },
      error: (err: any) => {
        this.rollingOver = false;
        this.dialog.showDialog({
          content: err.error?.message || 'Failed to trigger Financial Year rollover'
        });
      }
    });
  }

  getLeaveTypeBadgeStyle(typeCode?: string, color?: string): any {
    const bg = color || '#10b981';
    return {
      'background-color': `${bg}18`,
      'color': bg,
      'border': `1px solid ${bg}40`
    };
  }
}
