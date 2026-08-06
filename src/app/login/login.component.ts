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
  email: string = '';
  password: string = '';
  loading: boolean = false;
  error: string = '';

  constructor(
    private coreService: CoreService,
    private authService: SharedAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  login(): void {
    if (!this.email || !this.password) {
      this.error = 'Email and password are required';
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
          this.router.navigate(['/dashboard']);
        } else {
          this.error = 'Invalid response from server';
        }
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err.error?.message || 'Login failed. Please try again.';
        this.loading = false;
      }
    });
  }

  goToTestProject(): void {
    window.location.href = 'http://localhost:4200';
  }
}
