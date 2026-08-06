export interface Leave {
    userId:number
    leaveId: number
    leaveContent: string
    fromDate: string
    toDate: string
    reason: string
    timestamp: string
    status: string
    response: string
}


export interface LeaveForm {
    leaveContent: string
    fromDate?:string
    toDate?:string
    date?:string
    duration:string
    half?:number
    reason: string
}

export interface LeavesInfo {
    userId: number
    remainingLeaves: number
}


export interface UsersLeavesInfo {
    userId: number
    name:string
    remainingLeaves: number
    totalLeaves: number
}