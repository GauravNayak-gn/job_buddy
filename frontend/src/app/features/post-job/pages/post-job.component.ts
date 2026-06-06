import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { AlertService } from '../../../core/services/alert.service';
import { Category, RecruiterJob } from '../../../core/models';
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
          <h1>{{ editingJobId() ? 'Edit Job Posting' : 'Post a New Job' }}</h1>
        </div>
        <div>
          <a routerLink="/manage-jobs" class="inline-link">&larr; Back to Manage Jobs</a>
        </div>
      </div>

      @if (!auth.isLoggedIn()) {
        <div class="empty-card">Login first to create recruiter jobs.</div>
      } @else if (!isRecruiter()) {
        <div class="empty-card warning">This page is intended for recruiter accounts only.</div>
      } @else {
        
        <article class="form-container">
          
          <!-- Left Column: Specs & Description -->
          <div class="form-column">
            <!-- Section 1: Job Specifications -->
            <div class="form-section">
              <h2 class="section-title">
                <span class="step-num">1</span> Job Specifications
              </h2>
              <div class="grid">
                <label>
                  <span>Job Title <span class="required">*</span></span>
                  <input [disabled]="isSubmitting()" [(ngModel)]="form.title" type="text" placeholder="e.g. Senior Angular Developer" />
                </label>
                
                <label>
                  <span>Category <span class="required">*</span></span>
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
                  <input [disabled]="isSubmitting()" [(ngModel)]="form.location_city" type="text" placeholder="e.g. Bangalore" />
                </label>
                
                <label>
                  <span>Salary min (Annual)</span>
                  <input [disabled]="isSubmitting()" [(ngModel)]="form.salary_min" type="number" placeholder="Min salary" />
                </label>
                
                <label>
                  <span>Salary max (Annual)</span>
                  <input [disabled]="isSubmitting()" [(ngModel)]="form.salary_max" type="number" placeholder="Max salary" />
                </label>
                
                <label>
                  <span>Experience required</span>
                  <input [disabled]="isSubmitting()" [(ngModel)]="form.experience_required" type="text" placeholder="e.g. 3+ years" />
                </label>
                
                <label>
                  <span>Primary skill required</span>
                  <input [disabled]="isSubmitting()" [(ngModel)]="form.skill_name" type="text" placeholder="e.g. Angular" />
                </label>
              </div>
            </div>

            <!-- Section 2: Job Description -->
            <div class="form-section">
              <h2 class="section-title">
                <span class="step-num">2</span> Job Description
              </h2>
              <label class="desc-label">
                <span>Outline job responsibilities, stack details, and benefit packages <span class="required">*</span></span>
                <textarea [disabled]="isSubmitting()" [(ngModel)]="form.description" rows="5" placeholder="Outline job responsibilities, stack details, and benefit packages..."></textarea>
              </label>
            </div>
          </div>
          
          <!-- Right Column: Screening Questions & Actions -->
          <div class="form-column">
            <!-- Section 3: Screening Questions -->
            <div class="form-section">
              <h2 class="section-title">
                <span class="step-num">3</span> Screening Questions (Optional)
              </h2>
              <p class="section-subtitle">Add custom questions for seekers to answer when they apply.</p>
              
              <div class="add-question-box">
                <input 
                  [disabled]="isSubmitting()" 
                  [ngModel]="newQuestion()" 
                  (ngModelChange)="newQuestion.set($event)" 
                  type="text" 
                  placeholder="e.g. How many years of experience do you have with Angular?" 
                  (keyup.enter)="addQuestion()"
                  class="question-input"
                />
                <button type="button" [disabled]="isSubmitting() || !newQuestion().trim()" class="add-q-btn" (click)="addQuestion()">
                  + Add
                </button>
              </div>

              <div class="questions-list">
                @if (!screeningQuestions().length) {
                  <div class="no-questions">
                    ❓ No screening questions added.
                  </div>
                } @else {
                  <div class="questions-grid">
                    @for (q of screeningQuestions(); track $index) {
                      <div class="question-item">
                        <div class="q-content">
                          <span class="q-index">Q{{ $index + 1 }}</span>
                          <span class="q-text" [title]="q">{{ q }}</span>
                        </div>
                        <button type="button" [disabled]="isSubmitting()" class="delete-q-btn" (click)="removeQuestion($index)" title="Remove question">
                          &times;
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="actions">
              @if (editingJobId()) {
                <button type="button" [disabled]="isSubmitting()" class="btn-primary" (click)="updateJob()">
                  {{ isSubmitting() ? 'Saving...' : 'Save Changes' }}
                </button>
                <button type="button" [disabled]="isSubmitting()" class="btn-secondary" (click)="cancelEdit()">Cancel</button>
              } @else {
                <button type="button" [disabled]="isSubmitting()" class="btn-primary" (click)="createJob()">
                  {{ isSubmitting() ? 'Creating...' : 'Create Job' }}
                </button>
              }
            </div>

            @if (message()) {
              <div class="message-banner">{{ message() }}</div>
            }
          </div>

        </article>
      }
    </section>
  `,
  styles: [`
    .page-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
      display: grid;
      gap: 2rem;
      padding: 2.5rem;
      max-width: 1200px;
      margin: 2rem auto;
    }

    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.25rem;
    }

    .page-head h1 {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--text);
    }

    .form-container {
      display: grid;
      gap: 2rem;
      grid-template-columns: 1.15fr 0.85fr;
      align-items: start;
    }

    .form-column {
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    .form-section {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.25rem;
    }

    .step-num {
      background: var(--accent);
      color: white;
      font-size: 0.9rem;
      font-weight: 700;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .section-subtitle {
      font-size: 0.875rem;
      color: var(--muted);
      margin-top: -0.5rem;
    }

    .grid {
      display: grid;
      gap: 1.5rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 1024px) {
      .form-container {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .grid {
        grid-template-columns: 1fr;
      }
      .page-card {
        padding: 1.5rem;
        border-radius: 20px;
      }
      .form-section {
        padding: 1.25rem;
      }
    }

    .required {
      color: var(--accent);
    }

    .desc-label {
      display: grid;
      gap: 0.5rem;
    }

    .add-question-box {
      display: flex;
      gap: 0.75rem;
    }

    .question-input {
      flex: 1;
    }

    .add-q-btn {
      white-space: nowrap;
      background: var(--secondary);
      color: white;
    }

    .add-q-btn:hover {
      background: var(--secondary);
      filter: brightness(1.1);
    }

    .questions-list {
      background: var(--bg-alt);
      border: 1px dashed var(--border);
      border-radius: 12px;
      padding: 1.25rem;
    }

    .no-questions {
      color: var(--muted);
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .questions-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .question-item {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      transition: border-color 0.2s ease;
    }

    .question-item:hover {
      border-color: var(--accent);
    }

    .q-content {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }

    .q-index {
      background: var(--pill-bg);
      color: var(--pill-text);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
    }

    .q-text {
      font-size: 0.9rem;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .delete-q-btn {
      background: transparent;
      color: var(--muted);
      border: none;
      font-size: 1.5rem;
      padding: 0;
      min-height: auto;
      height: 24px;
      width: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }

    .delete-q-btn:hover {
      background: var(--danger-bg);
      color: var(--danger-text);
      transform: none;
      box-shadow: none;
    }

    .actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
    }

    .btn-primary {
      background: var(--accent);
      color: white;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
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

    .message-banner {
      background: var(--danger-bg);
      color: var(--error-text);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem;
      font-size: 0.9rem;
      font-weight: 500;
    }
  `],
})
export class PostJobComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);
  private readonly alertService = inject(AlertService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isRecruiter = this.auth.isRecruiter;
  readonly isSubmitting = signal(false);
  readonly message = signal('');

  readonly categories = signal<Category[]>([]);
  readonly editingJobId = signal<string>('');

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

  readonly newQuestion = signal('');
  readonly screeningQuestions = signal<string[]>([]);

  protected addQuestion(): void {
    const val = this.newQuestion().trim();
    if (val) {
      this.screeningQuestions.update(list => [...list, val]);
      this.newQuestion.set('');
    }
  }

  protected removeQuestion(index: number): void {
    this.screeningQuestions.update(list => list.filter((_, i) => i !== index));
  }

  ngOnInit(): void {
    this.api.get<Category[]>(`${this.api.jobsBase}/categories/`).subscribe({
      next: (categories) => this.categories.set(categories),
    });

    // Check query params for edit mode
    this.route.queryParams.subscribe((params) => {
      const editJobId = params['edit'];
      if (editJobId) {
        this.loadJobToEdit(editJobId);
      }
    });
  }

  private loadJobToEdit(jobId: string): void {
    this.isSubmitting.set(true);
    this.api.get<RecruiterJob>(`${this.api.jobsBase}/${jobId}/`, true).subscribe({
      next: (job) => {
        this.editingJobId.set(job.id);
        this.form.title = job.title;
        this.form.description = job.description;
        this.form.location_type = job.location_type;
        this.form.location_city = job.location_city || '';
        this.form.salary_min = job.salary_min ?? 0;
        this.form.salary_max = job.salary_max ?? 0;
        this.form.experience_required = job.experience_required || '';
        
        const categoryObj = (job as any).category;
        this.form.category = categoryObj && typeof categoryObj === 'object' ? categoryObj.id : (categoryObj || '');

        if ((job as any).skills && (job as any).skills.length) {
          this.form.skill_name = (job as any).skills[0].skill_name;
        } else {
          this.form.skill_name = '';
        }
        
        this.screeningQuestions.set((job as any).screening_questions || []);

        this.isSubmitting.set(false);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.alertService.error(extractErrorMessage(err), 'Failed to Load');
        this.router.navigate(['/manage-jobs']);
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
      screening_questions: this.screeningQuestions(),
    };

    this.isSubmitting.set(true);
    this.message.set('');

    this.api.post(`${this.api.jobsBase}/create/`, payload, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.success('Job listing created successfully!', 'Created');
        this.resetForm();
        this.router.navigate(['/manage-jobs']);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Creation Failed');
      },
    });
  }

  protected updateJob(): void {
    const jobId = this.editingJobId();
    if (!jobId) return;

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
      screening_questions: this.screeningQuestions(),
    };

    this.isSubmitting.set(true);
    this.message.set('');

    this.api.patch(`${this.api.jobsBase}/${jobId}/`, payload, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.editingJobId.set('');
        this.alertService.success('Job listing updated successfully!', 'Saved');
        this.resetForm();
        this.router.navigate(['/manage-jobs']);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Update Failed');
      },
    });
  }

  protected cancelEdit(): void {
    this.editingJobId.set('');
    this.resetForm();
    this.router.navigate(['/manage-jobs']);
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
    this.screeningQuestions.set([]);
    this.newQuestion.set('');
  }
}
