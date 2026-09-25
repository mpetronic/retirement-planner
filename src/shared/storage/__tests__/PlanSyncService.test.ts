import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanSyncService } from '../PlanSyncService';
import { AuthService } from '../../auth/AuthService';
import { DEFAULT_CHARITY_SETTINGS, AppStateInputs } from '../../../types';

describe('PlanSyncService', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.restoreAllMocks();
    for (const key in mockStorage) delete mockStorage[key];

    const storageObj = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
    };

    vi.stubGlobal('localStorage', storageObj);
    vi.stubGlobal('window', {
      localStorage: storageObj,
      dispatchEvent: vi.fn(),
    });
  });

  it('starts with initial status and notifies subscribers', () => {
    const statusListener = vi.fn();
    const unsub = PlanSyncService.subscribe(statusListener);
    expect(statusListener).toHaveBeenCalledWith(
      expect.objectContaining({
        isSyncing: false,
      })
    );
    unsub();
  });

  it('returns null for fetchRemotePlan when unauthenticated', async () => {
    vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(false);
    const plan = await PlanSyncService.fetchRemotePlan();
    expect(plan).toBeNull();
  });

  it('saves remote plan when authenticated and receives 200 response', async () => {
    vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(true);
    vi.spyOn(AuthService, 'getIdToken').mockResolvedValue('mock-token-xyz');
    vi.spyOn(AuthService, 'getSession').mockReturnValue({
      sub: 'user-sub-123',
      email: 'test@example.com',
      householdId: 'household-123',
      idToken: 'mock-token-xyz',
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
      expiresAt: Date.now() + 3600000,
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const mockInputs: AppStateInputs = {
      you: { name: 'Primary', birthDate: '1960-01-01', plannedRetirementAge: 65, targetSSClaimingAge: 67, estimatedPIA: 3000, activeSalary: 0, preMedicareMonthlyPremium: null },
      wife: { name: 'Spouse', birthDate: '1964-01-01', plannedRetirementAge: 67, targetSSClaimingAge: 67, estimatedPIA: 1500, activeSalary: 0, preMedicareMonthlyPremium: null },
      portfolio: { yourPreTaxIRA: 0, yourRothIRA: 0, yourTaxableBrokerage: 0, yourTaxableBasis: 0, yourCash: 0, wifePreTaxIRA: 0, wifeRothIRA: 0, wifeTaxableBrokerage: 0, wifeTaxableBasis: 0, wifeCash: 0, taxableDividendYield: 0, taxableNonQualifiedPortion: 0 },
      jurisdiction: { currentState: 'MD', targetState: 'FL', relocationYear: null },
      growthAssumptions: { equityReturnRate: 0.07, fixedIncomeReturnRate: 0.04, cpiInflationRate: 0.025, healthcareInflationRate: 0.05, minCashReserveDollars: 100000 },
      annualLivingExpenses: 100000,
      annualRothConversion: 0,
      simulationStartYear: 2026,
      rothConversionStartYear: 2027,
      rothConversionEndYear: 2032,
      rothConversionStrategy: 'flat',
      rothConversionTargetValue: null,
      isConfigured: true,
      isSingleFiler: false,
      useDetailedExpenses: false,
      charitySettings: DEFAULT_CHARITY_SETTINGS,
      monteCarloSettings: { mode: 'monte-carlo', equityVolatility: 0.15, fixedIncomeVolatility: 0.05, correlation: 0.15, trials: 1000, seed: null },
    };

    const result = await PlanSyncService.saveRemotePlan(mockInputs);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalled();
  });
});
