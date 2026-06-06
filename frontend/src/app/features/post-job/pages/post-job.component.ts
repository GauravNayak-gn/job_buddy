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
        
        <article class="form-card">
          <h2>{{ editingJobId() ? 'Edit job specifications' : 'Job details' }}</h2>
          
          <div class="grid">
            <label>
              <span>Title</span>
              <input [disabled]="isSubmitting()" [(ngModel)]="form.title" type="text" placeholder="e.g. Senior Angular Developer" />
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
              <input [disabled]="isSubmitting()" [(ngModel)]="form.location_city" type="text" placeholder="e.g. Bangalore" />
            </label>
            
            <label>
              <span>Salary min (Annual)</span>
              <input [disabled]="isSubmitting()" [(ngModel)]="form.salary_min" type="number" />
            </label>
            
            <label>
              <span>Salary max (Annual)</span>
              <input [disabled]="isSubmitting()" [(ngModel)]="form.salary_max" type="number" />
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
          
          <label class="desc-label">
            <span>Description</span>
            <textarea [disabled]="isSubmitting()" [(ngModel)]="form.description" rows="8" placeholder="Outline job responsibilities, stack details, and benefit packages..."></textarea>
          </label>
          
          <div class="actions">
            @if (editingJobId()) {
              <button type="button" [disabled]="isSubmitting()" (click)="updateJob()">
                {{ isSubmitting() ? 'Saving...' : 'Save changes' }}
              </button>
              <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="cancelEdit()">Cancel</button>
            } @else {
              <button type="button" [disabled]="isSubmitting()" (click)="createJob()">
                {{ isSubmitting() ? 'Creating...' : 'Create job' }}
              </button>
            }
          </div>

          @if (message()) {
            <div class="message">{{ message() }}</div>
          }
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
      gap: 1.5rem;
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }

    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1rem;
    }

    .form-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-card h2 {
      font-size: 1.3rem;
      font-weight: 600;
      color: var(--text);
      border-bottom: 1px dashed var(--border);
      padding-bottom: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .grid {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    @media (max-width: 600px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }

    .desc-label {
      display: grid;
      gap: 0.4rem;
      margin-top: 0.5rem;
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .message {
      margin-top: 1rem;
      color: var(--error-text);
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
        if ((job as any).skills && (job as any).skills.length) {
          this.form.skill_name = (job as any).skills[0].skill_name;
        } else {
          this.form.skill_name = '';
        }
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
  }
}
