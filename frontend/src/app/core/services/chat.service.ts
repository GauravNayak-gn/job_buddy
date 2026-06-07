import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { Conversation, Message } from '../models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiService);

  getConversations(): Observable<Conversation[]> {
    return this.api.get<Conversation[]>(`${this.api.chatBase}/conversations/`, true);
  }

  getOrCreateConversation(otherUserId: string): Observable<Conversation> {
    return this.api.post<Conversation>(`${this.api.chatBase}/conversations/`, { other_user_id: otherUserId }, true);
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
