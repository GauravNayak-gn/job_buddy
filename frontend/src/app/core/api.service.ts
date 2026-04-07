import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthStateService } from './auth-state.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly authState = inject(AuthStateService);

  readonly authBase = 'http://localhost:8001/api/auth';
  readonly profileBase = 'http://localhost:8002/api/profile';
  readonly jobsBase = 'http://localhost:8003/api/jobs';

  get<T>(url: string, auth = false): Observable<T> {
    return this.http.get<T>(url, { headers: this.headers(auth) });
  }

  post<T>(url: string, body: unknown, auth = false): Observable<T> {
    return this.http.post<T>(url, body, { headers: this.headers(auth) });
  }

  patch<T>(url: string, body: unknown, auth = false): Observable<T> {
    return this.http.patch<T>(url, body, { headers: this.headers(auth) });
  }

  private headers(auth: boolean): HttpHeaders {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    if (auth && this.authState.accessToken()) {
      headers = headers.set('Authorization', `Bearer ${this.authState.accessToken()}`);
    }

    return headers;
  }
}
