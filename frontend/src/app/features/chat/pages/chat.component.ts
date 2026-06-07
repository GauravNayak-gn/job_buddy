import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { AuthStateService } from '../../../core/services/auth-state.service';
import { ChatService } from '../../../core/services/chat.service';
import { AlertService } from '../../../core/services/alert.service';
import { ApiService } from '../../../core/services/api.service';
import { Conversation, Message, Job, InterviewResponse } from '../../../core/models';
import { extractErrorMessage } from '../../../shared/utils/error-message.util';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="chat-container">
      <!-- Left Panel: Conversations List -->
      <aside class="conversations-sidebar" [class.mobile-hidden]="mobileShowThread()">
        <div class="sidebar-header">
          <h2>Conversations</h2>
          <button type="button" class="refresh-action-btn" (click)="loadConversations()" aria-label="Refresh Chats">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="icon-refresh" [class.spinning]="loadingConversations()">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        <div class="sidebar-search-container">
          <div class="search-input-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="icon-search">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" />
            </svg>
            <input 
              class="sidebar-search" 
              placeholder="Search conversations..." 
              [(ngModel)]="searchQuery"
              type="search"
            />
          </div>
        </div>

        <div class="conversations-list">
          @if (loadingConversations()) {
            @for (i of [1, 2, 3]; track i) {
              <div class="skeleton-card">
                <div class="skeleton-avatar"></div>
                <div class="skeleton-info">
                  <div class="skeleton-line short"></div>
                  <div class="skeleton-line long"></div>
                </div>
              </div>
            }
          } @else if (filteredConversations().length === 0) {
            <div class="list-placeholder empty">
              <div class="placeholder-icon-small">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 20.25c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 9h.01M9 9h.01M9 15h6" />
                </svg>
              </div>
              <p>{{ searchQuery.trim() ? 'No matches found.' : 'No past conversations found.' }}</p>
            </div>
          } @else {
            @for (conv of filteredConversations(); track conv.id) {
              <div 
                class="conversation-card" 
                [class.active]="selectedConversation()?.id === conv.id"
                (click)="selectConversation(conv)"
              >
                <!-- Avatar with Initials -->
                <div class="avatar" [style.background-color]="getAvatarColor(conv.id)">
                  {{ getInitials(conv) }}
                </div>
                
                <div class="card-details">
                  <div class="card-row">
                    <span class="user-name" [class.unread-name]="hasUnreadMessages(conv)">{{ getDisplayName(conv) }}</span>
                    <span class="time-label">{{ getRelativeTime(conv.last_message?.created_at || conv.updated_at) }}</span>
                  </div>
                  @if (conv.job_title) {
                    <div class="job-tag">{{ conv.job_title }}</div>
                  }
                  <div class="card-row">
                    <span class="last-msg-preview" [class.unread]="hasUnreadMessages(conv)">
                      {{ conv.last_message?.body || getDisplaySubtitle(conv) }}
                    </span>
                    @if (hasUnreadMessages(conv)) {
                      <span class="unread-dot" title="Unread message"></span>
                    }
                  </div>
                </div>
              </div>
            }
          }
        </div>
      </aside>

      <!-- Right Panel: Conversation Thread -->
      <main class="chat-thread" [class.mobile-hidden]="!mobileShowThread()">
        @if (!selectedConversation()) {
          <div class="thread-placeholder">
            <div class="placeholder-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.25" stroke="currentColor" class="placeholder-svg">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <h3>Your Messages</h3>
            <p>Select a contact from the sidebar or start a chat from the job applicants list to begin messaging.</p>
          </div>
        } @else {
          <!-- Active Conversation Header -->
          <header class="thread-header">
            <button type="button" class="back-to-sidebar-btn" (click)="mobileShowThread.set(false)" aria-label="Back to Sidebar">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="icon-back">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              <span>Back</span>
            </button>

            <div class="header-avatar-container">
              <div class="avatar header-avatar" [style.background-color]="getAvatarColor(selectedConversation()?.id || '')">
                {{ getInitials(selectedConversation()!) }}
              </div>
              <span class="online-dot"></span>
            </div>
            
            <div class="header-info">
              <h3>{{ getDisplayName(selectedConversation()!) }}</h3>
              @if (selectedConversation()?.job_title) {
                <span class="header-job-tag">{{ selectedConversation()?.job_title }}</span>
              } @else {
                <p class="subtitle">{{ getDisplaySubtitle(selectedConversation()!) }}</p>
              }
            </div>

            <!-- Header Action Controls -->
            <div class="header-actions">
              <!-- Scheduler Button (Recruiters only) -->
              @if (auth.isRecruiter()) {
                <button type="button" class="schedule-trigger-btn" (click)="openSchedulerModal()" title="Schedule Video Interview">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="icon-btn-calendar">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <span>Schedule</span>
                </button>
              }

              <!-- Kebab Menu Dropdown Trigger -->
              <div class="kebab-container" (click)="$event.stopPropagation()">
                <button type="button" class="kebab-btn" [class.rotated]="showKebabMenu()" (click)="toggleKebabMenu()" aria-label="More Options">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="icon-kebab">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                  </svg>
                </button>
                
                @if (showKebabMenu()) {
                  <div class="kebab-dropdown">
                    <!-- Profile View Option -->
                    <button type="button" class="kebab-item" (click)="viewOtherUserProfile()">
                      @if (auth.isRecruiter()) {
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="icon-menu">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        View Seeker Profile
                      } @else {
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="icon-menu">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 16.5h.75m3 0h.75m3 0h.75M16.5 16.5h.75m-3-9.75h.75m-.75 3h.75m-.75 3h.75" />
                        </svg>
                        View Company Profile
                      }
                    </button>
                    
                    <!-- Job details Option -->
                    @if (activeApplication()) {
                      <button type="button" class="kebab-item" (click)="viewJobSpecification()">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="icon-menu">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 .596-.465 1.077-1.053 1.11C15.822 19.742 12.3 20.25 12 20.25s-3.822-.508-7.197-.74c-.588-.033-1.053-.514-1.053-1.11v-4.25m16.5 0a9.003 9.003 0 00-16.5 0m16.5 0L19.5 9.75A1.875 1.875 0 0017.625 7.875h-11.25A1.875 1.875 0 004.5 9.75L3.75 14.15M15 9.75V5.625c0-.621-.504-1.125-1.125-1.125h-3.75c-.621 0-1.125.504-1.125 1.125V9.75" />
                        </svg>
                        View Job Details
                      </button>
                    }
                    
                    <!-- Resume View Option -->
                    @if (activeApplication()?.resume_id) {
                      <button type="button" class="kebab-item" (click)="downloadResume()">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="icon-menu">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        View Resume File
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          </header>

          <!-- Messages History Container -->
          <div class="messages-history" #messagesContainer (scroll)="onMessagesScroll($event)">
            @if (loadingMessages() && messages().length === 0) {
              <div class="loading-messages">Loading message history...</div>
            } @else {
              @for (msg of messages(); track msg.id; let idx = $index) {
                @if (getDateDividerText(msg, idx > 0 ? messages()[idx - 1] : null); as dividerText) {
                  <div class="date-divider">
                    <span>{{ dividerText }}</span>
                  </div>
                }

                <div class="message-row" [class.outgoing]="isMyMessage(msg)">
                  <div class="message-bubble">
                    <p class="message-text">{{ msg.body }}</p>
                    
                    <!-- Meeting link parsed card -->
                    @if (detectJitsiLink(msg.body); as jitsiUrl) {
                      <div class="meeting-card">
                        <div class="meeting-badge">
                          <svg class="badge-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                          <span>Jitsi Meet</span>
                        </div>
                        <div class="meeting-card-content">
                          <div class="meeting-icon-container">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="icon-video">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          </div>
                          <div class="meeting-details">
                            <strong>Video Interview Scheduled</strong>
                            <span>Join directly on Jitsi Meet.</span>
                          </div>
                        </div>
                        <div class="meeting-actions">
                          <a [href]="jitsiUrl" target="_blank" rel="noreferrer" class="join-btn">
                            Join Meeting
                          </a>
                        </div>
                      </div>
                    }

                    <span class="message-time">{{ msg.created_at | date: 'shortTime' }}</span>
                  </div>
                </div>
              }

              <!-- Ghost Bubble -->
              @if (sendingMessage() && sendingMessageText) {
                <div class="message-row outgoing ghost-message">
                  <div class="message-bubble">
                    <p class="message-text">{{ sendingMessageText }}</p>
                    <span class="message-time">Sending...</span>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Scroll-to-bottom FAB -->
          @if (showScrollFab()) {
            <button type="button" class="scroll-fab" (click)="onScrollToBottomClick()" aria-label="Scroll to bottom">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="icon-fab-down">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          }

          <!-- Message Input Controls -->
          <form class="message-input-area" (keydown)="onKeydown($event)">
            <div class="input-wrapper">
              <textarea 
                name="newMessage"
                [(ngModel)]="newMessageText" 
                placeholder="Type your message here..." 
                autocomplete="off"
                required
                rows="1"
                #messageInput
                (input)="adjustHeight($event.target)"
              ></textarea>
              @if (newMessageText.trim().length >= 100) {
                <span class="char-count">{{ newMessageText.trim().length }} chars</span>
              }
            </div>
            <button type="button" class="send-action-btn" [disabled]="!newMessageText.trim()" (click)="sendChatMessage()" aria-label="Send Message">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor" class="icon-send">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        }
      </main>
    </section>

    <!-- Modals Section -->

    <!-- Recruiter Details Modal -->
    @if (showingRecruiterModal() && resolvedRecruiterProfile; as rProf) {
      <div class="modal-overlay" (click)="showingRecruiterModal.set(false)">
        <article class="modal-card" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h2>{{ rProf.company_name }}</h2>
            <button type="button" class="close-btn" (click)="showingRecruiterModal.set(false)">&times;</button>
          </header>
          <div class="modal-body">
            <p><strong>Industry:</strong> {{ rProf.industry || 'Not specified' }}</p>
            <p><strong>HQ Location:</strong> {{ rProf.hq_location || 'Not provided' }}</p>
            <p><strong>Company Size:</strong> {{ rProf.company_size || 'Not provided' }}</p>
            @if (rProf.website_url) {
              <p><strong>Website:</strong> <a [href]="rProf.website_url" target="_blank" rel="noreferrer">{{ rProf.website_url }}</a></p>
            }
          </div>
        </article>
      </div>
    }

    <!-- Seeker Profile Modal -->
    @if (showingSeekerModal() && resolvedSeekerProfile; as sProf) {
      <div class="modal-overlay" (click)="showingSeekerModal.set(false)">
        <article class="modal-card" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h2>{{ sProf.first_name }} {{ sProf.last_name }}</h2>
            <button type="button" class="close-btn" (click)="showingSeekerModal.set(false)">&times;</button>
          </header>
          <div class="modal-body">
            <p><strong>Current Title:</strong> {{ sProf.current_title || 'Not specified' }}</p>
            <p><strong>Phone:</strong> {{ sProf.phone || 'Not provided' }}</p>
            @if (sProf.github_url) {
              <p><strong>GitHub:</strong> <a [href]="sProf.github_url" target="_blank" rel="noreferrer">{{ sProf.github_url }}</a></p>
            }
            @if (sProf.linkedin_url) {
              <p><strong>LinkedIn:</strong> <a [href]="sProf.linkedin_url" target="_blank" rel="noreferrer">{{ sProf.linkedin_url }}</a></p>
            }
            <p><strong>Summary:</strong> {{ sProf.summary || 'No summary provided.' }}</p>

            <div class="modal-section-title">Skills</div>
            @if (!sProf.skills?.length) {
              <p class="muted-text">No skills listed.</p>
            } @else {
              <div class="chips-grid">
                @for (sk of sProf.skills; track sk.id) {
                  <span class="skill-chip">{{ sk.skill_name }} ({{ sk.years_of_experience }} years)</span>
                }
              </div>
            }
          </div>
        </article>
      </div>
    }

    <!-- Job Specification Modal -->
    @if (showingJobModal() && resolvedJobSpec; as job) {
      <div class="modal-overlay" (click)="showingJobModal.set(false)">
        <article class="modal-card" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <div>
              <span class="modal-eyebrow">Job Details</span>
              <h2>{{ job.title }}</h2>
            </div>
            <button type="button" class="close-btn" (click)="showingJobModal.set(false)">&times;</button>
          </header>
          <div class="modal-body">
            <div class="job-meta-grid">
              <div>
                <span class="meta-label">Location</span>
                <span class="meta-value">📍 {{ job.location_type }} · {{ job.location_city || 'Remote' }}</span>
              </div>
              <div>
                <span class="meta-label">Salary</span>
                <span class="meta-value">💰 {{ job.salary_min }} - {{ job.salary_max }}</span>
              </div>
              <div>
                <span class="meta-label">Experience</span>
                <span class="meta-value">💼 {{ job.experience_required || 'Not specified' }}</span>
              </div>
            </div>
            <div class="job-desc-section">
              <h3>Role Description</h3>
              <p class="desc-text">{{ job.description }}</p>
            </div>
          </div>
        </article>
      </div>
    }

    <!-- Recruiter Scheduler Modal -->
    @if (showingSchedulerModal()) {
      <div class="modal-overlay" (click)="showingSchedulerModal.set(false)">
        <article class="modal-card scheduler-modal-card" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h2>Schedule Interview</h2>
            <button type="button" class="close-btn" (click)="showingSchedulerModal.set(false)">&times;</button>
          </header>
          <div class="modal-body">
            @if (availableApplications().length === 0) {
              <p class="error-msg">No active applications found between you and this seeker. You cannot schedule an interview without a job application.</p>
            } @else {
              <div class="form-group">
                <label for="appSelect"><strong>Select Job Role</strong></label>
                <select id="appSelect" [(ngModel)]="schedulerSelectedAppId">
                  @for (app of availableApplications(); track app.id) {
                    <option [value]="app.id">{{ app.job_title || 'Role (ID: ' + app.job_id + ')' }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label for="schedTime"><strong>Interview Date & Time</strong></label>
                <input id="schedTime" type="datetime-local" [(ngModel)]="schedulerDateTime" [min]="minDateTime" />
              </div>

              @if (schedulerDateTime) {
                <div class="scheduler-preview">
                  <span class="preview-badge">Preview</span>
                  <p>Scheduled for: <strong>{{ schedulerDateTime | date: 'medium' }}</strong></p>
                </div>
              }

              <div class="form-group">
                <label for="schedNotes"><strong>Meeting Notes (Topics)</strong></label>
                <textarea id="schedNotes" rows="3" [(ngModel)]="schedulerNotes" placeholder="Enter interview topics or notes..."></textarea>
              </div>

              <button type="button" class="schedule-submit-btn" [disabled]="submittingScheduler()" (click)="submitSchedulerInterview()">
                {{ submittingScheduler() ? 'Generating link...' : 'Generate Jitsi Link & Send' }}
              </button>
            }
          </div>
        </article>
      </div>
    }
  `,
  styles: [`
    .chat-container {
      display: grid;
      grid-template-columns: 320px 1fr;
      height: calc(85vh - 60px);
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: var(--shadow);
      overflow: hidden;
      margin-top: 1rem;
      backdrop-filter: blur(12px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Responsive adjustments */
    @media (max-width: 1024px) and (min-width: 768px) {
      .chat-container {
        grid-template-columns: 260px 1fr;
      }
    }

    @media (max-width: 768px) {
      .chat-container {
        grid-template-columns: 1fr;
      }
      .conversations-sidebar.mobile-hidden {
        display: none !important;
      }
      .chat-thread.mobile-hidden {
        display: none !important;
      }
    }

    /* Sidebar list */
    .conversations-sidebar {
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      background: var(--bg-alt);
    }

    .sidebar-header {
      height: 70px;
      padding: 0 1.5rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-sizing: border-box;
    }

    .sidebar-header h2 {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text);
      margin: 0;
    }

    /* Sidebar Search Input Styling */
    .sidebar-search-container {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.02);
    }

    .search-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .icon-search {
      position: absolute;
      left: 12px;
      width: 16px;
      height: 16px;
      color: var(--muted);
      pointer-events: none;
    }

    .sidebar-search {
      width: 100%;
      height: 38px;
      padding: 0.5rem 0.75rem 0.5rem 2.25rem;
      font-size: 0.88rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--input-bg);
      color: var(--text);
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    .sidebar-search:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); /* Focus ring glow using --accent */
    }

    .refresh-action-btn {
      background: var(--secondary-btn-bg);
      border: 1px solid var(--border);
      color: var(--secondary-btn-text);
      cursor: pointer;
      min-height: auto;
      height: 34px;
      width: 34px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .refresh-action-btn:hover {
      background: var(--secondary-btn-hover-bg);
      color: var(--secondary-btn-hover-text);
    }

    .icon-refresh {
      width: 17px;
      height: 17px;
      transition: transform 0.3s ease;
    }

    .refresh-action-btn:hover .icon-refresh {
      transform: rotate(30deg);
    }

    .icon-refresh.spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .conversations-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      scrollbar-width: thin;
    }

    .conversations-list::-webkit-scrollbar {
      width: 4px;
    }
    .conversations-list::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 2px;
    }

    .list-placeholder {
      padding: 2rem;
      text-align: center;
      color: var(--muted);
      font-size: 0.9rem;
    }

    .list-placeholder.empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 3rem 1.5rem;
    }

    .placeholder-icon-small {
      width: 40px;
      height: 40px;
      color: var(--muted);
      opacity: 0.6;
    }

    /* Skeleton Loader Cards */
    .skeleton-card {
      display: flex;
      gap: 0.75rem;
      padding: 0.85rem;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.01);
      border: 1px solid var(--border);
    }

    .skeleton-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(90deg, var(--border) 25%, var(--bg-hover) 50%, var(--border) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      flex-shrink: 0;
    }

    .skeleton-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.4rem;
    }

    .skeleton-line {
      height: 12px;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--border) 25%, var(--bg-hover) 50%, var(--border) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    .skeleton-line.short {
      width: 40%;
    }

    .skeleton-line.long {
      width: 80%;
    }

    @keyframes shimmer {
      from { background-position: -200% 0; }
      to { background-position: 200% 0; }
    }

    /* Conversation Card */
    .conversation-card {
      display: flex;
      gap: 0.75rem;
      padding: 0.85rem;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid transparent;
      border-left: 4px solid transparent;
      background: var(--card);
    }

    .conversation-card:hover {
      background: var(--bg-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow);
    }

    .conversation-card:hover .avatar {
      transform: scale(1.05);
    }

    .conversation-card.active {
      background: var(--bg-hover);
      border-color: var(--border);
      border-left: 4px solid var(--accent);
      border-top-left-radius: 4px;
      border-bottom-left-radius: 4px;
    }

    /* Avatars */
    .avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-weight: 700;
      font-size: 0.95rem;
      flex-shrink: 0;
      text-shadow: 0 1px 2px rgba(0,0,0,0.15);
      transition: transform 0.2s ease;
    }

    .header-avatar-container {
      position: relative;
      display: inline-block;
    }

    .header-avatar {
      width: 48px;
      height: 48px;
      font-size: 1.1rem;
    }

    .online-dot {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #10b981;
      border: 2px solid var(--bg-panel);
    }

    .card-details {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.2rem;
    }

    .card-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }

    .user-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-name.unread-name {
      font-weight: 700;
      color: var(--text);
    }

    .time-label {
      font-size: 0.72rem;
      color: var(--muted);
      flex-shrink: 0;
    }

    .job-tag {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--accent);
      background: rgba(37, 99, 235, 0.1);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      width: fit-content;
      margin-top: 0.1rem;
      margin-bottom: 0.1rem;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .header-job-tag {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--accent);
      background: rgba(37, 99, 235, 0.1);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      width: fit-content;
      margin-top: 0.2rem;
      display: inline-block;
    }

    .subtitle {
      font-size: 0.78rem;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      margin: 0;
    }

    .last-msg-preview {
      font-size: 0.78rem;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
    }

    .last-msg-preview.unread {
      color: var(--text);
      font-weight: 700;
    }

    .unread-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      display: inline-block;
      position: relative;
      flex-shrink: 0;
    }

    .unread-dot::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: var(--accent);
      animation: unreadPulse 2s infinite ease-in-out;
    }

    @keyframes unreadPulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      100% {
        transform: scale(2.5);
        opacity: 0;
      }
    }

    /* Chat thread section */
    .chat-thread {
      display: flex;
      flex-direction: column;
      background: var(--bg-panel);
      height: 100%;
      overflow: hidden;
      position: relative;
      animation: threadSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes threadSlideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .thread-placeholder {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 3rem;
      text-align: center;
      color: var(--muted);
      background: radial-gradient(circle at center, rgba(255, 255, 255, 0.02) 0%, transparent 70%);
    }

    .placeholder-icon {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: var(--bg-alt);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.5rem;
      color: var(--accent);
      box-shadow: var(--shadow);
    }

    .placeholder-svg {
      width: 44px;
      height: 44px;
    }

    .thread-placeholder h3 {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 0.75rem;
    }

    .thread-placeholder p {
      font-size: 0.95rem;
      max-width: 440px;
      line-height: 1.6;
      color: var(--muted);
    }

    .thread-header {
      height: 70px;
      padding: 0 1.5rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--card);
      flex-shrink: 0;
      box-sizing: border-box;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      z-index: 10;
    }

    .back-to-sidebar-btn {
      display: none; /* Desktop/Tablet default */
      background: none;
      border: none;
      color: var(--text);
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem 0.25rem 0;
      transition: color 0.2s ease;
    }

    @media (max-width: 768px) {
      .back-to-sidebar-btn {
        display: flex; /* Visible on mobile */
      }
    }

    .icon-back {
      width: 18px;
      height: 18px;
    }

    .header-info {
      flex: 1;
      min-width: 0;
    }

    .header-info h3 {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text);
      margin: 0;
    }

    .header-info .subtitle {
      font-size: 0.78rem;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .schedule-trigger-btn {
      background: var(--accent);
      color: #ffffff;
      font-size: 0.82rem;
      font-weight: 600;
      padding: 0.5rem 1rem;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      min-height: auto;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .schedule-trigger-btn:hover {
      background: var(--accent-hover);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      transform: translateY(-1px);
    }

    .icon-btn-calendar {
      width: 15px;
      height: 15px;
    }

    /* Kebab Dropdown */
    .kebab-container {
      position: relative;
    }

    .kebab-btn {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      padding: 0;
      min-height: auto;
    }

    .kebab-btn:hover {
      background: var(--bg-hover);
      color: var(--text);
    }

    .kebab-btn.rotated {
      transform: rotate(90deg);
    }

    .icon-kebab {
      width: 20px;
      height: 20px;
    }

    .kebab-dropdown {
      position: absolute;
      top: 42px;
      right: 0;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow);
      z-index: 100;
      width: 210px;
      padding: 0.4rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .kebab-item {
      background: none !important;
      border: none !important;
      padding: 0.6rem 0.8rem !important;
      font-size: 0.85rem !important;
      font-weight: 500 !important;
      text-align: left !important;
      color: var(--text) !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      transition: background 0.2s !important;
      width: 100% !important;
      min-height: auto !important;
      display: flex !important;
      align-items: center !important;
      gap: 0.5rem !important;
      justify-content: flex-start !important;
      box-shadow: none !important;
    }

    .kebab-item:hover {
      background: var(--bg-hover) !important;
      color: var(--text) !important;
    }

    .icon-menu {
      width: 16px;
      height: 16px;
      opacity: 0.75;
    }

    /* Message List styling */
    .messages-history {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      background-color: var(--bg-panel);
      background-image: 
        radial-gradient(var(--border) 0.5px, transparent 0.5px), 
        radial-gradient(var(--border) 0.5px, var(--bg-panel) 0.5px);
      background-size: 20px 20px;
      background-position: 0 0, 10px 10px;
      scrollbar-width: thin;
    }

    .messages-history::-webkit-scrollbar {
      width: 6px;
    }
    .messages-history::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }

    .loading-messages {
      text-align: center;
      color: var(--muted);
      font-size: 0.9rem;
      margin-top: 2rem;
    }

    .date-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 1.5rem 0 0.5rem 0;
      width: 100%;
    }

    .date-divider::before,
    .date-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }

    .date-divider span {
      background: var(--bg-panel);
      padding: 0 1rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .message-row {
      display: flex;
      width: 100%;
      justify-content: flex-start;
      animation: messageFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .message-row.outgoing {
      justify-content: flex-end;
    }

    @keyframes messageFadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message-bubble {
      max-width: 65%;
      padding: 0.85rem 1.1rem;
      border-radius: 18px;
      font-size: 0.925rem;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      box-shadow: 0 2px 6px rgba(0,0,0,0.02);
      position: relative;
    }

    .message-row:not(.outgoing) .message-bubble {
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text);
      border-top-left-radius: 4px;
    }

    .message-row.outgoing .message-bubble {
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
      color: #ffffff;
      border-top-right-radius: 4px;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.15);
    }

    .message-row.ghost-message .message-bubble {
      opacity: 0.7;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
      border-style: dashed;
      box-shadow: none;
    }

    .message-text {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message-time {
      font-size: 0.68rem;
      align-self: flex-end;
      opacity: 0.65;
    }

    .message-row.outgoing .message-time {
      color: rgba(255, 255, 255, 0.85);
    }

    /* Meeting Invitation Card */
    .meeting-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1rem;
      margin-top: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      width: 100%;
      box-sizing: border-box;
      box-shadow: var(--shadow);
    }

    .message-row.outgoing .meeting-card {
      color: var(--text);
    }

    .meeting-badge {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      background: rgba(37, 99, 235, 0.1);
      color: var(--accent);
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 700;
      width: fit-content;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .badge-icon {
      width: 14px;
      height: 14px;
    }

    .meeting-card-content {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .meeting-icon-container {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .icon-video {
      width: 20px;
      height: 20px;
    }

    .meeting-details {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.85rem;
    }

    .meeting-details strong {
      font-weight: 600;
      color: var(--text);
    }

    .meeting-details span {
      font-size: 0.78rem;
      color: var(--muted);
    }

    .meeting-actions {
      display: flex;
      width: 100%;
    }

    .join-btn {
      width: 100%;
      background: var(--accent);
      color: #ffffff;
      text-align: center;
      padding: 0.6rem;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.15);
    }

    .join-btn:hover {
      background: var(--accent-hover);
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
      transform: translateY(-1px);
    }

    /* Scroll to bottom FAB */
    .scroll-fab {
      position: absolute;
      bottom: 85px;
      right: 25px;
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: var(--shadow);
      z-index: 15;
      transition: all 0.2s ease;
      animation: fabPopIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }

    .scroll-fab:hover {
      background: var(--bg-hover);
      transform: translateY(-2px);
    }

    .icon-fab-down {
      width: 18px;
      height: 18px;
    }

    @keyframes fabPopIn {
      from { opacity: 0; transform: scale(0.8) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    /* Input controls */
    .message-input-area {
      padding: 1.25rem 1.5rem;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 0.75rem;
      background: var(--card);
      align-items: flex-end;
      flex-shrink: 0;
    }

    .input-wrapper {
      flex: 1;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .message-input-area textarea {
      width: 100%;
      min-height: 44px;
      max-height: 120px;
      padding: 0.75rem 1rem;
      font-size: 0.925rem;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--input-bg);
      color: var(--text);
      resize: none;
      box-sizing: border-box;
      font-family: inherit;
      line-height: 1.4;
      transition: all 0.2s ease;
    }

    .message-input-area textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }

    .char-count {
      position: absolute;
      bottom: -18px;
      right: 5px;
      font-size: 0.68rem;
      color: var(--muted);
      opacity: 0.85;
    }

    .send-action-btn {
      min-height: auto;
      height: 44px;
      width: 44px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      background: var(--accent);
      color: #ffffff;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      flex-shrink: 0;
    }

    .send-action-btn:hover:not(:disabled) {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }

    .send-action-btn:hover:not(:disabled) .icon-send {
      transform: rotate(5deg) scale(1.05);
    }

    .send-action-btn:disabled {
      opacity: 0.5;
      background: var(--secondary-btn-bg);
      color: var(--muted);
      cursor: not-allowed;
    }

    .icon-send {
      width: 20px;
      height: 20px;
      transform: rotate(-15deg);
      transition: transform 0.25s ease;
    }

    /* Modals Overlay & Card */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(5px);
      z-index: 1040;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .modal-card {
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      width: 500px;
      max-width: 90vw;
      padding: 1.75rem;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      animation: modalFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes modalFadeIn {
      from { transform: translateY(20px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0.75rem;
    }

    .modal-header h2 {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text);
      margin: 0;
    }

    .modal-eyebrow {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--accent);
      letter-spacing: 0.05em;
    }

    .close-btn {
      background: none;
      border: none;
      color: var(--muted);
      font-size: 2rem;
      cursor: pointer;
      padding: 0;
      min-height: auto;
      line-height: 1;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s;
    }

    .close-btn:hover {
      background: var(--bg-hover);
      color: var(--text);
    }

    .modal-body {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      font-size: 0.9rem;
      line-height: 1.5;
      max-height: 60vh;
      overflow-y: auto;
      padding-right: 4px;
      scrollbar-width: thin;
    }

    .modal-body::-webkit-scrollbar {
      width: 4px;
    }
    .modal-body::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 2px;
    }

    .modal-body strong {
      color: var(--text);
    }

    .modal-section-title {
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--text);
      border-bottom: 1px dashed var(--border);
      padding-bottom: 0.25rem;
      margin-top: 0.5rem;
    }

    .chips-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }

    .skill-chip {
      background: var(--bg-hover);
      color: var(--text);
      font-size: 0.78rem;
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
      border: 1px solid var(--border);
    }

    /* Job Spec Grid styling */
    .job-meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      background: var(--bg-alt);
      padding: 1rem;
      border-radius: 12px;
      border: 1px solid var(--border);
    }

    .job-meta-grid div {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .meta-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--muted);
    }

    .meta-value {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text);
    }

    .job-desc-section h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text);
    }

    .desc-text {
      white-space: pre-wrap;
      color: var(--text);
      opacity: 0.9;
    }

    /* Form Fields for Scheduler */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .form-group select, .form-group input, .form-group textarea {
      padding: 0.75rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--input-bg);
      color: var(--text);
      font-size: 0.88rem;
      transition: all 0.2s ease;
    }

    .form-group select:focus, .form-group input:focus, .form-group textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }

    .form-group select {
      cursor: pointer;
    }

    .scheduler-preview {
      background: rgba(16, 185, 129, 0.05);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 10px;
      padding: 0.75rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .scheduler-preview p {
      margin: 0;
      font-size: 0.85rem;
    }

    .preview-badge {
      font-size: 0.65rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #10b981;
      letter-spacing: 0.05em;
    }

    .schedule-submit-btn {
      background: var(--accent);
      color: #ffffff;
      padding: 0.75rem;
      border-radius: 10px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      box-shadow: 0 3px 6px rgba(37, 99, 235, 0.2);
      transition: all 0.2s ease;
      margin-top: 0.5rem;
      font-size: 0.9rem;
    }

    .schedule-submit-btn:hover {
      background: var(--accent-hover);
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
      transform: translateY(-1px);
    }

    .error-msg {
      color: var(--error-text);
      text-align: center;
      padding: 1rem;
      background: var(--danger-bg);
      border-radius: 10px;
      border: 1px solid rgba(159, 47, 24, 0.15);
    }
  `],
})
export class ChatComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  readonly auth = inject(AuthStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alertService = inject(AlertService);
  private readonly api = inject(ApiService);

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  readonly conversations = signal<Conversation[]>([]);
  readonly loadingConversations = signal(false);

  readonly selectedConversation = signal<Conversation | null>(null);
  readonly messages = signal<Message[]>([]);
  readonly loadingMessages = signal(false);

  readonly sendingMessage = signal(false);
  newMessageText = '';

  // New states for visual refactoring
  searchQuery = '';
  readonly mobileShowThread = signal(false);
  readonly showScrollFab = signal(false);
  sendingMessageText = '';

  // Kebab menu trigger state
  readonly showKebabMenu = signal(false);

  // Application details matched for this conversation
  readonly availableApplications = signal<any[]>([]);
  readonly activeApplication = signal<any | null>(null);

  // Modal display states
  readonly showingRecruiterModal = signal(false);
  readonly showingSeekerModal = signal(false);
  readonly showingJobModal = signal(false);
  readonly showingSchedulerModal = signal(false);

  // Modals data caches
  resolvedRecruiterProfile: any = null;
  resolvedSeekerProfile: any = null;
  resolvedJobSpec: Job | null = null;

  // Scheduler Form inputs
  schedulerSelectedAppId = '';
  schedulerDateTime = '';
  schedulerNotes = '';
  readonly submittingScheduler = signal(false);

  // Unread messages trackers (Signal map)
  private readonly lastSeenMessages = signal<Record<string, string>>({});

  // Local cache (Signal) to resolve names/company details
  private readonly profilesCache = signal<Record<string, { name: string; subtitle?: string }>>({});

  private pollingSub?: Subscription;

  ngOnInit(): void {
    // Load last seen message IDs from local storage
    const saved = localStorage.getItem('job-buddy-chats-seen');
    if (saved) {
      try {
        this.lastSeenMessages.set(JSON.parse(saved));
      } catch {}
    }

    this.loadConversations();

    // Check if otherUserId was passed as query parameter
    this.route.queryParams.subscribe((params) => {
      const otherUserId = params['userId'];
      const jobId = params['jobId'];
      const jobTitle = params['jobTitle'];
      if (otherUserId) {
        this.startConversationWithUser(otherUserId, jobId, jobTitle);
      }
    });

    // Setup periodic polling:
    // Update active messages every 4 seconds, reload conversations list every 8 seconds
    this.pollingSub = interval(4000).subscribe((tick) => {
      const active = this.selectedConversation();
      if (active) {
        this.fetchMessagesSilently(active.id);
      }
      if (tick % 2 === 0) {
        this.loadConversationsSilently();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
  }

  // Close kebab menu if clicked anywhere else
  toggleKebabMenu(): void {
    this.showKebabMenu.update((v) => !v);
  }

  protected loadConversations(): void {
    this.loadingConversations.set(true);
    this.chatService.getConversations().subscribe({
      next: (data) => {
        this.conversations.set(data);
        this.loadingConversations.set(false);
        // Pre-fetch names for all conversations in the sidebar
        data.forEach((c) => this.resolveConversationProfiles(c));
      },
      error: (err) => {
        this.loadingConversations.set(false);
        this.alertService.error(extractErrorMessage(err), 'Failed to Load Chats');
      },
    });
  }

  private loadConversationsSilently(): void {
    this.chatService.getConversations().subscribe({
      next: (data) => {
        this.conversations.set(data);
        data.forEach((c) => this.resolveConversationProfiles(c));
      }
    });
  }

  private startConversationWithUser(otherUserId: string, jobId?: string, jobTitle?: string): void {
    this.chatService.getOrCreateConversation(otherUserId, jobId, jobTitle).subscribe({
      next: (conv) => {
        // Clear query parameters from URL
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { userId: null, jobId: null, jobTitle: null },
          queryParamsHandling: 'merge',
        });
        
        this.selectConversation(conv);
        this.loadConversations();
      },
      error: (err) => {
        this.alertService.error(extractErrorMessage(err), 'Failed to Start Chat');
      },
    });
  }

  protected selectConversation(conv: Conversation): void {
    this.mobileShowThread.set(true);
    this.selectedConversation.set(conv);
    this.messages.set([]);
    this.showKebabMenu.set(false);
    
    // Clear old active application states
    this.availableApplications.set([]);
    this.activeApplication.set(null);

    this.loadActiveMessages();
    this.loadApplicationForConversation(conv);
  }

  private loadApplicationForConversation(conv: Conversation): void {
    const otherId = this.getOtherUserId(conv);

    if (this.auth.isRecruiter()) {
      // Recruiter fetching candidate applications
      this.chatService.getApplicationsForSeeker(otherId).subscribe((apps) => {
        if (apps && apps.length > 0) {
          this.availableApplications.set(apps);
          this.activeApplication.set(apps[0]); // Default to first application
          this.schedulerSelectedAppId = apps[0].id;
        }
      });
    } else {
      // Seeker fetching their own applications and filtering by recruiter_id
      this.chatService.getSeekerApplications().subscribe((apps) => {
        const matches = apps.filter((app) => String(app.recruiter_id) === String(otherId));
        if (matches.length > 0) {
          this.availableApplications.set(matches);
          this.activeApplication.set(matches[0]);
        }
      });
    }
  }

  protected loadActiveMessages(): void {
    const active = this.selectedConversation();
    if (!active) return;

    this.loadingMessages.set(true);
    this.chatService.getMessages(active.id).subscribe({
      next: (msgs) => {
        this.messages.set(msgs);
        this.loadingMessages.set(false);
        this.scrollToBottom();

        // Mark this conversation as fully read
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg) {
          this.markConversationAsRead(active.id, lastMsg.id);
        }
      },
      error: (err) => {
        this.loadingMessages.set(false);
        this.alertService.error(extractErrorMessage(err), 'Failed to Load Messages');
      },
    });
  }

  private fetchMessagesSilently(conversationId: string): void {
    this.chatService.getMessages(conversationId).subscribe({
      next: (msgs) => {
        const currentCount = this.messages().length;
        if (msgs.length !== currentCount) {
          this.messages.set(msgs);
          this.scrollToBottom();
        }

        // Mark this conversation as read
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg) {
          this.markConversationAsRead(conversationId, lastMsg.id);
        }
      },
    });
  }

  protected sendChatMessage(): void {
    const active = this.selectedConversation();
    const text = this.newMessageText.trim();
    if (!active || !text || this.sendingMessage()) return;

    this.sendingMessageText = text;
    this.newMessageText = '';
    this.sendingMessage.set(true);
    this.chatService.sendMessage(active.id, text).subscribe({
      next: (newMsg) => {
        this.messages.update((msgs) => [...msgs, newMsg]);
        this.sendingMessageText = '';
        this.sendingMessage.set(false);
        this.scrollToBottom();

        // Mark as read
        this.markConversationAsRead(active.id, newMsg.id);
      },
      error: (err) => {
        this.newMessageText = text;
        this.sendingMessageText = '';
        this.sendingMessage.set(false);
        this.alertService.error(extractErrorMessage(err), 'Send Failed');
      },
    });
  }

  // Helpers to resolve display info
  private getOtherUserId(conv: Conversation): string {
    const myId = this.auth.userId();
    return String(conv.participant_a) === String(myId) ? conv.participant_b : conv.participant_a;
  }

  private resolveConversationProfiles(conv: Conversation): void {
    const otherId = this.getOtherUserId(conv);
    if (this.profilesCache()[otherId]) return;

    // Set initial loading placeholders in Signal map
    this.profilesCache.update((cache) => ({
      ...cache,
      [otherId]: { name: 'Chat Member', subtitle: 'Retrieving details...' },
    }));

    if (this.auth.isRecruiter()) {
      // Recruiter looking up Seeker
      this.chatService.getSeekerProfile(otherId).subscribe((profile) => {
        if (profile) {
          this.profilesCache.update((cache) => ({
            ...cache,
            [otherId]: {
              name: `${profile.first_name} ${profile.last_name}`,
              subtitle: profile.current_title || 'Job Seeker',
            },
          }));
        } else {
          this.profilesCache.update((cache) => ({
            ...cache,
            [otherId]: { name: 'Candidate', subtitle: 'Job Seeker' },
          }));
        }
      });
    } else {
      // Seeker looking up Recruiter
      this.chatService.getRecruiterProfile(otherId).subscribe((profile) => {
        if (profile) {
          this.profilesCache.update((cache) => ({
            ...cache,
            [otherId]: {
              name: profile.company_name,
              subtitle: profile.industry ? `${profile.industry} Recruiter` : 'Company Recruiter',
            },
          }));
        } else {
          this.profilesCache.update((cache) => ({
            ...cache,
            [otherId]: { name: 'Recruiter', subtitle: 'Company Recruiter' },
          }));
        }
      });
    }
  }

  protected getDisplayName(conv: Conversation): string {
    const otherId = this.getOtherUserId(conv);
    return this.profilesCache()[otherId]?.name || 'Chat Member';
  }

  protected getDisplaySubtitle(conv: Conversation): string {
    const otherId = this.getOtherUserId(conv);
    return this.profilesCache()[otherId]?.subtitle || 'Job Seeker';
  }

  protected getInitials(conv: Conversation): string {
    const name = this.getDisplayName(conv);
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  protected getAvatarColor(convId: string): string {
    const colors = ['#d95d39', '#1e6f68', '#0284c7', '#7c3aed', '#db2777', '#ea580c'];
    let hash = 0;
    for (let i = 0; i < convId.length; i++) {
      hash = convId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  }

  protected isMyMessage(msg: Message): boolean {
    return String(msg.sender_id) === String(this.auth.userId());
  }

  protected detectJitsiLink(text: string): string | null {
    const match = text.match(/https:\/\/meet\.jit\.si\/[a-zA-Z0-9\-]+/);
    return match ? match[0] : null;
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        const el = this.messagesContainer.nativeElement as HTMLElement;
        el.scrollTop = el.scrollHeight;
      } catch {}
    }, 50);
  }

  // Unread message indicators helpers
  private markConversationAsRead(convId: string, messageId: string): void {
    this.lastSeenMessages.update((state) => {
      const updated = { ...state, [convId]: messageId };
      localStorage.setItem('job-buddy-chats-seen', JSON.stringify(updated));
      this.chatService.checkUnreadStatus();
      return updated;
    });
  }

  protected hasUnreadMessages(conv: Conversation): boolean {
    if (this.selectedConversation()?.id === conv.id) {
      return false;
    }
    const last = conv.last_message;
    if (!last) {
      return false;
    }
    if (String(last.sender_id) === String(this.auth.userId())) {
      return false;
    }
    const lastSeenId = this.lastSeenMessages()[conv.id];
    return lastSeenId !== last.id;
  }

  // Menu action calls
  protected viewOtherUserProfile(): void {
    this.showKebabMenu.set(false);
    const active = this.selectedConversation();
    if (!active) return;
    const otherId = this.getOtherUserId(active);

    if (this.auth.isRecruiter()) {
      // Load seeker profile
      this.chatService.getSeekerProfile(otherId).subscribe((profile) => {
        if (profile) {
          this.resolvedSeekerProfile = profile;
          this.showingSeekerModal.set(true);
        } else {
          this.alertService.error('Candidate profile details not found.');
        }
      });
    } else {
      // Load recruiter profile
      this.chatService.getRecruiterProfile(otherId).subscribe((profile) => {
        if (profile) {
          this.resolvedRecruiterProfile = profile;
          this.showingRecruiterModal.set(true);
        } else {
          this.alertService.error('Recruiter profile details not found.');
        }
      });
    }
  }

  protected viewJobSpecification(): void {
    this.showKebabMenu.set(false);
    const app = this.activeApplication();
    if (!app || !app.job_id) return;

    this.api.get<Job>(`${this.api.jobsBase}/${app.job_id}/`, true).subscribe({
      next: (job) => {
        this.resolvedJobSpec = job;
        this.showingJobModal.set(true);
      },
      error: (err) => {
        this.alertService.error(extractErrorMessage(err), 'Failed to Load Job');
      },
    });
  }

  protected downloadResume(): void {
    this.showKebabMenu.set(false);
    const app = this.activeApplication();
    if (!app || !app.resume_id) return;

    this.alertService.toast('Downloading resume file...');
    this.api.getBlob(`${this.api.profileBase}/seeker/resumes/${app.resume_id}/download/`, true).subscribe({
      next: (blob) => {
        const fileUrl = window.URL.createObjectURL(blob);
        window.open(fileUrl, '_blank');
        setTimeout(() => window.URL.revokeObjectURL(fileUrl), 15000);
      },
      error: () => {
        this.alertService.error('Could not retrieve resume file.');
      },
    });
  }

  // Scheduler controls
  protected openSchedulerModal(): void {
    this.schedulerDateTime = '';
    this.schedulerNotes = '';
    this.showingSchedulerModal.set(true);
  }

  protected submitSchedulerInterview(): void {
    if (!this.schedulerSelectedAppId) {
      this.alertService.warning('Please select a job application to schedule for.');
      return;
    }
    if (!this.schedulerDateTime) {
      this.alertService.warning('Please select a date and time.');
      return;
    }

    const activeConv = this.selectedConversation();
    if (!activeConv) return;

    this.submittingScheduler.set(true);
    this.api.post<InterviewResponse>(`${this.api.applicationsBase}/${this.schedulerSelectedAppId}/schedule-interview/`, {
      scheduled_at: new Date(this.schedulerDateTime).toISOString(),
      recruiter_notes: this.schedulerNotes,
    }, true).subscribe({
      next: (res) => {
        this.submittingScheduler.set(false);
        this.showingSchedulerModal.set(false);
        this.alertService.success(`Interview scheduled. Jitsi Link: ${res.jitsi_link}`, 'Interview Generated');

        // Share the invitation directly in the chat thread
        const matchedApp = this.availableApplications().find((a) => a.id === this.schedulerSelectedAppId);
        const formattedDate = new Date(res.scheduled_at).toLocaleString();
        const notesStr = res.recruiter_notes ? `\nNotes: ${res.recruiter_notes}` : '';
        const messageBody = `Interview Scheduled!\n\nRole: ${matchedApp?.job_title || 'Applied Role'}\nDate & Time: ${formattedDate}\nMeeting Link: ${res.jitsi_link}${notesStr}`;

        this.chatService.sendMessage(activeConv.id, messageBody).subscribe({
          next: (newMsg) => {
            this.messages.update((msgs) => [...msgs, newMsg]);
            this.scrollToBottom();
            this.alertService.toast('Meeting invitation posted in chat.');
          },
          error: (err) => console.error('Failed to post interview link to chat:', err)
        });
      },
      error: (err) => {
        this.submittingScheduler.set(false);
        this.alertService.error(extractErrorMessage(err), 'Failed to Schedule');
      },
    });
  }

  // Helper additions for refactored template logic
  filteredConversations(): Conversation[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return this.conversations();
    return this.conversations().filter((conv) => {
      const name = this.getDisplayName(conv).toLowerCase();
      const job = (conv.job_title || '').toLowerCase();
      return name.includes(query) || job.includes(query);
    });
  }

  getRelativeTime(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  }

  getDateDividerText(msg: Message, prevMsg: Message | null): string {
    if (!msg.created_at) return '';
    const currentDate = new Date(msg.created_at);
    if (isNaN(currentDate.getTime())) return '';

    if (prevMsg && prevMsg.created_at) {
      const prevDate = new Date(prevMsg.created_at);
      if (!isNaN(prevDate.getTime())) {
        if (currentDate.toDateString() === prevDate.toDateString()) {
          return '';
        }
      }
    }

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (currentDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (currentDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return currentDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    }
  }

  onMessagesScroll(event: Event): void {
    const element = event.target as HTMLElement;
    if (!element) return;
    const threshold = 200;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    this.showScrollFab.set(distanceFromBottom > threshold);
  }

  onScrollToBottomClick(): void {
    this.scrollToBottom();
  }

  adjustHeight(target: any): void {
    const textarea = target as HTMLTextAreaElement;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendChatMessage();
      const textarea = event.target as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
      }
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapePressed(event: KeyboardEvent): void {
    this.showingRecruiterModal.set(false);
    this.showingSeekerModal.set(false);
    this.showingJobModal.set(false);
    this.showingSchedulerModal.set(false);
  }

  get minDateTime(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
}
