import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SharedAuthService } from '../service/shared-auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: SharedAuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const { token, tenantId } = this.authService.getTokenWithTenant();

    if (token) {
      let authReq = req.clone({
        setParams: {
          token: token
        }
      });

      if (tenantId) {
        authReq = authReq.clone({
          setHeaders: {
            'X-Tenant-ID': String(tenantId)
          }
        });
      }

      return next.handle(authReq);
    }

    return next.handle(req);
  }
}
