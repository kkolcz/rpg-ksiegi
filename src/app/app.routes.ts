import { Routes } from '@angular/router';
import { BookPageComponent } from './books/book-page.component';
import { HomePageComponent } from './home/home-page.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent },
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
