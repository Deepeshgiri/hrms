import { Component } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-shell',
  template: `
    <admin-header></admin-header>
    <div class="app-body">
      <admin-sidebar></admin-sidebar>
      <main class="page-content">
        <router-outlet></router-outlet>
      </main>
    </div>
    <!-- Global WebRTC Calling Screen & Ringing Overlay -->
    <app-call-overlay></app-call-overlay>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100vh; }
    .app-body { display: flex; flex: 1; overflow: hidden; }
    .page-content { flex: 1; overflow-y: auto; padding: 0; background: #f5f5f5; }
  `]
})
export class ShellComponent {}
