import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { SimpleDialogComponent } from '../components/simple-dialog/simple-dialog.component';

export interface DialogOptions {
  content: string;
  title?: string;
  callBack?: () => void;
  width?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  constructor(private dialog: MatDialog) {}

  showDialog(options: DialogOptions) {
    const dialogRef = this.dialog.open(SimpleDialogComponent, {
      width: options.width || '400px',
      data: {
        content: options.content,
        title: options.title || 'Message',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && options.callBack) {
        options.callBack();
      }
    });
  }
}
