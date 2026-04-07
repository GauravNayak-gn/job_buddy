import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthStateService } from '../core/auth-state.service';

interface Job {
  id: string;
  title: string;
  description: string;
  location_type: string;
  location_city: string;
  experience_required: string;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
  created_at: string;
}

interface ResumeItem {
  id: string;
  resume_title: string;
  parsing_status: string;
}

interface ApplicationItem {
  id: string;
  job_id: string;
  current_stage: string;
}

@Component({
  selector: 'app-jobs-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">Job marketplace</p>
          <h1>Browse open roles</h1>
        </div>
      </div>

      <div class="filters">
        <label>
          <span>Location type</span>
          <select [(ngModel)]="filters.location_type">
            <option value="">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </label>
        <label>
          <span>Category</span>
          <input [(ngModel)]="filters.category" type="text" placeholder="Backend" />
        </label>
        <label>
          <span>Search</span>
          <input [(ngModel)]="filters.search" type="text" placeholder="Python Developer" />
        </label>
        <button type="button" (click)="loadJobs()">Apply filters</button>
      </div>

      @if (isSeeker() && auth.isLoggedIn()) {
        <div class="apply-bar">
          <label>
            <span>Resume to use for apply</span>
            <select [(ngModel)]="selectedResumeId">
              <option value="">Select resume</option>
              @for (resume of resumes(); track resume.id) {
                <option [value]="resume.id">{{ resume.resume_title }} ({{ resume.parsing_status }})</option>
              }
            </select>
          </label>
        </div>
      }

      @if (loading()) {
        <div class="empty-card">Loading jobs...</div>
      } @else if (error()) {
        <div class="empty-card error">{{ error() }}</div>
      } @else if (!jobs().length) {
        <div class="empty-card">No jobs matched your filters.</div>
      } @else {
        <div class="job-list">
          @for (job of jobs(); track job.id) {
            <article class="job-item">
              <div class="job-top">
                <div>
                  <p class="eyebrow">{{ job.location_type }} @if (job.location_city) { · {{ job.location_city }} }</p>
                  <h2>{{ job.title }}</h2>
                </div>
                <span class="status-pill">{{ job.status }}</span>
              </div>
              <p class="description">{{ job.description }}</p>
              <div class="job-bottom">
                <span>{{ job.experience_required || 'Experience not specified' }}</span>
                <span>{{ formatSalary(job.salary_min, job.salary_max) }}</span>
              </div>

              @if (isSeeker() && auth.isLoggedIn()) {
                <div class="apply-actions">
                  @if (appliedJobIds().has(job.id)) {
                    <span class="applied-tag">Already applied</span>
                  } @else {
                    <button type="button" (click)="apply(job.id)">Apply now</button>
                  }
                </div>
              }
            </article>
          }
        </div>
      }

      @if (message()) {
        <div class="empty-card">{{ message() }}</div>
      }
    </section>
  `,
  styles: [`
    .page-card,
    .job-item,
    .empty-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .page-card { display: grid; gap: 1rem; padding: 1.5rem; }
    .filters { display: grid; gap: 1rem; grid-template-columns: repeat(4, minmax(0, 1fr)); align-items: end; }
    .job-list { display: grid; gap: 1rem; }
    .job-item { display: grid; gap: 0.8rem; padding: 1.25rem; }
    .job-top,
    .job-bottom,
    .apply-actions { display: flex; gap: 1rem; justify-content: space-between; flex-wrap: wrap; align-items: center; }
    .description { color: var(--muted); }
    .status-pill { background: rgba(42, 157, 143, 0.16); border-radius: 999px; color: #9fe3d8; height: fit-content; padding: 0.45rem 0.8rem; text-transform: capitalize; }
    .applied-tag { background: rgba(30, 111, 104, 0.14); color: #1e6f68; border-radius: 999px; padding: 0.45rem 0.8rem; }
    .apply-bar { background: rgba(10, 16, 32, 0.05); border: 1px solid var(--border); border-radius: 18px; padding: 1rem; }
    .error { color: #ffb8aa; }
    @media (max-width: 980px) {
      .filters { grid-template-columns: 1fr; }
    }
  `],
})
export class JobsComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);

  readonly isSeeker = computed(() => this.auth.role() === 'seeker');
  readonly jobs = signal<Job[]>([]);
  readonly resumes = signal<ResumeItem[]>([]);
  readonly appliedJobIds = signal<Set<string>>(new Set<string>());

  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');

  selectedResumeId = '';

  readonly filters = {
    location_type: '',
    category: '',
    search: '',
  };

  ngOnInit(): void {
    this.loadJobs();
    if (this.isSeeker() && this.auth.isLoggedIn()) {
      this.loadResumes();
      this.loadApplications();
    }
  }

  protected loadJobs(): void {
    this.loading.set(true);
    this.error.set('');

    const params = new URLSearchParams();
    if (this.filters.location_type) params.set('location_type', this.filters.location_type);
    if (this.filters.category) params.set('category', this.filters.category);
    if (this.filters.search) params.set('search', this.filters.search);

    const url = `${this.api.jobsBase}/${params.toString() ? `?${params.toString()}` : ''}`;
    this.api.get<Job[]>(url).subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load jobs. Confirm the Job Service is running on port 8003.');
        this.loading.set(false);
      },
    });
  }

  private loadResumes(): void {
    this.api.get<ResumeItem[]>(`${this.api.profileBase}/seeker/resumes/`, true).subscribe({
      next: (resumes) => {
        this.resumes.set(resumes);
        if (!this.selectedResumeId && resumes.length) {
          this.selectedResumeId = resumes[0].id;
        }
      },
    });
  }

  private loadApplications(): void {
    this.api.get<ApplicationItem[]>(`${this.api.applicationsBase}/my/`, true).subscribe({
      next: (apps) => this.appliedJobIds.set(new Set(apps.map((app) => app.job_id))),
    });
  }

  protected apply(jobId: string): void {
    this.message.set('');
    if (!this.selectedResumeId) {
      this.message.set('Select a resume first from the dropdown above.');
      return;
    }

    this.api.post(`${this.api.applicationsBase}/apply/`, {
      job_id: jobId,
      resume_id: this.selectedResumeId,
      cover_letter: 'Applied via frontend.',
    }, true).subscribe({
      next: () => {
        this.message.set('Application submitted.');
        this.loadApplications();
      },
      error: (error) => {
        if (error?.error && typeof error.error === 'object') {
          this.message.set(JSON.stringify(error.error));
        } else {
          this.message.set('Unable to apply for this job.');
        }
      },
    });
  }

  protected formatSalary(min: number | null, max: number | null): string {
    if (!min && !max) return 'Salary not disclosed';
    return `INR ${min ?? 0} - ${max ?? 0}`;
  }
}
