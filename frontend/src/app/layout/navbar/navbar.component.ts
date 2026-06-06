import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStateService } from '../../core/services/auth-state.service';
import { ApiService } from '../../core/services/api.service';
import { ThemeService } from '../../core/services/theme.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {
  readonly auth = inject(AuthStateService);
  readonly theme = inject(ThemeService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly isRecruiter = this.auth.isRecruiter;

  protected logout(): void {
    const refresh = this.auth.refreshToken();
    const clearAndRedirect = () => {
      this.auth.clearSession();
      void this.router.navigateByUrl('/login');
    };

    if (!refresh) {
      clearAndRedirect();
      return;
    }

    this.api.post(`${this.api.authBase}/logout/`, { refresh }, true)
      .pipe(finalize(clearAndRedirect))
      .subscribe();
  }
}
