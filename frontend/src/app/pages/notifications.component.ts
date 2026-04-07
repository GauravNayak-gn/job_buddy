import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-card">
      <div class="page-head">
        <div>
          <p class="eyebrow">Notification service</p>
          <h1>Inbox</h1>
        </div>
        <button type="button" class="secondary" (click)="markAllRead()">Mark all read</button>
      </div>

      @if (loading()) {
        <div class="empty-card">Loading notifications...</div>
      } @else if (error()) {
        <div class="empty-card error">{{ error() }}</div>
      } @else if (!items().length) {
        <div class="empty-card">No notifications yet.</div>
      } @else {
        <div class="list">
          @for (item of items(); track item.id) {
            <article class="item" [class.unread]="!item.is_read">
              <div class="row">
                <div>
                  <h2>{{ item.title }}</h2>
                  <p class="meta">{{ item.notification_type }} . {{ item.created_at | date: 'medium' }}</p>
                </div>
                @if (!item.is_read) {
                  <button type="button" class="secondary" (click)="markRead(item.id)">Mark read</button>
                }
              </div>
              <p>{{ item.body }}</p>
            </article>
          }
        </div>
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
    .page-head,
    .row { display: flex; justify-content: space-between; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .list { display: grid; gap: 1rem; }
    .item { padding: 1rem 1.2rem; display: grid; gap: 0.6rem; }
    .item.unread { border-color: rgba(217, 93, 57, 0.35); }
    .meta { color: var(--muted); font-size: 0.9rem; }
    .error { color: #ffb8aa; }
  `],
})
export class NotificationsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly items = signal<NotificationItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.get<NotificationItem[]>(`${this.api.notificationsBase}/`, true).subscribe({
      next: (res) => {
        this.items.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Notification service is unavailable on port 8006.');
        this.loading.set(false);
      },
    });
  }

  protected markRead(id: string): void {
    this.api.post(`${this.api.notificationsBase}/${id}/mark-read/`, {}, true).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Failed to mark notification as read.'),
    });
  }

  protected markAllRead(): void {
    this.api.post(`${this.api.notificationsBase}/mark-all-read/`, {}, true).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Failed to mark all notifications as read.'),
    });
  }
}
