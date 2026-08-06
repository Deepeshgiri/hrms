export interface Permissions {
  [key: string]: boolean;
}

export const permissionsObject: Permissions = {
  canViewUsers: false,
  canEditUsers: false,
  canDeleteUsers: false,
  canViewReports: false,
  canEditReports: false,
  canViewAttendance: false,
  canEditAttendance: false,
  canViewLeaves: false,
  canApproveLeaves: false,
  canViewPayroll: false,
  canEditPayroll: false
};

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: Permissions;
}
