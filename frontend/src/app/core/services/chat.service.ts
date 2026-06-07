import { Injectable, inject, signal, effect } from '@angular/core';
import { ApiService } from './api.service';
import { AuthStateService } from './auth-state.service';
import { Observable, catchError, forkJoin, map, of, Subscription, interval } from 'rxjs';
import { Conversation, Message } from '../models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStateService);

  readonly hasUnread = signal<boolean>(false);
  private pollSub?: Subscription;

  constructor() {
    // Start/stop background polling when logged-in state changes
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.startPollingUnread();
      } else {
        this.stopPollingUnread();
        this.hasUnread.set(false);
      }
    });
  }

  private startPollingUnread(): void {
    this.stopPollingUnread();
    this.checkUnreadStatus();
    this.pollSub = interval(8000).subscribe(() => {
      this.checkUnreadStatus();
    });
  }

  private stopPollingUnread(): void {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = undefined;
    }
  }

  checkUnreadStatus(): void {
    if (!this.auth.isLoggedIn()) {
      this.hasUnread.set(false);
      return;
    }
    this.getConversations().subscribe({
      next: (conversations) => {
        const saved = localStorage.getItem('job-buddy-chats-seen');
        let lastSeen: Record<string, string> = {};
        if (saved) {
          try {
            lastSeen = JSON.parse(saved);
          } catch {}
        }
        const myId = this.auth.userId();
        const anyUnread = conversations.some((conv) => {
          const last = conv.last_message;
          if (!last) return false;
          if (String(last.sender_id) === String(myId)) return false;
          return lastSeen[conv.id] !== last.id;
        });
        this.hasUnread.set(anyUnread);
      },
      error: () => {
        // Silently ignore errors during auto-poll
      }
    });
  }

  getConversations(): Observable<Conversation[]> {
    return this.api.get<Conversation[]>(`${this.api.chatBase}/conversations/`, true);
  }

  getOrCreateConversation(otherUserId: string, jobId?: string, jobTitle?: string): Observable<Conversation> {
    const payload: any = { other_user_id: otherUserId };
    if (jobId) payload.job_id = jobId;
    if (jobTitle) payload.job_title = jobTitle;
    return this.api.post<Conversation>(`${this.api.chatBase}/conversations/`, payload, true);
  }

  getMessages(conversationId: string): Observable<Message[]> {
    return this.api.get<Message[]>(`${this.api.chatBase}/conversations/${conversationId}/messages/`, true);
  }

  sendMessage(conversationId: string, body: string): Observable<Message> {
    return this.api.post<Message>(`${this.api.chatBase}/conversations/${conversationId}/messages/`, { body }, true);
  }

  // Helper lookups for profile resolution
  getSeekerProfile(seekerId: string): Observable<any> {
    return this.api.get<any>(`${this.api.profileBase}/seeker/${seekerId}/`, true).pipe(
      catchError(() => of(null))
    );
  }

  getRecruiterProfile(recruiterId: string): Observable<any> {
    return this.api.get<any>(`${this.api.profileBase}/recruiter/${recruiterId}/`, true).pipe(
      catchError(() => of(null))
    );
  }

  getApplicationsForSeeker(seekerId: string): Observable<any[]> {
    return this.api.get<any[]>(`${this.api.applicationsBase}/seeker/${seekerId}/`, true).pipe(
      catchError(() => of([]))
    );
  }

  getSeekerApplications(): Observable<any[]> {
    return this.api.get<any[]>(`${this.api.applicationsBase}/my/`, true).pipe(
      catchError(() => of([]))
    );
  }
}
