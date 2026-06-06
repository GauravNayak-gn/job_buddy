import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { SeekerDataService } from '../../../core/services/seeker-data.service';
import { AlertService } from '../../../core/services/alert.service';
import { MatchResponse, JobMatch, SeekerMatch, SeekerProfile, Applicant, InterviewResponse, JobSummary, JobMatchView, Job } from '../../../core/models';
import { extractErrorMessage } from '../../../shared/utils/error-message.util';
import { SalaryPipe } from '../../../shared/pipes/salary.pipe';
import { AiAlignmentDrawerComponent } from '../../../shared/components/ai-alignment-drawer/ai-alignment-drawer.component';

@Component({
  selector: 'app-matches-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SalaryPipe, AiAlignmentDrawerComponent],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">Matching service</p>
          <h1>AI match explorer</h1>
        </div>
      </div>

      @if (isSeeker()) {
        <p class="hint">Shows top matched jobs for your seeker account.</p>
        <button type="button" [disabled]="isSubmitting()" (click)="loadJobsForSeeker()">Find jobs for me</button>

        @if (auth.isLoggedIn()) {
          <div class="apply-bar" style="margin-top: 1rem; margin-bottom: 1rem; background: rgba(10, 16, 32, 0.05); border: 1px solid var(--border); border-radius: 18px; padding: 1rem;">
            <label style="display: grid; gap: 0.25rem;">
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

        @if (jobResults().length) {
          <div class="list">
            @for (item of jobResults(); track item.job_id) {
              <article class="item" (click)="viewJobMatch(item)">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                  <div>
                    <p class="eyebrow" style="margin: 0; color: var(--muted); font-size: 0.85rem; text-transform: uppercase;">{{ item.location_type || 'Location N/A' }} @if (item.location_city) { · {{ item.location_city }} }</p>
                    <h2 style="margin: 0.25rem 0;">{{ item.title }}</h2>
                    <p class="muted" style="margin: 0; font-size: 0.85rem;">Job ID: {{ item.job_id }}</p>
                  </div>
                  <span class="status-pill" style="background: rgba(42, 157, 143, 0.16); color: #9fe3d8; font-weight: 700;">Match score: {{ item.similarity_score }}</span>
                </div>
                
                @if (item.description) {
                  <p class="description" style="color: var(--muted); margin: 1rem 0;">{{ item.description.length > 200 ? (item.description | slice:0:200) + '...' : item.description }}</p>
                }
                
                <div style="display: flex; gap: 1rem; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap;">
                  <span>{{ item.experience_required || 'Experience not specified' }}</span>
                  <span>{{ item.salary_min | salary:item.salary_max }}</span>
                </div>

                @if (auth.isLoggedIn()) {
                  <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;" (click)="$event.stopPropagation()">
                    <button type="button" class="secondary" (click)="viewJobMatch(item)">
                      ✨ AI Alignment Review
                    </button>
                    @if (appliedJobIds().has(item.job_id)) {
                      <span style="background: rgba(30, 111, 104, 0.14); color: #1e6f68; border-radius: 999px; padding: 0.45rem 0.8rem;">Already applied</span>
                    } @else {
                      <button type="button" [disabled]="isSubmitting()" (click)="apply(item.job_id)">
                        {{ isSubmitting() ? 'Applying...' : 'Apply now' }}
                      </button>
                    }
                  </div>
                }
              </article>
            }
          </div>
        }
      } @else {
        <div class="controls">
          <label>
            <span>Select job</span>
            <select [disabled]="isSubmitting()" [(ngModel)]="jobId">
              <option value="">Select job</option>
              @for (job of recruiterJobs(); track job.id) {
                <option [value]="job.id">{{ job.title }} ({{ job.id }})</option>
              }
            </select>
          </label>

          <button type="button" [disabled]="isSubmitting()" (click)="loadSeekersForJob()">Find matching seekers</button>
        </div>

        @if (seekerResults().length) {
          <div class="applicant-list">
            @for (item of seekerResults(); track item.resume_id) {
              <article class="applicant-card">
                <div class="applicant-header">
                  <div class="applicant-info">
                    <h3>
                      @if (item.first_name) {
                        {{ item.first_name }} {{ item.last_name }}
                      } @else {
                        {{ item.seeker_email || item.seeker_id }}
                      }
                    </h3>
                    <p class="meta-line">Match score: {{ item.similarity_score }}</p>
                  </div>
                  @if (item.current_stage) {
                    <span class="status-pill">{{ item.current_stage }}</span>
                  }
                </div>

                <div class="applicant-actions">
                  <button type="button" class="secondary" (click)="viewProfile(item.seeker_id)">Profile</button>

                  @if (item.resume_id) {
                    <button type="button" class="secondary" (click)="viewResume(item.resume_id)">View Resume</button>
                  }

                  <button type="button" class="secondary ai-review-btn" (click)="openAiReview(item)">
                    ✨ AI Review
                  </button>

                  <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="toggleSchedule(item.seeker_id)">
                    {{ schedulingSeekerId() === item.seeker_id ? 'Cancel' : 'Schedule' }}
                  </button>
                </div>

                @if (schedulingSeekerId() === item.seeker_id) {
                  <div class="schedule-form">
                    @if (!item.application_id) {
                      <p class="error-text">Seeker must apply before you can schedule.</p>
                    } @else {
                      <label>
                        <span>Date and time</span>
                        <input [disabled]="isSubmitting()" [(ngModel)]="scheduleDateTime" type="datetime-local" />
                      </label>
                      <label>
                        <span>Recruiter notes</span>
                        <textarea [disabled]="isSubmitting()" [(ngModel)]="scheduleNotes" rows="2"></textarea>
                      </label>
                      <button type="button" [disabled]="isSubmitting()" (click)="scheduleInterview(item)">
                        {{ isSubmitting() ? 'Scheduling...' : 'Generate interview link' }}
                      </button>
                    }
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

      @if (scheduledInterview(); as interview) {
        <article class="interview-banner">
          <h3>Latest interview scheduled</h3>
          <p><strong>Time:</strong> {{ interview.scheduled_at | date: 'medium' }}</p>
          <p><strong>Link:</strong> <a [href]="interview.jitsi_link" target="_blank" rel="noreferrer">{{ interview.jitsi_link }}</a></p>
          <p><strong>Notes:</strong> {{ interview.recruiter_notes || 'None' }}</p>
        </article>
      }

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
              <p><strong>Summary:</strong> {{ profile.summary || '-' }}</p>
            </div>
            <div class="profile-section">
              <h3>Skills</h3>
              @if (!profile.skills?.length) {
                <p class="muted">No skills details available.</p>
              } @else {
                <div class="chips">
                  @for (skill of profile.skills; track skill.id) {
                    <span class="chip">{{ skill.skill_name }} ({{ skill.years_of_experience }}y)</span>
                  }
                </div>
              }
            </div>
          </article>
        </div>
      }
    </section>

    <!-- Shared AI Review Drawer -->
    <app-ai-alignment-drawer 
      [isOpen]="isAiDrawerOpen()"
      [job]="selectedJob()"
      [seekerId]="isSeeker() ? (auth.userId() || '') : aiSelectedSeekerId()"
      [seekerName]="isSeeker() ? 'Your Seeker Profile' : aiSelectedSeekerName()"
      [type]="isSeeker() ? 'seeker-alignment' : 'recruiter-review'"
      (close)="closeAiDrawer()"
    />
  `,
  styles: [`
    .page-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
      padding: 2rem;
      display: grid;
      gap: 1.5rem;
    }
    .list, .applicant-list { display: grid; gap: 1rem; }
    .item, .applicant-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .item:hover, .applicant-card:hover {
      transform: translateY(-2px);
      border-color: var(--accent);
    }
    .status-pill {
      background: var(--pill-bg);
      border-radius: 999px;
      color: var(--pill-text);
      padding: 0.4rem 0.8rem;
      font-size: 0.8rem;
    }
    .controls {
      display: flex;
      gap: 1rem;
      align-items: flex-end;
      flex-wrap: wrap;
    }
    .controls label {
      flex: 1;
      min-width: 200px;
    }
    .controls button {
      height: 46px;
    }
    .applicant-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.75rem;
    }
    .applicant-info h3 {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text);
    }
    .meta-line {
      font-size: 0.8rem;
      color: var(--muted);
      margin-top: 0.15rem;
    }
    .applicant-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
    .applicant-actions button {
      font-size: 0.8rem;
      min-height: auto;
      padding: 0.5rem 0.75rem;
    }
    .ai-review-btn {
      background: linear-gradient(135deg, rgba(30, 111, 104, 0.1) 0%, rgba(217, 93, 57, 0.1) 100%);
      color: var(--secondary) !important;
      border: 1px solid rgba(30, 111, 104, 0.3) !important;
      font-weight: 600 !important;
    }
    .ai-review-btn:hover {
      background: linear-gradient(135deg, rgba(30, 111, 104, 0.2) 0%, rgba(217, 93, 57, 0.2) 100%) !important;
    }
    .schedule-form {
      margin-top: 1rem;
      padding: 1rem;
      border: 1px solid var(--border);
      background: var(--bg-alt);
      border-radius: 12px;
      display: grid;
      gap: 0.75rem;
    }
    .schedule-form button {
      width: fit-content;
      font-size: 0.8rem;
      min-height: auto;
      padding: 0.45rem 1rem;
    }
    .error-text {
      color: var(--danger-text);
      font-size: 0.85rem;
    }
    .message {
      color: var(--error-text);
      font-size: 0.9rem;
    }
    .interview-banner {
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      border-radius: 16px;
      padding: 1.25rem;
      color: var(--success-text);
    }
    .interview-banner h3 {
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }
    .interview-banner a {
      color: var(--secondary);
      font-weight: 600;
    }
    /* Modal styles */
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
    }
    .profile-header button {
      min-height: auto;
      padding: 0.3rem 0.6rem;
    }
    .profile-section h3 {
      font-size: 1rem;
      border-bottom: 1px dashed var(--border);
      padding-bottom: 0.25rem;
      margin-bottom: 0.5rem;
    }
    .profile-section p {
      font-size: 0.875rem;
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
  `],
})
export class MatchesComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);
  private readonly seekerData = inject(SeekerDataService);
  private readonly alertService = inject(AlertService);

  readonly isSeeker = this.auth.isSeeker;
  readonly isSubmitting = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  // Seeker Results
  readonly jobResults = signal<JobMatchView[]>([]);
  readonly resumes = this.seekerData.resumes;
  readonly appliedJobIds = computed(() => new Set(this.seekerData.applications().map((app) => app.job_id)));
  readonly selectedResumeId = signal<string>('');

  // Recruiter Results
  readonly recruiterJobs = signal<JobSummary[]>([]);
  readonly seekerResults = signal<SeekerMatch[]>([]);
  readonly jobId = signal<string>('');

  // AI Drawer states
  readonly isAiDrawerOpen = signal(false);
  readonly seekerSelectedJob = signal<Job | null>(null);
  readonly aiSelectedSeekerId = signal<string>('');
  readonly aiSelectedSeekerName = signal<string>('');

  readonly selectedJob = computed(() => {
    if (this.isSeeker()) {
      return this.seekerSelectedJob();
    }
    const id = this.jobId();
    if (!id) return null;
    const summary = this.recruiterJobs().find((j) => j.id === id);
    if (!summary) return null;
    return {
      id: summary.id,
      title: summary.title,
      description: 'Find candidates matching criteria.',
      location_type: 'remote',
      location_city: '',
      salary_min: 0,
      salary_max: 0,
      currency: '',
      experience_required: '',
      status: 'published',
    } as Job;
  });

  // Scheduling states
  readonly schedulingSeekerId = signal<string>('');
  scheduleDateTime = '';
  scheduleNotes = '';
  readonly scheduledInterview = signal<InterviewResponse | null>(null);
  readonly interviewMessage = signal('');

  // Viewing seeker profiles
  readonly viewingProfile = signal<SeekerProfile | null>(null);

  constructor() {
    effect(() => {
      const resumesList = this.resumes();
      if (!this.selectedResumeId() && resumesList.length) {
        const primaryResume = resumesList.find((r) => r.is_primary);
        this.selectedResumeId.set(primaryResume ? primaryResume.id : resumesList[0].id);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) return;
    if (this.isSeeker()) {
      this.seekerData.loadResumes();
      this.seekerData.loadApplications();
    } else {
      this.loadRecruiterJobs();
    }
  }

  private loadRecruiterJobs(): void {
    this.api.get<JobSummary[]>(`${this.api.jobsBase}/my/`, true).subscribe({
      next: (jobs) => this.recruiterJobs.set(jobs),
      error: () => this.error.set('Unable to load recruiter jobs summary.'),
    });
  }

  protected apply(jobId: string): void {
    this.message.set('');
    const resumeId = this.selectedResumeId();
    if (!resumeId) {
      this.alertService.warning('Please select a resume before applying.');
      return;
    }

    this.isSubmitting.set(true);
    this.api.post(`${this.api.applicationsBase}/apply/`, {
      job_id: jobId,
      resume_id: resumeId,
      cover_letter: 'Applied via AI Matches.',
    }, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.message.set('Application submitted.');
        this.alertService.toast('Application submitted successfully!');
        this.seekerData.loadApplications(true);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Application Failed');
      },
    });
  }

  protected loadJobsForSeeker(): void {
    this.error.set('');
    this.message.set('');
    const seekerId = this.auth.userId();
    
    const resumesList = this.resumes();
    const matchResume = resumesList.find((r) => r.is_primary) || resumesList[0];
    const resumeQuery = matchResume ? `?resume_id=${matchResume.id}` : '';

    this.isSubmitting.set(true);
    this.api.get<MatchResponse<JobMatch>>(`${this.api.matchBase}/jobs-for-seeker/${seekerId}/${resumeQuery}`, true).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const results = res.results ?? [];
        if (!results.length) {
          this.jobResults.set([]);
          this.message.set('No matches yet. Ensure your resume is uploaded.');
          return;
        }

        const detailCalls = results.map((item) =>
          this.api.get<any>(`${this.api.jobsBase}/${item.job_id}/`).pipe(
            map((job) => ({ 
              job_id: item.job_id, 
              title: job.title || item.job_id, 
              similarity_score: Math.round(item.similarity_score * 100),
              description: job.description,
              location_type: job.location_type,
              location_city: job.location_city,
              experience_required: job.experience_required,
              salary_min: job.salary_min,
              salary_max: job.salary_max,
              status: job.status
            })),
            catchError(() => of({ job_id: item.job_id, title: item.job_id, similarity_score: Math.round(item.similarity_score * 100) })),
          ),
        );

        this.isSubmitting.set(true);
        forkJoin(detailCalls).subscribe({
          next: (rows) => {
            this.isSubmitting.set(false);
            this.jobResults.set(rows as JobMatchView[]);
          },
          error: () => {
            this.isSubmitting.set(false);
            this.error.set('Unable to resolve job details for match results.');
          },
        });
      },
      error: () => {
        this.isSubmitting.set(false);
        this.error.set('Unable to fetch seeker matches from matching service.');
      },
    });
  }

  protected loadSeekersForJob(): void {
    this.error.set('');
    this.message.set('');
    if (!this.jobId().trim()) {
      this.error.set('Select a job first.');
      return;
    }

    const job_id = this.jobId().trim();

    this.isSubmitting.set(true);
    this.api.get<MatchResponse<SeekerMatch>>(`${this.api.matchBase}/seekers-for-job/${job_id}/`, true).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        const results = res.results ?? [];
        if (!results.length) {
          this.seekerResults.set([]);
          this.message.set('No seeker matches yet for this job.');
          return;
        }

        const applications$ = this.api.get<Applicant[]>(`${this.api.applicationsBase}/job/${job_id}/`, true).pipe(
          catchError(() => of([] as Applicant[]))
        );

        const profiles$ = forkJoin(
          results.map((match) => 
            this.api.get<SeekerProfile>(`${this.api.profileBase}/seeker/${match.seeker_id}/`, true).pipe(
              catchError(() => of(null))
            )
          )
        );

        this.isSubmitting.set(true);
        forkJoin([applications$, profiles$]).subscribe({
          next: ([apps, profiles]) => {
            this.isSubmitting.set(false);
            const seekerResultsEnriched = results.map((match, index) => {
              const profile = profiles[index];
              const appLookupId = profile?.user_id || match.seeker_id;
              const app = apps.find((a) => a.seeker_id === appLookupId);

              return {
                ...match,
                similarity_score: Math.round(match.similarity_score * 100),
                application_id: app?.id,
                seeker_email: app?.seeker_email,
                current_stage: app?.current_stage,
                first_name: profile?.first_name,
                last_name: profile?.last_name,
              };
            });
            this.seekerResults.set(seekerResultsEnriched);
          },
          error: () => {
            this.isSubmitting.set(false);
            this.seekerResults.set(results);
          }
        });
      },
      error: () => {
        this.isSubmitting.set(false);
        this.error.set('Unable to fetch job matches from matching service.');
      },
    });
  }

  protected viewProfile(seekerId: string): void {
    this.api.get<SeekerProfile>(`${this.api.profileBase}/seeker/${seekerId}/`, true).subscribe({
      next: (profile) => this.viewingProfile.set(profile),
      error: (error) => this.error.set(extractErrorMessage(error)),
    });
  }

  protected closeProfile(): void {
    this.viewingProfile.set(null);
  }

  protected viewResume(resumeId: string): void {
    if (!resumeId) {
      this.alertService.warning('No resume is attached.');
      return;
    }

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
        this.error.set('Failed to load resume. You may not have permission.');
        this.alertService.error('Could not download resume. Check your permissions.');
      },
    });
  }

  protected toggleSchedule(seekerId: string): void {
    if (this.schedulingSeekerId() === seekerId) {
      this.schedulingSeekerId.set('');
      this.scheduleDateTime = '';
      this.scheduleNotes = '';
      return;
    }
    this.schedulingSeekerId.set(seekerId);
    this.scheduleDateTime = '';
    this.scheduleNotes = '';
    this.interviewMessage.set('');
  }

  protected scheduleInterview(match: SeekerMatch): void {
    if (!match.application_id) {
      this.alertService.warning('Candidate has not applied to this job yet.');
      return;
    }

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
    this.api
      .post<InterviewResponse>(
        `${this.api.applicationsBase}/${match.application_id}/schedule-interview/`,
        {
          scheduled_at: scheduledAt.toISOString(),
          recruiter_notes: this.scheduleNotes,
        },
        true
      )
      .subscribe({
        next: (interview) => {
          this.isSubmitting.set(false);
          this.scheduledInterview.set(interview);
          this.interviewMessage.set('Interview scheduled and email notification queued.');
          this.alertService.success('Interview scheduled successfully!', 'Scheduled');
          this.schedulingSeekerId.set('');
          this.scheduleDateTime = '';
          this.scheduleNotes = '';
        },
        error: (error) => {
          this.isSubmitting.set(false);
          const errMsg = extractErrorMessage(error);
          this.interviewMessage.set(errMsg);
          this.alertService.error(errMsg, 'Scheduling Failed');
        },
      });
  }

  // AI reviews implementation
  protected viewJobMatch(item: JobMatchView): void {
    const jobDetail: Job = {
      id: item.job_id,
      title: item.title,
      description: item.description || 'Details for matched role.',
      location_type: item.location_type || 'remote',
      location_city: item.location_city || '',
      salary_min: item.salary_min || 0,
      salary_max: item.salary_max || 0,
      experience_required: item.experience_required || '',
      status: item.status || 'published'
    };
    this.seekerSelectedJob.set(jobDetail);
    this.isAiDrawerOpen.set(true);
  }

  protected openAiReview(match: SeekerMatch): void {
    this.aiSelectedSeekerId.set(match.seeker_id);
    this.aiSelectedSeekerName.set(match.first_name ? `${match.first_name} ${match.last_name}` : (match.seeker_email || 'Candidate'));
    this.isAiDrawerOpen.set(true);
  }

  protected closeAiDrawer(): void {
    this.isAiDrawerOpen.set(false);
    this.seekerSelectedJob.set(null);
  }
}
