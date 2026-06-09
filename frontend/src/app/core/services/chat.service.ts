import { Injectable, inject, signal, effect } from '@angular/core';
import { ApiService } from './api.service';
import { AuthStateService } from './auth-state.service';
import { Observable, catchError, forkJoin, map, of, Subscription, Subject } from 'rxjs';
import { Conversation, Message } from '../models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStateService);

  readonly hasUnread = signal<boolean>(false);
  
  readonly messageReceived$ = new Subject<{ message: Message; conversation_id: string }>();
  readonly conversationReceived$ = new Subject<Conversation>();

  private ws?: WebSocket;
  private reconnectTimeout?: any;
  private isConnecting = false;

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.connectWebSocket();
        this.checkUnreadStatus();
      } else {
        this.disconnectWebSocket();
        this.hasUnread.set(false);
      }
    });
  }

  private connectWebSocket(): void {
    if (this.ws || this.isConnecting) return;
    const token = this.auth.accessToken();
    if (!token) return;

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Direct WebSocket connection to Nginx on port 80 in development
    // to bypass dev server proxy limitations.
    const port = window.location.port === '4200' || window.location.port === '4201' ? '80' : window.location.port;
    const host = window.location.hostname + (port ? ':' + port : '');
    const wsUrl = `${protocol}//${host}/api/chat/ws/?token=${token}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnecting = false;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = undefined;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          this.messageReceived$.next({
            message: data.message,
            conversation_id: data.conversation_id
          });
          this.checkUnreadStatus();
        } else if (data.type === 'conversation') {
          this.conversationReceived$.next(data.conversation);
          this.checkUnreadStatus();
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    this.ws.onclose = () => {
      this.isConnecting = false;
      this.ws = undefined;
      if (this.auth.isLoggedIn()) {
        this.reconnectTimeout = setTimeout(() => this.connectWebSocket(), 3000);
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      if (this.ws) {
        this.ws.close();
      }
    };
  }

  private disconnectWebSocket(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.isConnecting = false;
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
