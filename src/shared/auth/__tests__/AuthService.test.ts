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
  beforeEach(() => {
    const mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', {
      localStorage: mockStorage,
      dispatchEvent: vi.fn(),
    });
    AuthService.signOut();
    vi.restoreAllMocks();
  });

  it('starts unauthenticated when localStorage is empty', () => {
    expect(AuthService.isAuthenticated()).toBe(false);
    expect(AuthService.getSession()).toBeNull();
    expect(AuthService.getHouseholdId()).toBe('local_household');
  });

  it('signs in successfully and saves session tokens', async () => {
    const mockIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiY3VzdG9tOmhvdXNlaG9sZF9pZCI6ImhvdXNlaG9sZF85OSIsImV4cCI6OTk5OTk5OTk5OX0.dummy';
    
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

  it('signs out properly', async () => {
    const mockIdToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiY3VzdG9tOmhvdXNlaG9sZF9pZCI6ImhvdXNlaG9sZF85OSIsImV4cCI6OTk5OTk5OTk5OX0.dummy';
    
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
