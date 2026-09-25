import { getCloudConfig } from './config';
import {
  CognitoCredentialCreationOptions,
  CognitoCredentialRequestOptions,
  prepareCredentialCreationOptions,
  prepareCredentialRequestOptions,
  serializeCreationCredential,
  serializeAssertionCredential,
} from './webauthn';

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

export interface WebAuthnCredentialInfo {
  credentialId: string;
  friendlyCredentialName?: string;
  relyingPartyId?: string;
  authenticatorAttachment?: string;
  createdAt?: number;
}

const STORAGE_KEY_SESSION = 'retirement_planner_auth_session';
const STORAGE_KEY_LAST_EMAIL = 'retirement_planner_last_email';

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
        if (session.email) {
          this.setLastUsedEmail(session.email);
        }
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

  public getLastUsedEmail(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(STORAGE_KEY_LAST_EMAIL);
    } catch {
      return null;
    }
  }

  public setLastUsedEmail(email: string): void {
    if (typeof window === 'undefined' || !email) return;
    try {
      window.localStorage.setItem(STORAGE_KEY_LAST_EMAIL, email.trim());
    } catch (err) {
      console.warn('Failed to save last used email:', err);
    }
  }

  public getRegisteredDeviceName(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem('retirement_planner_device_name');
    } catch {
      return null;
    }
  }

  public setRegisteredDeviceName(name: string): void {
    if (typeof window === 'undefined') return;
    try {
      if (name) {
        window.localStorage.setItem('retirement_planner_device_name', name.trim());
      } else {
        window.localStorage.removeItem('retirement_planner_device_name');
      }
    } catch (err) {
      console.warn('Failed to save device name:', err);
    }
  }

  public supportsPasskeys(): boolean {
    return typeof window !== 'undefined' && Boolean(window.PublicKeyCredential);
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

  private createSessionFromTokens(authResult: { IdToken: string; AccessToken: string; RefreshToken?: string; ExpiresIn?: number }, fallbackEmail?: string): AuthSession {
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
      email: String(payload.email || fallbackEmail || ''),
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

    return this.createSessionFromTokens(authResult, email);
  }

  /**
   * Register a new Passkey / WebAuthn biometric credential for the currently signed-in user.
   */
  public async registerPasskey(friendlyDeviceName?: string): Promise<{ success: boolean; message: string }> {
    if (!this.currentSession || !this.currentSession.accessToken) {
      throw new Error('You must be signed in to register a passkey for this device.');
    }
    if (!this.supportsPasskeys()) {
      throw new Error('Passkeys/WebAuthn are not supported on this browser or platform.');
    }

    const config = getCloudConfig();
    const cognitoUrl = `https://cognito-idp.${config.region}.amazonaws.com/`;

    // Step 1: Start WebAuthn registration
    const startResponse = await fetch(cognitoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.StartWebAuthnRegistration',
      },
      body: JSON.stringify({
        AccessToken: this.currentSession.accessToken,
      }),
    });

    const startData = await startResponse.json();
    if (!startResponse.ok || !startData.CredentialCreationOptions) {
      const errorType = startData.__type || startData.name || 'WebAuthnRegistrationError';
      const message = startData.message || 'Failed to initiate passkey registration with Cognito';
      throw new Error(`[${errorType}] ${message}`);
    }

    const rawOptions: CognitoCredentialCreationOptions = typeof startData.CredentialCreationOptions === 'string'
      ? JSON.parse(startData.CredentialCreationOptions)
      : startData.CredentialCreationOptions;

    // Step 2: Invoke browser WebAuthn credential creation
    const creationOptions = prepareCredentialCreationOptions(rawOptions);
    const credential = (await navigator.credentials.create({
      publicKey: creationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      throw new Error('Passkey creation was cancelled or returned no credentials.');
    }

    // Step 3: Complete WebAuthn registration
    const serializedCredential = serializeCreationCredential(credential);

    const completeResponse = await fetch(cognitoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.CompleteWebAuthnRegistration',
      },
      body: JSON.stringify({
        AccessToken: this.currentSession.accessToken,
        Credential: serializedCredential,
      }),
    });

    const completeData = await completeResponse.json().catch(() => ({}));
    if (!completeResponse.ok) {
      const errorType = completeData.__type || completeData.name || 'WebAuthnCompletionError';
      const message = completeData.message || 'Failed to complete passkey registration with Cognito';
      throw new Error(`[${errorType}] ${message}`);
    }

    if (friendlyDeviceName) {
      this.setRegisteredDeviceName(friendlyDeviceName);
    }

    return {
      success: true,
      message: 'Passkey registered successfully! You can now sign in using Face ID, Touch ID, or your device passkey.',
    };
  }

  /**
   * Sign in using Passkey / Face ID (WebAuthn) via Cognito USER_AUTH flow.
   */
  public async signInWithPasskey(email?: string): Promise<AuthSession> {
    if (!this.supportsPasskeys()) {
      throw new Error('Passkeys/WebAuthn are not supported on this browser or platform.');
    }

    const targetEmail = email?.trim() || this.getLastUsedEmail();
    if (!targetEmail) {
      throw new Error('Please enter your email address to sign in with your Passkey.');
    }

    const config = getCloudConfig();
    const cognitoUrl = `https://cognito-idp.${config.region}.amazonaws.com/`;

    // Step 1: Initiate USER_AUTH flow with PREFERRED_CHALLENGE = WEB_AUTHN
    const initResponse = await fetch(cognitoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'USER_AUTH',
        ClientId: config.clientId,
        AuthParameters: {
          USERNAME: targetEmail,
          PREFERRED_CHALLENGE: 'WEB_AUTHN',
        },
      }),
    });

    let authData = await initResponse.json();
    if (!initResponse.ok) {
      const errorType = authData.__type || authData.name || 'AuthError';
      const message = authData.message || 'Passkey sign-in initiation failed';
      throw new Error(`[${errorType}] ${message}`);
    }

    // Step 2: Handle SELECT_CHALLENGE if needed
    if (authData.ChallengeName === 'SELECT_CHALLENGE') {
      const available: string[] = Array.isArray(authData.AvailableChallenges) ? authData.AvailableChallenges : [];
      if (available.length > 0 && !available.includes('WEB_AUTHN')) {
        throw new Error('No passkey registered for this account yet. Please sign in with your password below, then tap "Register This Device (Face ID / Passkey)".');
      }

      const selectResponse = await fetch(cognitoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
        },
        body: JSON.stringify({
          ChallengeName: 'SELECT_CHALLENGE',
          ClientId: config.clientId,
          Session: authData.Session,
          ChallengeResponses: {
            USERNAME: targetEmail,
            ANSWER: 'WEB_AUTHN',
          },
        }),
      });

      authData = await selectResponse.json();
      if (!selectResponse.ok) {
        const errorType = authData.__type || authData.name || 'AuthError';
        const message = authData.message || '';
        if (message.toLowerCase().includes('challenge is not available')) {
          throw new Error('No passkey registered for this account yet. Please sign in with your password below, then tap "Register This Device (Face ID / Passkey)".');
        }
        throw new Error(`[${errorType}] ${message || 'Failed to select WebAuthn challenge'}`);
      }
    }

    // Step 3: Handle WEB_AUTHN challenge
    if (authData.ChallengeName !== 'WEB_AUTHN' || !authData.ChallengeParameters?.CREDENTIAL_REQUEST_OPTIONS) {
      if (authData.AuthenticationResult?.IdToken) {
        return this.createSessionFromTokens(authData.AuthenticationResult, targetEmail);
      }
      if (authData.ChallengeName === 'PASSWORD') {
        throw new Error('No passkey registered for this account yet. Please sign in with your password below, then tap "Register This Device".');
      }
      throw new Error(
        authData.ChallengeName
          ? `Authentication requires: ${authData.ChallengeName}. Have you registered a passkey for this device?`
          : 'Cognito did not issue a WebAuthn challenge for this account. Have you registered a passkey?'
      );
    }

    const rawRequestOptions: CognitoCredentialRequestOptions =
      typeof authData.ChallengeParameters.CREDENTIAL_REQUEST_OPTIONS === 'string'
        ? JSON.parse(authData.ChallengeParameters.CREDENTIAL_REQUEST_OPTIONS)
        : authData.ChallengeParameters.CREDENTIAL_REQUEST_OPTIONS;

    const requestOptions = prepareCredentialRequestOptions(rawRequestOptions);

    // Step 4: Invoke browser WebAuthn assertion (Touch ID / Face ID / Security Key)
    const assertion = (await navigator.credentials.get({
      publicKey: requestOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      throw new Error('Biometric authentication cancelled.');
    }

    // Step 5: Respond to WEB_AUTHN challenge with assertion response
    const serializedAssertion = serializeAssertionCredential(assertion);

    const respondResponse = await fetch(cognitoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
      },
      body: JSON.stringify({
        ChallengeName: 'WEB_AUTHN',
        ClientId: config.clientId,
        Session: authData.Session,
        ChallengeResponses: {
          USERNAME: authData.ChallengeParameters.USERNAME || targetEmail,
          CREDENTIAL: JSON.stringify(serializedAssertion),
        },
      }),
    });

    const resultData = await respondResponse.json();
    if (!respondResponse.ok || !resultData.AuthenticationResult?.IdToken) {
      const errorType = resultData.__type || resultData.name || 'AuthError';
      const message = resultData.message || 'Passkey verification failed';
      throw new Error(`[${errorType}] ${message}`);
    }

    return this.createSessionFromTokens(resultData.AuthenticationResult, targetEmail);
  }

  /**
   * List registered WebAuthn credentials for current user.
   */
  public async listPasskeys(): Promise<WebAuthnCredentialInfo[]> {
    if (!this.currentSession?.accessToken) return [];

    const config = getCloudConfig();
    const cognitoUrl = `https://cognito-idp.${config.region}.amazonaws.com/`;

    try {
      const response = await fetch(cognitoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.ListWebAuthnCredentials',
        },
        body: JSON.stringify({
          AccessToken: this.currentSession.accessToken,
        }),
      });

      const data = await response.json();
      if (!response.ok || !Array.isArray(data.Credentials)) {
        return [];
      }

      return data.Credentials.map((c: Record<string, unknown>) => ({
        credentialId: String(c.CredentialId || ''),
        friendlyCredentialName: typeof c.FriendlyCredentialName === 'string' ? c.FriendlyCredentialName : undefined,
        relyingPartyId: typeof c.RelyingPartyId === 'string' ? c.RelyingPartyId : undefined,
        authenticatorAttachment: typeof c.AuthenticatorAttachment === 'string' ? c.AuthenticatorAttachment : undefined,
        createdAt: typeof c.CreatedAt === 'number' ? c.CreatedAt : undefined,
      }));
    } catch (err) {
      console.warn('Failed to list passkeys:', err);
      return [];
    }
  }

  /**
   * Delete a registered passkey.
   */
  public async deletePasskey(credentialId: string): Promise<void> {
    if (!this.currentSession?.accessToken) {
      throw new Error('You must be signed in to delete a passkey.');
    }

    const config = getCloudConfig();
    const cognitoUrl = `https://cognito-idp.${config.region}.amazonaws.com/`;

    const response = await fetch(cognitoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.DeleteWebAuthnCredential',
      },
      body: JSON.stringify({
        AccessToken: this.currentSession.accessToken,
        CredentialId: credentialId,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorType = data.__type || data.name || 'DeleteWebAuthnError';
      const message = data.message || 'Failed to delete passkey from Cognito';
      throw new Error(`[${errorType}] ${message}`);
    }
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
