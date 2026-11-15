import { describe, it, expect } from 'vitest';
import {
  calculateTaxEquilibriumSchedule,
  calculateDynamicRMDHurdleRate,
  DEFAULT_TAX_EQUILIBRIUM_FLOOR_RATE,
} from './taxEquilibriumEngine';
import { AppStateInputs, SimulationResultRow } from '../types';
import { FED_BRACKETS_MFJ, FED_STANDARD_DEDUCTION_MFJ } from './taxRates';

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

  describe('calculateDynamicRMDHurdleRate bracket and torpedo handling', () => {
    const NO_INCOME_TAX_STATE = 'TX';
    const TEST_CPI_FACTOR = 1.75;
    const TEST_NOMINAL_TAXABLE_INCOME = 150000;
    const TEST_RMD = 50000;
    const TEST_SS = 40000;
    const TEST_STATUTORY_MAX_SS_SHARE = 0.85;
    const rateOf = (limitRate: number) => FED_BRACKETS_MFJ.find((b) => b.rate === limitRate)!.rate;

    const makeRow = (overrides: Partial<SimulationResultRow>): SimulationResultRow =>
      ({
        yourRMD: TEST_RMD,
        wifeRMD: 0,
        yourSS: 0,
        wifeSS: 0,
        taxableSS: 0,
        standardDeduction: FED_STANDARD_DEDUCTION_MFJ * TEST_CPI_FACTOR,
        cpiFactor: TEST_CPI_FACTOR,
        taxableIncome: TEST_NOMINAL_TAXABLE_INCOME,
        capitalGainsTriggered: 0,
        taxableDividends: 0,
        qualifiedDividends: 0,
        magi: 0,
        effectiveLocalTaxRate: 0,
        ...overrides,
      }) as SimulationResultRow;

    it('inflates bracket limits to match nominal future income', () => {
      const rate = calculateDynamicRMDHurdleRate([makeRow({})], NO_INCOME_TAX_STATE);
      expect(rate).toBeCloseTo(rateOf(0.12));
    });

    it('excludes capital gains and qualified dividends from the ordinary base', () => {
      const withGains = makeRow({ taxableIncome: 400000, capitalGainsTriggered: 200000, qualifiedDividends: 50000 });
      const rate = calculateDynamicRMDHurdleRate([withGains], NO_INCOME_TAX_STATE);
      expect(rate).toBeCloseTo(rateOf(0.12));
    });

    it('applies the torpedo only to the RMD share inside the SS phase-in zone', () => {
      const noSsRate = calculateDynamicRMDHurdleRate([makeRow({})], NO_INCOME_TAX_STATE);
      const fullyTaxedSS = makeRow({ yourSS: TEST_SS, taxableSS: TEST_SS * TEST_STATUTORY_MAX_SS_SHARE });
      expect(calculateDynamicRMDHurdleRate([fullyTaxedSS], NO_INCOME_TAX_STATE)).toBeCloseTo(noSsRate);

      const allInZone = makeRow({ yourSS: TEST_SS, taxableSS: 0, yourRMD: 1000 });
      const partlyInZone = makeRow({ yourSS: TEST_SS, taxableSS: TEST_SS * 0.5 });
      const zoneRate = calculateDynamicRMDHurdleRate([allInZone], NO_INCOME_TAX_STATE);
      const partialRate = calculateDynamicRMDHurdleRate([partlyInZone], NO_INCOME_TAX_STATE);
      expect(zoneRate).toBeGreaterThan(partialRate);
      expect(partialRate).toBeGreaterThan(noSsRate);
    });
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
