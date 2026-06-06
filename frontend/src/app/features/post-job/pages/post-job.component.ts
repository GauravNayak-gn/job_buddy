import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { AlertService } from '../../../core/services/alert.service';
import { Category, RecruiterJob } from '../../../core/models';
import { extractErrorMessage } from '../../../shared/utils/error-message.util';

const DEFAULT_QUESTIONS = [
  'Why are you interested in this role, and what makes you a good fit?',
  'What is your notice period?',
  'What is your earliest available start date?'
];

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
                <textarea 
                  [disabled]="isSubmitting()" 
                  [ngModel]="newQuestion()" 
                  (ngModelChange)="newQuestion.set($event)" 
                  rows="2"
                  [placeholder]="editingQuestionIndex() !== null ? 'Edit screening question...' : 'e.g. How many years of experience do you have with Angular?'" 
                  (keyup.enter)="addQuestion()"
                  class="question-input"
                ></textarea>
                <div class="add-question-actions">
                  @if (editingQuestionIndex() !== null) {
                    <button type="button" [disabled]="isSubmitting()" class="cancel-q-btn" (click)="cancelEditQuestion()">
                      Cancel
                    </button>
                  }
                  <button type="button" [disabled]="isSubmitting() || !newQuestion().trim()" class="add-q-btn" (click)="addQuestion()">
                    {{ editingQuestionIndex() !== null ? 'Save Changes' : '+ Add Question' }}
                  </button>
                </div>
              </div>

              <div class="questions-list">
                @if (!screeningQuestions().length) {
                  <div class="no-questions">
                    ❓ No screening questions added.
                  </div>
                } @else {
                  <div class="questions-grid">
                    @for (q of screeningQuestions(); track $index) {
                      <div class="question-item" [class.editing]="editingQuestionIndex() === $index">
                        <div class="q-content">
                          <span class="q-index">Q{{ $index + 1 }}</span>
                          <span class="q-text" [title]="q">{{ q }}</span>
                        </div>
                        <div class="q-actions-mini">
                          <button type="button" [disabled]="isSubmitting()" class="edit-q-btn" (click)="editQuestion($index)" title="Edit question">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button type="button" [disabled]="isSubmitting()" class="delete-q-btn" (click)="removeQuestion($index)" title="Remove question">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 16px; height: 16px;">
                              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
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
      max-width: 1400px;
      width: 95%;
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
      gap: 2.5rem;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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
      flex-direction: column;
      gap: 0.75rem;
    }

    .question-input {
      width: 100%;
      resize: vertical;
    }

    .add-question-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
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
      flex: 1;
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

    .q-actions-mini {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .edit-q-btn {
      background: var(--bg-hover);
      color: var(--muted);
      border: 1px solid var(--border);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      min-height: 0;
      padding: 0;
      border-radius: 50%;
      transition: all 0.2s ease;
    }

    .edit-q-btn:hover {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }

    .cancel-q-btn {
      white-space: nowrap;
      background: var(--secondary-btn-bg);
      color: var(--secondary-btn-text);
      border: 1px solid var(--border);
    }

    .cancel-q-btn:hover {
      background: var(--secondary-btn-hover-bg);
      color: var(--secondary-btn-hover-text);
    }

    .question-item.editing {
      border-color: var(--accent);
      background: var(--bg-hover);
    }

    .delete-q-btn {
      background: var(--bg-hover);
      color: var(--muted);
      border: 1px solid var(--border);
      height: 32px;
      width: 32px;
      min-height: 0;
      padding: 0;
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
      border-color: var(--border);
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
  readonly screeningQuestions = signal<string[]>([...DEFAULT_QUESTIONS]);
  readonly editingQuestionIndex = signal<number | null>(null);

  protected addQuestion(): void {
    const val = this.newQuestion().trim();
    if (!val) return;

    const editIdx = this.editingQuestionIndex();
    if (editIdx !== null) {
      this.screeningQuestions.update(list => {
        const copy = [...list];
        copy[editIdx] = val;
        return copy;
      });
      this.editingQuestionIndex.set(null);
    } else {
      this.screeningQuestions.update(list => [...list, val]);
    }
    this.newQuestion.set('');
  }

  protected removeQuestion(index: number): void {
    this.screeningQuestions.update(list => list.filter((_, i) => i !== index));
    if (this.editingQuestionIndex() === index) {
      this.cancelEditQuestion();
    } else if (this.editingQuestionIndex() !== null && this.editingQuestionIndex()! > index) {
      this.editingQuestionIndex.update(idx => idx !== null ? idx - 1 : null);
    }
  }

  protected editQuestion(index: number): void {
    const val = this.screeningQuestions()[index];
    this.newQuestion.set(val);
    this.editingQuestionIndex.set(index);
  }

  protected cancelEditQuestion(): void {
    this.editingQuestionIndex.set(null);
    this.newQuestion.set('');
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
    this.screeningQuestions.set([...DEFAULT_QUESTIONS]);
    this.newQuestion.set('');
    this.editingQuestionIndex.set(null);
  }
}
