import { Component, OnInit } from '@angular/core';
import { AppConstants } from 'src/app/AppConstants';
import { CoreService } from 'src/app/service/core.service';

@Component({
  standalone: false,
  selector: 'app-default-user-leaves',
  templateUrl: './default-user-leaves.component.html',
  styleUrls: ['./default-user-leaves.component.css']
})
export class DefaultUserLeavesComponent implements OnInit {

  loading: boolean = true

  roleId = ""
  roles = []

  activeLeave = []

  constructor(private coreService: CoreService) { }

  ngOnInit(): void {
    this.coreService.getRequest(AppConstants.API_URL + "leaves/default-role-leaves").
      subscribe((roles: any) => {
        this.loading = false
        this.roles = roles
      })
  }

  //Load Leaves
  loadLeaves() {
    if(this.roleId == ""){
      return this.activeLeave = []
    }
    let role = this.roles.find(r => r.roleId == this.roleId)
    this.activeLeave = role.leaves
  }

  //Update Leaves
  updateLeave() {
    this.loading = true
    const url = AppConstants.API_URL + "leaves/default-leave"
    const data = {
      roleId: this.roleId,
      leave: this.activeLeave
    }
    this.coreService.putRequest(url, data).subscribe((data:any)=>{
        this.loading = false
    })
  }

}
