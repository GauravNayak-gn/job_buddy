import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStateService } from './core/auth-state.service';
import { ApiService } from './core/api.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <header class="topbar">
        <a routerLink="/" class="brand">
          <span class="brand-mark">JB</span>
          <div>
            <strong>Job Buddy</strong>
            <span>Microservice Job Portal</span>
          </div>
        </a>

        <nav class="nav-links">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
          <a routerLink="/jobs" routerLinkActive="active">Jobs</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/profile" routerLinkActive="active">Profile</a>
            <a routerLink="/notifications" routerLinkActive="active">Notifications</a>
            <a routerLink="/matches" routerLinkActive="active">AI Match</a>
          }
          @if (isRecruiter()) {
            <a routerLink="/post-job" routerLinkActive="active">Post Job</a>
          }
        </nav>

        <div class="session-box">
          @if (auth.isLoggedIn()) {
            <span class="user-pill">{{ auth.role() }} account</span>
            <button type="button" class="logout" (click)="logout()">Logout</button>
          } @else {
            <a routerLink="/login" class="login-link">Login</a>
          }
        </div>
      </header>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthStateService);
  readonly api = inject(ApiService);
  readonly router = inject(Router);
  readonly isRecruiter = computed(() => this.auth.role() === 'recruiter');

  protected logout(): void {
    const refresh = this.auth.refreshToken();
    const clearAndRedirect = () => {
      this.auth.clearSession();
      void this.router.navigateByUrl('/login');
    };

    if (!refresh) {
      clearAndRedirect();
      return;
    }

    this.api.post(`${this.api.authBase}/logout/`, { refresh }, true)
      .pipe(finalize(clearAndRedirect))
      .subscribe();
  }
}
