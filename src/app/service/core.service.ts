import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CoreService {
  constructor(private http: HttpClient) {}

  getRequest(url: string): Observable<any> {
    return this.http.get(url);
  }

  postRequest(url: string, data: any): Observable<any> {
    return this.http.post(url, data);
  }

  putRequest(url: string, data: any): Observable<any> {
    return this.http.put(url, data);
  }

  deleteRequest(url: string): Observable<any> {
    return this.http.delete(url);
  }

  patchRequest(url: string, data: any): Observable<any> {
    return this.http.patch(url, data);
  }
}
