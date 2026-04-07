import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStateService } from './core/auth-state.service';

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
          <a routerLink="/profile" routerLinkActive="active">Profile</a>
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
  readonly isRecruiter = computed(() => this.auth.role() === 'recruiter');

  protected logout(): void {
    this.auth.clearSession();
  }
}
