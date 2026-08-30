import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CoreService } from '../service/core.service';
import { SharedAuthService } from '../service/shared-auth.service';
import { AppConstants } from '../AppConstants';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  email: string = 'admin@hrms.com';
  password: string = 'admin123';
  loading: boolean = false;
  error: string = '';

  demoAccounts = [
    { role: 'Admin', email: 'admin@hrms.com', password: 'admin123', name: 'System Admin', icon: '⚡' },
    { role: 'HR Manager', email: 'ayesha@hrms.com', password: 'hr123', name: 'Ayesha Khan', icon: '💼' },
    { role: 'Employee', email: 'rahul@hrms.com', password: 'emp123', name: 'Rahul Sharma', icon: '👤' },
  ];

  constructor(
    private coreService: CoreService,
    private authService: SharedAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/users/human-resources']);
    }
  }

  fillDemo(account: { email: string; password: string }): void {
    this.email = account.email;
    this.password = account.password;
    this.error = '';
    this.login();
  }

  login(): void {
    if (!this.email || !this.password) {
      this.error = 'Please enter both email and password';
      return;
    }

    this.loading = true;
    this.error = '';

    this.coreService.postRequest(
      AppConstants.API_URL + 'login',
      { email: this.email, password: this.password }
    ).subscribe({
      next: (response: any) => {
        if (response.token) {
          this.authService.setToken(response.token);
          this.authService.setUser(response.user);
          if (response.tenantId) {
            this.authService.setTenantId(response.tenantId);
          }
          this.router.navigate(['/users/human-resources']);
        } else {
          this.error = 'Invalid response from server';
        }
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err.error?.message || 'Login failed. Please check your credentials.';
        this.loading = false;
      }
    });
  }
}
