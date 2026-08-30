import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { SharedAuthService } from '../service/shared-auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(SharedAuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const allowedRoles = route.data['roles'] as number[] | undefined;
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  const userRoleId = auth.getRoleId();
  if (allowedRoles.includes(userRoleId)) {
    return true;
  }

  // Unauthorized for this specific route -> redirect to dashboard
  router.navigate(['/users/human-resources/dashboard']);
  return false;
};
