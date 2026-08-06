import { Component, Input, OnInit } from '@angular/core';
import { DialogService } from 'src/app/service/dialog.service';
import { Leave } from '../leave.modal';
import { LeaveService } from '../leave.service';
import Editor from 'ckeditor5/build/ckeditor';

@Component({
  selector: 'edit-leave',
  templateUrl: './edit-leave.component.html',
  styleUrls: ['./edit-leave.component.css']
})
export class EditLeaveComponent implements OnInit {

  public Editor = Editor
  @Input() leave: Leave
  @Input() modal: { editLeave: boolean }

  fromDate
  toDate

  constructor(
    private leaveService:LeaveService,
    private dialog:DialogService
  ) { }

  ngOnInit(): void {
    this.fromDate = new Date(this.leave.fromDate)
    this.toDate = new Date(this.leave.toDate)
  }

  //Update Leave
  updateLeave(data){
    const toYmd = (d: any) => {
      if (!d) return null;
      const dt = d instanceof Date ? d : new Date(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    
    const updateData = {
      leaveId:this.leave.leaveId,
      leaveContent:data.leaveContent,
      reason:data.reason,
      fromDate: toYmd(this.fromDate),
      toDate: toYmd(this.toDate)
    }

    this.leaveService.updateLeave(updateData).subscribe({
      next: (result:any) => {
        if(result.success){
          this.modal.editLeave = false
        }
        this.dialog.showDialog({content:result.message})
      },
      error: () => this.dialog.showDialog({ content: 'Failed to update leave' })
    })

  }

}
