import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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

interface JobSummary {
  id: string;
  title: string;
}

interface JobMatchView {
  job_id: string;
  title: string;
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

      @if (isSeeker()) {
        <p class="hint">Shows top matched jobs for your seeker account.</p>
        <button type="button" (click)="loadJobsForSeeker()">Find jobs for me</button>

        @if (jobResults().length) {
          <div class="list">
            @for (item of jobResults(); track item.job_id) {
              <article class="item">
                <h2>{{ item.title }}</h2>
                <p class="muted">Job ID: {{ item.job_id }}</p>
                <p>Match score: {{ item.similarity_score }}</p>
              </article>
            }
          </div>
        }
      } @else {
        <label>
          <span>Select job</span>
          <select [(ngModel)]="jobId">
            <option value="">Select job</option>
            @for (job of recruiterJobs(); track job.id) {
              <option [value]="job.id">{{ job.title }} ({{ job.id }})</option>
            }
          </select>
        </label>
        <button type="button" (click)="loadSeekersForJob()">Find matching seekers</button>

        @if (seekerResults().length) {
          <div class="list">
            @for (item of seekerResults(); track item.resume_id) {
              <article class="item">
                <h2>{{ item.seeker_id }}</h2>
                <p>Resume: {{ item.resume_id }}</p>
                <p>Match score: {{ item.similarity_score }}</p>
              </article>
            }
          </div>
        }
      }

      @if (message()) {
        <div class="empty-card">{{ message() }}</div>
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
    .hint,
    .muted { color: var(--muted); }
    .error { color: #ffb8aa; }
  `],
})
export class MatchesComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthStateService);

  readonly isSeeker = computed(() => this.auth.role() === 'seeker');
  readonly recruiterJobs = signal<JobSummary[]>([]);

  readonly jobResults = signal<JobMatchView[]>([]);
  readonly seekerResults = signal<SeekerMatch[]>([]);
  readonly error = signal('');
  readonly message = signal('');

  jobId = '';

  ngOnInit(): void {
    if (!this.isSeeker() && this.auth.isLoggedIn()) {
      this.api.get<JobSummary[]>(`${this.api.jobsBase}/my/`, true).subscribe({
        next: (jobs) => this.recruiterJobs.set(jobs),
      });
    }
  }

  protected loadJobsForSeeker(): void {
    this.error.set('');
    this.message.set('');
    const seekerId = this.auth.userId();

    this.api.get<MatchResponse<JobMatch>>(`${this.api.matchBase}/jobs-for-seeker/${seekerId}/`, true).subscribe({
      next: (res) => {
        const results = res.results ?? [];
        if (!results.length) {
          this.jobResults.set([]);
          this.message.set('No matches yet. Upload resume and ensure a recruiter published jobs.');
          return;
        }

        const detailCalls = results.map((item) =>
          this.api.get<{ title: string }>(`${this.api.jobsBase}/${item.job_id}/`).pipe(
            map((job) => ({ job_id: item.job_id, title: job.title || item.job_id, similarity_score: item.similarity_score })),
            catchError(() => of({ job_id: item.job_id, title: item.job_id, similarity_score: item.similarity_score })),
          ),
        );

        forkJoin(detailCalls).subscribe({
          next: (rows) => this.jobResults.set(rows),
          error: () => this.error.set('Unable to resolve job details for match results.'),
        });
      },
      error: () => this.error.set('Unable to fetch seeker matches from matching service.'),
    });
  }

  protected loadSeekersForJob(): void {
    this.error.set('');
    this.message.set('');
    if (!this.jobId.trim()) {
      this.error.set('Select a job first.');
      return;
    }
    this.api.get<MatchResponse<SeekerMatch>>(`${this.api.matchBase}/seekers-for-job/${this.jobId.trim()}/`, true).subscribe({
      next: (res) => {
        this.seekerResults.set(res.results ?? []);
        if (!res.results?.length) {
          this.message.set('No seeker matches yet for this job.');
        }
      },
      error: () => this.error.set('Unable to fetch job matches from matching service.'),
    });
  }
}
