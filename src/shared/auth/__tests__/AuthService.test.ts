import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../AuthService';

const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe('AuthService', () => {
  const mockIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiY3VzdG9tOmhvdXNlaG9sZF9pZCI6ImhvdXNlaG9sZF85OSIsImV4cCI6OTk5OTk5OTk5OX0.dummy';

  beforeEach(() => {
    const mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', {
      localStorage: mockStorage,
      dispatchEvent: vi.fn(),
      PublicKeyCredential: function () {},
    });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      credentials: {
        create: vi.fn(),
        get: vi.fn(),
      },
    });
    AuthService.signOut();
    vi.restoreAllMocks();
  });

  it('starts unauthenticated when localStorage is empty', () => {
    expect(AuthService.isAuthenticated()).toBe(false);
    expect(AuthService.getSession()).toBeNull();
    expect(AuthService.getHouseholdId()).toBe('local_household');
  });

  it('signs in successfully with password and saves session tokens and last used email', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        AuthenticationResult: {
          IdToken: mockIdToken,
          AccessToken: 'access_123',
          RefreshToken: 'refresh_123',
          ExpiresIn: 3600,
        },
      }),
    } as unknown as Response);

    const session = await AuthService.signIn('test@example.com', 'Password123!');
    expect(session.email).toBe('test@example.com');
    expect(session.householdId).toBe('household_99');
    expect(AuthService.isAuthenticated()).toBe(true);
    expect(AuthService.getHouseholdId()).toBe('household_99');
    expect(AuthService.getLastUsedEmail()).toBe('test@example.com');
  });

  it('handles sign in error from Cognito', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        __type: 'NotAuthorizedException',
        message: 'Incorrect username or password.',
      }),
    } as unknown as Response);

    await expect(AuthService.signIn('bad@example.com', 'wrong')).rejects.toThrow('[NotAuthorizedException] Incorrect username or password.');
    expect(AuthService.isAuthenticated()).toBe(false);
  });

  it('registers a new passkey successfully', async () => {
    // 1. Initial login
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          AuthenticationResult: {
            IdToken: mockIdToken,
            AccessToken: 'access_123',
            RefreshToken: 'refresh_123',
            ExpiresIn: 3600,
          },
        }),
      } as unknown as Response)
      // 2. StartWebAuthnRegistration
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          CredentialCreationOptions: {
            challenge: 'Y2hhbGxlbmdl',
            rp: { name: 'RetirementPlanner', id: 'localhost' },
            user: { id: 'dXNlcg', name: 'test@example.com', displayName: 'Test' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          },
        }),
      } as unknown as Response)
      // 3. CompleteWebAuthnRegistration
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

    await AuthService.signIn('test@example.com', 'Password123!');

    const mockCreate = vi.fn().mockResolvedValue({
      id: 'passkey_cred_1',
      rawId: new Uint8Array([1, 2, 3]),
      type: 'public-key',
      response: {
        clientDataJSON: new Uint8Array([4, 5, 6]),
        attestationObject: new Uint8Array([7, 8, 9]),
        getTransports: () => ['internal'],
      },
    });
    navigator.credentials.create = mockCreate;

    const result = await AuthService.registerPasskey('My iPhone');
    expect(result.success).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });

  it('signs in with passkey using Cognito USER_AUTH flow', async () => {
    vi.spyOn(global, 'fetch')
      // 1. InitiateAuth with USER_AUTH
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ChallengeName: 'WEB_AUTHN',
          Session: 'session_token_xyz',
          ChallengeParameters: {
            USERNAME: 'test@example.com',
            CREDENTIAL_REQUEST_OPTIONS: JSON.stringify({
              challenge: 'Y2hhbGxlbmdlX3JlcXVlc3Q',
              rpId: 'localhost',
              allowCredentials: [{ id: 'Y3JlZF8x', type: 'public-key' }],
            }),
          },
        }),
      } as unknown as Response)
      // 2. RespondToAuthChallenge with assertion
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          AuthenticationResult: {
            IdToken: mockIdToken,
            AccessToken: 'access_passkey_123',
            RefreshToken: 'refresh_passkey_123',
            ExpiresIn: 3600,
          },
        }),
      } as unknown as Response);

    const mockGet = vi.fn().mockResolvedValue({
      id: 'cred_1',
      rawId: new Uint8Array([1, 2, 3]),
      type: 'public-key',
      response: {
        clientDataJSON: new Uint8Array([4, 5, 6]),
        authenticatorData: new Uint8Array([7, 8, 9]),
        signature: new Uint8Array([10, 11, 12]),
      },
    });
    navigator.credentials.get = mockGet;

    const session = await AuthService.signInWithPasskey('test@example.com');
    expect(session.email).toBe('test@example.com');
    expect(AuthService.isAuthenticated()).toBe(true);
    expect(mockGet).toHaveBeenCalled();
  });

  it('lists and deletes registered passkeys', async () => {
    vi.spyOn(global, 'fetch')
      // 1. Sign in
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          AuthenticationResult: {
            IdToken: mockIdToken,
            AccessToken: 'access_123',
            RefreshToken: 'refresh_123',
            ExpiresIn: 3600,
          },
        }),
      } as unknown as Response)
      // 2. ListWebAuthnCredentials
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Credentials: [
            {
              CredentialId: 'cred_abc',
              FriendlyCredentialName: 'My iPhone',
              CreatedAt: 1720000000000,
            },
          ],
        }),
      } as unknown as Response)
      // 3. DeleteWebAuthnCredential
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

    await AuthService.signIn('test@example.com', 'Password123!');

    const keys = await AuthService.listPasskeys();
    expect(keys).toHaveLength(1);
    expect(keys[0].credentialId).toBe('cred_abc');
    expect(keys[0].friendlyCredentialName).toBe('My iPhone');

    await expect(AuthService.deletePasskey('cred_abc')).resolves.not.toThrow();
  });

  it('signs out properly and clears session', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        AuthenticationResult: {
          IdToken: mockIdToken,
          AccessToken: 'access_123',
          RefreshToken: 'refresh_123',
          ExpiresIn: 3600,
        },
      }),
    } as unknown as Response);

    await AuthService.signIn('test@example.com', 'Password123!');
    expect(AuthService.isAuthenticated()).toBe(true);

    AuthService.signOut();
    expect(AuthService.isAuthenticated()).toBe(false);
    expect(AuthService.getSession()).toBeNull();
  });
});
