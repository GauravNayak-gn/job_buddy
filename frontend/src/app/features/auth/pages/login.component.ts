import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { AlertService } from '../../../core/services/alert.service';
import { LoginResponse, RegisterResponse, OtpVerifyResponse } from '../../../core/models';
import { extractErrorMessage } from '../../../shared/utils/error-message.util';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="auth-shell">
      <article class="auth-card">
        @if (mode() !== 'otp') {
          <div class="tabs">
            <button type="button" [disabled]="isSubmitting()" [class.active]="mode() === 'login'" (click)="setMode('login')">Login</button>
            <button type="button" [disabled]="isSubmitting()" [class.active]="mode() === 'register'" (click)="setMode('register')">Register</button>
          </div>
        }

        @if (mode() === 'login') {
          <div class="stack">
            <div>
              <p class="eyebrow">Welcome back</p>
              <h1>Sign in to Job Buddy</h1>
            </div>
            <label>
              <span>Email</span>
              <input [disabled]="isSubmitting()" [(ngModel)]="loginForm.email" type="email" />
            </label>
            <label>
              <span>Password</span>
              <input [disabled]="isSubmitting()" [(ngModel)]="loginForm.password" type="password" />
            </label>
            <button type="button" [disabled]="isSubmitting()" (click)="login()">{{ isSubmitting() ? 'Logging in...' : 'Login' }}</button>
          </div>
        } @else if (mode() === 'register') {
          <div class="stack">
            <div>
              <p class="eyebrow">Create an account</p>
              <h1>Register a seeker or recruiter</h1>
            </div>
            <label>
              <span>Email</span>
              <input [disabled]="isSubmitting()" [(ngModel)]="registerForm.email" type="email" />
            </label>
            <label>
              <span>Password</span>
              <input [disabled]="isSubmitting()" [(ngModel)]="registerForm.password" type="password" />
            </label>
            <label>
              <span>Role</span>
              <select [disabled]="isSubmitting()" [(ngModel)]="registerForm.role">
                <option value="seeker">Seeker</option>
                <option value="recruiter">Recruiter</option>
              </select>
            </label>
            <button type="button" [disabled]="isSubmitting()" (click)="register()">{{ isSubmitting() ? 'Registering...' : 'Register' }}</button>
          </div>
        } @else {
          <div class="stack">
            <div>
              <p class="eyebrow">Verify Email</p>
              <h1>Enter 6-digit OTP</h1>
              <p>OTP sent to <strong>{{ otpEmail() }}</strong></p>
            </div>
            <label>
              <span>OTP Code</span>
              <input [disabled]="isSubmitting()" [(ngModel)]="otpForm.otp" type="text" maxlength="6" />
            </label>
            <button type="button" [disabled]="isSubmitting()" (click)="verifyOtp()">{{ isSubmitting() ? 'Verifying...' : 'Verify OTP' }}</button>
            <button type="button" [disabled]="isSubmitting()" (click)="setMode('login')" class="secondary">Back to Login</button>
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
          <strong>Seeker </strong>
          <span>seeker1@jobbuddy.com / Test@1234</span>
        </div>
        <div class="tip">
          <strong>Recruiter </strong>
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
      background: rgba(255, 255, 255, 0.55);
      border: 1px solid var(--border);
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
      background: rgba(255, 255, 255, 0.6);
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

  readonly api = inject(ApiService);
  readonly authState = inject(AuthStateService);
  readonly router = inject(Router);
  private readonly alertService = inject(AlertService);

  readonly mode = signal<'login' | 'register' | 'otp'>('login');
  readonly message = signal('');
  readonly isSubmitting = signal(false);

  readonly loginForm = {
    email: 'seeker1@jobbuddy.com',
    password: 'Test@1234',
  };

  readonly registerForm = {
    email: '',
    password: 'Test@1234',
    role: 'seeker',
  };

  protected setMode(nextMode: 'login' | 'register' | 'otp'): void {
    this.mode.set(nextMode);
    this.message.set('');
  }

  protected verifyOtp(): void {
    const otp = this.otpForm.otp.trim();
    if (!this.otpEmail() || otp.length !== 6) {
      this.message.set('Enter the 6-digit OTP sent to your email.');
      return;
    }

    this.isSubmitting.set(true);
    this.message.set('');

    this.api.post<OtpVerifyResponse>(`${this.api.authBase}/verify-otp/`, {
      email: this.otpEmail(),
      otp_code: otp,
    }).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.alertService.success(response.message, 'Email Verified');
        this.mode.set('login');
        this.otpForm.otp = '';
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Verification Failed');
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

    this.isSubmitting.set(true);
    this.message.set('');

    this.api.post<RegisterResponse>(`${this.api.authBase}/register/`, payload).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.otpEmail.set(payload.email);
        const otpHint = response.otp_code ? ` OTP: ${response.otp_code}` : '';
        this.alertService.success('Registration successful. OTP sent to your email.', 'Check Email');
        this.message.set(`${response.message}${otpHint} Enter OTP below:`);
        this.mode.set('otp');
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Registration Failed');
      },
    });
  }

  protected login(): void {
    const payload = {
      email: this.loginForm.email.trim().toLowerCase(),
      password: this.loginForm.password,
    };
    if (!payload.email || !payload.password) {
      this.message.set('Email and password are required.');
      return;
    }

    this.isSubmitting.set(true);
    this.message.set('');

    this.api.post<LoginResponse>(
      `${this.api.authBase}/login/`,
      payload,
    ).subscribe({
      next: (response) => {
        this.isSubmitting.set(false);
        this.authState.setSession({
          access: response.access,
          refresh: response.refresh,
          role: response.role,
          userId: response.user_id,
        });
        this.alertService.toast('Welcome back to Job Buddy!');
        void this.router.navigateByUrl(response.role === 'recruiter' ? '/post-job' : '/profile');
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Login Failed');
      },
    });
  }
}
