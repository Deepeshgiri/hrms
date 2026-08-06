import { Component, OnInit } from '@angular/core';
import { AppConstants } from '../../../AppConstants';
import { CoreService } from '../../../service/core.service';

@Component({
  selector: 'app-users-leaves',
  templateUrl: './users-leaves.component.html',
  styleUrls: ['./users-leaves.component.css']
})
export class UsersLeavesComponent implements OnInit {

  loading: boolean = true;
  usersLeaves: any[] = [];
  date: Date = new Date();

  constructor(private coreService: CoreService) { }

  ngOnInit(): void {
    this.date.setDate(1);
    this.filterLeaves();
  }

  getUsersLeaves(month: number, year: number): void {
    const url = AppConstants.API_URL + "leaves/all-users-leaves?month=" + month + "&year=" + year;
    this.coreService.getRequest(url).subscribe((data: any) => {
      this.usersLeaves = data;
      this.loading = false;
    });
  }

  changeDate(direction: string): void {
    const date = new Date(this.date);
    if (direction === 'next') {
      date.setMonth(date.getMonth() + 1);
      this.date = date;
    } else {
      date.setMonth(date.getMonth() - 1);
      this.date = date;
    }
    this.filterLeaves();
  }

  filterLeaves(): void {
    this.getUsersLeaves(this.date.getMonth(), this.date.getFullYear());
  }
}
