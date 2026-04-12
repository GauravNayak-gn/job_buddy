import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStateService } from '../core/auth-state.service';

interface SeekerSkill {
  id: string;
  skill_name: string;
  years_of_experience: number;
}

interface ResumeItem {
  id: string;
  resume_title: string;
  is_primary: boolean;
  parsing_status: string;
  created_at: string;
}

interface ApplicationItem {
  id: string;
  job_id: string;
  current_stage: string;
  created_at: string;
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">Profile service</p>
          <h1>Profile and activity</h1>
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
              <div class="section-head">
                <h2>Seeker profile</h2>
                <button type="button" class="secondary" (click)="editMode.set(!editMode())">
                  {{ editMode() ? 'Cancel edit' : 'Edit profile' }}
                </button>
              </div>

              @if (!editMode()) {
                <div class="info-grid">
                  <p><strong>Name:</strong> {{ seeker.first_name }} {{ seeker.last_name }}</p>
                  <p><strong>Phone:</strong> {{ seeker.phone || '-' }}</p>
                  <p><strong>Title:</strong> {{ seeker.current_title || '-' }}</p>
                  <p><strong>GitHub:</strong> {{ seeker.github_url || '-' }}</p>
                  <p><strong>LinkedIn:</strong> {{ seeker.linkedin_url || '-' }}</p>
                  <p><strong>Summary:</strong> {{ seeker.summary || '-' }}</p>
                </div>
              } @else {
                <div class="grid">
                  <label><span>First name</span><input [(ngModel)]="seeker.first_name" type="text" /></label>
                  <label><span>Last name</span><input [(ngModel)]="seeker.last_name" type="text" /></label>
                  <label><span>Phone</span><input [(ngModel)]="seeker.phone" type="text" /></label>
                  <label><span>Current title</span><input [(ngModel)]="seeker.current_title" type="text" /></label>
                </div>
                <label><span>Summary</span><textarea [(ngModel)]="seeker.summary" rows="4"></textarea></label>
                <div class="grid">
                  <label><span>GitHub URL</span><input [(ngModel)]="seeker.github_url" type="text" /></label>
                  <label><span>LinkedIn URL</span><input [(ngModel)]="seeker.linkedin_url" type="text" /></label>
                </div>
                <div class="actions">
                  <button type="button" (click)="saveSeeker()">Save profile</button>
                  <button type="button" class="secondary" (click)="loadSeeker()">Reload</button>
                </div>
              }

              <div class="sub-card">
                <h3>Skills</h3>
                @if (!skills().length) {
                  <p class="muted">No skills added yet.</p>
                } @else {
                  <div class="chips">
                    @for (item of skills(); track item.id) {
                      <span class="chip">{{ item.skill_name }} ({{ item.years_of_experience }}y)</span>
                    }
                  </div>
                }
                <div class="grid">
                  <label><span>Skill name</span><input [(ngModel)]="skill.skill_name" type="text" /></label>
                  <label><span>Years of experience</span><input [(ngModel)]="skill.years_of_experience" type="number" min="0" /></label>
                </div>
                <button type="button" class="secondary" (click)="addSkill()">Add skill</button>
              </div>

              <div class="sub-card">
                <h3>Resume upload</h3>
                <label><span>Title</span><input [(ngModel)]="resumeTitle" type="text" placeholder="Backend Resume" /></label>
                <label><span>PDF file</span><input type="file" accept="application/pdf" (change)="onResumeSelect($event)" /></label>
                <button type="button" class="secondary" (click)="uploadResume()">Upload resume</button>
                @if (resumes().length) {
                  <div class="list compact">
                    @for (item of resumes(); track item.id) {
                      <article class="list-item">
                        <strong>{{ item.resume_title }}</strong>
                        <p>{{ item.parsing_status }} · {{ item.created_at | date: 'medium' }}</p>
                      </article>
                    }
                  </div>
                }
              </div>

