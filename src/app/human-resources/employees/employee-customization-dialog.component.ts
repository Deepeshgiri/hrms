import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CoreService } from 'src/app/service/core.service';
import { AppConstants } from 'src/app/AppConstants';

@Component({
  standalone: false,
  selector: 'employee-customization-dialog',
  template: `
    <div class="modal" *ngIf="show">
      <div class="dialog" style="max-width: 860px; width: 95%;">
        <div class="modal-header">
          <div class="title-with-icon">
            <mat-icon style="color: #6366f1;">settings_suggest</mat-icon>
            <span>Custom Schedule, Policy & Permissions &mdash; {{ employee?.name }}</span>
          </div>
          <button class="close" (click)="onClose()">&times;</button>
        </div>

        <div class="modal-body" style="padding: 0 24px 24px 24px;">
          <mat-tab-group animationDuration="150ms">

            <!-- ================= TAB 1: WEEKLY WORK SCHEDULE ================= -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon style="margin-right: 6px; font-size: 18px;">calendar_month</mat-icon>
                <span>Day-Wise Schedule</span>
              </ng-template>

              <div class="tab-pane-content" style="padding-top: 20px;">
                <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">
                  Configure individual working days, start times, end times, and late grace periods for each day of the week.
                </p>

                <div class="table-wrapper">
                  <table class="hrms-table">
                    <thead>
                      <tr>
                        <th>Day of Week</th>
                        <th>Status</th>
                        <th>Shift Hours (From &rarr; To)</th>
                        <th>Late Grace</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let s of schedule" [class.off-day-row]="!s.isWorkingDay">
                        <td><strong>{{ s.dayOfWeek }}</strong></td>
                        <td>
                          <label class="custom-toggle">
                            <input type="checkbox" [(ngModel)]="s.isWorkingDay" />
                            <span class="slider"></span>
                            <span class="toggle-text">{{ s.isWorkingDay ? 'Working Day' : 'Day Off' }}</span>
                          </label>
                        </td>
                        <td>
                          <div class="time-inputs" *ngIf="s.isWorkingDay" style="display: flex; gap: 8px; align-items: center;">
                            <input type="time" [(ngModel)]="s.fromTime" class="hrms-input-sm" />
                            <span>to</span>
                            <input type="time" [(ngModel)]="s.toTime" class="hrms-input-sm" />
                          </div>
                          <span *ngIf="!s.isWorkingDay" style="color: #94a3b8; font-size: 12px; font-style: italic;">Off / Weekend</span>
                        </td>
                        <td>
                          <div *ngIf="s.isWorkingDay" style="display: flex; align-items: center; gap: 4px;">
                            <input type="number" [(ngModel)]="s.lateGraceMinutes" class="hrms-input-sm" style="width: 60px;" min="0" />
                            <span style="font-size: 11.5px; color: #64748b;">mins</span>
                          </div>
                          <span *ngIf="!s.isWorkingDay">-</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="modal-actions" style="margin-top: 18px; display: flex; justify-content: flex-end; gap: 10px;">
                  <button mat-stroked-button (click)="onClose()">Cancel</button>
                  <button mat-raised-button color="primary" [disabled]="saving" (click)="saveSchedule()">
                    <mat-icon>save</mat-icon> {{ saving ? 'Saving...' : 'Save Weekly Schedule' }}
                  </button>
                </div>
              </div>
            </mat-tab>

            <!-- ================= TAB 2: INDIVIDUAL USER HOLIDAYS ================= -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon style="margin-right: 6px; font-size: 18px;">event_available</mat-icon>
                <span>Custom Holidays ({{ holidays.length }})</span>
              </ng-template>

              <div class="tab-pane-content" style="padding-top: 20px;">
                <div class="add-holiday-box" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                  <h4 style="margin: 0 0 12px 0; font-size: 13.5px; font-weight: 700; color: #334155;">Add Individual Holiday / Exemption</h4>
                  <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 160px;">
                      <label style="font-size: 11.5px; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;">Holiday Date *</label>
                      <input type="date" [(ngModel)]="newHoliday.holidayDate" class="hrms-input" required />
                    </div>
                    <div style="flex: 2; min-width: 220px;">
                      <label style="font-size: 11.5px; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;">Title / Reason *</label>
                      <input type="text" [(ngModel)]="newHoliday.title" placeholder="e.g. Regional Festival, Personal Day" class="hrms-input" />
                    </div>
                    <div style="flex: 1; display: flex; align-items: flex-end; height: 100%; margin-top: 18px;">
                      <button mat-raised-button color="primary" [disabled]="!newHoliday.holidayDate || savingHoliday" (click)="addHoliday()">
                        <mat-icon>add</mat-icon> Add Holiday
                      </button>
                    </div>
                  </div>
                </div>

                <div class="table-wrapper" *ngIf="holidays.length > 0">
                  <table class="hrms-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Holiday Title</th>
                        <th>Type</th>
                        <th style="text-align: right;">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let h of holidays">
                        <td><strong>{{ h.holidayDate | date:'fullDate' }}</strong></td>
                        <td>{{ h.title }}</td>
                        <td>
                          <span class="status-badge active" style="background: #e0e7ff; color: #4338ca;">Personal</span>
                        </td>
                        <td style="text-align: right;">
                          <button mat-icon-button color="warn" (click)="deleteHoliday(h.id)" matTooltip="Remove holiday">
                            <mat-icon>delete</mat-icon>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div *ngIf="holidays.length === 0" style="text-align: center; padding: 24px; color: #64748b; font-size: 13.5px;">
                  No customized holidays assigned yet for this employee.
                </div>
              </div>
            </mat-tab>

            <!-- ================= TAB 3: LEAVE POLICY & QUOTAS ================= -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon style="margin-right: 6px; font-size: 18px;">beach_access</mat-icon>
                <span>Leave Policy & Quotas</span>
              </ng-template>

              <div class="tab-pane-content" style="padding-top: 20px;">
                <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">
                  Configure individual annual leave quotas per type. Earned Leaves are carried forward at financial year end up to the carry-forward limit.
                </p>

                <div class="policy-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                  <div style="border-left: 3px solid #10b981; padding-left: 8px;">
                    <label class="hrms-label" style="color: #15803d; font-weight: 700;">Casual Leaves (CL)</label>
                    <input type="number" step="0.5" [(ngModel)]="leavePolicy.casualLeaves" class="hrms-input" (input)="recalculateAnnualQuota()" />
                    <span style="font-size: 11px; color: #64748b;">Annual allotment (resets)</span>
                  </div>
                  <div style="border-left: 3px solid #0284c7; padding-left: 8px;">
                    <label class="hrms-label" style="color: #0369a1; font-weight: 700;">Sick Leaves (SL)</label>
                    <input type="number" step="0.5" [(ngModel)]="leavePolicy.sickLeaves" class="hrms-input" (input)="recalculateAnnualQuota()" />
                    <span style="font-size: 11px; color: #64748b;">Annual medical allotment</span>
                  </div>
                  <div style="border-left: 3px solid #8b5cf6; padding-left: 8px;">
                    <label class="hrms-label" style="color: #6d28d9; font-weight: 700;">Earned Leaves (EL)</label>
                    <input type="number" step="0.5" [(ngModel)]="leavePolicy.earnedLeaves" class="hrms-input" (input)="recalculateAnnualQuota()" />
                    <span style="font-size: 11px; color: #64748b;">Privilege / vacation days</span>
                  </div>
                  <div style="border-left: 3px solid #f59e0b; padding-left: 8px;">
                    <label class="hrms-label" style="color: #b45309; font-weight: 700;">Max Carry-Forward</label>
                    <input type="number" step="1" [(ngModel)]="leavePolicy.carryForwardMax" class="hrms-input" />
                    <span style="font-size: 11px; color: #64748b;">Max EL carry at FY end</span>
                  </div>
                  <div style="border-left: 3px solid #0f172a; padding-left: 8px;">
                    <label class="hrms-label" style="color: #0f172a; font-weight: 700;">Total Annual Quota</label>
                    <input type="number" step="0.5" [(ngModel)]="leavePolicy.annualQuota" class="hrms-input" readonly style="background: #f1f5f9; font-weight: 700;" />
                    <span style="font-size: 11px; color: #64748b;">{{ leavePolicy.monthlyAccrual }} days/month</span>
                  </div>
                </div>

                <h4 style="margin: 0 0 10px 0; font-size: 13.5px; font-weight: 700; color: #334155;">Monthly Allocation Breakdown</h4>
                <div class="table-wrapper" style="max-height: 240px; overflow-y: auto;">
                  <table class="hrms-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Allotted</th>
                        <th>Carried</th>
                        <th>Used</th>
                        <th>Total Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let b of leaveBalances">
                        <td><strong>{{ b.monthName }}</strong></td>
                        <td>
                          <input type="number" step="0.5" [(ngModel)]="b.alloted" class="hrms-input-sm" style="width: 70px;" (input)="b.leaves = b.alloted + (b.carried || 0)" />
                        </td>
                        <td>{{ b.carried || 0 }}</td>
                        <td><span style="color: #ef4444; font-weight: 600;">{{ b.used || 0 }}</span></td>
                        <td><strong>{{ b.leaves }} Days</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div class="modal-actions" style="margin-top: 18px; display: flex; justify-content: flex-end; gap: 10px;">
                  <button mat-stroked-button (click)="onClose()">Cancel</button>
                  <button mat-raised-button color="primary" [disabled]="savingPolicy" (click)="saveLeavePolicy()">
                    <mat-icon>save</mat-icon> {{ savingPolicy ? 'Saving...' : 'Save Leave Policy' }}
                  </button>
                </div>
              </div>
            </mat-tab>

            <!-- ================= TAB 4: INDIVIDUAL CUSTOM PERMISSIONS OVERRIDES ================= -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon style="margin-right: 6px; font-size: 18px;">admin_panel_settings</mat-icon>
                <span>Custom Permissions</span>
              </ng-template>

              <div class="tab-pane-content" style="padding-top: 20px;">
                <p style="font-size: 13px; color: #64748b; margin-bottom: 14px;">
                  Customize individual permissions for this employee. Override their base role by explicitly granting or denying specific module features.
                </p>

                <div class="permissions-override-scroll" style="max-height: 380px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                  <div *ngFor="let cat of permissionCategories" style="margin-bottom: 16px;">
                    <div style="font-weight: 700; font-size: 13.5px; color: #1e293b; padding: 6px 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 8px;">
                      {{ cat.category }}
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 8px;">
                      <div *ngFor="let p of cat.permissions" class="perm-override-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border: 1px solid #f1f5f9; border-radius: 6px; background: #ffffff;">
                        <div style="flex: 1; padding-right: 8px;">
                          <div style="font-weight: 600; font-size: 13px; color: #1e293b;">{{ p.name }}</div>
                          <div style="font-size: 11px; color: #64748b;">{{ p.key }}</div>
                        </div>

                        <!-- 3-State Override Selector -->
                        <select
                          [ngModel]="getOverrideState(p.key)"
                          (ngModelChange)="setOverrideState(p.key, $event)"
                          [ngClass]="getOverrideClass(p.key)"
                          style="padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; outline: none; cursor: pointer;"
                        >
                          <option value="inherit">Inherit ({{ isInheritedFromRole(p.key) ? 'Granted' : 'Denied' }})</option>
                          <option value="grant" style="color: #15803d;">Explicitly Grant (ALLOW)</option>
                          <option value="deny" style="color: #b91c1c;">Explicitly Deny (BLOCK)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="modal-actions" style="margin-top: 18px; display: flex; justify-content: flex-end; gap: 10px;">
                  <button mat-stroked-button (click)="onClose()">Cancel</button>
                  <button mat-raised-button color="primary" [disabled]="savingPermissions" (click)="savePermissionsOverrides()">
                    <mat-icon>save</mat-icon> {{ savingPermissions ? 'Saving...' : 'Save Custom Permissions' }}
                  </button>
                </div>
              </div>
            </mat-tab>

          </mat-tab-group>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .title-with-icon {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 17px;
        font-weight: 700;
        color: #1e293b;
      }
      .custom-toggle {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
      }
      .custom-toggle input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .slider {
        position: relative;
        display: inline-block;
        width: 38px;
        height: 20px;
        background-color: #cbd5e1;
        border-radius: 20px;
        transition: 0.2s;
      }
      .slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        border-radius: 50%;
        transition: 0.2s;
      }
      .custom-toggle input:checked + .slider {
        background-color: #4f46e5;
      }
      .custom-toggle input:checked + .slider:before {
        transform: translateX(18px);
      }
      .toggle-text {
        font-size: 12.5px;
        font-weight: 500;
        color: #475569;
      }
      .hrms-input-sm {
        padding: 4px 8px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 12.5px;
        outline: none;
      }
      .hrms-input-sm:focus {
        border-color: #4f46e5;
      }
      .off-day-row {
        background: #f8fafc !important;
        opacity: 0.75;
      }
      .override-grant {
        background: #dcfce7 !important;
        color: #15803d !important;
        border: 1px solid #86efac !important;
      }
      .override-deny {
        background: #fee2e2 !important;
        color: #b91c1c !important;
        border: 1px solid #fca5a5 !important;
      }
      .override-inherit {
        background: #f8fafc !important;
        color: #475569 !important;
        border: 1px solid #cbd5e1 !important;
      }
    `
  ]
})
export class EmployeeCustomizationDialogComponent implements OnInit, OnChanges {
  @Input() show: boolean = false;
  @Input() employee: any = null;
  @Output() close = new EventEmitter<void>();

