import { Injectable, inject, signal, effect } from '@angular/core';
import { ApiService } from './api.service';
import { AuthStateService } from './auth-state.service';
import { ResumeItem, ApplicationItem } from '../models';

@Injectable({ providedIn: 'root' })
export class SeekerDataService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStateService);

  readonly resumes = signal<ResumeItem[]>([]);
  readonly applications = signal<ApplicationItem[]>([]);

  readonly resumesLoading = signal(false);
  readonly applicationsLoading = signal(false);

  private resumesLoaded = false;
  private applicationsLoaded = false;

  constructor() {
    // Automatically clear cache when the user logs out
    effect(() => {
      if (!this.auth.isLoggedIn()) {
        this.clearCache();
      }
    });
  }

  clearCache(): void {
    this.resumes.set([]);
    this.applications.set([]);
    this.resumesLoaded = false;
    this.applicationsLoaded = false;
  }

  loadResumes(force = false): void {
    if (!this.auth.isLoggedIn() || this.auth.role() !== 'seeker') {
      return;
    }
    if (this.resumesLoaded && !force) {
      return;
    }

    this.resumesLoading.set(true);
    this.api.get<ResumeItem[]>(`${this.api.profileBase}/seeker/resumes/`, true).subscribe({
      next: (resumes) => {
        this.resumes.set(resumes);
        this.resumesLoaded = true;
        this.resumesLoading.set(false);
      },
      error: () => {
        this.resumesLoading.set(false);
      }
    });
  }

  loadApplications(force = false): void {
    if (!this.auth.isLoggedIn() || this.auth.role() !== 'seeker') {
      return;
    }
    if (this.applicationsLoaded && !force) {
      return;
    }

    this.applicationsLoading.set(true);
    this.api.get<ApplicationItem[]>(`${this.api.applicationsBase}/my/`, true).subscribe({
      next: (apps) => {
        this.applications.set(apps);
        this.applicationsLoaded = true;
        this.applicationsLoading.set(false);
      },
      error: () => {
        this.applicationsLoading.set(false);
      }
    });
  }
}
