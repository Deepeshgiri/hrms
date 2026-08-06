import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'users/human-resources',
    loadChildren: () =>
      import('./human-resources/human-resources.module').then((m) => m.HumanResourcesModule),
  },
  { path: '', redirectTo: '/users/human-resources', pathMatch: 'full' },
];
