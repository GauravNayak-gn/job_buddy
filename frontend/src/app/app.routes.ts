import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { recruiterGuard } from './core/guards/recruiter.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/pages/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'jobs',
    loadComponent: () => import('./features/jobs/pages/jobs.component').then((m) => m.JobsComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/pages/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/profile/pages/profile.component').then((m) => m.ProfileComponent),
    canActivate: [authGuard],
  },
  {
    path: 'applications',
    loadComponent: () => import('./features/applications/pages/applications.component').then((m) => m.ApplicationsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'post-job',
    loadComponent: () => import('./features/post-job/pages/post-job.component').then((m) => m.PostJobComponent),
    canActivate: [recruiterGuard],
  },
  {
    path: 'manage-jobs',
    loadComponent: () => import('./features/manage-jobs/pages/manage-jobs.component').then((m) => m.ManageJobsComponent),
    canActivate: [recruiterGuard],
  },
  {
    path: 'notifications',
    loadComponent: () => import('./features/notifications/pages/notifications.component').then((m) => m.NotificationsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'matches',
    loadComponent: () => import('./features/matches/pages/matches.component').then((m) => m.MatchesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'chat',
    loadComponent: () => import('./features/chat/pages/chat.component').then((m) => m.ChatComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: '' },
];
