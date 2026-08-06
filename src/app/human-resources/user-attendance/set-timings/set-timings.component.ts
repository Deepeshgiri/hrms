import { Component, OnInit } from '@angular/core';
import { AppConstants } from '../../../AppConstants';
import { CoreService } from '../../../service/core.service';
import { DialogService } from '../../../service/dialog.service';

@Component({
  standalone: false,
  selector: 'app-set-timings',
  templateUrl: './set-timings.component.html',
  styleUrls: ['./set-timings.component.css']
})
export class SetTimingsComponent implements OnInit {

  loading: boolean = false;

  users: any[] = [];
  timings: any[] = [];
  timeSlots: string[] = [];

  timingForm = {
    userId: null,
    fromTime: null,
    toTime: null
  };

  constructor(
    private coreService: CoreService,
    private dialog: DialogService
  ) {}

  ngOnInit(): void {
    this.setTimeSlots();
    this.getUsers();
    this.getTimings();
  }

  // ---------------- USERS ----------------
  getUsers() {
    this.loading = true;

    this.coreService.getRequest(AppConstants.API_URL + "users")
      .subscribe((users: any) => {
        this.users = users;
        this.loading = false;
      }, () => {
        this.loading = false;
      });
  }

  // ---------------- TIMINGS ----------------
  getTimings() {
    this.loading = true;

    this.coreService.getRequest(AppConstants.API_URL + "users/timings")
      .subscribe((result: any) => {
        this.timings = result;
        this.loading = false;
      }, () => {
        this.loading = false;
      });
  }

  // ---------------- AUTO FILL ----------------
  populateTimings() {
    const userId = this.timingForm.userId;

    const userTimings = this.timings.find(t => t.userId == userId);

    if (userTimings) {
      this.timingForm.fromTime = userTimings.fromTime?.slice(0, 5);
      this.timingForm.toTime = userTimings.toTime?.slice(0, 5);
    } else {
      this.timingForm.fromTime = null;
      this.timingForm.toTime = null;
    }
  }

  // ---------------- TIME SLOTS ----------------
  setTimeSlots() {
    this.timeSlots = [];

    for (let i = 8; i <= 23; i++) {
      for (let j = 0; j <= 45; j += 15) {
        const hour = (i + "").padStart(2, "0");
        const minute = (j + "").padStart(2, "0");
        this.timeSlots.push(`${hour}:${minute}`);
      }
    }
  }

  // ---------------- SUBMIT ----------------
  submitTimings() {

    if (!this.timingForm.userId || !this.timingForm.fromTime || !this.timingForm.toTime) {
      this.dialog.showDialog({ content: "Please fill all fields" });
      return;
    }

    if (this.timingForm.fromTime >= this.timingForm.toTime) {
      this.dialog.showDialog({ content: "From Time must be less than To Time" });
      return;
    }

    this.loading = true;

    this.coreService.putRequest(
      AppConstants.API_URL + "users/timings",
      this.timingForm
    ).subscribe((data: any) => {

      this.loading = false;

      this.dialog.showDialog({ content: data.message });

      // Refresh list
      this.getTimings();

    }, () => {
      this.loading = false;
    });
  }

}