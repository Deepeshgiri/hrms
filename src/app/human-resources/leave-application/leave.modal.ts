export interface Leave {
  userId: number;
  leaveId: number;
  name: string;
  leaveContent: string;
  leaveType?: string;
  leaveTypeName?: string;
  leaveTypeColor?: string;
  leaveTypeIcon?: string;
  fromDate: string;
  toDate: string;
  reason: string;
  timestamp: string;
  status: string;
  response: string;
  duration?: string;
  half?: number;
}

export interface LeaveForm {
  leaveContent: string;
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  date?: string;
  duration: string;
  half?: number;
  reason: string;
}

export interface LeaveTypeBalance {
  id: number;
  code: string;
  name: string;
  description?: string;
  colorCode: string;
  icon: string;
  isCarryForwardable: boolean;
  maxCarryForward: number;
  allotted: number;
  carried: number;
  totalQuota: number;
  used: number;
  remaining: number;
}

export interface LeavesInfo {
  userId: number;
  financialYear?: string;
  fyLabel?: string;
  startDate?: string;
  endDate?: string;
  leaveTypes?: LeaveTypeBalance[];
  summary?: {
    totalAllotted: number;
    totalCarried: number;
    totalQuota: number;
    totalUsed: number;
    totalRemaining: number;
  };
  totalLeaves?: number;
  usedLeaves?: number;
  remainingLeaves: number;
}

export interface UsersLeavesInfo {
  userId: number;
  name: string;
  financialYear?: string;
  leaveTypes?: LeaveTypeBalance[];
  remainingLeaves: number;
  totalLeaves: number;
  usedLeaves?: number;
}