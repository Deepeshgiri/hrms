export interface BiometricUser {
  userId: number;
  name: string;
  email?: string;
  employeeId?: string;
}

export interface BiometricMapEmployeeResponse {
  users: BiometricUser[];
  totalCount: number;
}

export interface BiometricMapRequest {
  enrollId: string;
  deviceSN: string;
  userId: number;
}
