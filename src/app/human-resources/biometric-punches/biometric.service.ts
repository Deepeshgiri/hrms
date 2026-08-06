import { Injectable } from '@angular/core';
import { CoreService } from 'src/app/service/core.service';
import { AppConstants } from 'src/app/AppConstants';
import { BiometricMapEmployeeResponse, BiometricMapRequest } from './biometric.modal';

@Injectable({
  providedIn: 'root'
})
export class BiometricService {
  constructor(private coreService: CoreService) { }

  getEmployeesForMapping() {
    return this.coreService.getRequest(
      `${AppConstants.API_URL}bio/employees/mapping`
    );
  }

  mapEmployeeToPunch(mapRequest: BiometricMapRequest) {
    return this.coreService.postRequest(
      `${AppConstants.API_URL}bio/punches/map-employee`,
      mapRequest
    );
  }
}
