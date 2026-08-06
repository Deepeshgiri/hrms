import { Injectable } from "@angular/core";
import { AppConstants } from "src/app/AppConstants";
import { CoreService } from "src/app/service/core.service";
import { LeaveForm, UsersLeavesInfo } from "./leave.modal";

@Injectable({
    providedIn: 'root',
})
export class LeaveService {
    constructor(private coreService: CoreService) { }

    getMyLeaves() {
        return this.coreService.getRequest(AppConstants.API_URL + "leaves/my")
    }

    getUsersLeaves() {
        return this.coreService.getRequest(AppConstants.API_URL + "leaves")
    }

    getMyLeavesInfo() {
        return this.coreService.getRequest(AppConstants.API_URL + "leaves/my-leaves-info")
    }

    getUsersLeavesInfo() {
        return this.coreService.getRequest(AppConstants.API_URL + "leaves/users-leaves-info")
    }

    getPendingLeavesCount() {
        return this.coreService.getRequest(AppConstants.API_URL + "leaves/pending-leaves-count")
    }

    submitLeave(data: LeaveForm) {
        return this.coreService.postRequest(AppConstants.API_URL + "leaves/", data)
    }

    updateUserLeaveInfo(userLeaveInfo: UsersLeavesInfo) {
        return this.coreService.putRequest(AppConstants.API_URL + "leaves/update-user-leave-info", userLeaveInfo)
    }

    reCalculateLeaves() {
        return this.coreService.putRequest(AppConstants.API_URL + "leaves/re-calculate-leaves", {})
    }

    acceptRejectLeave(leaveId, status, response, userId) {
        return this.coreService.putRequest(AppConstants.API_URL + "leaves/", { leaveId, status, response, userId })
    }

    updateLeave(data) {
        return this.coreService.putRequest(AppConstants.API_URL + "leaves/update-leave", data)
    }

    deleteLeave(leaveId) {
        return this.coreService.deleteRequest(AppConstants.API_URL + "leaves/" + leaveId)
    }

    addInstituteHoliday(date){
        return this.coreService.postRequest(AppConstants.API_URL+"leaves/institute-holiday",{date})
    }

    getInstituteHolidays(){
        return this.coreService.getRequest(AppConstants.API_URL+"leaves/institute-holidays")
    }

    deleteInstituteHoliday(date){
        return this.coreService.deleteRequest(AppConstants.API_URL+"leaves/institute-holiday/"+date)
    }

}