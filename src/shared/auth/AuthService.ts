import { getCloudConfig } from './config';

export interface AuthSession {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp in seconds
  email: string;
  householdId: string;
  sub: string;
  nickname?: string;
  givenName?: string;
  name?: string;
}

const STORAGE_KEY_SESSION = 'retirement_planner_auth_session';

class AuthServiceClass {
  private currentSession: AuthSession | null = null;
  private listeners: Set<(session: AuthSession | null) => void> = new Set();
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.loadSessionFromStorage();
  }

  private loadSessionFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_SESSION);
      if (raw) {
        this.currentSession = JSON.parse(raw);
        if (this.currentSession && this.currentSession.idToken) {
          const payload = this.parseJwtPayload(this.currentSession.idToken);
          if (typeof payload.nickname === 'string' && payload.nickname.trim()) {
            this.currentSession.nickname = payload.nickname.trim();
          }
          if (typeof payload.given_name === 'string' && payload.given_name.trim()) {
            this.currentSession.givenName = payload.given_name.trim();
          }
          if (typeof payload.name === 'string' && payload.name.trim()) {
            this.currentSession.name = payload.name.trim();
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse auth session from localStorage:', err);
      this.currentSession = null;
    }
  }

  private saveSessionToStorage(session: AuthSession | null): void {
    this.currentSession = session;
    if (typeof window !== 'undefined') {
      if (session) {
        window.localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(STORAGE_KEY_SESSION);
      }
      if (typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: session }));
      }
    }
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentSession);
      } catch (e) {
        console.error('Auth listener error:', e);
      }
    }
  }

  public subscribe(listener: (session: AuthSession | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentSession);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSession(): AuthSession | null {
    return this.currentSession;
  }

  public isAuthenticated(): boolean {
    return Boolean(this.currentSession && this.currentSession.idToken);
  }

  public getUserEmail(): string | null {
    return this.currentSession?.email || null;
  }

  public getHouseholdId(): string {
    return this.currentSession?.householdId || 'local_household';
  }

  /**
   * Parse JWT payload without external library
   */
  private parseJwtPayload(token: string): Record<string, unknown> {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (err) {
      console.error('Failed to decode JWT token payload:', err);
      return {};
    }
  }

  /**
   * Sign in using standard Cognito USER_PASSWORD_AUTH
   */
  public async signIn(email: string, password: string): Promise<AuthSession> {
    const config = getCloudConfig();
    const cognitoUrl = `https://cognito-idp.${config.region}.amazonaws.com/`;

    const requestBody = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: config.clientId,
      AuthParameters: {
        USERNAME: email.trim(),
        PASSWORD: password,
      },
    };

    const response = await fetch(cognitoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorType = data.__type || data.name || 'AuthError';
      const message = data.message || 'Authentication failed';
      throw new Error(`[${errorType}] ${message}`);
    }

    const authResult = data.AuthenticationResult;
    if (!authResult || !authResult.IdToken) {
      if (data.ChallengeName) {
        throw new Error(`Cognito Challenge Required: ${data.ChallengeName}. Temporary passwords must be reset.`);
      }
      throw new Error('Authentication did not return valid tokens');
    }

    const payload = this.parseJwtPayload(authResult.IdToken);
    const exp = typeof payload.exp === 'number' ? payload.exp : Math.floor(Date.now() / 1000) + (authResult.ExpiresIn || 3600);
    const sub = String(payload.sub || '');
    const householdId = String(payload['custom:household_id'] || 'household_default');
    const nickname = typeof payload.nickname === 'string' && payload.nickname.trim() ? payload.nickname.trim() : undefined;
    const givenName = typeof payload.given_name === 'string' && payload.given_name.trim() ? payload.given_name.trim() : undefined;
    const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : undefined;

    const session: AuthSession = {
      idToken: authResult.IdToken,
      accessToken: authResult.AccessToken,
      refreshToken: authResult.RefreshToken || this.currentSession?.refreshToken,
      expiresAt: exp,
      email: String(payload.email || email),
      householdId,
      sub,
      nickname,
      givenName,
      name,
    };

    this.saveSessionToStorage(session);
    return session;
  }

  /**
   * Automatically refresh token if close to expiry
   */
  public async getIdToken(): Promise<string | null> {
    if (!this.currentSession) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    // If token is still valid for > 2 minutes, return it
    if (this.currentSession.expiresAt > nowSec + 120) {
      return this.currentSession.idToken;
    }

    // Refresh if refresh token is present
    if (!this.currentSession.refreshToken) {
      return this.currentSession.idToken;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refreshToken();
    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async refreshToken(): Promise<string | null> {
    if (!this.currentSession?.refreshToken) return null;

    const config = getCloudConfig();
    const cognitoUrl = `https://cognito-idp.${config.region}.amazonaws.com/`;

    try {
      const requestBody = {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: config.clientId,
        AuthParameters: {
          REFRESH_TOKEN: this.currentSession.refreshToken,
        },
      };

      const response = await fetch(cognitoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      if (!response.ok || !data.AuthenticationResult?.IdToken) {
        console.warn('Token refresh failed, logging out session');
        this.signOut();
        return null;
      }

      const authResult = data.AuthenticationResult;
      const payload = this.parseJwtPayload(authResult.IdToken);
      const exp = typeof payload.exp === 'number' ? payload.exp : Math.floor(Date.now() / 1000) + (authResult.ExpiresIn || 3600);
      const nickname = typeof payload.nickname === 'string' && payload.nickname.trim() ? payload.nickname.trim() : this.currentSession.nickname;
      const givenName = typeof payload.given_name === 'string' && payload.given_name.trim() ? payload.given_name.trim() : this.currentSession.givenName;
      const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : this.currentSession.name;

      const updatedSession: AuthSession = {
        ...this.currentSession,
        idToken: authResult.IdToken,
        accessToken: authResult.AccessToken,
        expiresAt: exp,
        nickname,
        givenName,
        name,
      };

      this.saveSessionToStorage(updatedSession);
      return updatedSession.idToken;
    } catch (err) {
      console.error('Failed to refresh token:', err);
      return null;
    }
  }

  public signOut(): void {
    this.saveSessionToStorage(null);
  }
}

export const AuthService = new AuthServiceClass();
