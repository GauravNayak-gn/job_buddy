import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { SeekerDataService } from '../../../core/services/seeker-data.service';
import { AlertService } from '../../../core/services/alert.service';
import { SeekerSkill, ResumeItem, ApplicationItem } from '../../../core/models';
import { extractErrorMessage } from '../../../shared/utils/error-message.util';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">Profile service</p>
          <h1>Profile and activity</h1>
        </div>
      </div>

      @if (!auth.isLoggedIn()) {
        <div class="empty-card">
          Login first to access your profile.
          <a href="/login" class="inline-link">Go to login</a>
        </div>
      } @else {
        
        @if (isSeeker()) {
          <div class="profile-layout">
            <div class="column-stack">
              <article class="panel-card">
                <div class="section-head">
                  <h2>Seeker profile</h2>
                  <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="editMode.set(!editMode())">
                    {{ editMode() ? 'Cancel edit' : 'Edit profile' }}
                  </button>
                </div>

                @if (!editMode()) {
                  <div class="info-grid">
                    <p><strong>Name:</strong> {{ seeker.first_name }} {{ seeker.last_name }}</p>
                    <p><strong>Phone:</strong> {{ seeker.phone || '-' }}</p>
                    <p><strong>Title:</strong> {{ seeker.current_title || '-' }}</p>
                    <p><strong>GitHub:</strong> {{ seeker.github_url || '-' }}</p>
                    <p><strong>LinkedIn:</strong> {{ seeker.linkedin_url || '-' }}</p>
                    <p><strong>Summary:</strong> {{ seeker.summary || '-' }}</p>
                  </div>
                } @else {
                  <div class="grid">
                    <label><span>First name</span><input [disabled]="isSubmitting()" [(ngModel)]="seeker.first_name" type="text" /></label>
                    <label><span>Last name</span><input [disabled]="isSubmitting()" [(ngModel)]="seeker.last_name" type="text" /></label>
                    <label><span>Phone</span><input [disabled]="isSubmitting()" [(ngModel)]="seeker.phone" type="text" /></label>
                    <label><span>Current title</span><input [disabled]="isSubmitting()" [(ngModel)]="seeker.current_title" type="text" /></label>
                  </div>
                  <label><span>Summary</span><textarea [disabled]="isSubmitting()" [(ngModel)]="seeker.summary" rows="4"></textarea></label>
                  <div class="grid">
                    <label><span>GitHub URL</span><input [disabled]="isSubmitting()" [(ngModel)]="seeker.github_url" type="text" /></label>
                    <label><span>LinkedIn URL</span><input [disabled]="isSubmitting()" [(ngModel)]="seeker.linkedin_url" type="text" /></label>
                  </div>
                  <div class="actions">
                    <button type="button" [disabled]="isSubmitting()" (click)="saveSeeker()">
                      {{ isSubmitting() ? 'Saving...' : 'Save profile' }}
                    </button>
                    <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="loadSeeker()">Reload</button>
                  </div>
                }
                @if (message()) {
                  <div class="message">{{ message() }}</div>
                }
              </article>
            </div>

            <div class="column-stack">
              <article class="panel-card">
                <h3>Skills</h3>
                @if (!skills().length) {
                  <p class="muted">No skills added yet.</p>
                } @else {
                  <div class="chips">
                    @for (item of skills(); track item.id) {
                      <span class="chip">{{ item.skill_name }} ({{ item.years_of_experience }}y)</span>
                    }
                  </div>
                }
                <div class="grid skill-inputs">
                  <label><span>Skill name</span><input [disabled]="isSubmitting()" [(ngModel)]="skill.skill_name" type="text" placeholder="e.g. Python" /></label>
                  <label><span>Years of experience</span><input [disabled]="isSubmitting()" [(ngModel)]="skill.years_of_experience" type="number" min="0" /></label>
                </div>
                <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="addSkill()">
                  {{ isSubmitting() ? 'Adding...' : 'Add skill' }}
                </button>
              </article>

              <article class="panel-card">
                <h3>Resume upload</h3>
                <div class="grid">
                  <label><span>Title</span><input [disabled]="isSubmitting()" [(ngModel)]="resumeTitle" type="text" placeholder="Backend Resume" /></label>
                  <label><span>PDF file</span><input [disabled]="isSubmitting()" type="file" accept="application/pdf" (change)="onResumeSelect($event)" class="file-input" /></label>
                </div>
                <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="uploadResume()">
                  {{ isSubmitting() ? 'Uploading...' : 'Upload resume' }}
                </button>
                @if (resumes().length) {
                  <div class="list compact">
                    @for (item of resumes(); track item.id) {
                      <div class="list-item" style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                          <strong>{{ item.resume_title }}</strong>
                          @if (item.is_primary) {
                            <span class="primary-badge">PRIMARY</span>
                          }
                          <p class="meta-line">{{ item.parsing_status }} · {{ item.created_at | date: 'medium' }}</p>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                          @if (!item.is_primary) {
                            <button type="button" [disabled]="isSubmitting()" class="secondary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" (click)="makePrimary(item.id)">Set Primary</button>
                          }
                          <button type="button" [disabled]="isSubmitting()" class="close-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" (click)="deleteResume(item.id)">Delete</button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </article>
            </div>
          </div>
        } @else {
          <article class="panel-card">
            <div class="section-head">
              <h2>Recruiter profile</h2>
              <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="editMode.set(!editMode())">
                {{ editMode() ? 'Cancel edit' : 'Edit profile' }}
              </button>
            </div>

            @if (!editMode()) {
              <div class="info-grid">
                <p><strong>Company:</strong> {{ recruiter.company_name || '-' }}</p>
                <p><strong>Size:</strong> {{ recruiter.company_size || '-' }}</p>
                <p><strong>Industry:</strong> {{ recruiter.industry || '-' }}</p>
                <p><strong>HQ:</strong> {{ recruiter.hq_location || '-' }}</p>
                <p><strong>Website:</strong> {{ recruiter.website_url || '-' }}</p>
              </div>
            } @else {
              <div class="grid">
                <label><span>Company name</span><input [disabled]="isSubmitting()" [(ngModel)]="recruiter.company_name" type="text" /></label>
                <label><span>Company size</span><input [disabled]="isSubmitting()" [(ngModel)]="recruiter.company_size" type="text" /></label>
                <label><span>Industry</span><input [disabled]="isSubmitting()" [(ngModel)]="recruiter.industry" type="text" /></label>
                <label><span>HQ location</span><input [disabled]="isSubmitting()" [(ngModel)]="recruiter.hq_location" type="text" /></label>
              </div>
              <label><span>Website URL</span><input [disabled]="isSubmitting()" [(ngModel)]="recruiter.website_url" type="text" /></label>
              <div class="actions">
                <button type="button" [disabled]="isSubmitting()" (click)="saveRecruiter()">
                  {{ isSubmitting() ? 'Saving...' : 'Save profile' }}
                </button>
                <button type="button" [disabled]="isSubmitting()" class="secondary" (click)="loadRecruiter()">Reload</button>
              </div>
            }

            @if (message()) {
              <div class="message">{{ message() }}</div>
            }
          </article>
        }
      }
    </section>
  `,
  styles: [`
    .page-card,
    .panel-card,
    .empty-card,
    .list-item,
    .app-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .page-card { display: grid; gap: 1.5rem; padding: 1.5rem; }
    .panel-card { padding: 1.5rem; }
    
    .profile-layout { display: grid; gap: 1.5rem; grid-template-columns: 1fr 1fr; }
    .column-stack { display: flex; flex-direction: column; gap: 1.5rem; }
    
    .tabs { display: flex; gap: 0.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; margin-bottom: 0.5rem; }
    .tabs button { background: transparent; border: none; color: var(--muted); padding: 0.75rem 1.5rem; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
    .tabs button.active { background: var(--pill-bg); color: var(--pill-text); }
    .tabs button:hover { background: var(--border); }

    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 1rem; }
    .skill-inputs { align-items: end; margin-bottom: 0.5rem; }
    
    .section-head,
    .page-head,
    .actions { display: flex; gap: 1rem; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
    .actions { margin-top: 1rem; margin-bottom: 0; justify-content: flex-start; }
    
    h3 { margin-bottom: 1rem; }
    h4 { margin-bottom: 0.5rem; }
    
    .chips { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 0.6rem 0 1rem; }
    .chip { 
      background: var(--info-bg); 
      border-radius: 999px; 
      padding: 0.35rem 0.8rem; 
      color: var(--info-text); 
      font-weight: 500;
      font-size: 0.9rem;
    }
    
    .info-grid { 
      display: grid; 
      gap: 0.8rem; 
      background: var(--bg-alt);
      padding: 1.25rem;
      border-radius: 16px;
      border: 1px solid var(--border);
    }
    .info-grid p { margin: 0; }
    
    .list { display: grid; gap: 0.8rem; margin-top: 1rem; }
    .list.compact .list-item { 
      padding: 1rem; 
      border-radius: 16px; 
      background: var(--bg-alt);
    }

    .app-grid { 
      display: grid; 
      gap: 1rem; 
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); 
      margin-top: 1rem; 
    }
    .app-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      border-radius: 18px; 
      padding: 1.25rem;
      border: 1px solid var(--border);
    }
    .app-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem; }
    
    .app-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: auto; border-top: 1px solid var(--border); padding-top: 1rem; }
    .app-actions button { padding: 0.4rem 0.8rem; font-size: 0.85rem; min-height: auto; }
    
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
    
    .app-filters { display: flex; gap: 0.5rem; align-items: center; }
    .filter-select { 
      padding: 0.4rem 0.8rem; 
      border-radius: 12px; 
      border: 1px solid var(--border);
      background: var(--card);
      font-size: 0.85rem;
      cursor: pointer;
    }
    
    .file-input { 
      padding: 0.5rem; 
      background: var(--input-bg); 
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 10px;
    }
    .file-input::file-selector-button {
      background: var(--secondary-btn-bg);
      color: var(--secondary-btn-text);
      border: 1px solid var(--border);
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
      margin-right: 0.5rem;
    }
    .file-input::file-selector-button:hover {
      background: var(--secondary-btn-hover-bg);
      color: var(--secondary-btn-hover-text);
    }
    
    .muted { color: var(--muted); }
    .meta-line { color: var(--muted); font-size: 0.85rem; margin-top: 0.25rem; margin-bottom: 0; }
    .small { margin-top: 1rem; padding: 1rem; }
    .message { margin-top: 1rem; padding: 1rem; background: var(--info-bg); color: var(--info-text); border-radius: 12px; }
    
    .primary-badge {
      margin-left: 0.5rem;
      background: var(--primary-badge-bg);
      color: var(--primary-badge-text);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
    }

    /* Modal Styles */
    .modal-overlay { 
      position: fixed; 
      top: 0; left: 0; right: 0; bottom: 0; 
      background: rgba(0, 0, 0, 0.7); 
      display: flex; 
      align-items: center; justify-content: center; 
      z-index: 1000; padding: 2rem;
    }
    .modal-card { 
      max-width: 700px; width: 100%; max-height: 85vh; 
      overflow-y: auto; padding: 2rem; 
      background: var(--card); border-radius: 28px;
    }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .close-btn { 
      background: var(--danger-bg); border: none; border-radius: 8px; 
      padding: 0.4rem 1rem; cursor: pointer; font-size: 0.95rem; 
      font-weight: 500; color: var(--danger-text); transition: all 0.2s; 
    }
    .close-btn:hover { background: var(--danger-hover); }
    .modal-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); }
    .modal-section p { margin-bottom: 0.5rem; }
    .description-text { white-space: pre-wrap; color: var(--muted); }

    @media (max-width: 980px) {
      .profile-layout,
      .grid { grid-template-columns: 1fr; }
    }
  `],
})
export class ProfileComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);
  private readonly seekerData = inject(SeekerDataService);
  private readonly alertService = inject(AlertService);

  readonly isSeeker = this.auth.isSeeker;
  readonly editMode = signal(false);
  readonly message = signal('');

  readonly skills = signal<SeekerSkill[]>([]);
  readonly resumes = this.seekerData.resumes;
  
  readonly profileExists = signal(false);
  readonly isSubmitting = signal(false);

  readonly seeker = {
    first_name: '',
    last_name: '',
    phone: '',
    current_title: '',
    summary: '',
    github_url: '',
    linkedin_url: '',
  };

  readonly recruiter = {
    company_name: '',
    company_size: '',
    industry: '',
    hq_location: '',
    website_url: '',
  };

  readonly skill = {
    skill_name: '',
    years_of_experience: 1,
  };

  resumeTitle = '';
  private selectedResumeFile: File | null = null;

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) return;
    if (this.isSeeker()) {
      this.loadSeeker();
      this.loadSkills();
      this.seekerData.loadResumes();
      this.seekerData.loadApplications();
    } else {
      this.loadRecruiter();
    }
  }

  protected loadSeeker(): void {
    this.api.get(`${this.api.profileBase}/seeker/`, true).subscribe({
      next: (response) => {
        Object.assign(this.seeker, response as object);
        this.profileExists.set(true);
      },
      error: (error) => {
        this.profileExists.set(false);
        this.message.set(extractErrorMessage(error));
      },
    });
  }

  protected saveSeeker(): void {
    this.isSubmitting.set(true);
    this.message.set('');

    const request$ = this.profileExists()
      ? this.api.patch(`${this.api.profileBase}/seeker/`, this.seeker, true)
      : this.api.post(`${this.api.profileBase}/seeker/`, this.seeker, true);

    request$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.profileExists.set(true);
        this.alertService.toast('Profile saved successfully.');
        this.message.set('Seeker profile saved.');
        this.editMode.set(false);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Save Failed');
      },
    });
  }

  protected loadRecruiter(): void {
    this.api.get(`${this.api.profileBase}/recruiter/`, true).subscribe({
      next: (response) => {
        Object.assign(this.recruiter, response as object);
        this.profileExists.set(true);
      },
      error: (error) => {
        this.profileExists.set(false);
        this.message.set(extractErrorMessage(error));
      },
    });
  }

  protected saveRecruiter(): void {
    this.isSubmitting.set(true);
    this.message.set('');

    const request$ = this.profileExists()
      ? this.api.patch(`${this.api.profileBase}/recruiter/`, this.recruiter, true)
      : this.api.post(`${this.api.profileBase}/recruiter/`, this.recruiter, true);

    request$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.profileExists.set(true);
        this.alertService.toast('Profile saved successfully.');
        this.message.set('Recruiter profile saved.');
        this.editMode.set(false);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Save Failed');
      },
    });
  }

  protected loadSkills(): void {
    this.api.get<SeekerSkill[]>(`${this.api.profileBase}/seeker/skills/`, true).subscribe({
      next: (res) => this.skills.set(res),
      error: () => undefined,
    });
  }

  protected addSkill(): void {
    if (!this.skill.skill_name.trim()) {
      this.message.set('Enter a skill name first.');
      this.alertService.warning('Skill name cannot be empty.');
      return;
    }
    
    this.isSubmitting.set(true);
    this.api.post(`${this.api.profileBase}/seeker/skills/`, this.skill, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.toast('Skill added successfully.');
        this.message.set('Skill saved.');
        this.skill.skill_name = '';
        this.skill.years_of_experience = 1;
        this.loadSkills();
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Failed to Add Skill');
      },
    });
  }

  protected onResumeSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedResumeFile = target.files?.[0] ?? null;
  }

  protected uploadResume(): void {
    if (!this.selectedResumeFile) {
      this.message.set('Select a resume PDF first.');
      this.alertService.warning('Please select a PDF file first.');
      return;
    }
    const form = new FormData();
    form.append('resume', this.selectedResumeFile);
    form.append('resume_title', this.resumeTitle || this.selectedResumeFile.name);

    this.isSubmitting.set(true);
    this.api.postForm(`${this.api.profileBase}/seeker/resumes/`, form, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.success('Resume uploaded successfully and parsing has started.', 'Uploaded');
        this.message.set('Resume uploaded successfully. It is currently being processed.');
        this.resumeTitle = '';
        this.selectedResumeFile = null;
        this.seekerData.loadResumes(true);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Upload Failed');
      },
    });
  }

  protected async deleteResume(resumeId: string): Promise<void> {
    const confirmed = await this.alertService.confirm('Are you sure you want to delete this resume?');
    if (!confirmed) return;

    this.isSubmitting.set(true);
    this.api.delete(`${this.api.profileBase}/seeker/resumes/${resumeId}/`, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.toast('Resume deleted successfully.');
        this.message.set('Resume deleted successfully.');
        this.seekerData.loadResumes(true);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Delete Failed');
      },
    });
  }

  protected makePrimary(resumeId: string): void {
    this.isSubmitting.set(true);
    this.api.patch(`${this.api.profileBase}/seeker/resumes/${resumeId}/`, { is_primary: true }, true).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.alertService.toast('Primary resume updated.');
        this.message.set('Primary resume updated successfully.');
        this.seekerData.loadResumes(true);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const errMsg = extractErrorMessage(error);
        this.message.set(errMsg);
        this.alertService.error(errMsg, 'Update Failed');
      },
    });
  }
  
}
