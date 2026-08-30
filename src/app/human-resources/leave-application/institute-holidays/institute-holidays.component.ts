import { Component, OnInit } from '@angular/core';
import { DialogService } from 'src/app/service/dialog.service';
import { SharedAuthService } from 'src/app/service/shared-auth.service';
import { LeaveService } from '../leave.service';

@Component({
  standalone: false,
  selector: 'app-institute-holidays',
  templateUrl: './institute-holidays.component.html',
  styleUrls: ['./institute-holidays.component.css']
})
export class InstituteHolidaysComponent implements OnInit {
  loading: boolean = false;
  holidays: any[] = [];
  date: any = null;

  constructor(
    private leaveService: LeaveService,
    public auth: SharedAuthService,
    private dialog: DialogService
  ) { }

  ngOnInit(): void {
    this.getHolidays();
  }

  getHolidays() {
    this.loading = true;
    this.leaveService.getInstituteHolidays().subscribe({
      next: (result: any) => {
        this.loading = false;
        this.holidays = result || [];
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  deleteHoliday(date: string, index: number) {
    this.dialog.showDialog({
      content: `Are you sure to delete company holiday "${date}"?`,
      callBack: () => {
        this.loading = true;
        let dateDB = new Date(date + " UTC").toISOString().substring(0, 10);
        this.leaveService.deleteInstituteHoliday(dateDB).subscribe({
          next: (result: any) => {
            this.loading = false;
            if (result.success) {
              this.holidays.splice(index, 1);
            }
          },
          error: () => {
            this.loading = false;
          }
        });
      }
    });
  }

  submit() {
    const dateStr = this.toYmd(this.date);
    if (!dateStr) return;
    this.loading = true;
    this.leaveService.addInstituteHoliday(dateStr).subscribe({
      next: (result: any) => {
        this.loading = false;
        this.date = null;
        this.getHolidays();
        this.dialog.showDialog({ content: result.message });
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private toYmd(d: any): string | null {
    if (!d) return null;
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
