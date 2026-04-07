import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStateService } from '../core/auth-state.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">Profile service</p>
          <h1>Manage your profile</h1>
        </div>
      </div>

      @if (!auth.isLoggedIn()) {
        <div class="empty-card">
          Login first to access your profile.
          <a routerLink="/login" class="inline-link">Go to login</a>
        </div>
      } @else {
        <div class="layout">
          <article class="form-card">
            @if (isSeeker()) {
              <h2>Seeker profile</h2>
              <div class="grid">
                <label><span>First name</span><input [(ngModel)]="seeker.first_name" type="text" /></label>
                <label><span>Last name</span><input [(ngModel)]="seeker.last_name" type="text" /></label>
                <label><span>Phone</span><input [(ngModel)]="seeker.phone" type="text" /></label>
                <label><span>Current title</span><input [(ngModel)]="seeker.current_title" type="text" /></label>
              </div>
              <label><span>Summary</span><textarea [(ngModel)]="seeker.summary" rows="5"></textarea></label>
              <div class="grid">
                <label><span>GitHub URL</span><input [(ngModel)]="seeker.github_url" type="text" /></label>
                <label><span>LinkedIn URL</span><input [(ngModel)]="seeker.linkedin_url" type="text" /></label>
              </div>
              <div class="actions">
                <button type="button" (click)="saveSeeker()">Save profile</button>
                <button type="button" class="secondary" (click)="loadSeeker()">Reload</button>
              </div>

              <div class="sub-card">
                <h3>Add skill</h3>
                <div class="grid">
                  <label><span>Skill name</span><input [(ngModel)]="skill.skill_name" type="text" /></label>
                  <label><span>Years of experience</span><input [(ngModel)]="skill.years_of_experience" type="number" /></label>
                </div>
                <button type="button" class="secondary" (click)="addSkill()">Add skill</button>
              </div>

              <div class="sub-card">
                <h3>Add experience</h3>
                <div class="grid">
                  <label><span>Company</span><input [(ngModel)]="experience.company_name" type="text" /></label>
                  <label><span>Role title</span><input [(ngModel)]="experience.role_title" type="text" /></label>
                  <label><span>Start date</span><input [(ngModel)]="experience.start_date" type="date" /></label>
                  <label><span>End date</span><input [(ngModel)]="experience.end_date" type="date" /></label>
                </div>
                <label><span>Description</span><textarea [(ngModel)]="experience.description" rows="4"></textarea></label>
                <button type="button" class="secondary" (click)="addExperience()">Add experience</button>
              </div>
            } @else {
              <h2>Recruiter profile</h2>
              <div class="grid">
                <label><span>Company name</span><input [(ngModel)]="recruiter.company_name" type="text" /></label>
                <label><span>Company size</span><input [(ngModel)]="recruiter.company_size" type="text" /></label>
                <label><span>Industry</span><input [(ngModel)]="recruiter.industry" type="text" /></label>
                <label><span>HQ location</span><input [(ngModel)]="recruiter.hq_location" type="text" /></label>
              </div>
              <label><span>Website URL</span><input [(ngModel)]="recruiter.website_url" type="text" /></label>
              <div class="actions">
                <button type="button" (click)="saveRecruiter()">Save profile</button>
                <button type="button" class="secondary" (click)="loadRecruiter()">Reload</button>
              </div>
            }

            @if (message()) {
              <div class="message">{{ message() }}</div>
            }
          </article>

          <article class="side-card">
            <h2>Live output</h2>
            <pre>{{ responsePreview() }}</pre>
          </article>
        </div>
      }
    </section>
  `,
  styles: [`
    .page-card,
    .form-card,
    .side-card,
    .sub-card,
    .empty-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .page-card,
    .form-card,
    .side-card,
    .sub-card {
      padding: 1.5rem;
    }
    .layout {
      display: grid;
      gap: 1rem;
      grid-template-columns: 1.1fr 0.9fr;
    }
    .grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-bottom: 1rem;
    }
    .actions {
      display: flex;
      gap: 1rem;
      margin: 1rem 0;
      flex-wrap: wrap;
    }
    .sub-card {
      margin-top: 1rem;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    @media (max-width: 980px) {
      .layout,
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);

  readonly isSeeker = computed(() => this.auth.role() === 'seeker');
  readonly message = signal('');
  readonly responsePreview = signal('Profile responses will appear here.');

  readonly seeker = {
    first_name: '',
    last_name: '',
    phone: '',
    current_title: '',
    summary: '',
    github_url: '',
    linkedin_url: '',
  };

  readonly recruiter = {
    company_name: '',
    company_size: '',
    industry: '',
    hq_location: '',
    website_url: '',
  };

  readonly skill = {
    skill_name: 'Python',
    years_of_experience: 1,
  };

  readonly experience = {
    company_name: '',
    role_title: '',
    start_date: '',
    end_date: '',
    description: '',
  };

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      if (this.isSeeker()) {
        this.loadSeeker();
      } else {
        this.loadRecruiter();
      }
    }
  }

  protected loadSeeker(): void {
    this.api.get(`${this.api.profileBase}/seeker/`, true).subscribe({
      next: (response) => {
        Object.assign(this.seeker, response as object);
        this.responsePreview.set(JSON.stringify(response, null, 2));
      },
      error: (error) => {
        this.message.set(this.errorMessage(error));
      },
    });
  }

  protected saveSeeker(): void {
    this.api.post(`${this.api.profileBase}/seeker/`, this.seeker, true).subscribe({
      next: (response) => {
        this.message.set('Seeker profile saved.');
        this.responsePreview.set(JSON.stringify(response, null, 2));
      },
      error: () => {
        this.api.patch(`${this.api.profileBase}/seeker/`, this.seeker, true).subscribe({
          next: (response) => {
            this.message.set('Seeker profile updated.');
            this.responsePreview.set(JSON.stringify(response, null, 2));
          },
          error: (error) => {
            this.message.set(this.errorMessage(error));
          },
        });
      },
    });
  }

  protected addSkill(): void {
    this.api.post(`${this.api.profileBase}/seeker/skills/`, this.skill, true).subscribe({
      next: (response) => {
        this.message.set('Skill saved.');
        this.responsePreview.set(JSON.stringify(response, null, 2));
      },
      error: (error) => {
        this.message.set(this.errorMessage(error));
      },
    });
  }

  protected addExperience(): void {
    const payload = {
      ...this.experience,
      end_date: this.experience.end_date || null,
    };

    this.api.post(`${this.api.profileBase}/seeker/experience/`, payload, true).subscribe({
      next: (response) => {
        this.message.set('Experience saved.');
        this.responsePreview.set(JSON.stringify(response, null, 2));
      },
      error: (error) => {
        this.message.set(this.errorMessage(error));
      },
    });
  }

  protected loadRecruiter(): void {
    this.api.get(`${this.api.profileBase}/recruiter/`, true).subscribe({
      next: (response) => {
        Object.assign(this.recruiter, response as object);
        this.responsePreview.set(JSON.stringify(response, null, 2));
      },
      error: (error) => {
        this.message.set(this.errorMessage(error));
      },
    });
  }

  protected saveRecruiter(): void {
    this.api.post(`${this.api.profileBase}/recruiter/`, this.recruiter, true).subscribe({
      next: (response) => {
        this.message.set('Recruiter profile saved.');
        this.responsePreview.set(JSON.stringify(response, null, 2));
      },
      error: () => {
        this.api.patch(`${this.api.profileBase}/recruiter/`, this.recruiter, true).subscribe({
          next: (response) => {
            this.message.set('Recruiter profile updated.');
            this.responsePreview.set(JSON.stringify(response, null, 2));
          },
          error: (error) => {
            this.message.set(this.errorMessage(error));
          },
        });
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
