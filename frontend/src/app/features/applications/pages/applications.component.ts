import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { SeekerDataService } from '../../../core/services/seeker-data.service';
import { AlertService } from '../../../core/services/alert.service';
import { Job, ApplicationItem } from '../../../core/models';
import { extractErrorMessage } from '../../../shared/utils/error-message.util';
import { AiAlignmentDrawerComponent } from '../../../shared/components/ai-alignment-drawer/ai-alignment-drawer.component';
import { SalaryPipe } from '../../../shared/pipes/salary.pipe';

@Component({
  selector: 'app-applications-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AiAlignmentDrawerComponent, SalaryPipe],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">My Career Activity</p>
          <h1>My Applications</h1>
        </div>
      </div>

      @if (!auth.isLoggedIn()) {
        <div class="empty-card">
          Login first to access your application history.
          <a routerLink="/login" class="inline-link">Go to login</a>
        </div>
      } @else if (!auth.isSeeker()) {
        <div class="empty-card warning">
          Recruiters do not submit applications. View your postings on the Manage Jobs page.
          <a routerLink="/manage-jobs" class="inline-link">Go to Manage Jobs</a>
        </div>
      } @else {
        
        <article class="panel-card">
          <div class="section-head">
            <h2>Track Applied Roles</h2>
            <div class="app-filters">
              <select [disabled]="isSubmitting()" [ngModel]="applicationStageFilter()" (ngModelChange)="onStageFilterChange($event)" class="filter-select">
                @for (stage of availableStages; track stage.value) {
                  <option [value]="stage.value">{{ stage.label }}</option>
                }
              </select>
              <button type="button" [disabled]="isSubmitting() || applicationsLoading()" class="secondary" (click)="refreshApplications()">Refresh</button>
            </div>
          </div>
          
          @if (applicationsLoading()) {
            <div class="empty-card small">Loading applications...</div>
          } @else if (!applications().length) {
            <div class="empty-card small">No applications found{{ applicationStageFilter() ? ' for this stage' : '' }}.</div>
          } @else {
            <div class="app-grid">
              @for (item of applications(); track item.id) {
                <div class="app-card">
                  <div class="app-header">
                    <div>
                      <h3>{{ item.job_title || 'Role (ID: ' + item.job_id + ')' }}</h3>
                      <p class="meta-line">Applied on {{ item.created_at | date: 'mediumDate' }}</p>
                    </div>
                    <span class="status-pill {{ item.current_stage }}">{{ item.current_stage }}</span>
                  </div>
                  
                  <div class="app-actions" (click)="$event.stopPropagation()">
                    <button type="button" class="secondary" (click)="viewJob(item.job_id, item)">View Job</button>
                    <button type="button" class="secondary" (click)="viewAiReview(item.job_id)">✨ AI Review</button>
                    @if (item.resume_id) {
                      <button type="button" class="secondary" (click)="viewResume(item.resume_id)">View Resume</button>
                    }
                  </div>
                </div>
              }
            </div>
          }
          
          @if (message()) {
            <div class="message">{{ message() }}</div>
          }
        </article>
      }
    </section>

    <!-- Side Drawer for Job Details and AI Alignment Review -->
    <app-ai-alignment-drawer 
      [isOpen]="isDrawerOpen()"
      [job]="selectedJob()"
      [seekerId]="auth.userId() || ''"
      [seekerName]="'Your Seeker Profile'"
      [type]="'seeker-alignment'"
      (close)="closeDrawer()"
    />

    <!-- Job Details Modal -->
    @if (isJobDetailsModalOpen() && selectedJob()) {
      <div class="modal-overlay" (click)="closeJobDetailsModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <div>
              <span class="eyebrow" style="margin-bottom: 0.2rem;">Job Specification</span>
              <h2>{{ selectedJob()?.title }}</h2>
            </div>
            <button type="button" class="close-btn" (click)="closeJobDetailsModal()">&times;</button>
          </header>
          
          <div class="modal-body">
            <div class="modal-details-grid">
              <div class="detail-item">
                <span class="detail-label">Location</span>
                <span class="detail-value">📍 {{ selectedJob()?.location_type }} · {{ selectedJob()?.location_city || 'Remote' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Salary Range</span>
                <span class="detail-value">💰 {{ selectedJob()?.salary_min | salary:selectedJob()?.salary_max }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Experience</span>
                <span class="detail-value">💼 {{ selectedJob()?.experience_required || 'Not specified' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Status</span>
                <span class="detail-value status-pill published" style="width: fit-content; text-transform: uppercase;">{{ selectedJob()?.status }}</span>
              </div>
            </div>

            <div class="detail-section">
              <h3>Role Description</h3>
              <p class="description-text">{{ selectedJob()?.description }}</p>
            </div>

            @if (selectedApplication()?.screening_answers; as answers) {
              @if (answers.length > 0) {
                <div class="detail-section screening-section">
                  <h3>Your Screening Answers</h3>
                  <div class="screening-answers-list">
                    @for (ans of answers; track $index) {
                      <div class="screening-answer-pair">
                        <p class="q-text"><strong>Q: {{ ans.question }}</strong></p>
                        <p class="a-text">A: {{ ans.answer }}</p>
                      </div>
                    }
                  </div>
                </div>
              }
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
      display: grid;
      gap: 1.5rem;
      padding: 2rem;
    }

    .panel-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 1.5rem;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.75rem;
    }

    .app-filters {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .filter-select {
      max-width: 200px;
    }

    .app-grid {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    }

    .app-card {
      background: var(--bg-alt);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1rem;
      transition: all 0.2s ease;
    }

    .app-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(24, 33, 47, 0.05);
      border-color: var(--accent);
    }

    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .app-header h3 {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text);
    }

    .meta-line {
      font-size: 0.8rem;
      color: var(--muted);
      margin-top: 0.25rem;
    }

    .status-pill {
      background: var(--pill-bg);
      color: var(--pill-text);
      border-radius: 999px;
      font-size: 0.72rem;
      padding: 0.3rem 0.6rem;
      text-transform: uppercase;
      font-weight: 700;
      white-space: nowrap;
    }

    .status-pill.rejected {
      background: var(--danger-bg);
      color: var(--danger-text);
    }

    .status-pill.selected {
      background: var(--success-bg);
      color: var(--success-text);
    }

    .app-actions {
      display: flex;
      gap: 0.5rem;
    }

    .app-actions button {
      flex: 1;
      font-size: 0.82rem;
      min-height: auto;
      padding: 0.5rem 0.75rem;
    }

    .message {
      margin-top: 1rem;
      color: var(--error-text);
      font-size: 0.9rem;
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
      transition: opacity 0.5s ease;
    }
    .modal-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      width: 600px;
      max-width: 90vw;
      max-height: 85vh;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      box-shadow: var(--shadow);
      transition: background-color 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease;
    }
    .modal-card::-webkit-scrollbar {
      display: none;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1rem;
    }
    .modal-header h2 {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--text);
    }
    .close-btn {
      background: none;
      border: none;
      color: var(--muted);
      font-size: 2rem;
      cursor: pointer;
      padding: 0;
      min-height: auto;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    }
    .close-btn:hover {
      background-color: rgba(15, 23, 42, 0.05);
      color: var(--text);
    }
    .modal-body {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .modal-details-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      background: var(--bg-alt);
      padding: 1.25rem;
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .detail-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--muted);
      letter-spacing: 0.05em;
    }
    .detail-value {
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text);
    }
    .detail-section h3 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: var(--text);
    }
    .description-text {
      font-size: 0.925rem;
      line-height: 1.6;
      color: var(--text);
      opacity: 0.9;
      white-space: pre-wrap;
    }
    .screening-section {
      border-top: 1px solid var(--border);
      padding-top: 1.25rem;
      margin-top: 1.25rem;
    }
    .screening-answers-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: var(--bg-alt);
      padding: 1rem;
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    .screening-answer-pair {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .screening-answer-pair .q-text {
      font-size: 0.875rem;
      color: var(--text);
      margin: 0;
    }
    .screening-answer-pair .a-text {
      font-size: 0.875rem;
      color: var(--muted);
      margin: 0;
      padding-left: 0.75rem;
      border-left: 2px solid var(--accent);
    }
  `],
})
export class ApplicationsComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);
  private readonly seekerData = inject(SeekerDataService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly message = signal('');
  readonly applicationsLoading = this.seekerData.applicationsLoading;
  readonly applicationStageFilter = signal<string>('');

  // Drawer/Modal state signals
  readonly isDrawerOpen = signal(false);
  readonly isJobDetailsModalOpen = signal(false);
  readonly selectedJob = signal<Job | null>(null);
  readonly selectedApplication = signal<ApplicationItem | null>(null);

  readonly availableStages = [
    { value: '', label: 'All stages' },
    { value: 'applied', label: 'Applied' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'interview_scheduled', label: 'Interview Scheduled' },
    { value: 'selected', label: 'Selected' },
    { value: 'rejected', label: 'Rejected' },
  ];

  readonly applications = computed(() => {
    const stage = this.applicationStageFilter();
    const apps = this.seekerData.applications();
    if (!stage) return apps;
    return apps.filter((app) => app.current_stage === stage);
  });

  ngOnInit(): void {
    if (this.auth.isLoggedIn() && this.auth.isSeeker()) {
      this.seekerData.loadApplications();
    }
  }

  protected refreshApplications(): void {
    this.seekerData.loadApplications(true);
  }

  protected onStageFilterChange(stage: string): void {
    this.applicationStageFilter.set(stage);
  }

  protected viewJob(jobId: string, appItem: ApplicationItem): void {
    this.message.set('');
    this.isSubmitting.set(true);
    this.selectedApplication.set(appItem);
    
    this.api.get<Job>(`${this.api.jobsBase}/${jobId}/`, true).subscribe({
      next: (job) => {
        this.selectedJob.set(job);
        this.isJobDetailsModalOpen.set(true);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.message.set('Could not load job details. The job may have been removed.');
        this.alertService.error('Could not load job details.');
      },
    });
  }

  protected viewAiReview(jobId: string): void {
    this.message.set('');
    this.isSubmitting.set(true);
    
    this.api.get<Job>(`${this.api.jobsBase}/${jobId}/`, true).subscribe({
      next: (job) => {
        this.selectedJob.set(job);
        this.isDrawerOpen.set(true);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.isSubmitting.set(false);
        this.message.set('Could not load job details. The job may have been removed.');
        this.alertService.error('Could not load job details.');
      },
    });
  }

  protected closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.selectedJob.set(null);
  }

  protected closeJobDetailsModal(): void {
    this.isJobDetailsModalOpen.set(false);
    this.selectedJob.set(null);
    this.selectedApplication.set(null);
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

}
