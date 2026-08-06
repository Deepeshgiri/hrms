import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'loading, app-loading',
  template: `
    <div class="loading-overlay" *ngIf="show">
      <div class="loading-spinner">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    </div>
  `,
  styles: [
    `
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.7);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class LoadingComponent {
  @Input() show = false;
}
