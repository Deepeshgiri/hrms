import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DateTimeFormatService {
  constructor() { }

  getFormattedDate(date: any): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
  }

  getFormattedTime(time: any): string {
    if (!time) return '';
    return new Date(time).toLocaleTimeString();
  }

  getFormattedDateTime(dateTime: any): string {
    if (!dateTime) return '';
    return new Date(dateTime).toLocaleString();
  }
}