  schedule: any[] = [];
  holidays: any[] = [];
  leavePolicy: any = { annualQuota: 18, monthlyAccrual: 1.5, sickLeaves: 6, casualLeaves: 12, carryForwardMax: 5 };
  leaveBalances: any[] = [];

  // Individual Permission Overrides
  permissionCategories: any[] = [];
  rolePermissions: string[] = [];
  userOverrides: { [key: string]: boolean } = {};
  savingPermissions: boolean = false;

  newHoliday: any = { holidayDate: '', title: '', isOptional: false };

  saving: boolean = false;
  savingHoliday: boolean = false;
  savingPolicy: boolean = false;

  constructor(private coreService: CoreService) {}

  ngOnInit(): void {
    this.loadPermissionsMeta();
    if (this.employee && (this.employee.userId || this.employee.id)) {
      this.loadAll();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show && this.employee) {
      this.loadPermissionsMeta();
      this.loadAll();
    }
  }

  loadPermissionsMeta(): void {
    this.coreService.getRequest(`${AppConstants.API_URL}roles/permissions/meta`).subscribe({
      next: (res: any) => {
        this.permissionCategories = res.categories || [];
      },
      error: () => {}
    });
  }

  loadAll(): void {
    const id = this.employee.userId || this.employee.id;
    if (!id) return;

    // 1. Schedule
    this.coreService.getRequest(`${AppConstants.API_URL}users/${id}/schedule`).subscribe({
      next: (data: any[]) => {
        this.schedule = data || [];
      },
      error: () => {}
    });

    // 2. Holidays
    this.coreService.getRequest(`${AppConstants.API_URL}users/${id}/holidays`).subscribe({
      next: (data: any[]) => {
        this.holidays = data || [];
      },
      error: () => {}
    });

    // 3. Leave Policy & Balances
    this.coreService.getRequest(`${AppConstants.API_URL}users/${id}/leave-policy`).subscribe({
      next: (res: any) => {
        if (res) {
          this.leavePolicy = res.policy || this.leavePolicy;
          this.leaveBalances = res.balances || [];
        }
      },
      error: () => {}
    });

    // 4. Custom Individual Permissions
    this.coreService.getRequest(`${AppConstants.API_URL}roles/user/${id}/permissions`).subscribe({
      next: (res: any) => {
        if (res) {
          this.rolePermissions = res.rolePermissions || [];
          this.userOverrides = res.userOverrides || {};
        }
      },
      error: () => {}
    });
  }

