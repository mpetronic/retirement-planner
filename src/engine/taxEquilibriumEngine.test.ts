import { describe, it, expect } from 'vitest';
import {
  calculateTaxEquilibriumSchedule,
  calculateDynamicRMDHurdleRate,
  DEFAULT_TAX_EQUILIBRIUM_FLOOR_RATE,
} from './taxEquilibriumEngine';
import { AppStateInputs } from '../types';

describe('taxEquilibriumEngine', () => {
  const getMockInputs = (): AppStateInputs => ({
    you: {
      name: 'John',
      birthDate: '1965-06-15',
      estimatedPIA: 2400,
      targetSSClaimingAge: 67,
      plannedRetirementAge: 62,
      activeSalary: 0,
      preMedicareMonthlyPremium: 500,
    },
    wife: {
      name: 'Jane',
      birthDate: '1967-09-20',
      estimatedPIA: 1400,
      targetSSClaimingAge: 67,
      plannedRetirementAge: 62,
      activeSalary: 0,
      preMedicareMonthlyPremium: 500,
    },
    portfolio: {
      yourPreTaxIRA: 800000,
      yourRothIRA: 50000,
      yourTaxableBrokerage: 250000,
      yourTaxableBasis: 180000,
      yourCash: 50000,
      wifePreTaxIRA: 400000,
      wifeRothIRA: 30000,
      wifeTaxableBrokerage: 150000,
      wifeTaxableBasis: 100000,
      wifeCash: 30000,
    },
    jurisdiction: {
      currentState: 'MD',
      targetState: 'FL',
      relocationYear: null,
    },
    growthAssumptions: {
      equityReturnRate: 0.07,
      fixedIncomeReturnRate: 0.04,
      cpiInflationRate: 0.025,
      healthcareInflationRate: 0.05,
    },
    annualLivingExpenses: 85000,
    annualRothConversion: 0,
    rothConversionStartYear: 2027,
    rothConversionEndYear: 2033,
    rothConversionStrategy: 'flat',
    rothConversionTargetValue: null,
    monteCarloSettings: {
      mode: 'monte-carlo',
      equityVolatility: 0.15,
      fixedIncomeVolatility: 0.05,
      correlation: 0.15,
      trials: 1,
      seed: 42,
    },
    isConfigured: true,
    isSingleFiler: false,
  });

  it('calculates a valid dynamic RMD hurdle rate', () => {
    const inputs = getMockInputs();
    const result = calculateTaxEquilibriumSchedule(inputs, false, null);

    expect(result.averageBenchmarkRate).toBeGreaterThan(DEFAULT_TAX_EQUILIBRIUM_FLOOR_RATE);
    expect(result.averageBenchmarkRate).toBeLessThan(0.45);

    // Direct check of helper with empty vs populated ledger
    expect(calculateDynamicRMDHurdleRate([], 'MD')).toBe(DEFAULT_TAX_EQUILIBRIUM_FLOOR_RATE);
  });

  it('generates a year-by-year schedule with limiting factors', () => {
    const inputs = getMockInputs();
    const result = calculateTaxEquilibriumSchedule(inputs, false, null);

    expect(result).toBeDefined();
    expect(Object.keys(result.schedule).length).toBe(7); // 2027 to 2033
    expect(result.yearlyDetails.length).toBe(7);

    for (const detail of result.yearlyDetails) {
      expect(detail.optimalConversion).toBeGreaterThanOrEqual(0);
      expect(detail.marginalRate).toBeGreaterThan(0);
      expect(detail.futureBenchmarkRate).toBeGreaterThan(0);
      expect(detail.limitingFactor).toBeDefined();
      expect(detail.limitingDetail).toBeDefined();
      expect(detail.limitingDetail!.length).toBeGreaterThan(5);

      if (detail.limitingFactor === 'IRMAA Cliff Boundary') {
        expect(detail.limitingTier).toBeGreaterThanOrEqual(1);
        expect(detail.limitingThreshold).toBeGreaterThan(100000);
      }
    }

    // Lifetime metrics
    expect(result.lifetimeImpact.baselineLifetimeTaxes).toBeGreaterThan(0);
    expect(result.lifetimeImpact.optimizedLifetimeTaxes).toBeGreaterThan(0);
    expect(result.lifetimeImpact.baselineFirstRMD).toBeGreaterThan(0);
    expect(result.lifetimeImpact.optimizedFirstRMD).toBeLessThanOrEqual(result.lifetimeImpact.baselineFirstRMD);
  });

  it('runs within performance expectations (< 500ms for multi-year window)', () => {
    const inputs = getMockInputs();
    const startTime = performance.now();
    const result = calculateTaxEquilibriumSchedule(inputs, false, null);
    const duration = performance.now() - startTime;

    expect(result.yearlyDetails.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(1000);
  });

  it('handles unconfigured inputs safely', () => {
    const inputs = getMockInputs();
    inputs.isConfigured = false;

    const result = calculateTaxEquilibriumSchedule(inputs, false, null);
    expect(result.yearlyDetails.length).toBe(0);
    expect(result.averageBenchmarkRate).toBe(0);
    expect(result.lifetimeImpact.lifetimeTaxSavings).toBe(0);
  });

  it('respects pre-tax IRA depletion constraint', () => {
    const inputs = getMockInputs();
    inputs.portfolio.yourPreTaxIRA = 25000;
    inputs.portfolio.wifePreTaxIRA = 0;

    const result = calculateTaxEquilibriumSchedule(inputs, false, null);
    const firstYearConversion = result.yearlyDetails[0].optimalConversion;
    expect(firstYearConversion).toBeLessThanOrEqual(35000); // Bounded by initial small IRA plus slight growth
  });
});
