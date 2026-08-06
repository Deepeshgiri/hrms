import { Component, Input, OnInit } from '@angular/core';
import { DialogService } from 'src/app/service/dialog.service';
import { LeaveForm } from '../leave.modal';
import { LeaveService } from '../leave.service';

@Component({
  selector: 'app-request-leave',
  templateUrl: './request-leave.component.html',
  styleUrls: ['./request-leave.component.css']
})
export class RequestLeaveComponent implements OnInit {

  @Input() isModal = false;
  loading: boolean = false

  constructor(private leaveService: LeaveService, private dialogService: DialogService) { }

  ngOnInit(): void {
  }

  //Submit Leave
  submitLeave(leaveData: LeaveForm) {

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

    if (leaveData.duration == "R") {
      fromDate = toYmd(leaveData.fromDate)
      toDate = toYmd(leaveData.toDate)
    } else {
      date = toYmd(leaveData.date)
    }


    const finalData = {
      fromDate,
      toDate,
      date,
      duration: leaveData.duration,
      half: leaveData.half,
      leaveContent: leaveData.leaveContent,
      reason: leaveData.reason
    }

    this.loading = true

    this.leaveService.submitLeave(finalData).subscribe({
      next: (data: any) => {
        this.loading = false
        this.dialogService.showDialog({ content: data.message });
      },
      error: () => {
        this.loading = false
        this.dialogService.showDialog({ content: 'Failed to request leave' });
      }
    })

  }

}