  getOverrideState(permKey: string): string {
    if (this.userOverrides[permKey] === true) return 'grant';
    if (this.userOverrides[permKey] === false) return 'deny';
    return 'inherit';
  }

  setOverrideState(permKey: string, state: string): void {
    if (state === 'grant') {
      this.userOverrides[permKey] = true;
    } else if (state === 'deny') {
      this.userOverrides[permKey] = false;
    } else {
      delete this.userOverrides[permKey];
    }
  }

  getOverrideClass(permKey: string): string {
    const state = this.getOverrideState(permKey);
    if (state === 'grant') return 'override-grant';
    if (state === 'deny') return 'override-deny';
    return 'override-inherit';
  }

  isInheritedFromRole(permKey: string): boolean {
    return this.rolePermissions.includes(permKey);
  }

  savePermissionsOverrides(): void {
    const id = this.employee.userId || this.employee.id;
    this.savingPermissions = true;
    this.coreService.putRequest(`${AppConstants.API_URL}roles/user/${id}/permissions`, {
      overrides: this.userOverrides
    }).subscribe({
      next: () => {
        this.savingPermissions = false;
        alert('Individual employee permissions customized successfully!');
      },
      error: (err: any) => {
        this.savingPermissions = false;
        alert(err.error?.message || 'Failed to save permissions');
      }
    });
  }

