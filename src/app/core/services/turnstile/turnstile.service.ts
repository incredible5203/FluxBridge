import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SessionStorageService } from '../session-storage/session-storage.service';

/**
 * Client session id for diagnostics. Cloudflare / Turnstile challenges are disabled in this app.
 */
@Injectable({
  providedIn: 'root'
})
export class TurnstileService {
  private _sessionID: string | null = null;

  public get sessionID(): string {
    return this._sessionID;
  }

  public loadSessionID(): string {
    const sessionID = this.sessionStorageService.getItem('SESSION_ID');
    if (sessionID) {
      this._sessionID = sessionID;
      return sessionID;
    }
    const newSessionID = `user-${Math.random().toString(36).slice(2)}`;
    this._sessionID = newSessionID;
    queueMicrotask(() => this.sessionStorageService.setItem('SESSION_ID', newSessionID));
    return newSessionID;
  }

  private readonly _cfModalOpened$ = new BehaviorSubject<boolean>(false);

  public readonly cfModalOpened$ = this._cfModalOpened$.asObservable();

  private readonly _token$ = new BehaviorSubject<string | null>(null);

  public readonly token$ = this._token$.asObservable();

  public get token(): string | null {
    return this._token$.value;
  }

  constructor(private readonly sessionStorageService: SessionStorageService) {}

  /**
   * No-op: challenges are disabled; socket auth uses a null token from {@link RubicApiService}.
   */
  public async askForCloudflareToken(): Promise<boolean> {
    return true;
  }
}
