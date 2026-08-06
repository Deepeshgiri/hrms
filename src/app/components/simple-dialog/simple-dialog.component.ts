import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  standalone: false,
  selector: 'app-simple-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p [innerHTML]="data.content"></p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" (click)="onOk()">OK</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content p {
        margin: 0;
        white-space: pre-line;
      }
    `,
  ],
})
export class SimpleDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<SimpleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; content: string }
  ) {}

  onOk(): void {
    this.dialogRef.close(true);
  }
}
