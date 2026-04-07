import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthStateService } from '../core/auth-state.service';

interface MatchResponse<T> {
  results: T[];
}

interface JobMatch {
  job_id: string;
  similarity_score: number;
}

interface SeekerMatch {
  seeker_id: string;
  resume_id: string;
  similarity_score: number;
}

@Component({
  selector: 'app-matches-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">Matching service</p>
          <h1>AI match explorer</h1>
        </div>
      </div>

      @if (auth.role() === 'seeker') {
        <p class="hint">As seeker, fetch top jobs for your account id.</p>
        <button type="button" (click)="loadJobsForSeeker()">Find jobs for me</button>

        @if (jobResults().length) {
          <div class="list">
            @for (item of jobResults(); track item.job_id) {
              <article class="item">
                <h2>{{ item.job_id }}</h2>
                <p>Similarity: {{ item.similarity_score }}</p>
              </article>
            }
          </div>
        }
      } @else {
        <label>
          <span>Job ID</span>
          <input [(ngModel)]="jobId" type="text" placeholder="Paste a job UUID" />
        </label>
        <button type="button" (click)="loadSeekersForJob()">Find matching seekers</button>

        @if (seekerResults().length) {
          <div class="list">
            @for (item of seekerResults(); track item.resume_id) {
              <article class="item">
                <h2>{{ item.seeker_id }}</h2>
                <p>Resume: {{ item.resume_id }}</p>
                <p>Similarity: {{ item.similarity_score }}</p>
              </article>
            }
          </div>
        }
      }

      @if (error()) {
        <div class="empty-card error">{{ error() }}</div>
      }
    </section>
  `,
  styles: [`
    .page-card,
    .empty-card,
    .item {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
    }
    .page-card { display: grid; gap: 1rem; padding: 1.5rem; }
    .list { display: grid; gap: 1rem; }
    .item { padding: 1rem 1.2rem; }
    .hint { color: var(--muted); }
    .error { color: #ffb8aa; }
  `],
})
export class MatchesComponent {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);

  readonly jobResults = signal<JobMatch[]>([]);
  readonly seekerResults = signal<SeekerMatch[]>([]);
  readonly error = signal('');

  jobId = '';

  protected loadJobsForSeeker(): void {
    this.error.set('');
    const seekerId = this.auth.userId();
    this.api.get<MatchResponse<JobMatch>>(`${this.api.matchBase}/jobs-for-seeker/${seekerId}/`, true).subscribe({
      next: (res) => this.jobResults.set(res.results ?? []),
      error: () => this.error.set('Unable to fetch seeker matches from matching service.'),
    });
  }

  protected loadSeekersForJob(): void {
    this.error.set('');
    if (!this.jobId.trim()) {
      this.error.set('Job ID is required.');
      return;
    }
    this.api.get<MatchResponse<SeekerMatch>>(`${this.api.matchBase}/seekers-for-job/${this.jobId.trim()}/`, true).subscribe({
      next: (res) => this.seekerResults.set(res.results ?? []),
      error: () => this.error.set('Unable to fetch job matches from matching service.'),
    });
  }
}
