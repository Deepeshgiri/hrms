import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  constructor() { }

  getUsers(): Observable<any[]> {
    return of([]);
  }

  getUser(id: number): Observable<any> {
    return of({});
  }

  createUser(user: any): Observable<any> {
    return of(user);
  }

  updateUser(id: number, user: any): Observable<any> {
    return of(user);
  }

  deleteUser(id: number): Observable<any> {
    return of({});
  }
}
