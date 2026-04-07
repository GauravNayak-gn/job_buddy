import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStateService } from '../core/auth-state.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="auth-shell">
      <article class="auth-card">
        <div class="tabs">
          <button type="button" [class.active]="mode() === 'login'" (click)="mode.set('login')">Login</button>
          <button type="button" [class.active]="mode() === 'register'" (click)="mode.set('register')">Register</button>
        </div>

        @if (mode() === 'login') {
          <div class="stack">
            <div>
              <p class="eyebrow">Welcome back</p>
              <h1>Sign in to Job Buddy</h1>
            </div>
            <label>
              <span>Email</span>
              <input [(ngModel)]="loginForm.email" type="email" />
            </label>
            <label>
              <span>Password</span>
              <input [(ngModel)]="loginForm.password" type="password" />
            </label>
            <button type="button" (click)="login()">Login</button>
          </div>
        } @else {
          <div class="stack">
            <div>
              <p class="eyebrow">Create an account</p>
              <h1>Register a seeker or recruiter</h1>
            </div>
            <label>
              <span>Email</span>
              <input [(ngModel)]="registerForm.email" type="email" />
            </label>
            <label>
              <span>Password</span>
              <input [(ngModel)]="registerForm.password" type="text" />
            </label>
            <label>
              <span>Role</span>
              <select [(ngModel)]="registerForm.role">
                <option value="seeker">Seeker</option>
                <option value="recruiter">Recruiter</option>
              </select>
            </label>
            <button type="button" (click)="register()">Register</button>
          </div>
        }

        @if (message()) {
          <div class="message">{{ message() }}</div>
        }
      </article>

      <article class="tips-card">
        <p class="eyebrow">Demo accounts</p>
        <h2>Use seeded credentials</h2>
        <div class="tip">
          <strong>Seeker</strong>
          <span>seeker1@jobbuddy.com / Test@1234</span>
        </div>
        <div class="tip">
          <strong>Recruiter</strong>
          <span>recruiter1@jobbuddy.com / Test@1234</span>
        </div>
        <p class="help">
          New registrations must verify OTP first. If login fails with "Email not verified", use an
          already verified account for the demo.
        </p>
      </article>
    </section>
  `,
  styles: [`
    .auth-shell {
      display: grid;
      gap: 1rem;
      grid-template-columns: 1fr 0.8fr;
    }
    .auth-card,
    .tips-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
      padding: 1.5rem;
    }
    .stack {
      display: grid;
      gap: 1rem;
    }
    .tabs {
      display: flex;
      gap: 0.8rem;
      margin-bottom: 1.2rem;
    }
    .tabs button {
      background: rgba(255,255,255,0.05);
      color: var(--text);
    }
    .tabs button.active {
      background: var(--accent);
      color: #fff;
    }
    label {
      display: grid;
      gap: 0.4rem;
    }
    .message,
    .tip {
      background: rgba(10, 16, 32, 0.45);
      border-radius: 18px;
      margin-top: 1rem;
      padding: 1rem;
    }
    .help {
      color: var(--muted);
      margin-top: 1rem;
    }
    @media (max-width: 900px) {
      .auth-shell {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class LoginComponent {
  private readonly api = inject(ApiService);
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  readonly mode = signal<'login' | 'register'>('login');
  readonly message = signal('');

  readonly loginForm = {
    email: 'seeker1@jobbuddy.com',
    password: 'Test@1234',
  };

  readonly registerForm = {
    email: '',
    password: 'Test@1234',
    role: 'seeker',
  };

  protected login(): void {
    this.api.post<{ access: string; refresh: string; role: 'seeker' | 'recruiter'; user_id: string }>(
      `${this.api.authBase}/login/`,
      this.loginForm,
    ).subscribe({
      next: (response) => {
        this.authState.setSession({
          access: response.access,
          refresh: response.refresh,
          role: response.role,
          userId: response.user_id,
        });
        void this.router.navigateByUrl(response.role === 'recruiter' ? '/post-job' : '/profile');
      },
      error: (error) => {
        this.message.set(this.errorMessage(error));
      },
    });
  }

  protected register(): void {
    this.api.post<{ message: string }>(`${this.api.authBase}/register/`, this.registerForm).subscribe({
      next: (response) => {
        this.message.set(`${response.message} Verify OTP in the backend before login.`);
        this.mode.set('login');
      },
      error: (error) => {
        this.message.set(this.errorMessage(error));
      },
    });
  }

  private errorMessage(error: { error?: unknown; message?: string }): string {
    if (typeof error.error === 'string') {
      return error.error;
    }
    if (error.error && typeof error.error === 'object') {
      return JSON.stringify(error.error);
    }
    return error.message ?? 'Request failed';
  }
}
