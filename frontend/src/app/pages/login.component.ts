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
              <input [(ngModel)]="registerForm.password" type="password" />
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

        @if (mode() === 'otp') {
          <div class="stack">
            <div>
              <p class="eyebrow">Verify Email</p>
              <h1>Enter 6-digit OTP</h1>
              <p>OTP sent to <strong>{{ otpEmail() }}</strong></p>
            </div>
            <label>
              <span>OTP Code</span>
              <input [(ngModel)]="otpForm.otp" type="text" maxlength="6" />
            </label>
            <button type="button" (click)="verifyOtp()">Verify OTP</button>
            <button type="button" (click)="mode.set('login')" class="secondary">Back to Login</button>
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
          Demo accounts are verified. New registrations: Register → Enter OTP from email → Login.
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
  otpEmail = signal('');
  readonly otpForm = {
    otp: '',
  };

  protected verifyOtp(): void {
    const otp = this.otpForm.otp.trim();
    if (!this.otpEmail() || otp.length !== 6) {
      this.message.set('Enter the 6-digit OTP sent to your email.');
      return;
    }

    this.api.post<{message: string}>(`${this.api.authBase}/verify-otp/`, {
      email: this.otpEmail(),
      otp_code: otp,
    }).subscribe({
      next: (response) => {
        this.message.set(response.message + ' You can now login.');
        this.mode.set('login');
        this.otpForm.otp = '';
      },
      error: (error) => {
        this.message.set(this.errorMessage(error));
      },
    });
  }

  protected register(): void {
    const payload = {
      email: this.registerForm.email.trim().toLowerCase(),
      password: this.registerForm.password,
      role: this.registerForm.role,
    };
    if (!payload.email || !payload.password) {
      this.message.set('Email and password are required.');
      return;
    }

    this.api.post<{ message: string }>(`${this.api.authBase}/register/`, payload).subscribe({
      next: (response) => {
        this.otpEmail.set(payload.email);
        this.message.set(`${response.message} Enter OTP below:`);
        this.mode.set('otp');
      },
      error: (error) => {
        this.message.set(this.errorMessage(error));
      },
    });
  }
  readonly api = inject(ApiService);
  readonly authState = inject(AuthStateService);
  readonly router = inject(Router);

  readonly mode = signal<'login' | 'register' | 'otp'>('login');
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
    const payload = {
      email: this.loginForm.email.trim().toLowerCase(),
      password: this.loginForm.password,
    };
    if (!payload.email || !payload.password) {
      this.message.set('Email and password are required.');
      return;
    }

    this.api.post<{ access: string; refresh: string; role: 'seeker' | 'recruiter'; user_id: string }>(
      `${this.api.authBase}/login/`,
      payload,
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
