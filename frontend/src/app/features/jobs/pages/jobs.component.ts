import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { SeekerDataService } from '../../../core/services/seeker-data.service';
import { AlertService } from '../../../core/services/alert.service';
import { Job } from '../../../core/models';
import { SalaryPipe } from '../../../shared/pipes/salary.pipe';
import { AiAlignmentDrawerComponent } from '../../../shared/components/ai-alignment-drawer/ai-alignment-drawer.component';
import { extractErrorMessage } from '../../../shared/utils/error-message.util';

@Component({
  selector: 'app-jobs-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SalaryPipe, AiAlignmentDrawerComponent],
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
          <select [disabled]="loading()" [(ngModel)]="filters.location_type">
            <option value="">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </label>
        <label>
          <span>Category</span>
          <input [disabled]="loading()" [(ngModel)]="filters.category" type="text" placeholder="Backend" />
        </label>
        <label>
          <span>Search</span>
          <input [disabled]="loading()" [(ngModel)]="filters.search" type="text" placeholder="Python Developer" />
        </label>
        <button type="button" [disabled]="loading()" (click)="loadJobs()">Apply filters</button>
      </div>

      @if (isSeeker() && auth.isLoggedIn()) {
        <div class="apply-bar">
          <label>
            <span>Resume to use for apply</span>
            <select [disabled]="isSubmitting()" [(ngModel)]="selectedResumeId">
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
            <article class="job-item" (click)="viewJob(job)">
              <div class="job-top">
                <div>
                  <p class="eyebrow">{{ job.location_type }} @if (job.location_city) { · {{ job.location_city }} }</p>
                  <h2>{{ job.title }}</h2>
                </div>
                <span class="status-pill">{{ job.status }}</span>
              </div>
              <p class="description">{{ job.description | slice:0:180 }}{{ job.description.length > 180 ? '...' : '' }}</p>
              <div class="job-bottom">
                <span>{{ job.experience_required || 'Experience not specified' }}</span>
                <span>{{ job.salary_min | salary:job.salary_max }}</span>
              </div>

              @if (isSeeker() && auth.isLoggedIn()) {
                <div class="apply-actions" (click)="$event.stopPropagation()">
                  <button type="button" class="secondary" (click)="viewJob(job)">
                    ✨ AI Alignment Review
                  </button>
                  @if (appliedJobIds().has(job.id)) {
                    <span class="applied-tag">Already applied</span>
                  } @else {
                    <button type="button" [disabled]="isSubmitting()" (click)="apply(job.id)">
                      {{ isSubmitting() ? 'Applying...' : 'Apply now' }}
                    </button>
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

    <!-- Slide Drawer for Job Details and AI Alignment Review -->
    <app-ai-alignment-drawer 
      [isOpen]="isDrawerOpen()"
      [job]="selectedJob()"
      [seekerId]="auth.userId() || ''"
      [seekerName]="'Your Seeker Profile'"
      [type]="'seeker-alignment'"
      (close)="closeDrawer()"
    />
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
    .job-item { display: grid; gap: 0.8rem; padding: 1.25rem; cursor: pointer; transition: all 0.2s ease; }
    .job-item:hover { transform: translateY(-2px); border-color: var(--accent); }
    .job-top,
    .job-bottom,
    .apply-actions { display: flex; gap: 1rem; justify-content: space-between; flex-wrap: wrap; align-items: center; }
    .description { color: var(--muted); line-height: 1.45; }
    .status-pill { background: var(--pill-bg); border-radius: 999px; color: var(--pill-text); height: fit-content; padding: 0.45rem 0.8rem; text-transform: capitalize; }
    .applied-tag { background: var(--success-bg); color: var(--success-text); border: 1px solid var(--success-border); border-radius: 999px; padding: 0.45rem 0.8rem; }
    .apply-bar { background: rgba(10, 16, 32, 0.05); border: 1px solid var(--border); border-radius: 18px; padding: 1rem; }
    .error { color: var(--error-text); }
    @media (max-width: 980px) {
      .filters { grid-template-columns: 1fr; }
    }
  `],
})
export class JobsComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);
  private readonly seekerData = inject(SeekerDataService);
  private readonly alertService = inject(AlertService);

  readonly isSeeker = this.auth.isSeeker;
  readonly jobs = signal<Job[]>([]);
  readonly resumes = this.seekerData.resumes;
  readonly appliedJobIds = computed(() => new Set(this.seekerData.applications().map((app) => app.job_id)));

  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');
  readonly isSubmitting = signal(false);

  selectedResumeId = '';

  // Drawer state signals
  readonly isDrawerOpen = signal(false);
  readonly selectedJob = signal<Job | null>(null);

  readonly filters = {
    location_type: '',
    category: '',
    search: '',
  };

  constructor() {
    effect(() => {
      const resumesList = this.resumes();
      if (!this.selectedResumeId && resumesList.length) {
        const primaryResume = resumesList.find((r) => r.is_primary);
        this.selectedResumeId = primaryResume ? primaryResume.id : resumesList[0].id;
      }
    });
  }

  ngOnInit(): void {
    this.loadJobs();
    if (this.isSeeker() && this.auth.isLoggedIn()) {
      this.seekerData.loadResumes();
      this.seekerData.loadApplications();
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

  protected apply(jobId: string): void {
    this.message.set('');
    if (!this.selectedResumeId) {
      this.message.set('Select a resume first from the dropdown above.');
      this.alertService.warning('Please select a resume before applying.');
      return;
    }

    this.isSubmitting.set(true);
    const payload = { job_id: jobId, resume_id: this.selectedResumeId, cover_letter: '' };
    this.api.post(`${this.api.applicationsBase}/apply/`, payload, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.success('Application submitted successfully!', 'Applied');
        this.seekerData.loadApplications(true);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        this.message.set(extractErrorMessage(error));
        this.alertService.error(extractErrorMessage(error), 'Apply Failed');
      },
    });
  }

  protected viewJob(job: Job): void {
    this.selectedJob.set(job);
    this.isDrawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.selectedJob.set(null);
  }
}
