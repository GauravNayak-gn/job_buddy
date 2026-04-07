import { Routes, Router, CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStateService } from './core/auth-state.service';
import { HomeComponent } from './pages/home.component';
import { JobsComponent } from './pages/jobs.component';
import { LoginComponent } from './pages/login.component';
import { ProfileComponent } from './pages/profile.component';
import { PostJobComponent } from './pages/post-job.component';

const authGuard: CanActivateFn = () => {
  const auth = inject(AuthStateService);
  const router = inject(Router);
  return auth.isLoggedIn() ? true : router.createUrlTree(['/login']);
};

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'jobs', component: JobsComponent },
  { path: 'login', component: LoginComponent },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'post-job', component: PostJobComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
