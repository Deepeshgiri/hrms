import { Component, OnInit, Inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { CoreService } from 'src/app/service/core.service';
import { AppConstants } from 'src/app/AppConstants';
import { BiometricService } from './biometric.service';
import { BiometricUser, BiometricMapRequest } from './biometric.modal';
import { EmployeeSelectionDialogComponent } from './employee-selection-dialog.component';

@Component({
  standalone: false,
  selector: 'app-biometric-punches',
  templateUrl: './biometric-punches.component.html',
  styleUrls: ['./biometric-punches.component.css']
})
export class BiometricPunchesComponent implements OnInit {
  punches: any[] = [];
  loading = false;
  devices: any[] = [];

  startDate: Date = new Date();
  endDate: Date = new Date();
  selectedDevice = '';
  selectedEnrollId = '';
  mappedFilter: 'all' | 'known' | 'unknown' = 'all';

  displayedColumns = ['datetime', 'deviceSN', 'enrollId', 'employee', 'status', 'entryType', 'actions'];


  constructor(
    private coreService: CoreService,
    private snackBar: MatSnackBar,
    private biometricService: BiometricService,
    private dialog: MatDialog
  ) { }

  ngOnInit() {
    this.setDefaultDates();
    this.loadDevices();
    this.loadPunches();
  }

  setDefaultDates() {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    this.startDate = weekAgo;
    this.endDate = today;
  }

  loadDevices() {
    this.coreService.getRequest(`${AppConstants.API_URL}bio/biometric/devices`).subscribe({
      next: (data: any) => {
        this.devices = data || [];
      },
      error: (err) => console.error('Error loading devices:', err)
    });
  }

  loadPunches() {
    this.loading = true;

    let params = new URLSearchParams();
    
    if (this.startDate) {
      params.append('startDate', this.formatDateForAPI(this.startDate));
    }
    if (this.endDate) {
      params.append('endDate', this.formatDateForAPI(this.endDate));
    }
    if (this.selectedDevice) {
      params.append('deviceSN', this.selectedDevice);
    }
    if (this.selectedEnrollId) {
      params.append('enrollId', this.selectedEnrollId);
    }
    if (this.mappedFilter !== 'all') {
      params.append('mapped', this.mappedFilter);
    }

    const queryString = params.toString();
    const url = `${AppConstants.API_URL}bio/punches/recent${queryString ? '?' + queryString : ''}`;

    this.coreService.getRequest(url).subscribe({
      next: (response: any) => {
        this.punches = response.punches || [];
        this.loading = false;
        this.snackBar.open(`Loaded ${this.punches.length} punches`, 'Close', { duration: 2000 });
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading punches:', err);
        this.snackBar.open('Error loading punches', 'Close', { duration: 3000 });
      }
    });
  }

  formatDateForAPI(date: Date): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  clearFilters() {
    this.setDefaultDates();
    this.selectedDevice = '';
    this.selectedEnrollId = '';
    this.mappedFilter = 'all';
    this.loadPunches();
  }

  exportPunches() {
    if (this.punches.length === 0) {
      this.snackBar.open('No data to export', 'Close', { duration: 2000 });
      return;
    }

    const csvData = this.convertToCSV(this.punches);
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `biometric-punches-${this.formatDateForAPI(new Date())}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  convertToCSV(data: any[]): string {
    const headers = ['Date Time', 'Device SN', 'Enroll ID', 'Employee Name', 'Employee ID', 'Status'];
    const csvRows = [headers.join(',')];

    data.forEach(punch => {
      const row = [
        new Date(punch.datetime).toLocaleString(),
        punch.deviceSN || '',
        punch.enrollId || '',
        punch.name || 'Unknown',
        punch.employeeId || '',
        punch.status || ''
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'in': return '#4CAF50';
      case 'out': return '#2196F3';
      case 'break': return '#FF9800';
      default: return '#666';
    }
  }

  getDeviceName(deviceSN: string): string {
    const device = this.devices.find(d => d.deviceSN === deviceSN);
    return device ? device.deviceName : '';
  }

  viewPunchDetails(punch: any) {
    const details = `
      Date: ${new Date(punch.datetime).toLocaleString()}
      Device: ${punch.deviceSN}
      Enroll ID: ${punch.enrollId}
      Employee: ${punch.name || 'Unknown'}
      Status: ${punch.status || 'N/A'}
      Raw Data: ${punch.rawLine || 'N/A'}
    `;
    alert(details);
  }

  mapEmployee(punch: any) {
    this.loading = true;
    this.biometricService.getEmployeesForMapping().subscribe({
      next: (response: any) => {
        this.loading = false;
        const users: BiometricUser[] = response.users || [];
        this.showEmployeeSelectionDialog(users, punch);
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading employees:', err);
        this.snackBar.open('Error loading employees for mapping', 'Close', { duration: 3000 });
      }
    });
  }

  private showEmployeeSelectionDialog(users: BiometricUser[], punch: any) {
    const dialogRef = this.dialog.open( EmployeeSelectionDialogComponent, {
      width: '600px',
      data: { users, punch }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.userId) {
        this.submitEmployeeMapping(punch, result.userId);
      }
    });
  }

  private submitEmployeeMapping(punch: any, userId: number) {
    this.loading = true;
    const mapRequest: BiometricMapRequest = {
      enrollId: punch.enrollId,
      deviceSN: punch.deviceSN,
      userId: userId
    };

    this.biometricService.mapEmployeeToPunch(mapRequest).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.snackBar.open('Employee mapped successfully', 'Close', { duration: 2000 });
        this.loadPunches();
      },
      error: (err) => {
        this.loading = false;
        console.error('Error mapping employee:', err);
        this.snackBar.open('Error mapping employee', 'Close', { duration: 3000 });
      }
    });
  }
}
