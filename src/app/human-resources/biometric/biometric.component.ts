import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CoreService } from 'src/app/service/core.service';
import { AppConstants } from 'src/app/AppConstants';

@Component({
  selector: 'app-biometric',
  templateUrl: './biometric.component.html',
  styleUrls: ['./biometric.component.css']
})
export class BiometricComponent implements OnInit, OnDestroy {
  devices: any[] = [];

  loading = false;
  
  deviceStats = {
    totalDevices: 0,
    activeDevices: 0,
    offlineDevices: 0,
    inactiveDevices: 0,
    todayPunches: 0,
    uniqueUsersToday: 0
  };
  refreshInterval: any;

  constructor(
    private coreService: CoreService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit() {
    this.loadDevices();
    this.loadDeviceStats();
    
    // Auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadDevices();
      this.loadDeviceStats();
      
    }, 30000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadDevices() {
    this.coreService.getRequest(`${AppConstants.API_URL}bio/biometric/devices`).subscribe({
      next: (data: any) => {
        this.devices = data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading devices:', err);
        this.loading = false;
      }
    });
  }

  


  loadDeviceStats() {
    this.coreService.getRequest(`${AppConstants.API_URL}bio/devices/status`).subscribe({
      next: (data: any) => {
        this.deviceStats = data;
      },
      error: (err) => console.error('Error loading device stats:', err)
    });
  }

  refreshData() {
    this.loading = true;
    this.loadDevices();
    this.loadDeviceStats();
   
  }

  approveDevice(pendingDevice: any) {
    const deviceName = prompt('Enter device name:', pendingDevice.deviceSN);
    if (!deviceName) return;
    
    const location = prompt('Enter device location:', 'Office');
    if (!location) return;
    
    const data = {
      pendingId: pendingDevice.id,
      deviceName: deviceName,
      location: location
    };
    
    this.coreService.postRequest(`${AppConstants.API_URL}bio/biometric/approve-device`, data).subscribe({
      next: (response: any) => {
        this.snackBar.open('✅ Device approved and added successfully!', 'Close', { duration: 3000 });
        this.loadDevices();
        
        this.loadDeviceStats();
      },
      error: (err) => {
        console.error('Error approving device:', err);
        this.snackBar.open('Error approving device', 'Close', { duration: 3000 });
      }
    });
  }

 

  openDeviceDialog(device?: any) {
    const dialogData = device || { deviceName: '', deviceSN: '', ipAddress: '', location: '', status: 'Active' };
    
    // Simple prompt-based dialog for now
    const deviceName = prompt('Device Name:', dialogData.deviceName);
    if (!deviceName) return;
    
    const deviceSN = prompt('Device Serial Number:', dialogData.deviceSN);
    if (!deviceSN) return;
    
    const ipAddress = prompt('IP Address (optional):', dialogData.ipAddress);
    const location = prompt('Location:', dialogData.location);
    
    const data = { deviceName, deviceSN, ipAddress, location, status: 'Active' };
    
    if (device) {
      this.updateDevice(device.id, data);
    } else {
      this.addDevice(data);
    }
  }

  addDevice(data: any) {
    this.coreService.postRequest(`${AppConstants.API_URL}bio/biometric/device`, data).subscribe({
      next: (response: any) => {
        this.snackBar.open(response.message, 'Close', { duration: 3000 });
        this.loadDevices();
        this.loadDeviceStats();
      },
      error: (err) => this.snackBar.open('Error adding device', 'Close', { duration: 3000 })
    });
  }

  updateDevice(id: number, data: any) {
    this.coreService.putRequest(`${AppConstants.API_URL}bio/biometric/device/${id}`, data).subscribe({
      next: (response: any) => {
        this.snackBar.open(response.message, 'Close', { duration: 3000 });
        this.loadDevices();
        this.loadDeviceStats();
      },
      error: (err) => this.snackBar.open('Error updating device', 'Close', { duration: 3000 })
    });
  }

  editDevice(device: any) {
    this.openDeviceDialog(device);
  }

  deleteDevice(id: number) {
    if (confirm('Are you sure you want to delete this device?')) {
      this.coreService.deleteRequest(`${AppConstants.API_URL}bio/biometric/device/${id}`).subscribe({
        next: (response: any) => {
          this.snackBar.open(response.message, 'Close', { duration: 3000 });
          this.loadDevices();
          this.loadDeviceStats();
        },
        error: (err) => this.snackBar.open('Error deleting device', 'Close', { duration: 3000 })
      });
    }
  }

  downloadDeviceData(deviceSN: string) {
    this.coreService.postRequest(`${AppConstants.API_URL}bio/download/${deviceSN}`, {}).subscribe({
      next: (response: any) => {
        this.snackBar.open(response.message, 'Close', { duration: 3000 });
      },
      error: (err) => this.snackBar.open('Error initiating download', 'Close', { duration: 3000 })
    });
  }

  downloadAllData() {
    this.devices.forEach(device => {
      if (device.status === 'Active') {
        this.downloadDeviceData(device.deviceSN);
      }
    });
    this.snackBar.open('Download initiated for all active devices', 'Close', { duration: 3000 });
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active': return '#4CAF50';
      case 'offline': return '#FF9800';
      case 'inactive': return '#F44336';
      default: return '#666';
    }
  }

  getLastSeenText(lastSeenAt: string): string {
    if (!lastSeenAt) return 'Never';
    const lastSeen = new Date(lastSeenAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  }


}
