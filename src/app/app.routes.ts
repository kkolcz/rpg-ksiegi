import { Routes } from '@angular/router';
import { BookPageComponent } from './books/book-page.component';
import { HomePageComponent } from './home/home-page.component';
import { AdminPanelComponent } from './admin/admin-panel.component';
import { AdminLoginComponent } from './admin/admin-login.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { path: 'admin', component: AdminPanelComponent },
  { path: 'admin/login', component: AdminLoginComponent },
  {
    path: ':slug',
    component: BookPageComponent,
  },
  {
    path: ':slug/:page',
    component: BookPageComponent,
  },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
