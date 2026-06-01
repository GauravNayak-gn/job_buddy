import { Injectable, computed, signal } from '@angular/core';
import { UserRole, SessionState } from '../models';

const STORAGE_KEY = 'job-buddy-session';

@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly state = signal<SessionState>(this.readSession());

  readonly accessToken = computed(() => this.state().access);
  readonly refreshToken = computed(() => this.state().refresh);
  readonly role = computed(() => this.state().role);
  readonly userId = computed(() => this.state().userId);
  readonly isLoggedIn = computed(() => Boolean(this.state().access));
  readonly isRecruiter = computed(() => this.state().role === 'recruiter');

  setSession(session: SessionState): void {
    this.state.set(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  clearSession(): void {
    const empty = { access: '', refresh: '', role: '', userId: '' } as SessionState;
    this.state.set(empty);
    localStorage.removeItem(STORAGE_KEY);
  }

  private readSession(): SessionState {
    const empty = { access: '', refresh: '', role: '', userId: '' } as SessionState;
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return empty;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SessionState>;
      return {
        access: parsed.access ?? '',
        refresh: parsed.refresh ?? '',
        role: (parsed.role as UserRole) ?? '',
        userId: parsed.userId ?? '',
      };
    } catch {
      return empty;
    }
  }
}
