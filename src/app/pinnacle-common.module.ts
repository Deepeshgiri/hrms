import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MaterialModule } from './material.module';
import { AdminHeaderComponent } from './components/admin-header/admin-header.component';
import { AdminSidebarComponent } from './components/admin-sidebar/admin-sidebar.component';
import { LoadingComponent } from './components/loading/loading.component';
import { ModalDirective } from './components/modal/modal.directive';
import { SimpleDialogComponent } from './components/simple-dialog/simple-dialog.component';
import { SafePipe } from './pipes/safe.pipe';

@NgModule({
  declarations: [
    AdminHeaderComponent,
    AdminSidebarComponent,
    LoadingComponent,
    ModalDirective,
    SimpleDialogComponent,
    SafePipe,
  ],
  imports: [CommonModule, FormsModule, RouterModule, MaterialModule],
  exports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MaterialModule,
    AdminHeaderComponent,
    AdminSidebarComponent,
    LoadingComponent,
    ModalDirective,
    SimpleDialogComponent,
    SafePipe,
  ],
})
export class PinnacleCommonModule {}