              <div class="sub-card">
                <h3>My applications</h3>
                @if (!applications().length) {
                  <p class="muted">No applications yet.</p>
                } @else {
                  <div class="list compact">
                    @for (item of applications(); track item.id) {
                      <article class="list-item">
                        <strong>{{ item.job_id }}</strong>
                        <p>Stage: {{ item.current_stage }} · {{ item.created_at | date: 'medium' }}</p>
                      </article>
                    }
                  </div>
                }
              </div>
            } @else {
              <div class="section-head">
                <h2>Recruiter profile</h2>
                <button type="button" class="secondary" (click)="editMode.set(!editMode())">
                  {{ editMode() ? 'Cancel edit' : 'Edit profile' }}
                </button>
              </div>

              @if (!editMode()) {
                <div class="info-grid">
                  <p><strong>Company:</strong> {{ recruiter.company_name || '-' }}</p>
                  <p><strong>Size:</strong> {{ recruiter.company_size || '-' }}</p>
                  <p><strong>Industry:</strong> {{ recruiter.industry || '-' }}</p>
                  <p><strong>HQ:</strong> {{ recruiter.hq_location || '-' }}</p>
                  <p><strong>Website:</strong> {{ recruiter.website_url || '-' }}</p>
                </div>
              } @else {
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
            }

            @if (message()) {
              <div class="message">{{ message() }}</div>
            }
          </article>

          <article class="side-card">
            <h2>Latest API response</h2>
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
    .empty-card,
    .list-item {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .page-card,
    .form-card,
    .side-card,
    .sub-card { padding: 1.5rem; }
    .layout { display: grid; gap: 1rem; grid-template-columns: 1.1fr 0.9fr; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 1rem; }
    .section-head,
    .actions { display: flex; gap: 1rem; justify-content: space-between; align-items: center; flex-wrap: wrap; }
    .sub-card { margin-top: 1rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 0.6rem 0 1rem; }
    .chip { background: rgba(10, 16, 32, 0.45); border-radius: 999px; padding: 0.4rem 0.8rem; }
    .info-grid { display: grid; gap: 0.6rem; }
    .list { display: grid; gap: 0.6rem; margin-top: 0.8rem; }
    .list.compact .list-item { padding: 0.8rem 1rem; border-radius: 16px; }
    .muted { color: var(--muted); }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
    @media (max-width: 980px) {
      .layout,
      .grid { grid-template-columns: 1fr; }
    }
  `],
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);

  readonly isSeeker = computed(() => this.auth.role() === 'seeker');
  readonly editMode = signal(false);
  readonly message = signal('');
  readonly responsePreview = signal('No responses yet.');

  readonly skills = signal<SeekerSkill[]>([]);
  readonly resumes = signal<ResumeItem[]>([]);
  readonly applications = signal<ApplicationItem[]>([]);

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
    skill_name: '',
    years_of_experience: 1,
  };

  resumeTitle = '';
  private selectedResumeFile: File | null = null;

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) return;
    if (this.isSeeker()) {
      this.loadSeeker();
      this.loadSkills();
      this.loadResumes();
      this.loadApplications();
    } else {
      this.loadRecruiter();
    }
  }

  protected loadSeeker(): void {
    this.api.get(`${this.api.profileBase}/seeker/`, true).subscribe({
      next: (response) => {
        Object.assign(this.seeker, response as object);
        this.responsePreview.set(JSON.stringify(response, null, 2));
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected saveSeeker(): void {
    this.api.post(`${this.api.profileBase}/seeker/`, this.seeker, true).subscribe({
      next: (response) => {
        this.message.set('Seeker profile saved.');
        this.editMode.set(false);
        this.responsePreview.set(JSON.stringify(response, null, 2));
      },
      error: () => {
        this.api.patch(`${this.api.profileBase}/seeker/`, this.seeker, true).subscribe({
          next: (response) => {
            this.message.set('Seeker profile updated.');
            this.editMode.set(false);
            this.responsePreview.set(JSON.stringify(response, null, 2));
          },
          error: (error) => this.message.set(this.errorMessage(error)),
        });
      },
    });
  }

  protected loadRecruiter(): void {
    this.api.get(`${this.api.profileBase}/recruiter/`, true).subscribe({
      next: (response) => {
        Object.assign(this.recruiter, response as object);
        this.responsePreview.set(JSON.stringify(response, null, 2));
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected saveRecruiter(): void {
    this.api.post(`${this.api.profileBase}/recruiter/`, this.recruiter, true).subscribe({
      next: (response) => {
        this.message.set('Recruiter profile saved.');
        this.editMode.set(false);
        this.responsePreview.set(JSON.stringify(response, null, 2));
      },
      error: () => {
        this.api.patch(`${this.api.profileBase}/recruiter/`, this.recruiter, true).subscribe({
          next: (response) => {
            this.message.set('Recruiter profile updated.');
            this.editMode.set(false);
            this.responsePreview.set(JSON.stringify(response, null, 2));
          },
          error: (error) => this.message.set(this.errorMessage(error)),
        });
      },
    });
  }

  protected loadSkills(): void {
    this.api.get<SeekerSkill[]>(`${this.api.profileBase}/seeker/skills/`, true).subscribe({
      next: (res) => this.skills.set(res),
      error: () => undefined,
    });
  }

  protected addSkill(): void {
    if (!this.skill.skill_name.trim()) {
      this.message.set('Enter a skill name first.');
      return;
    }
    this.api.post(`${this.api.profileBase}/seeker/skills/`, this.skill, true).subscribe({
      next: (response) => {
        this.message.set('Skill saved.');
        this.responsePreview.set(JSON.stringify(response, null, 2));
        this.skill.skill_name = '';
        this.skill.years_of_experience = 1;
        this.loadSkills();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected loadResumes(): void {
    this.api.get<ResumeItem[]>(`${this.api.profileBase}/seeker/resumes/`, true).subscribe({
      next: (res) => this.resumes.set(res),
      error: () => undefined,
    });
  }

  protected onResumeSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedResumeFile = target.files?.[0] ?? null;
  }

  protected uploadResume(): void {
    if (!this.selectedResumeFile) {
      this.message.set('Select a resume PDF first.');
      return;
    }
    const form = new FormData();
    form.append('resume', this.selectedResumeFile);
    form.append('resume_title', this.resumeTitle || this.selectedResumeFile.name);

    this.api.postForm(`${this.api.profileBase}/seeker/resumes/`, form, true).subscribe({
      next: (res) => {
        this.message.set('Resume uploaded.');
        this.responsePreview.set(JSON.stringify(res, null, 2));
        this.resumeTitle = '';
        this.selectedResumeFile = null;
        this.loadResumes();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected loadApplications(): void {
    this.api.get<ApplicationItem[]>(`${this.api.applicationsBase}/my/`, true).subscribe({
      next: (res) => this.applications.set(res),
      error: () => undefined,
    });
  }

  private errorMessage(error: { error?: unknown; message?: string }): string {
    if (typeof error.error === 'string') return error.error;
    if (error.error) {
      if (typeof error.error === 'object' && 'detail' in error.error) return error.error.detail as string;
      return JSON.stringify(error.error, null, 2);
    }
    return error.message ?? 'Request failed';
  }
}