  saveSchedule(): void {
    const id = this.employee.userId || this.employee.id;
    this.saving = true;
    this.coreService.putRequest(`${AppConstants.API_URL}users/${id}/schedule`, { schedule: this.schedule }).subscribe({
      next: () => {
        this.saving = false;
        alert('Weekly schedule saved successfully!');
      },
      error: (err: any) => {
        this.saving = false;
        alert(err.error?.message || 'Failed to save schedule');
      }
    });
  }

  addHoliday(): void {
    if (!this.newHoliday.holidayDate) return;
    const id = this.employee.userId || this.employee.id;
    this.savingHoliday = true;
    this.coreService.postRequest(`${AppConstants.API_URL}users/${id}/holidays`, this.newHoliday).subscribe({
      next: () => {
        this.savingHoliday = false;
        this.newHoliday = { holidayDate: '', title: '', isOptional: false };
        this.loadAll();
      },
      error: (err: any) => {
        this.savingHoliday = false;
        alert(err.error?.message || 'Failed to add holiday');
      }
    });
  }

  deleteHoliday(holidayId: number): void {
    if (!confirm('Remove this custom holiday?')) return;
    const id = this.employee.userId || this.employee.id;
    this.coreService.deleteRequest(`${AppConstants.API_URL}users/${id}/holidays/${holidayId}`).subscribe({
      next: () => {
        this.loadAll();
      },
      error: () => {}
    });
  }

