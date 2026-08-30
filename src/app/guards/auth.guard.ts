import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SharedAuthService } from '../service/shared-auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(SharedAuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  router.navigate(['/login']);
  return false;
};
