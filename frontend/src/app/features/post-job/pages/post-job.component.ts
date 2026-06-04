import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { AlertService } from '../../../core/services/alert.service';
import { Category, RecruiterJob, Applicant, SeekerProfile, InterviewResponse } from '../../../core/models';
import { extractErrorMessage } from '../../../shared/utils/error-message.util';

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
        <div class="tabs">
          <button type="button" [disabled]="isSubmitting()" [class.active]="activeTab() === 'create'" (click)="activeTab.set('create')">Create Job</button>
          <button type="button" [disabled]="isSubmitting()" [class.active]="activeTab() === 'manage'" (click)="activeTab.set('manage')">Manage Jobs</button>
        </div>

        @if (activeTab() === 'create') {
          <article class="form-card">
            <h2>{{ editingJobId() ? 'Edit job' : 'Create a new job' }}</h2>
            <div class="grid">
              <label>
                <span>Title</span>
                <input [disabled]="isSubmitting()" [(ngModel)]="form.title" type="text" />
              </label>
              <label>
                <span>Category</span>
                <select [disabled]="isSubmitting()" [(ngModel)]="form.category">
                  <option value="">Select category</option>
                  @for (category of categories(); track category.id) {
                    <option [value]="category.id">{{ category.name }}</option>
                  }
                </select>
              </label>
              <label>
                <span>Location type</span>
                <select [disabled]="isSubmitting()" [(ngModel)]="form.location_type">
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </label>
              <label>
                <span>Location city</span>
                <input [disabled]="isSubmitting()" [(ngModel)]="form.location_city" type="text" />
              </label>
              <label>
                <span>Salary min</span>
                <input [disabled]="isSubmitting()" [(ngModel)]="form.salary_min" type="number" />
              </label>
              <label>
                <span>Salary max</span>
                <input [disabled]="isSubmitting()" [(ngModel)]="form.salary_max" type="number" />
              </label>
              <label>
                <span>Experience required</span>
                <input [disabled]="isSubmitting()" [(ngModel)]="form.experience_required" type="text" />
              </label>
              <label>
                <span>Primary skill</span>
                <input [disabled]="isSubmitting()" [(ngModel)]="form.skill_name" type="text" />
              </label>
            </div>
            <label>
              <span>Description</span>
              <textarea [disabled]="isSubmitting()" [(ngModel)]="form.description" rows="8"></textarea>
            </label>
            <div class="actions">
              @if (editingJobId()) {
                <button type="button" [disabled]="isSubmitting()" (click)="updateJob()">{{ isSubmitting() ? 'Saving...' : 'Save changes' }}</button>
                <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="cancelEdit()">Cancel</button>
              } @else {
                <button type="button" [disabled]="isSubmitting()" (click)="createJob()">{{ isSubmitting() ? 'Creating...' : 'Create job' }}</button>
              }
            </div>
            @if (message()) {
              <div class="message">{{ message() }}</div>
            }
          </article>
        } @else {
          <div class="manage-layout">
            <article class="jobs-panel">
              <div class="list-head">
                <h2>My jobs</h2>
                <button type="button" [disabled]="isSubmitting() || jobsLoading()" class="secondary" (click)="loadMyJobs()">Refresh</button>
              </div>
              @if (message()) {
                <div class="message">{{ message() }}</div>
              }
              @if (jobsLoading()) {
                <div class="empty-card small">Loading recruiter jobs...</div>
              } @else if (!myJobs().length) {
                <div class="empty-card small">No jobs created yet.</div>
              } @else {
                <div class="job-grid">
                  @for (job of myJobs(); track job.id) {
                    <article class="job-card" [class.selected]="selectedJobId() === job.id">
                      <div class="job-header">
                        <div>
                          <h3>{{ job.title }}</h3>
                          <p class="job-meta">{{ job.location_type }} @if (job.location_city) { · {{ job.location_city }} }</p>
                        </div>
                        <span class="status-pill" [class.archived]="job.is_archived">
                          {{ job.is_archived ? 'archived' : job.status }}
                        </span>
                      </div>
                      <p class="job-desc">{{ job.description | slice:0:120 }}{{ job.description.length > 120 ? '...' : '' }}</p>
                      <div class="job-actions">
                        <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="startEdit(job)">Edit</button>
                        <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="openApplicants(job.id)">Applicants</button>
                        @if (!job.is_archived && job.status !== 'published') {
                          <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="publish(job.id)">Publish</button>
                        }
                        @if (!job.is_archived && job.status !== 'closed') {
                          <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="close(job.id)">Close</button>
                        }
                        @if (!job.is_archived) {
                          <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="archive(job.id)">Archive</button>
                        } @else {
                          <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="restore(job.id)">Restore</button>
                        }
                      </div>
                    </article>
                  }
                </div>
              }
            </article>

            <article class="applicants-panel">
              <div class="list-head">
                <h2>Page applicants {{ selectedJob() ? 'for "' + selectedJob()!.title + '"' : '' }}</h2>
                <div class="applicants-ctrl">
                  <select [disabled]="isSubmitting()" [ngModel]="applicationSortBy()" (ngModelChange)="onSortChange($event)" class="sort-select">
                    <option value="-created_at">Newest first</option>
                    <option value="created_at">Oldest first</option>
                    <option value="current_stage">Stage (A-Z)</option>
                    <option value="-current_stage">Stage (Z-A)</option>
                  </select>
                  @if (selectedJob(); as currentJob) {
                    <button type="button" [disabled]="isSubmitting() || applicationsLoading()" class="secondary" (click)="openApplicants(currentJob.id)">Refresh</button>
                  }
                </div>
              </div>

              @if (!selectedJob()) {
                <div class="empty-card small">Select a job from the left to view applicants.</div>
              } @else if (selectedJob(); as currentJob) {
                @if (applicationsLoading()) {
                  <div class="empty-card small">Loading applicants...</div>
                } @else if (!applications().length) {
                  <div class="empty-card small">No applicants yet.</div>
                } @else {
                  <div class="applicant-list">
                    @for (application of applications(); track application.id) {
                      <article class="applicant-card">
                        <div class="applicant-header">
                          <div class="applicant-info">
                            <h3>{{ application.seeker_email || application.seeker_id }}</h3>
                            <p class="meta-line">Applied {{ application.created_at | date: 'short' }}</p>
                          </div>
                          <div class="stage-ctrl">
                            <select [disabled]="isSubmitting()" [ngModel]="application.current_stage" (ngModelChange)="updateStage(application.id, $event)" class="stage-select">
                                @for (stage of availableStages; track stage.value) {
                                    <option [value]="stage.value">{{ stage.label }}</option>
                                }
                            </select>
                          </div>
                        </div>

                        <p class="cover-letter">{{ application.cover_letter || 'No cover letter provided' }}</p>

                        <div class="applicant-actions">
                          <button type="button" class="secondary" (click)="viewProfile(application.seeker_id)">Profile</button>

                          @if (application.resume_id) {
                            <button type="button" class="secondary" (click)="viewResume(application.resume_id)">View Resume</button>
                          }

                          <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="toggleSchedule(application.id)">
                            {{ schedulingApplicationId() === application.id ? 'Cancel' : 'Schedule' }}
                          </button>
                        </div>

                        @if (schedulingApplicationId() === application.id) {
                          <div class="schedule-form">
                            <label>
                              <span>Date and time</span>
                              <input [disabled]="isSubmitting()" [(ngModel)]="scheduleDateTime" type="datetime-local" />
                            </label>
                            <label>
                              <span>Recruiter notes</span>
                              <textarea [disabled]="isSubmitting()" [(ngModel)]="scheduleNotes" rows="2"></textarea>
                            </label>
                            <button type="button" [disabled]="isSubmitting()" (click)="scheduleInterview(application.id)">
                              {{ isSubmitting() ? 'Scheduling...' : 'Generate interview link' }}
                            </button>
                          </div>
                        }
                      </article>
                    }
                  </div>
                }
              }

              @if (interviewMessage()) {
                <div class="message">{{ interviewMessage() }}</div>
              }
            </article>
          </div>

          @if (viewingProfile(); as profile) {
            <div class="modal-overlay" (click)="closeProfile()">
              <article class="modal-card" (click)="$event.stopPropagation()">
                <div class="profile-header">
                  <h2>{{ profile.first_name }} {{ profile.last_name }}</h2>
                  <button type="button" class="close-btn" (click)="closeProfile()">Close</button>
                </div>
                  <div class="profile-section">
                    <p><strong>Current Title:</strong> {{ profile.current_title || 'Not specified' }}</p>
                    <p><strong>Phone:</strong> {{ profile.phone || 'Not provided' }}</p>
                    @if (profile.github_url) {
                      <p><strong>GitHub:</strong> <a [href]="profile.github_url" target="_blank" rel="noreferrer">{{ profile.github_url }}</a></p>
                    }
                    @if (profile.linkedin_url) {
                      <p><strong>LinkedIn:</strong> <a [href]="profile.linkedin_url" target="_blank" rel="noreferrer">{{ profile.linkedin_url }}</a></p>
                    }
                  </div>
                  @if (profile.summary) {
                    <div class="profile-section">
                      <h4>Summary</h4>
                      <p>{{ profile.summary }}</p>
                    </div>
                  }
                  @if (profile.skills?.length) {
                    <div class="profile-section">
                      <h4>Skills</h4>
                      <div class="skills-grid">
                        @for (skill of profile.skills; track skill.id) {
                          <span class="skill-tag">{{ skill.skill_name }} ({{ skill.years_of_experience }}y)</span>
                        }
                      </div>
                    </div>
                  }
                  @if (profile.experiences?.length) {
                    <div class="profile-section">
                      <h4>Experience</h4>
                      @for (exp of profile.experiences; track exp.id) {
                        <div class="experience-item">
                          <p><strong>{{ exp.role_title }}</strong> at {{ exp.company_name }}</p>
                          <p class="meta-line">{{ exp.start_date | date: 'MMM yyyy' }} - {{ exp.end_date ? (exp.end_date | date: 'MMM yyyy') : 'Present' }}</p>
                          @if (exp.description) {
                            <p>{{ exp.description }}</p>
                          }
                        </div>
                      }
                    </div>
                  }
              </article>
            </div>
          }

          @if (scheduledInterview(); as interview) {
            <article class="interview-banner">
              <h3>Latest interview scheduled</h3>
              <p><strong>Time:</strong> {{ interview.scheduled_at | date: 'medium' }}</p>
              <p><strong>Link:</strong> <a [href]="interview.jitsi_link" target="_blank" rel="noreferrer">{{ interview.jitsi_link }}</a></p>
              <p><strong>Notes:</strong> {{ interview.recruiter_notes || 'None' }}</p>
            </article>
          }
        }
      }
    </section>
  `,
  styles: [`
    .page-card,
    .form-card,
    .jobs-panel,
    .applicants-panel,
    .modal-card,
    .empty-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .page-card { display: grid; gap: 1.5rem; padding: 1.5rem; }
    .tabs { display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
    .tabs button { background: transparent; border: none; color: var(--muted); padding: 0.75rem 1.5rem; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
    .tabs button.active { background: var(--pill-bg); color: var(--pill-text); }
    .tabs button:hover { background: var(--border); }
    
    .form-card,
    .jobs-panel,
    .applicants-panel { padding: 1.5rem; }
    
    .manage-layout { display: grid; gap: 1.5rem; grid-template-columns: 1fr 1fr; }
    
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 1rem; }
    
    .list-head,
    .page-head,
    .actions { display: flex; gap: 1rem; justify-content: space-between; align-items: center; flex-wrap: wrap; }
    
    .job-grid { display: grid; gap: 1rem; margin-top: 1rem; }
    .job-card { 
      display: flex;
      flex-direction: column;
      background: var(--card); 
      border: 1px solid var(--border);
      border-radius: 18px; 
      padding: 1.25rem; 
      cursor: pointer;
      transition: all 0.2s;
    }
    .job-card:hover { border-color: var(--accent); transform: translateY(-2px); }
    .job-card.selected { border-color: var(--accent); background: rgba(217, 93, 57, 0.05); }
    
    .job-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; }
    .job-meta { color: var(--muted); font-size: 0.9rem; margin: 0.25rem 0 0 0; }
    .job-desc { color: var(--muted); font-size: 0.95rem; margin: 0.5rem 0; }
    
    .job-actions { 
      display: flex; 
      gap: 0.5rem; 
      flex-wrap: wrap; 
      margin-top: auto; 
      padding-top: 1rem;
    }
    .job-actions button { padding: 0.4rem 0.8rem; font-size: 0.85rem; min-height: auto; }
    
    .applicant-list { display: grid; gap: 1rem; margin-top: 1rem; max-height: 70vh; overflow-y: auto; }
    .applicant-card { 
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: var(--card); 
      border-radius: 18px; 
      padding: 1.25rem;
      border: 1px solid var(--border);
    }
    
    .applicant-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .applicant-info { display: grid; gap: 0.25rem; }
    .cover-letter { color: var(--muted); font-size: 0.9rem; font-style: italic; margin: 0; }
    .applicant-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    
    .schedule-form { 
      display: grid; 
      gap: 1rem; 
      background: var(--bg);
      border: 1px solid var(--border);
      padding: 1rem;
      border-radius: 12px;
    }
    
    .message,
    .small { margin-top: 1rem; padding: 1rem; }
    
    .status-pill { 
      background: var(--pill-bg); 
      border-radius: 999px; 
      color: var(--pill-text); 
      padding: 0.45rem 0.8rem; 
      text-transform: capitalize;
      font-size: 0.85rem;
      white-space: nowrap;
      font-weight: 500;
    }
    .status-pill.archived { background: var(--border); color: var(--muted); }
    
    .meta-line { margin: 0; color: var(--muted); font-size: 0.9rem; }
    
    .modal-overlay { 
      position: fixed; 
      top: 0; 
      left: 0; 
      right: 0; 
      bottom: 0; 
      background: rgba(0, 0, 0, 0.7); 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      z-index: 1000;
      padding: 2rem;
    }
    .modal-card { 
      max-width: 700px; 
      width: 100%; 
      max-height: 85vh; 
      overflow-y: auto; 
      padding: 2rem;
    }
    
    .profile-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .close-btn { 
      background: var(--danger-bg); 
      border: none; 
      border-radius: 8px; 
      padding: 0.4rem 1rem;
      cursor: pointer; 
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--danger-text);
      transition: all 0.2s;
    }
    .close-btn:hover { background: var(--danger-hover); }
    
    .profile-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); }
    .profile-section:first-of-type { border-top: none; padding-top: 0; }
    .skills-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
    .skill-tag { background: var(--info-bg); border-radius: 999px; color: var(--info-text); padding: 0.35rem 0.7rem; font-size: 0.9rem; font-weight: 500; }
    .experience-item { margin-top: 0.8rem; padding: 0.8rem; background: var(--bg); border: 1px solid var(--border); border-radius: 12px; }
    
    .interview-banner { 
      background: var(--success-bg); 
      border: 1px solid var(--success-border);
      border-radius: 18px; 
      padding: 1.25rem;
      margin-top: 1rem;
      color: var(--success-text);
    }
 
    .applicants-ctrl { display: flex; gap: 0.5rem; align-items: center; }
    .sort-select, .stage-select { 
      padding: 0.4rem 0.8rem; 
      border-radius: 12px; 
      border: 1px solid var(--border);
      background: var(--card);
      font-size: 0.85rem;
      cursor: pointer;
    }
    .stage-select { color: var(--pill-text); font-weight: 500; background: var(--pill-bg); border: none; }
    
    @media (max-width: 980px) {
      .manage-layout,
      .grid { grid-template-columns: 1fr; }
      .modal-overlay { padding: 1rem; }
    }
  `],
})
export class PostJobComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);
  private readonly alertService = inject(AlertService);

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
  readonly applicationSortBy = signal('-created_at');
  readonly schedulingApplicationId = signal('');
  readonly scheduledInterview = signal<InterviewResponse | null>(null);
  readonly selectedJob = computed(() => this.myJobs().find((job) => job.id === this.selectedJobId()) ?? null);
  readonly viewingProfile = signal<SeekerProfile | null>(null);

  readonly isSubmitting = signal(false);

  readonly availableStages = [
    { value: 'applied', label: 'Applied' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'interview_scheduled', label: 'Interview Scheduled' },
    { value: 'selected', label: 'Selected' },
    { value: 'rejected', label: 'Rejected' },
  ];

  readonly activeTab = signal<'create' | 'manage'>('manage');

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

  protected viewResume(resumeId: string): void {
    if (!resumeId) {
      this.interviewMessage.set('No resume was attached to this application.');
      this.alertService.warning('No resume was attached to this application.');
      return;
    }

    this.interviewMessage.set('Loading resume securely...');
    
    this.api.getBlob(`${this.api.profileBase}/seeker/resumes/${resumeId}/download/`, true).subscribe({
      next: (blob) => {
        this.interviewMessage.set('');
        const fileUrl = window.URL.createObjectURL(blob);
        window.open(fileUrl, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(fileUrl), 10000);
      },
      error: (error) => {
        console.error(error);
        this.interviewMessage.set('Failed to load resume. You may not have permission.');
        this.alertService.error('Could not download resume. Check your permissions.');
      },
    });
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

    this.isSubmitting.set(true);
    this.api.post(`${this.api.jobsBase}/create/`, payload, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.success('Job listing created successfully!', 'Created');
        this.message.set('Job created successfully.');
        this.resetForm();
        this.loadMyJobs();
        this.activeTab.set('manage');
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Creation Failed');
      },
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
    this.activeTab.set('create');
  }

  protected cancelEdit(): void {
    this.editingJobId.set('');
    this.resetForm();
    this.activeTab.set('manage');
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

    this.isSubmitting.set(true);
    this.api.patch(`${this.api.jobsBase}/${jobId}/`, payload, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.success('Job listing updated successfully!', 'Updated');
        this.message.set('Job updated.');
        this.cancelEdit();
        this.loadMyJobs();
        this.activeTab.set('manage');
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Update Failed');
      },
    });
  }

  protected publish(jobId: string): void {
    this.alertService.confirm('Are you sure you want to publish this job listing? It will become visible to all seekers.', 'Publish Job').then((confirmed) => {
      if (!confirmed) return;
      
      this.isSubmitting.set(true);
      this.api.post(`${this.api.jobsBase}/${jobId}/publish/`, {}, true).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.alertService.toast('Job published successfully');
          this.message.set('Job published.');
          this.loadMyJobs();
        },
        error: (error) => {
          this.isSubmitting.set(false);
          const errMsg = extractErrorMessage(error);
          this.message.set(errMsg);
          this.alertService.error(errMsg, 'Publish Failed');
        },
      });
    });
  }

  protected close(jobId: string): void {
    this.alertService.confirm('Are you sure you want to close this job listing? It will no longer accept new applications.', 'Close Job').then((confirmed) => {
      if (!confirmed) return;

      this.isSubmitting.set(true);
      this.api.post(`${this.api.jobsBase}/${jobId}/close/`, {}, true).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.alertService.toast('Job closed successfully');
          this.message.set('Job closed.');
          this.loadMyJobs();
        },
        error: (error) => {
          this.isSubmitting.set(false);
          const errMsg = extractErrorMessage(error);
          this.message.set(errMsg);
          this.alertService.error(errMsg, 'Close Failed');
        },
      });
    });
  }

  protected archive(jobId: string): void {
    this.alertService.confirm('Are you sure you want to archive this job listing?', 'Archive Job').then((confirmed) => {
      if (!confirmed) return;

      this.isSubmitting.set(true);
      this.api.post(`${this.api.jobsBase}/${jobId}/archive/`, {}, true).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.alertService.toast('Job archived successfully');
          this.message.set('Job archived.');
          this.loadMyJobs();
        },
        error: (error) => {
          this.isSubmitting.set(false);
          const errMsg = extractErrorMessage(error);
          this.message.set(errMsg);
          this.alertService.error(errMsg, 'Archive Failed');
        },
      });
    });
  }

  protected restore(jobId: string): void {
    this.isSubmitting.set(true);
    this.api.post(`${this.api.jobsBase}/${jobId}/restore/`, {}, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.toast('Job restored successfully');
        this.message.set('Job restored.');
        this.loadMyJobs();
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Restore Failed');
      },
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

    this.isSubmitting.set(true);
    this.api.post<InterviewResponse>(`${this.api.applicationsBase}/${applicationId}/schedule-interview/`, {
      scheduled_at: scheduledAt.toISOString(),
      recruiter_notes: this.scheduleNotes,
    }, true).subscribe({
      next: (interview) => {
        this.isSubmitting.set(false);
        this.scheduledInterview.set(interview);
        this.interviewMessage.set('Interview scheduled and email notification queued for the candidate.');
        this.alertService.success('Interview scheduled successfully!', 'Scheduled');
        this.schedulingApplicationId.set('');
        this.scheduleDateTime = '';
        this.scheduleNotes = '';
        if (this.selectedJobId()) {
          this.loadApplications(this.selectedJobId());
        }
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.interviewMessage.set(errMsg);
        this.alertService.error(errMsg, 'Scheduling Failed');
      },
    });
  }

  protected onSortChange(sort: string): void {
    this.applicationSortBy.set(sort);
    if (this.selectedJobId()) {
      this.loadApplications(this.selectedJobId());
    }
  }

  protected updateStage(applicationId: string, newStage: string): void {
    this.isSubmitting.set(true);
    this.api.post(`${this.api.applicationsBase}/${applicationId}/stage/`, {
      new_stage: newStage,
      note: 'Updated by recruiter'
    }, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.interviewMessage.set('Application stage updated.');
        this.alertService.toast(`Stage updated to ${newStage}`);
        if (this.selectedJobId()) {
          this.loadApplications(this.selectedJobId());
        }
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.interviewMessage.set(errMsg);
        this.alertService.error(errMsg, 'Stage Update Failed');
      }
    });
  }

  protected viewProfile(seekerId: string): void {
    this.api.get<SeekerProfile>(`${this.api.profileBase}/seeker/${seekerId}/`, true).subscribe({
      next: (profile) => this.viewingProfile.set(profile),
      error: (error) => this.interviewMessage.set(extractErrorMessage(error)),
    });
  }

  protected closeProfile(): void {
    this.viewingProfile.set(null);
  }

  protected loadMyJobs(): void {
    this.jobsLoading.set(true);
    this.message.set('');
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
        const errMsg = extractErrorMessage(error);
        if (errMsg.includes('Invalid or expired token')) {
          this.message.set('Your session has expired. Please log in again.');
        } else {
          this.message.set(errMsg);
        }
        this.jobsLoading.set(false);
      },
    });
  }

  private loadApplications(jobId: string): void {
    this.applicationsLoading.set(true);
    const params = { sort_by: this.applicationSortBy() };
    this.api.get<Applicant[]>(`${this.api.applicationsBase}/job/${jobId}/`, true, params).subscribe({
      next: (applications) => {
        this.applications.set(applications);
        this.applicationsLoading.set(false);
      },
      error: (error) => {
        this.interviewMessage.set(extractErrorMessage(error));
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
}
