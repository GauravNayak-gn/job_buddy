import { Component, ElementRef, ViewChild, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

@Component({
  selector: 'app-chatbot-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Floating Action Button -->
    <button 
      type="button" 
      class="chat-fab" 
      [class.active]="isOpen()"
      (click)="toggleOpen()"
      aria-label="Toggle AI Assistant"
    >
      @if (isOpen()) {
        <span class="close-icon">&times;</span>
      } @else {
        <span class="chat-icon">💬</span>
      }
      <span class="fab-pulse"></span>
    </button>

    <!-- Sidebar Drawer Container -->
    <div class="sidebar-container" [class.open]="isOpen()">
      <header class="sidebar-header">
        <div class="bot-info">
          <span class="status-indicator online"></span>
          <div>
            <h3>Job Buddy Assistant</h3>
            <p>AI Support & Search</p>
          </div>
        </div>
        <button type="button" class="close-drawer-btn" (click)="toggleOpen()">&times;</button>
      </header>

      <!-- Scrollable Message Pane -->
      <div class="message-pane" #scrollContainer>
        @for (msg of messages(); track msg.id) {
          <div class="message-row" [class.user-row]="msg.sender === 'user'">
            <div class="bubble" [class.user-bubble]="msg.sender === 'user'">
              <p>{{ msg.text }}</p>
              <span class="time">{{ msg.timestamp | date: 'shortTime' }}</span>
            </div>
          </div>
        }

        @if (isTyping()) {
          <div class="message-row">
            <div class="bubble bot-bubble typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        }
      </div>

      <!-- Quick Action Suggestions -->
      <div class="quick-actions">
        <p class="suggestions-title">Suggestions:</p>
        <div class="chips-container">
          @for (chip of suggestionChips; track chip) {
            <button type="button" class="suggestion-chip" (click)="selectChip(chip)">
              {{ chip }}
            </button>
          }
        </div>
      </div>

      <!-- Message Input Form -->
      <form class="input-form" (submit)="sendMessage($event)">
        <input 
          type="text" 
          name="userInput"
          [(ngModel)]="inputText" 
          placeholder="Ask about jobs, resume help..." 
          autocomplete="off"
          [disabled]="isTyping()"
        />
        <button type="submit" [disabled]="!inputText.trim() || isTyping()">
          Send
        </button>
      </form>
    </div>

    <!-- Background overlay when open for small devices -->
    @if (isOpen()) {
      <div class="sidebar-backdrop" (click)="toggleOpen()"></div>
    }
  `,
  styles: [`
    /* FAB Styling */
    .chat-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 1000;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
      border: none;
      box-shadow: 0 8px 24px rgba(217, 93, 57, 0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    
    .chat-fab:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 12px 28px rgba(217, 93, 57, 0.5);
    }

    .chat-fab:active {
      transform: scale(0.95);
    }

    .chat-fab.active {
      background: #1e293b;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.3);
    }

    .chat-icon {
      font-size: 28px;
      color: #fff;
    }

    .close-icon {
      font-size: 32px;
      color: #fff;
      line-height: 1;
    }

    .fab-pulse {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid var(--accent);
      animation: pulse 2.5s infinite;
      pointer-events: none;
      opacity: 0.8;
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(1.4); opacity: 0; }
    }

    /* Sidebar Drawer Styling */
    .sidebar-container {
      position: fixed;
      top: 0;
      right: -420px; /* Hidden state */
      width: 400px;
      height: 100vh;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-left: 1px solid var(--border);
      box-shadow: -10px 0 35px rgba(24, 33, 47, 0.15);
      z-index: 999;
      display: flex;
      flex-direction: column;
      transition: right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .sidebar-container.open {
      right: 0;
    }

    .sidebar-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.15);
      backdrop-filter: blur(2px);
      z-index: 998;
    }

    /* Header */
    .sidebar-header {
      padding: 1.25rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(to right, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.7));
    }

    .bot-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .bot-info h3 {
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text);
    }

    .bot-info p {
      font-size: 0.75rem;
      color: var(--muted);
      margin: 0;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .status-indicator.online {
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }

    .close-drawer-btn {
      background: none;
      border: none;
      color: var(--muted);
      font-size: 1.75rem;
      cursor: pointer;
      padding: 0;
      min-height: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      transition: background-color 0.2s;
    }

    .close-drawer-btn:hover {
      background-color: rgba(15, 23, 42, 0.05);
      color: var(--text);
    }

    /* Messages area */
    .message-pane {
      flex: 1;
      padding: 1.25rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .message-row {
      display: flex;
      width: 100%;
    }

    .user-row {
      justify-content: flex-end;
    }

    .bubble {
      max-width: 80%;
      padding: 0.85rem 1.1rem;
      border-radius: 18px 18px 18px 4px;
      background: #ffffff;
      border: 1px solid var(--border);
      font-size: 0.925rem;
      color: var(--text);
      line-height: 1.45;
      box-shadow: 0 2px 5px rgba(24, 33, 47, 0.03);
    }

    .user-bubble {
      border-radius: 18px 18px 4px 18px;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 12px rgba(217, 93, 57, 0.15);
    }

    .time {
      display: block;
      font-size: 0.7rem;
      margin-top: 0.35rem;
      opacity: 0.6;
      text-align: right;
    }

    .user-bubble .time {
      color: rgba(255, 255, 255, 0.8);
    }

    /* Typing bubble */
    .typing {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.75rem 1rem;
    }

    .typing span {
      width: 6px;
      height: 6px;
      background: var(--muted);
      border-radius: 50%;
      animation: typingBounce 1.4s infinite both;
    }

    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typingBounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Suggestions Area */
    .quick-actions {
      padding: 0.75rem 1.25rem;
      background: rgba(255, 255, 255, 0.5);
      border-top: 1px solid var(--border);
    }

    .suggestions-title {
      font-size: 0.8rem;
      color: var(--muted);
      font-weight: 600;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .suggestion-chip {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid rgba(24, 33, 47, 0.05);
      font-size: 0.8rem;
      padding: 0.4rem 0.8rem;
      border-radius: 999px;
      cursor: pointer;
      min-height: auto;
      transition: all 0.2s;
    }

    .suggestion-chip:hover {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }

    /* Input form */
    .input-form {
      padding: 1rem 1.25rem 1.5rem 1.25rem;
      background: #ffffff;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 0.5rem;
    }

    .input-form input {
      flex: 1;
      border: 1px solid var(--border);
      background: #f8fafc;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      font-size: 0.9rem;
    }

    .input-form input:focus {
      background: #fff;
    }

    .input-form button {
      min-height: auto;
      height: auto;
      border-radius: 12px;
      padding: 0.75rem 1.25rem;
    }

    /* Responsive adjustments */
    @media (max-width: 480px) {
      .sidebar-container {
        width: 100vw;
        right: -100vw;
      }
    }
  `],
})
export class ChatbotSidebarComponent {
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  private readonly api = inject(ApiService);

  readonly isOpen = signal(false);
  readonly isTyping = signal(false);
  
  inputText = '';

  readonly suggestionChips = [
    'Recommend backend jobs',
    'How do I apply for a job?',
    'Review my resume formats',
    'Edit recruiter job postings'
  ];

  readonly messages = signal<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I'm Job Buddy, your AI assistant. Ask me anything about job listings, resume checks, or recruiter tools. I can also search database records via RAG search.",
      timestamp: new Date()
    }
  ]);

  toggleOpen(): void {
    this.isOpen.set(!this.isOpen());
    if (this.isOpen()) {
      this.scrollToBottom();
    }
  }

  selectChip(chipText: string): void {
    this.inputText = chipText;
    this.sendMessage();
  }

  sendMessage(event?: Event): void {
    if (event) {
      event.preventDefault();
    }

    const textToSend = this.inputText.trim();
    if (!textToSend || this.isTyping()) {
      return;
    }

    // Add User Message
    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };
    
    this.messages.update(prev => [...prev, userMsg]);
    this.inputText = '';
    this.scrollToBottom();

    // Trigger AI response simulation
    this.simulateBotResponse(textToSend);
  }

  private simulateBotResponse(query: string): void {
    this.isTyping.set(true);
    this.scrollToBottom();

    // Map history to simple format: { sender: 'user'|'bot', text: string }
    const history = this.messages().map(m => ({
      sender: m.sender,
      text: m.text
    }));

    this.api.post<any>(`${this.api.matchBase}/chat/`, {
      message: query,
      chat_history: history
    }, true).subscribe({
      next: (res) => {
        const replyText = res?.reply || 'Sorry, I did not understand that.';
        const botMsg: ChatMessage = {
          id: 'bot-' + Date.now(),
          sender: 'bot',
          text: replyText,
          timestamp: new Date()
        };
        this.messages.update(prev => [...prev, botMsg]);
        this.isTyping.set(false);
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Error in chatbot query, falling back to simulated logic:', err);
        this.runFallbackBotResponse(query);
      }
    });
  }

  private runFallbackBotResponse(query: string): void {
    this.isTyping.set(true);
    this.scrollToBottom();

    // Mock processing timeout (1 - 1.5 seconds)
    setTimeout(() => {
      let botText = '';
      const lowercaseQuery = query.toLowerCase();

      if (lowercaseQuery.includes('job') || lowercaseQuery.includes('recommend')) {
        botText = "Checking databases... Found 3 active backend jobs matching your profile: \n\n1. Python Backend Developer at InnovateCorp (hybrid, Min $80,000)\n2. Senior Go Engineer at CloudTech (remote, Min $120,000)\n3. Django Developer at WebLabs (onsite, Min $65,000).\n\nYou can click on the 'Jobs' tab to apply directly using your primary resume.";
      } else if (lowercaseQuery.includes('apply')) {
        botText = "Applying is simple! Navigate to the 'Jobs' tab, select your preferred resume from the top bar dropdown, and click 'Apply now' on the job card. The recruiter will be notified instantly via email and their manage-jobs panel.";
      } else if (lowercaseQuery.includes('resume')) {
        botText = "Sure! You can upload multiple PDFs in the 'Profile' section. Once uploaded, click 'Set Primary' to make it the default for new applications. In the next phase, the [AI Review] panel will analyze your resume against ATS tracking algorithms.";
      } else if (lowercaseQuery.includes('recruiter') || lowercaseQuery.includes('post')) {
        botText = "If you have a Recruiter account, you can create new postings under 'Post Job'. To track existing applications and view AI applicant alignments, navigate to the newly refactored '/manage-jobs' section.";
      } else {
        botText = "That's a great question! I'm currently configured with a dummy Gemini API key. Once my API key is activated, I will be able to perform fully conversational RAG search on the Job Buddy database and summarize custom matches for you.";
      }

      const botMsg: ChatMessage = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: botText,
        timestamp: new Date()
      };

      this.messages.update(prev => [...prev, botMsg]);
      this.isTyping.set(false);
      this.scrollToBottom();
    }, 1200);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        const el = this.scrollContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      } catch (err) {
        // Safe check
      }
    }, 50);
  }
}
