import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStateService } from '../core/auth-state.service';

interface Category {
  id: string;
  name: string;
}

interface RecruiterJob {
  id: string;
  recruiter_id: string;
  title: string;
  description: string;
  location_type: string;
  location_city: string;
  experience_required: string;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
}

interface Applicant {
  id: string;
  seeker_id: string;
  seeker_email: string;
  job_id: string;
  job_title: string;
  cover_letter: string;
  current_stage: string;
  created_at: string;
}

interface InterviewResponse {
  id: string;
  scheduled_at: string;
  expires_at: string;
  jitsi_link: string;
  recruiter_notes: string;
  is_expired: boolean;
}

@Component({
  selector: 'app-post-job-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">Recruiter workspace</p>
          <h1>Post and manage jobs</h1>
        </div>
        @if (!isRecruiter()) {
          <a routerLink="/login" class="inline-link">Login as recruiter</a>
        }
      </div>

      @if (!auth.isLoggedIn()) {
        <div class="empty-card">Login first to create recruiter jobs.</div>
      } @else if (!isRecruiter()) {
        <div class="empty-card">This page is intended for recruiter accounts only.</div>
      } @else {
        <div class="layout">
          <article class="form-card">
            <h2>{{ editingJobId() ? 'Edit job' : 'Create a new job' }}</h2>
            <div class="grid">
              <label>
                <span>Title</span>
                <input [(ngModel)]="form.title" type="text" />
              </label>
              <label>
                <span>Category</span>
                <select [(ngModel)]="form.category">
                  <option value="">Select category</option>
                  @for (category of categories(); track category.id) {
                    <option [value]="category.id">{{ category.name }}</option>
                  }
                </select>
              </label>
              <label>
                <span>Location type</span>
                <select [(ngModel)]="form.location_type">
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </label>
              <label>
                <span>Location city</span>
                <input [(ngModel)]="form.location_city" type="text" />
              </label>
              <label>
                <span>Salary min</span>
                <input [(ngModel)]="form.salary_min" type="number" />
              </label>
              <label>
                <span>Salary max</span>
                <input [(ngModel)]="form.salary_max" type="number" />
              </label>
              <label>
                <span>Experience required</span>
                <input [(ngModel)]="form.experience_required" type="text" />
              </label>
              <label>
                <span>Primary skill</span>
                <input [(ngModel)]="form.skill_name" type="text" />
              </label>
            </div>
            <label>
              <span>Description</span>
              <textarea [(ngModel)]="form.description" rows="8"></textarea>
            </label>
            <div class="actions">
              @if (editingJobId()) {
                <button type="button" (click)="updateJob()">Save changes</button>
                <button type="button" class="secondary" (click)="cancelEdit()">Cancel</button>
              } @else {
                <button type="button" (click)="createJob()">Create job</button>
              }
            </div>
            @if (message()) {
              <div class="message">{{ message() }}</div>
            }
          </article>

          <article class="list-card">
            <div class="list-head">
              <h2>My jobs</h2>
              <button type="button" class="secondary" (click)="loadMyJobs()">Refresh</button>
            </div>
            @if (jobsLoading()) {
              <div class="empty-card small">Loading recruiter jobs...</div>
            } @else if (!myJobs().length) {
              <div class="empty-card small">No jobs created yet.</div>
            } @else {
              <div class="job-list">
                @for (job of myJobs(); track job.id) {
                  <article class="job-item">
                    <div>
                      <h3>{{ job.title }}</h3>
                      <p>{{ job.location_type }} @if (job.location_city) { · {{ job.location_city }} }</p>
                    </div>
                    <span class="status-pill" [class.archived]="job.is_archived">
                      {{ job.is_archived ? 'archived' : job.status }}
                    </span>
                    <div class="actions compact">
                      <button type="button" class="secondary" (click)="startEdit(job)">Edit</button>
                      <button type="button" class="secondary" (click)="openApplicants(job.id)">Applicants</button>
                      @if (!job.is_archived && job.status !== 'published') {
                        <button type="button" class="secondary" (click)="publish(job.id)">Publish</button>
                      }
                      @if (!job.is_archived && job.status !== 'closed') {
                        <button type="button" class="secondary" (click)="close(job.id)">Close</button>
                      }
                      @if (!job.is_archived) {
                        <button type="button" class="secondary" (click)="archive(job.id)">Archive</button>
                      } @else {
                        <button type="button" class="secondary" (click)="restore(job.id)">Restore</button>
                      }
                    </div>
                  </article>
                }
              </div>
            }

            <div class="applicant-panel">
              <div class="list-head">
                <h2>Applicants</h2>
                @if (selectedJob(); as currentJob) {
                  <button type="button" class="secondary" (click)="openApplicants(currentJob.id)">Refresh applicants</button>
                }
              </div>

              @if (!selectedJob()) {
                <div class="empty-card small">Choose a recruiter job to inspect applicants.</div>
              } @else if (selectedJob(); as currentJob) {
                @if (applicationsLoading()) {
                  <div class="empty-card small">Loading applicants for {{ currentJob.title }}...</div>
                } @else if (!applications().length) {
                  <div class="empty-card small">No applicants yet for {{ currentJob.title }}.</div>
                } @else {
                  <div class="job-list">
                    @for (application of applications(); track application.id) {
                      <article class="job-item applicant-item">
                        <div>
                          <h3>{{ application.seeker_email || application.seeker_id }}</h3>
                          <p>{{ application.job_title || currentJob.title }}</p>
                        </div>
                        <span class="status-pill">{{ application.current_stage }}</span>

                        <p class="meta-line">Applied {{ application.created_at | date: 'medium' }}</p>
                        <p class="meta-line">Cover letter: {{ application.cover_letter || 'Not provided' }}</p>

                        <div class="actions compact">
                          <button type="button" class="secondary" (click)="toggleSchedule(application.id)">
                            {{ schedulingApplicationId() === application.id ? 'Cancel interview' : 'Schedule interview' }}
                          </button>
                        </div>

                        @if (schedulingApplicationId() === application.id) {
                          <div class="schedule-grid">
                            <label>
                              <span>Date and time</span>
                              <input [(ngModel)]="scheduleDateTime" type="datetime-local" />
                            </label>
                            <label>
                              <span>Recruiter notes</span>
                              <textarea [(ngModel)]="scheduleNotes" rows="3"></textarea>
                            </label>
                          </div>
                          <div class="actions compact">
                            <button type="button" (click)="scheduleInterview(application.id)">Generate interview link</button>
                          </div>
                        }
                      </article>
                    }
                  </div>
                }
              } @else {
                <div class="empty-card small">Choose a recruiter job to inspect applicants.</div>
              }

              @if (interviewMessage()) {
                <div class="message">{{ interviewMessage() }}</div>
              }

              @if (scheduledInterview(); as interview) {
                <div class="sub-card interview-card">
                  <h3>Latest interview link</h3>
                  <p><strong>Scheduled:</strong> {{ interview.scheduled_at | date: 'medium' }}</p>
                  <p><strong>Expires:</strong> {{ interview.expires_at | date: 'medium' }}</p>
                  <p><strong>Link:</strong> <a [href]="interview.jitsi_link" target="_blank" rel="noreferrer">{{ interview.jitsi_link }}</a></p>
                  <p><strong>Notes:</strong> {{ interview.recruiter_notes || 'None' }}</p>
                </div>
              }
            </div>
          </article>
        </div>
      }
    </section>
  `,
  styles: [`
    .page-card,
    .form-card,
    .list-card,
    .sub-card,
    .empty-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .page-card,
    .form-card,
    .list-card,
    .sub-card { padding: 1.5rem; }
    .layout { display: grid; gap: 1rem; grid-template-columns: 1.1fr 0.9fr; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 1rem; }
    .list-head,
    .job-item,
    .page-head,
    .actions { display: flex; gap: 1rem; justify-content: space-between; align-items: center; flex-wrap: wrap; }
    .job-list { display: grid; gap: 0.8rem; }
    .job-item { background: rgba(10, 16, 32, 0.45); border-radius: 18px; padding: 1rem; }
    .applicant-item { align-items: stretch; }
    .applicant-panel { border-top: 1px solid var(--border); margin-top: 1.25rem; padding-top: 1.25rem; }
    .actions.compact { margin-top: 0.6rem; }
    .schedule-grid { 
  display: grid; 
  gap: 1.25rem; 
  grid-template-columns: 1fr; /* Stacks the inputs vertically */
  margin-top: 1rem; 
  background: var(--bg); /* Adds a subtle inset look */
  border: 1px solid var(--border);
  padding: 1.25rem;
  border-radius: 12px;
}
    .message,
    .small { margin-top: 1rem; padding: 1rem; }
    .status-pill { background: rgba(238, 108, 77, 0.16); border-radius: 999px; color: #ffd1c6; padding: 0.45rem 0.8rem; text-transform: capitalize; }
    .status-pill.archived { background: rgba(142, 145, 150, 0.18); color: #d9dde4; }
    .meta-line { margin: 0; color: var(--muted); }
    .interview-card { margin-top: 1rem; }
    @media (max-width: 980px) {
      .layout,
      .grid,
      .schedule-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class PostJobComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);

  readonly categories = signal<Category[]>([]);
  readonly myJobs = signal<RecruiterJob[]>([]);
  readonly jobsLoading = signal(false);
  readonly applicationsLoading = signal(false);
  readonly message = signal('');
  readonly interviewMessage = signal('');
  readonly isRecruiter = computed(() => this.auth.role() === 'recruiter');
  readonly editingJobId = signal('');
  readonly selectedJobId = signal('');
  readonly applications = signal<Applicant[]>([]);
  readonly schedulingApplicationId = signal('');
  readonly scheduledInterview = signal<InterviewResponse | null>(null);
  readonly selectedJob = computed(() => this.myJobs().find((job) => job.id === this.selectedJobId()) ?? null);

  readonly form = {
    title: '',
    description: '',
    category: '',
    location_type: 'remote',
    location_city: '',
    salary_min: 80000,
    salary_max: 120000,
    currency: 'INR',
    experience_required: '2 years',
    skill_name: 'Python',
  };

  scheduleDateTime = '';
  scheduleNotes = '';

  ngOnInit(): void {
    this.api.get<Category[]>(`${this.api.jobsBase}/categories/`).subscribe({
      next: (categories) => this.categories.set(categories),
    });

    if (this.isRecruiter()) {
      this.loadMyJobs();
    }
  }

  protected createJob(): void {
    const payload = {
      title: this.form.title,
      description: this.form.description,
      category: this.form.category || null,
      location_type: this.form.location_type,
      location_city: this.form.location_city,
      salary_min: this.form.salary_min,
      salary_max: this.form.salary_max,
      currency: this.form.currency,
      experience_required: this.form.experience_required,
      skills: this.form.skill_name ? [{ skill_name: this.form.skill_name, is_required: true }] : [],
    };

    this.api.post(`${this.api.jobsBase}/create/`, payload, true).subscribe({
      next: () => {
        this.message.set('Job created successfully.');
        this.resetForm();
        this.loadMyJobs();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected startEdit(job: RecruiterJob): void {
    this.editingJobId.set(job.id);
    this.form.title = job.title;
    this.form.description = job.description;
    this.form.location_type = job.location_type;
    this.form.location_city = job.location_city;
    this.form.salary_min = job.salary_min ?? 0;
    this.form.salary_max = job.salary_max ?? 0;
    this.form.experience_required = job.experience_required;
  }

  protected cancelEdit(): void {
    this.editingJobId.set('');
    this.resetForm();
  }

  protected updateJob(): void {
    const jobId = this.editingJobId();
    if (!jobId) return;

    const payload = {
      title: this.form.title,
      description: this.form.description,
      location_type: this.form.location_type,
      location_city: this.form.location_city,
      salary_min: this.form.salary_min,
      salary_max: this.form.salary_max,
      experience_required: this.form.experience_required,
      skills: this.form.skill_name ? [{ skill_name: this.form.skill_name, is_required: true }] : [],
    };

    this.api.patch(`${this.api.jobsBase}/${jobId}/`, payload, true).subscribe({
      next: () => {
        this.message.set('Job updated.');
        this.cancelEdit();
        this.loadMyJobs();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected publish(jobId: string): void {
    this.api.post(`${this.api.jobsBase}/${jobId}/publish/`, {}, true).subscribe({
      next: () => {
        this.message.set('Job published.');
        this.loadMyJobs();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected close(jobId: string): void {
    this.api.post(`${this.api.jobsBase}/${jobId}/close/`, {}, true).subscribe({
      next: () => {
        this.message.set('Job closed.');
        this.loadMyJobs();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected archive(jobId: string): void {
    this.api.post(`${this.api.jobsBase}/${jobId}/archive/`, {}, true).subscribe({
      next: () => {
        this.message.set('Job archived.');
        this.loadMyJobs();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected restore(jobId: string): void {
    this.api.post(`${this.api.jobsBase}/${jobId}/restore/`, {}, true).subscribe({
      next: () => {
        this.message.set('Job restored.');
        this.loadMyJobs();
      },
      error: (error) => this.message.set(this.errorMessage(error)),
    });
  }

  protected openApplicants(jobId: string): void {
    this.selectedJobId.set(jobId);
    this.schedulingApplicationId.set('');
    this.scheduleDateTime = '';
    this.scheduleNotes = '';
    this.interviewMessage.set('');
    this.scheduledInterview.set(null);
    this.loadApplications(jobId);
  }

  protected toggleSchedule(applicationId: string): void {
    if (this.schedulingApplicationId() === applicationId) {
      this.schedulingApplicationId.set('');
      this.scheduleDateTime = '';
      this.scheduleNotes = '';
      return;
    }
    this.schedulingApplicationId.set(applicationId);
    this.scheduleDateTime = '';
    this.scheduleNotes = '';
    this.interviewMessage.set('');
  }

  protected scheduleInterview(applicationId: string): void {
    if (!this.scheduleDateTime) {
      this.interviewMessage.set('Pick an interview date and time first.');
      return;
    }

    const scheduledAt = new Date(this.scheduleDateTime);
    if (Number.isNaN(scheduledAt.getTime())) {
      this.interviewMessage.set('Enter a valid interview date and time.');
      return;
    }

    this.api.post<InterviewResponse>(`${this.api.applicationsBase}/${applicationId}/schedule-interview/`, {
      scheduled_at: scheduledAt.toISOString(),
      recruiter_notes: this.scheduleNotes,
    }, true).subscribe({
      next: (interview) => {
        this.scheduledInterview.set(interview);
        this.interviewMessage.set('Interview scheduled and email notification queued for the candidate.');
        this.schedulingApplicationId.set('');
        this.scheduleDateTime = '';
        this.scheduleNotes = '';
        if (this.selectedJobId()) {
          this.loadApplications(this.selectedJobId());
        }
      },
      error: (error) => this.interviewMessage.set(this.errorMessage(error)),
    });
  }

  protected loadMyJobs(): void {
    this.jobsLoading.set(true);
    this.api.get<RecruiterJob[]>(`${this.api.jobsBase}/my/`, true).subscribe({
      next: (jobs) => {
        this.myJobs.set(jobs);
        const selected = this.selectedJobId();
        if (selected && jobs.some((job) => job.id === selected)) {
          this.loadApplications(selected);
        } else if (!selected && jobs.length) {
          this.selectedJobId.set(jobs[0].id);
          this.loadApplications(jobs[0].id);
        } else if (selected && !jobs.some((job) => job.id === selected)) {
          this.selectedJobId.set('');
          this.applications.set([]);
        }
        this.jobsLoading.set(false);
      },
      error: (error) => {
        this.message.set(this.errorMessage(error));
        this.jobsLoading.set(false);
      },
    });
  }

  private loadApplications(jobId: string): void {
    this.applicationsLoading.set(true);
    this.api.get<Applicant[]>(`${this.api.applicationsBase}/job/${jobId}/`, true).subscribe({
      next: (applications) => {
        this.applications.set(applications);
        this.applicationsLoading.set(false);
      },
      error: (error) => {
        this.interviewMessage.set(this.errorMessage(error));
        this.applicationsLoading.set(false);
      },
    });
  }

  private resetForm(): void {
    this.form.title = '';
    this.form.description = '';
    this.form.category = '';
    this.form.location_type = 'remote';
    this.form.location_city = '';
    this.form.salary_min = 80000;
    this.form.salary_max = 120000;
    this.form.currency = 'INR';
    this.form.experience_required = '2 years';
    this.form.skill_name = 'Python';
  }

  private errorMessage(error: { error?: unknown; message?: string }): string {
    if (typeof error.error === 'string') return error.error;
    if (error.error && typeof error.error === 'object') return JSON.stringify(error.error);
    return error.message ?? 'Request failed';
  }
}
