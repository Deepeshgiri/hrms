import { Component, OnInit } from '@angular/core';
import { DialogService } from 'src/app/service/dialog.service';
import { LeaveService } from '../leave.service';

interface Holiday {
  leaveDate: string;
  title: string;
  description: string;
  type: string;
}

@Component({
  standalone: false,
  selector: 'app-institute-holidays',
  templateUrl: './institute-holidays.component.html',
  styleUrls: ['./institute-holidays.component.css']
})
export class InstituteHolidaysComponent implements OnInit {
  loading = false;
  holidays: Holiday[] = [];

  // form state
  form = { date: null as any, title: '', description: '', type: 'Company' };
  editingDate: string | null = null;
  showForm = false;

  holidayTypes = ['Company', 'Public', 'Optional', 'Restricted'];

  constructor(private leaveService: LeaveService, private dialog: DialogService) {}

  ngOnInit(): void {
    this.getHolidays();
  }

  getHolidays() {
    this.loading = true;
    this.leaveService.getInstituteHolidays().subscribe({
      next: (result: any) => { this.holidays = result || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openAddForm() {
    this.editingDate = null;
    this.form = { date: null, title: '', description: '', type: 'Company' };
    this.showForm = true;
  }

  openEditForm(h: Holiday) {
    this.editingDate = h.leaveDate;
    this.form = { date: new Date(h.leaveDate + 'T00:00:00'), title: h.title, description: h.description || '', type: h.type };
    this.showForm = true;
  }

  cancelForm() {
    this.showForm = false;
    this.editingDate = null;
  }

  submit() {
    if (!this.form.title.trim()) {
      this.dialog.showDialog({ content: 'Title is required.' });
      return;
    }

    const payload = { title: this.form.title.trim(), description: this.form.description.trim(), type: this.form.type };
    this.loading = true;

    if (this.editingDate) {
      this.leaveService.updateInstituteHoliday(this.editingDate, payload).subscribe({
        next: (res: any) => { this.loading = false; this.showForm = false; this.getHolidays(); },
        error: () => { this.loading = false; }
      });
    } else {
      const dateStr = this.toYmd(this.form.date);
      if (!dateStr) { this.loading = false; this.dialog.showDialog({ content: 'Date is required.' }); return; }
      this.leaveService.addInstituteHoliday({ date: dateStr, ...payload }).subscribe({
        next: (res: any) => { this.loading = false; this.showForm = false; this.getHolidays(); },
        error: (err: any) => { this.loading = false; this.dialog.showDialog({ content: err?.error?.message || 'Failed to save holiday.' }); }
      });
    }
  }

  deleteHoliday(h: Holiday, index: number) {
    this.dialog.showDialog({
      content: `Delete "${h.title}" on ${h.leaveDate}?`,
      callBack: () => {
        this.loading = true;
        const dateDB = new Date(h.leaveDate + 'T00:00:00').toISOString().slice(0, 10);
        this.leaveService.deleteInstituteHoliday(dateDB).subscribe({
          next: (res: any) => { this.loading = false; if (res.success) this.holidays.splice(index, 1); },
          error: () => { this.loading = false; }
        });
      }
    });
  }

  private toYmd(d: any): string | null {
    if (!d) return null;
    const dt = d instanceof Date ? d : new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
}
