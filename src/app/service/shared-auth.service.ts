import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SharedAuthService {
  private tokenKey = 'pinnacle_auth_token';
  private userKey = 'pinnacle_user_info';
  private tenantKey = 'pinnacle_tenant_id';
  
  private tokenSubject = new BehaviorSubject<string | null>(this.getStoredToken());
  private userSubject = new BehaviorSubject<any>(this.getStoredUser());
  
  public token$ = this.tokenSubject.asObservable();
  public user$ = this.userSubject.asObservable();

  constructor() {
    this.initializeFromStorage();
  }

  private initializeFromStorage(): void {
    const token = localStorage.getItem(this.tokenKey);
    const user = localStorage.getItem(this.userKey);
    
    if (token) {
      this.tokenSubject.next(token);
    }
    if (user) {
      this.userSubject.next(JSON.parse(user));
    }
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
    this.tokenSubject.next(token);
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setUser(user: any): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.userSubject.next(user);
  }

  getUser(): any {
    return this.userSubject.value;
  }

  private getStoredUser(): any {
    const user = localStorage.getItem(this.userKey);
    return user ? JSON.parse(user) : null;
  }

  setTenantId(tenantId: string | number): void {
    localStorage.setItem(this.tenantKey, String(tenantId));
  }

  getTenantId(): string | number | null {
    return localStorage.getItem(this.tenantKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.tenantKey);
    this.tokenSubject.next(null);
    this.userSubject.next(null);
  }

  getTokenWithTenant(): { token: string; tenantId: string | number | null } {
    return {
      token: this.getToken() || '',
      tenantId: this.getTenantId()
    };
  }
}