  recalculateAnnualQuota(): void {
    const cl = Number(this.leavePolicy.casualLeaves) || 0;
    const sl = Number(this.leavePolicy.sickLeaves) || 0;
    const el = Number(this.leavePolicy.earnedLeaves) || 0;
    this.leavePolicy.annualQuota = cl + sl + el;
    this.recalculateMonthly();
  }

  recalculateMonthly(): void {
    const perMonth = (Number(this.leavePolicy.annualQuota) || 33) / 12;
    this.leavePolicy.monthlyAccrual = Number(perMonth.toFixed(2));
    this.leaveBalances.forEach((b: any) => {
      b.alloted = perMonth;
      b.leaves = b.alloted + (b.carried || 0);
    });
  }

  saveLeavePolicy(): void {
    const id = this.employee.userId || this.employee.id;
    this.savingPolicy = true;
    this.coreService.putRequest(`${AppConstants.API_URL}users/${id}/leave-policy`, {
      policy: this.leavePolicy,
      balances: this.leaveBalances
    }).subscribe({
      next: () => {
        this.savingPolicy = false;
        alert('Leave policy and balance distribution saved successfully!');
      },
      error: (err: any) => {
        this.savingPolicy = false;
        alert(err.error?.message || 'Failed to save leave policy');
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
