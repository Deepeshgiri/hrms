import { Injectable } from "@angular/core";
import { AppConstants } from "../../AppConstants";
import { CoreService } from "../../service/core.service";
import { LeaveForm, UsersLeavesInfo } from "./leave.modal";

@Injectable({
  providedIn: 'root',
})
export class LeaveService {
  constructor(private coreService: CoreService) {}

  getLeaveTypes() {
    return this.coreService.getRequest(AppConstants.API_URL + "leaves/types");
  }

  getMyLeaves() {
    return this.coreService.getRequest(AppConstants.API_URL + "leaves/my");
  }

  getUsersLeaves() {
    return this.coreService.getRequest(AppConstants.API_URL + "leaves");
  }

  getMyLeavesInfo() {
    return this.coreService.getRequest(AppConstants.API_URL + "leaves/my-leaves-info");
  }

  getUserDetailedBalances(userId: number) {
    return this.coreService.getRequest(AppConstants.API_URL + `leaves/user/${userId}/balances`);
  }

  getUsersLeavesInfo() {
    return this.coreService.getRequest(AppConstants.API_URL + "leaves/users-leaves-info");
  }

  getPendingLeavesCount() {
    return this.coreService.getRequest(AppConstants.API_URL + "leaves/pending-leaves-count");
  }

  submitLeave(data: LeaveForm) {
    return this.coreService.postRequest(AppConstants.API_URL + "leaves/", data);
  }

  updateUserLeaveInfo(userLeaveInfo: UsersLeavesInfo) {
    return this.coreService.putRequest(AppConstants.API_URL + "leaves/update-user-leave-info", userLeaveInfo);
  }

  reCalculateLeaves() {
    return this.coreService.putRequest(AppConstants.API_URL + "leaves/re-calculate-leaves", {});
  }

  acceptRejectLeave(leaveId: string | number, status: string | number, response: string, userId: string | number) {
    return this.coreService.putRequest(AppConstants.API_URL + "leaves/", { leaveId, status, response, userId });
  }

  updateLeave(data: any) {
    return this.coreService.putRequest(AppConstants.API_URL + "leaves/update-leave", data);
  }

  deleteLeave(leaveId: string | number) {
    return this.coreService.deleteRequest(AppConstants.API_URL + "leaves/" + leaveId);
  }

  addInstituteHoliday(date: string) {
    return this.coreService.postRequest(AppConstants.API_URL + "leaves/institute-holiday", { date });
  }

  getInstituteHolidays() {
    return this.coreService.getRequest(AppConstants.API_URL + "leaves/institute-holidays");
  }

  deleteInstituteHoliday(date: string) {
    return this.coreService.deleteRequest(AppConstants.API_URL + "leaves/institute-holiday/" + date);
  }

  rolloverFinancialYear(targetFY?: string) {
    return this.coreService.postRequest(AppConstants.API_URL + "leaves/financial-year/rollover", { targetFY });
  }

  getFinancialYearSummary() {
    return this.coreService.getRequest(AppConstants.API_URL + "leaves/financial-year/summary");
  }
}
