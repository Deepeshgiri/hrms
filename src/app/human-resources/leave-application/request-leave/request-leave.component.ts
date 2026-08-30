import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { DialogService } from 'src/app/service/dialog.service';
import { LeaveForm, LeavesInfo } from '../leave.modal';
import { LeaveService } from '../leave.service';

@Component({
  standalone: false,
  selector: 'app-request-leave',
  templateUrl: './request-leave.component.html',
  styleUrls: ['./request-leave.component.css']
})
export class RequestLeaveComponent implements OnInit {
  @Input() isModal = false;
  @Output() submitted = new EventEmitter<void>();

  loading: boolean = false;
  leavesInfo: LeavesInfo | null = null;
  selectedLeaveType: string = 'CL';

  constructor(
    private leaveService: LeaveService,
    private dialogService: DialogService
  ) {}

  ngOnInit(): void {
    this.loadLeaveTypesInfo();
  }

  loadLeaveTypesInfo(): void {
    this.leaveService.getMyLeavesInfo().subscribe({
      next: (info: LeavesInfo) => {
        this.leavesInfo = info;
        if (info.leaveTypes && info.leaveTypes.length > 0) {
          this.selectedLeaveType = info.leaveTypes[0].code;
        }
      },
      error: () => {}
    });
  }

  submitLeave(leaveData: any) {
    const toYmd = (d: any) => {
      if (!d) return null;
      const dt = d instanceof Date ? d : new Date(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    let fromDate: string | null = null;
    let toDate: string | null = null;
    let date: string | null = null;

    if (leaveData.duration === 'R') {
      fromDate = toYmd(leaveData.fromDate);
      toDate = toYmd(leaveData.toDate);
    } else {
      date = toYmd(leaveData.date);
    }

    const finalData: LeaveForm = {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      date: date || undefined,
      duration: leaveData.duration,
      half: leaveData.half ? Number(leaveData.half) : undefined,
      leaveContent: leaveData.leaveContent,
      leaveType: leaveData.leaveType || this.selectedLeaveType || 'CL',
      reason: leaveData.reason
    };

    this.loading = true;

    this.leaveService.submitLeave(finalData).subscribe({
      next: (data: any) => {
        this.loading = false;
        this.dialogService.showDialog({ content: data.message || 'Leave request submitted successfully' });
        this.submitted.emit();
      },
      error: (err: any) => {
        this.loading = false;
        this.dialogService.showDialog({ content: err.error?.message || 'Failed to request leave' });
      }
    });
  }

  getSelectedTypeRemaining(): number {
    if (!this.leavesInfo?.leaveTypes) return 0;
    const found = this.leavesInfo.leaveTypes.find(t => t.code === this.selectedLeaveType);
    return found ? found.remaining : 0;
  }
}
