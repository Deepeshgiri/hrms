import { Injectable } from '@angular/core';
import { Permissions, permissionsObject } from './user.modal';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  getUserPermissions(): Promise<Permissions> {
    return Promise.resolve({ ...permissionsObject });
  }
}
