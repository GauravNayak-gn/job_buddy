import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './layout/navbar/navbar.component';
import { ChatbotSidebarComponent } from './shared/components/chatbot-sidebar/chatbot-sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, ChatbotSidebarComponent],
  template: `
    <div class="app-shell">
      <app-navbar />
      <main class="content">
        <router-outlet />
      </main>
      <app-chatbot-sidebar />
    </div>
  `,
  styleUrl: './app.css',
})
export class App {}
