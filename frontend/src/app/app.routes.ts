import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/pages/home.component';
import { JobsComponent } from './features/jobs/pages/jobs.component';
import { LoginComponent } from './features/auth/pages/login.component';
import { ProfileComponent } from './features/profile/pages/profile.component';
import { PostJobComponent } from './features/post-job/pages/post-job.component';
import { NotificationsComponent } from './features/notifications/pages/notifications.component';
import { MatchesComponent } from './features/matches/pages/matches.component';
import { authGuard } from './core/guards/auth.guard';
import { recruiterGuard } from './core/guards/recruiter.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'jobs', component: JobsComponent },
  { path: 'login', component: LoginComponent },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'post-job', component: PostJobComponent, canActivate: [recruiterGuard] },
  { path: 'notifications', component: NotificationsComponent, canActivate: [authGuard] },
  { path: 'matches', component: MatchesComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
