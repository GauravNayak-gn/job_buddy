import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { AlertService } from '../../../core/services/alert.service';
import { ChatService } from '../../../core/services/chat.service';
import { RecruiterJob, Applicant, SeekerProfile, InterviewResponse } from '../../../core/models';
import { extractErrorMessage } from '../../../shared/utils/error-message.util';
import { AiAlignmentDrawerComponent } from '../../../shared/components/ai-alignment-drawer/ai-alignment-drawer.component';

@Component({
  selector: 'app-manage-jobs-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AiAlignmentDrawerComponent],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div class="title-block">
          <span class="eyebrow">Recruiter workspace</span>
          <h1>Manage Jobs</h1>
        </div>
        <div class="actions-header">
          <button type="button" routerLink="/post-job" class="post-job-btn">Post New Job</button>
        </div>
      </div>

      @if (!auth.isLoggedIn()) {
        <div class="empty-card">Login first to manage recruiter jobs.</div>
      } @else if (!isRecruiter()) {
        <div class="empty-card warning">This workspace is intended for recruiter accounts only.</div>
      } @else {
        
        <div class="manage-layout">
          
          <!-- Left Panel: Jobs List -->
          <article class="jobs-panel">
            <div class="list-head">
              <h2>My Job Postings</h2>
            </div>
            
            @if (message()) {
              <div class="message">{{ message() }}</div>
            }

            <!-- Search & Filters -->
            <div class="job-filters">
              <div class="search-row">
                <input type="text" [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" placeholder="Search job title..." class="search-input" />
                <button type="button" [disabled]="isSubmitting() || jobsLoading()" class="secondary refresh-btn" (click)="loadMyJobs()">Refresh</button>
              </div>
              <div class="filter-row">
                <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
                  <option value="">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="closed">Closed</option>
                  <option value="archived">Archived</option>
                </select>
                <select [ngModel]="locationFilter()" (ngModelChange)="locationFilter.set($event)">
                  <option value="">All Locations</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>
            </div>

            @if (jobsLoading()) {
              <div class="empty-card small">Loading recruiter jobs...</div>
            } @else if (!myJobs().length) {
              <div class="empty-card small">
                No jobs created yet. 
                <a routerLink="/post-job" class="inline-link">Create one now</a>
              </div>
            } @else {
              <div class="job-grid">
                @for (job of myJobs(); track job.id) {
                  <article class="job-card" [class.selected]="selectedJobId() === job.id" (click)="selectJob(job)">
                    <div class="job-header">
                      <div>
                        <h3>{{ job.title }}</h3>
                        <p class="job-meta">{{ job.location_type }} @if (job.location_city) { · {{ job.location_city }} }</p>
                      </div>
                      <span class="status-pill {{ job.is_archived ? 'archived' : job.status }}">
                        {{ job.is_archived ? 'archived' : job.status }}
                      </span>
                    </div>
                    <p class="job-desc">{{ job.description | slice:0:110 }}{{ job.description.length > 110 ? '...' : '' }}</p>
                    
                    <div class="job-actions" (click)="$event.stopPropagation()">
                      <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="editJob(job.id)">Edit</button>
                      <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="selectJob(job)">Applicants</button>
                      
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

          <!-- Right Panel: Applicants List -->
          <article class="applicants-panel">
            <div class="list-head">
              <div class="list-title-area">
                <h2>Applicants</h2>
                @if (selectedJob(); as job) {
                  <p class="job-subtitle" [title]="job.title">for {{ job.title }}</p>
                }
              </div>
              <div class="applicants-ctrl">
                <select [disabled]="isSubmitting()" [ngModel]="applicationSortBy()" (ngModelChange)="onSortChange($event)" class="sort-select">
                  <option value="-created_at">Newest first</option>
                  <option value="created_at">Oldest first</option>
                  <option value="current_stage">Stage (A-Z)</option>
                  <option value="-current_stage">Stage (Z-A)</option>
                </select>
                @if (selectedJob(); as currentJob) {
                  <button type="button" [disabled]="isSubmitting() || applicationsLoading()" class="secondary" (click)="loadApplicants(currentJob.id)">Refresh</button>
                }
              </div>
            </div>

            @if (!selectedJob()) {
              <div class="empty-card small">Select a job from the left panel to review candidate applications.</div>
            } @else if (selectedJob(); as currentJob) {
              @if (applicationsLoading()) {
                <div class="empty-card small">Loading applicants...</div>
              } @else if (!applicants().length) {
                <div class="empty-card small">No applicants for this role yet.</div>
              } @else {
                <div class="applicant-list">
                  @for (application of applicants(); track application.id) {
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

                      <p class="cover-letter">{{ application.cover_letter || 'No cover letter provided.' }}</p>

                      @if (application.screening_answers && application.screening_answers.length > 0) {
                        <div class="screening-responses">
                          <h4>Screening Answers</h4>
                          <div class="responses-list">
                            @for (resp of application.screening_answers; track $index) {
                              <div class="response-pair">
                                <p class="resp-q"><strong>Q: {{ resp.question }}</strong></p>
                                <p class="resp-a">A: {{ resp.answer }}</p>
                              </div>
                            }
                          </div>
                        </div>
                      }

                      <div class="applicant-actions">
                        <button type="button" class="secondary" (click)="viewProfile(application.seeker_id)">Profile</button>
                        <button type="button" class="secondary" (click)="openChatWithCandidate(application.seeker_id)">Chat</button>
                        
                        @if (application.resume_id) {
                          <button type="button" class="secondary" (click)="viewResume(application.resume_id)">View Resume</button>
                        }
                        
                        <button type="button" class="secondary ai-review-btn" (click)="openAiReview(application)">
                          ✨ AI Review
                        </button>
                        
                        <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="toggleSchedule(application.id)">
                          {{ schedulingApplicationId() === application.id ? 'Cancel' : 'Schedule' }}
                        </button>
                      </div>

                      @if (schedulingApplicationId() === application.id) {
                        <div class="schedule-form">
                          <label>
                            <span>Interview Date & Time</span>
                            <input [disabled]="isSubmitting()" [(ngModel)]="scheduleDateTime" type="datetime-local" />
                          </label>
                          <label>
                            <span>Meeting Notes</span>
                            <textarea [disabled]="isSubmitting()" [(ngModel)]="scheduleNotes" rows="2" placeholder="Interview topics..."></textarea>
                          </label>
                          <button type="button" [disabled]="isSubmitting()" (click)="scheduleInterview(application.id)">
                            {{ isSubmitting() ? 'Scheduling...' : 'Generate Jitsi Interview link' }}
                          </button>
                        </div>
                      }
                    </article>
                  }
                </div>
              }
            }
          </article>

        </div>
      }
    </section>

    <!-- Seeker Profile Modal -->
    @if (viewingProfile(); as profile) {
      <div class="modal-overlay" (click)="closeProfile()">
        <article class="modal-card" (click)="$event.stopPropagation()">
          <div class="profile-header">
            <h2>{{ profile.first_name }} {{ profile.last_name }}</h2>
            <button type="button" class="close-btn" (click)="closeProfile()">&times;</button>
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
            <p><strong>Summary:</strong> {{ profile.summary || 'No summary provided.' }}</p>
          </div>
          
          <div class="profile-section">
            <h3>Skills & Experience</h3>
            @if (!profile.skills?.length) {
              <p class="muted">No skills details available.</p>
            } @else {
              <div class="chips" style="margin-top: 0.5rem;">
                @for (skill of profile.skills; track skill.id) {
                  <span class="chip">{{ skill.skill_name }} ({{ skill.years_of_experience }}y)</span>
                }
              </div>
            }
          </div>
        </article>
      </div>
    }

    <!-- AI Candidate Review Drawer -->
    <app-ai-alignment-drawer 
      [isOpen]="isAiDrawerOpen()"
      [job]="selectedJob()"
      [seekerId]="aiSelectedSeekerId()"
      [seekerName]="aiSelectedSeekerName()"
      [type]="'recruiter-review'"
      (close)="closeAiDrawer()"
    />
  `,
  styles: [`
    .page-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: var(--shadow);
      padding: 1.25rem 1.5rem;
      display: grid;
      gap: 1rem;
    }

    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.5rem;
    }
    
    .title-block {
      display: flex;
      flex-direction: column;
    }

    .page-head h1 {
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0;
      color: var(--text);
    }
    
    .page-head .eyebrow {
      font-size: 0.72rem;
      margin-bottom: 0.1rem;
    }
    
    .post-job-btn {
      min-height: auto;
      height: 36px;
      font-size: 0.85rem;
      padding: 0.4rem 1rem;
    }

    .manage-layout {
      display: grid;
      gap: 1.5rem;
      grid-template-columns: 4fr 6fr;
    }

    @media (max-width: 1024px) {
      .manage-layout {
        grid-template-columns: 1fr;
      }
    }

    /* Panels styling */
    .jobs-panel, .applicants-panel {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .list-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0;
      margin-bottom: 0.1rem;
    }

    .list-head h2 {
      font-size: 1.1rem;
      font-weight: 600;
    }

    /* Job Card listing */
    .job-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 70vh;
      overflow-y: auto;
      padding-right: 0.5rem;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .job-grid::-webkit-scrollbar {
      display: none;
    }

    .job-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem;
      background: var(--bg-alt);
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .job-card:hover, .job-card.selected {
      border-color: var(--accent);
      background: var(--bg-panel);
    }

    .job-card.selected {
      box-shadow: 0 4px 12px rgba(24, 33, 47, 0.04);
    }

    .job-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .job-header h3 {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text);
    }

    .job-meta {
      font-size: 0.75rem;
      color: var(--muted);
    }

    .status-pill {
      border-radius: 999px;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.25rem 0.5rem;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .status-pill.published { background: #ecfdf5; color: #065f46; }
    .status-pill.closed { background: #f1f5f9; color: #475569; }
    .status-pill.draft { background: #fef3c7; color: #92400e; }
    .status-pill.archived { background: #fee2e2; color: #991b1b; }

    .job-desc {
      font-size: 0.85rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .job-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-top: 0.5rem;
    }

    .job-actions button {
      font-size: 0.75rem;
      min-height: auto;
      padding: 0.4rem 0.6rem;
    }

    /* Applicants area */
    .applicants-ctrl {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .list-title-area {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }

    .job-subtitle {
      font-size: 0.75rem;
      color: var(--muted);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 260px;
    }

    .sort-select {
      min-width: 130px;
      font-size: 0.8rem;
      padding: 0.4rem;
    }

    .applicant-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 70vh;
      overflow-y: auto;
      padding-right: 0.5rem;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .applicant-list::-webkit-scrollbar {
      display: none;
    }

    .applicant-card {
      background: var(--bg-alt);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .applicant-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }

    .applicant-info h3 {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--text);
    }

    .meta-line {
      font-size: 0.78rem;
      color: var(--muted);
    }

    .stage-select {
      font-size: 0.8rem;
      padding: 0.4rem;
      max-width: 150px;
    }

    .cover-letter {
      font-size: 0.85rem;
      color: var(--text);
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem;
      white-space: pre-line;
      line-height: 1.45;
    }

    .screening-responses {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .screening-responses h4 {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--accent);
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px dashed var(--border);
      padding-bottom: 0.25rem;
    }

    .responses-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .response-pair {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .resp-q {
      font-size: 0.82rem;
      color: var(--text);
      margin: 0;
    }

    .resp-a {
      font-size: 0.82rem;
      color: var(--muted);
      margin: 0;
      padding-left: 0.75rem;
      border-left: 2px solid var(--accent);
    }

    .applicant-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .applicant-actions button {
      font-size: 0.78rem;
      min-height: auto;
      padding: 0.4rem 0.75rem;
    }

    .ai-review-btn {
      background: linear-gradient(135deg, rgba(30, 111, 104, 0.1) 0%, rgba(217, 93, 57, 0.1) 100%);
      color: var(--secondary) !important;
      border: 1px solid rgba(30, 111, 104, 0.3) !important;
      font-weight: 600 !important;
    }

    .ai-review-btn:hover {
      background: linear-gradient(135deg, rgba(30, 111, 104, 0.2) 0%, rgba(217, 93, 57, 0.2) 100%) !important;
      transform: translateY(-1px);
    }

    .schedule-form {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      display: grid;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    .schedule-form button {
      width: fit-content;
      font-size: 0.8rem;
      min-height: auto;
      padding: 0.5rem 1rem;
    }

    .message {
      color: var(--error-text);
      font-size: 0.85rem;
    }

    /* Seeker Profile Modal overlay */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.3);
      backdrop-filter: blur(4px);
      z-index: 1040;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .modal-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      width: 500px;
      max-width: 90vw;
      padding: 1.5rem;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .profile-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.5rem;
    }

    .profile-header h2 {
      font-size: 1.25rem;
      color: var(--text);
    }

    .profile-section h3 {
      font-size: 1rem;
      border-bottom: 1px dashed var(--border);
      padding-bottom: 0.25rem;
      margin-bottom: 0.5rem;
    }

    .profile-section p {
      font-size: 0.875rem;
      line-height: 1.5;
      margin-bottom: 0.25rem;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .chip {
      background: var(--bg-hover);
      color: var(--text);
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      border: 1px solid rgba(24, 33, 47, 0.04);
    }

    .job-filters {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.75rem;
      margin-bottom: 0.25rem;
    }
    .search-row {
      display: flex;
      gap: 0.5rem;
    }
    .search-input {
      flex: 1;
      font-size: 0.85rem;
      padding: 0.5rem 0.75rem;
    }
    .refresh-btn {
      min-height: auto;
      height: 38px;
      font-size: 0.8rem;
      padding: 0.4rem 0.75rem;
    }
    .filter-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }
    .filter-row select {
      font-size: 0.8rem;
      padding: 0.45rem 0.6rem;
      cursor: pointer;
    }
  `],
})
export class ManageJobsComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly chatService = inject(ChatService);

  readonly isRecruiter = this.auth.isRecruiter;
  readonly isSubmitting = signal(false);
  readonly message = signal('');
  
  // Jobs lists
  readonly allMyJobs = signal<RecruiterJob[]>([]);
  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<string>('');
  readonly locationFilter = signal<string>('');

  readonly myJobs = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    const location = this.locationFilter();
    let jobs = this.allMyJobs();

    if (query) {
      jobs = jobs.filter(j => 
        j.title.toLowerCase().includes(query) || 
        (j.description && j.description.toLowerCase().includes(query))
      );
    }
    if (status) {
      if (status === 'archived') {
        jobs = jobs.filter(j => j.is_archived);
      } else {
        jobs = jobs.filter(j => j.status === status && !j.is_archived);
      }
    }
    if (location) {
      jobs = jobs.filter(j => j.location_type?.toLowerCase() === location.toLowerCase());
    }

    return jobs;
  });

  readonly jobsLoading = signal(false);
  readonly selectedJobId = signal<string>('');
  readonly selectedJob = signal<RecruiterJob | null>(null);

  // Applicants lists
  readonly applicants = signal<Applicant[]>([]);
  readonly applicationsLoading = signal(false);
  readonly applicationSortBy = signal<string>('-created_at');

  // Interactive scheduler states
  readonly schedulingApplicationId = signal<string>('');
  scheduleDateTime = '';
  scheduleNotes = '';

  // Interactive candidate details state
  readonly viewingProfile = signal<SeekerProfile | null>(null);

  // AI Drawer state signals
  readonly isAiDrawerOpen = signal(false);
  readonly aiSelectedSeekerId = signal<string>('');
  readonly aiSelectedSeekerName = signal<string>('');

  readonly availableStages = [
    { value: 'applied', label: 'Applied' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'interview_scheduled', label: 'Interview Scheduled' },
    { value: 'selected', label: 'Selected' },
    { value: 'rejected', label: 'Rejected' },
  ];

  ngOnInit(): void {
    if (this.auth.isLoggedIn() && this.isRecruiter()) {
      this.loadMyJobs();
    }
  }

  protected loadMyJobs(): void {
    this.jobsLoading.set(true);
    this.message.set('');
    
    this.api.get<RecruiterJob[]>(`${this.api.jobsBase}/my/`, true).subscribe({
      next: (jobs) => {
        this.allMyJobs.set(jobs);
        this.jobsLoading.set(false);
        // Automatically select first job if none selected
        if (jobs.length && !this.selectedJobId()) {
          this.selectJob(jobs[0]);
        }
      },
      error: (err) => {
        this.jobsLoading.set(false);
        const errMsg = extractErrorMessage(err);
        this.message.set(errMsg);
      },
    });
  }

  protected selectJob(job: RecruiterJob): void {
    this.selectedJobId.set(job.id);
    this.selectedJob.set(job);
    this.loadApplicants(job.id);
  }

  protected editJob(jobId: string): void {
    this.router.navigate(['/post-job'], { queryParams: { edit: jobId } });
  }

  protected loadApplicants(jobId: string): void {
    this.applicationsLoading.set(true);
    this.message.set('');

    const params = { ordering: this.applicationSortBy() };

    this.api.get<Applicant[]>(`${this.api.applicationsBase}/job/${jobId}/`, true, params).subscribe({
      next: (res) => {
        this.applicants.set(res);
        this.applicationsLoading.set(false);
      },
      error: (err) => {
        this.applicationsLoading.set(false);
        this.message.set(extractErrorMessage(err));
      },
    });
  }

  protected onSortChange(sort: string): void {
    this.applicationSortBy.set(sort);
    const jobId = this.selectedJobId();
    if (jobId) {
      this.loadApplicants(jobId);
    }
  }

  protected updateStage(applicationId: string, newStage: string): void {
    this.isSubmitting.set(true);
    this.message.set('');

    this.api.post(`${this.api.applicationsBase}/${applicationId}/stage/`, { stage: newStage }, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.toast(`Stage updated to ${newStage}.`);
        // Refresh applicants list
        const jobId = this.selectedJobId();
        if (jobId) this.loadApplicants(jobId);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(err);
        this.alertService.error(errMsg, 'Update Failed');
      },
    });
  }

  protected publish(jobId: string): void {
    this.isSubmitting.set(true);
    this.api.post(`${this.api.jobsBase}/${jobId}/publish/`, {}, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.success('Job published successfully.', 'Published');
        this.loadMyJobs();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.alertService.error(extractErrorMessage(err));
      },
    });
  }

  protected close(jobId: string): void {
    this.isSubmitting.set(true);
    this.api.post(`${this.api.jobsBase}/${jobId}/close/`, {}, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.toast('Job closed to new applicants.');
        this.loadMyJobs();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.alertService.error(extractErrorMessage(err));
      },
    });
  }

  protected archive(jobId: string): void {
    this.isSubmitting.set(true);
    this.api.post(`${this.api.jobsBase}/${jobId}/archive/`, {}, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.toast('Job archived.');
        this.loadMyJobs();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.alertService.error(extractErrorMessage(err));
      },
    });
  }

  protected restore(jobId: string): void {
    this.isSubmitting.set(true);
    this.api.post(`${this.api.jobsBase}/${jobId}/restore/`, {}, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.toast('Job restored to draft.');
        this.loadMyJobs();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.alertService.error(extractErrorMessage(err));
      },
    });
  }

  protected toggleSchedule(applicationId: string): void {
    if (this.schedulingApplicationId() === applicationId) {
      this.schedulingApplicationId.set('');
    } else {
      this.schedulingApplicationId.set(applicationId);
      this.scheduleDateTime = '';
      this.scheduleNotes = '';
    }
  }

  protected scheduleInterview(applicationId: string): void {
    if (!this.scheduleDateTime) {
      this.alertService.warning('Please select a date and time.');
      return;
    }

    this.isSubmitting.set(true);
    this.api.post<InterviewResponse>(`${this.api.applicationsBase}/${applicationId}/schedule-interview/`, {
      scheduled_at: new Date(this.scheduleDateTime).toISOString(),
      recruiter_notes: this.scheduleNotes,
    }, true).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.schedulingApplicationId.set('');
        this.alertService.success(`Interview scheduled. Jitsi Link: ${res.jitsi_link}`, 'Interview Generated');
        
        // Share details in chat
        const applicant = this.applicants().find((a) => a.id === applicationId);
        if (applicant) {
          const formattedDate = new Date(res.scheduled_at).toLocaleString();
          const notesStr = res.recruiter_notes ? `\nNotes: ${res.recruiter_notes}` : '';
          const messageBody = `Interview Scheduled!\n\nRole: ${applicant.job_title || 'Applied Role'}\nDate & Time: ${formattedDate}\nMeeting Link: ${res.jitsi_link}${notesStr}`;

          this.chatService.getOrCreateConversation(applicant.seeker_id).subscribe({
            next: (conv) => {
              this.chatService.sendMessage(conv.id, messageBody).subscribe({
                next: () => {
                  this.alertService.toast('Interview details shared in chat.');
                },
                error: (err) => console.error('Failed to share interview details in chat:', err)
              });
            }
          });
        }

        const jobId = this.selectedJobId();
        if (jobId) this.loadApplicants(jobId);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.alertService.error(extractErrorMessage(err), 'Failed to Schedule');
      },
    });
  }

  protected openChatWithCandidate(seekerId: string): void {
    const job = this.selectedJob();
    const queryParams: any = { userId: seekerId };
    if (job) {
      queryParams.jobId = job.id;
      queryParams.jobTitle = job.title;
    }
    this.router.navigate(['/chat'], { queryParams });
  }

  protected viewProfile(seekerId: string): void {
    this.isSubmitting.set(true);
    this.api.get<SeekerProfile>(`${this.api.profileBase}/seeker/${seekerId}/`, true).subscribe({
      next: (res) => {
        this.viewingProfile.set(res);
        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.alertService.error(extractErrorMessage(err), 'Failed to Load Profile');
      },
    });
  }

  protected closeProfile(): void {
    this.viewingProfile.set(null);
  }

  protected viewResume(resumeId: string): void {
    this.message.set('Loading resume securely...');
    this.api.getBlob(`${this.api.profileBase}/seeker/resumes/${resumeId}/download/`, true).subscribe({
      next: (blob) => {
        this.message.set('');
        const fileUrl = window.URL.createObjectURL(blob);
        window.open(fileUrl, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(fileUrl), 10000);
      },
      error: (error) => {
        console.error(error);
        this.message.set('Failed to load resume file.');
        this.alertService.error('Could not load resume file.');
      },
    });
  }

  // AI Review integration
  protected openAiReview(application: Applicant): void {
    this.aiSelectedSeekerId.set(application.seeker_id);
    this.aiSelectedSeekerName.set(application.seeker_email || 'Candidate');
    this.isAiDrawerOpen.set(true);
  }

  protected closeAiDrawer(): void {
    this.isAiDrawerOpen.set(false);
  }
}
