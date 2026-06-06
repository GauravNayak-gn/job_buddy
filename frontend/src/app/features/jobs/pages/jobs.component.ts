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

    <!-- Screening Questions Modal Overlay -->
    @if (screeningJob(); as job) {
      <div class="modal-overlay" (click)="closeScreeningModal()">
        <article class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Screening Questions</h2>
            <p class="subtitle">Applying for: {{ job.title }}</p>
            <button type="button" class="close-btn" (click)="closeScreeningModal()">&times;</button>
          </div>
          
          <div class="modal-body">
            <p class="instructions">Please answer the questions below to proceed with your application.</p>
            
            <div class="questions-container">
              @for (item of screeningAnswers(); track $index) {
                <label class="question-field">
                  <span class="q-label">Q{{ $index + 1 }}: {{ item.question }} <span class="required">*</span></span>
                  <textarea 
                    [ngModel]="item.answer" 
                    (ngModelChange)="updateAnswer($index, $event)"
                    [disabled]="isSubmitting()" 
                    rows="3" 
                    placeholder="Type your answer..."
                  ></textarea>
                </label>
              }
            </div>
          </div>
          
          <div class="modal-footer">
            <button 
              type="button" 
              [disabled]="isSubmitting() || !isScreeningValid()" 
              (click)="submitWithAnswers()"
              class="submit-btn"
            >
              {{ isSubmitting() ? 'Submitting...' : 'Submit Application' }}
            </button>
            <button 
              type="button" 
              [disabled]="isSubmitting()" 
              class="btn-secondary" 
              (click)="closeScreeningModal()"
            >
              Cancel
            </button>
          </div>
        </article>
      </div>
    }
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

    /* Modal Styling */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(4px);
      z-index: 1100;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .modal-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      width: 600px;
      max-width: 90vw;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .modal-header {
      padding: 1.5rem;
      border-bottom: 1px solid var(--border);
      position: relative;
    }

    .modal-header h2 {
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0;
      color: var(--text);
    }

    .modal-header .subtitle {
      font-size: 0.875rem;
      color: var(--muted);
      margin-top: 0.25rem;
      margin-bottom: 0;
    }

    .close-btn {
      position: absolute;
      top: 1.25rem;
      right: 1.25rem;
      background: transparent;
      border: none;
      color: var(--muted);
      font-size: 1.75rem;
      cursor: pointer;
      line-height: 1;
      padding: 0;
      min-height: auto;
    }

    .close-btn:hover {
      color: var(--text);
    }

    .modal-body {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .instructions {
      font-size: 0.9rem;
      color: var(--muted);
      margin: 0;
    }

    .questions-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .question-field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .q-label {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--text);
    }

    .required {
      color: var(--accent);
    }

    .modal-footer {
      padding: 1.25rem 1.5rem;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      background: var(--bg-alt);
    }

    .submit-btn {
      background: var(--accent);
      color: white;
    }

    .submit-btn:hover {
      background: var(--accent-hover);
    }

    .submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-secondary {
      background: var(--secondary-btn-bg);
      color: var(--secondary-btn-text);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--secondary-btn-hover-bg);
      color: var(--secondary-btn-hover-text);
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

  // Screening questions modal state signals
  readonly showScreeningModal = signal(false);
  readonly screeningJob = signal<Job | null>(null);
  readonly screeningAnswers = signal<{ question: string; answer: string; }[]>([]);

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

    const job = this.jobs().find(j => j.id === jobId);
    if (job && job.screening_questions && job.screening_questions.length > 0) {
      this.screeningJob.set(job);
      this.screeningAnswers.set(job.screening_questions.map(q => ({ question: q, answer: '' })));
      this.showScreeningModal.set(true);
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

  protected updateAnswer(index: number, val: string): void {
    this.screeningAnswers.update(answers => {
      const copy = [...answers];
      copy[index] = { ...copy[index], answer: val };
      return copy;
    });
  }

  protected isScreeningValid(): boolean {
    return this.screeningAnswers().every(item => item.answer.trim().length > 0);
  }

  protected closeScreeningModal(): void {
    this.showScreeningModal.set(false);
    this.screeningJob.set(null);
    this.screeningAnswers.set([]);
  }

  protected submitWithAnswers(): void {
    const job = this.screeningJob();
    if (!job) return;
    const resumeId = this.selectedResumeId;
    if (!resumeId) {
      this.alertService.warning('Please select a resume before applying.');
      return;
    }

    this.isSubmitting.set(true);
    const payload = {
      job_id: job.id,
      resume_id: resumeId,
      cover_letter: 'Applied with screening answers.',
      screening_answers: this.screeningAnswers()
    };

    this.api.post(`${this.api.applicationsBase}/apply/`, payload, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.closeScreeningModal();
        this.alertService.success('Application submitted successfully!', 'Applied');
        this.seekerData.loadApplications(true);
      },
      error: (error) => {
        this.isSubmitting.set(false);
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
