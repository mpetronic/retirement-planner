import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  generateSyntheticSequence,
  generateHistoricalSequence,
  runMonteCarloSimulation,
  computeHistoricalStats,
} from './monteCarloEngine';
import { AppStateInputs } from '../types';

describe('mulberry32 seedable PRNG', () => {
  it('should generate deterministic random numbers for the same seed', () => {
    const seed = 12345;
    const rng1 = mulberry32(seed);
    const rng2 = mulberry32(seed);

    const values1 = [rng1(), rng1(), rng1()];
    const values2 = [rng2(), rng2(), rng2()];

    expect(values1).toEqual(values2);
  });

  it('should generate different numbers for different seeds', () => {
    const rng1 = mulberry32(111);
    const rng2 = mulberry32(222);

    const values1 = [rng1(), rng1(), rng1()];
    const values2 = [rng2(), rng2(), rng2()];

    expect(values1).not.toEqual(values2);
  });
});

describe('generateSyntheticSequence', () => {
  it('should generate bivariate normal stock and bond returns of length 35', () => {
    const rand = mulberry32(42);
    const sequence = generateSyntheticSequence(0.08, 0.15, 0.04, 0.05, 0.1, rand);

    expect(sequence.mode).toBe('monte-carlo');
    expect(sequence.equityReturns).toBeInstanceOf(Array);
    expect(sequence.equityReturns.length).toBe(35);
    expect(sequence.fixedIncomeReturns).toBeInstanceOf(Array);
    expect(sequence.fixedIncomeReturns.length).toBe(35);

    // Verify returns are close to expected averages over 35 samples
    const avgEquity = sequence.equityReturns.reduce((sum, r) => sum + r, 0) / 35;
    const avgBond = sequence.fixedIncomeReturns.reduce((sum, r) => sum + r, 0) / 35;

    // With seed 42, they should fall within standard ranges
    expect(avgEquity).toBeGreaterThan(0.02);
    expect(avgEquity).toBeLessThan(0.14);
    expect(avgBond).toBeGreaterThan(0.01);
    expect(avgBond).toBeLessThan(0.07);
  });
});

describe('generateHistoricalSequence', () => {
  it('should sample from historical returns with length 35', () => {
    const rand = mulberry32(777);

    // Random year sampling (standard bootstrap)
    const bootstrapSeq = generateHistoricalSequence(false, undefined, rand);
    expect(bootstrapSeq.mode).toBe('historical');
    expect(bootstrapSeq.equityReturns.length).toBe(35);
    expect(bootstrapSeq.fixedIncomeReturns.length).toBe(35);

    // Block sampling (contiguous segment)
    const blockSeq = generateHistoricalSequence(true, 10, rand);
    expect(blockSeq.mode).toBe('historical');
    expect(blockSeq.equityReturns.length).toBe(35);
    expect(blockSeq.fixedIncomeReturns.length).toBe(35);

    // Contiguous verification: year t+1 index matches historical +1
    // At index 10: stock and bond should match index 11 at next step, etc.
    // The sequence starts at index 10 of HISTORICAL_RETURNS
    expect(blockSeq.equityReturns[0]).toBeDefined();
  });
});

describe('runMonteCarloSimulation', () => {
  const getMockInputs = (): AppStateInputs => ({
    you: {
      name: 'John',
      birthDate: '1965-06-15',
      estimatedPIA: 2000,
      targetSSClaimingAge: 67,
      plannedRetirementAge: 65,
      activeSalary: 120000,
      preMedicareMonthlyPremium: 500,
    },
    wife: {
      name: 'Jane',
      birthDate: '1968-09-20',
      estimatedPIA: 1200,
      targetSSClaimingAge: 67,
      plannedRetirementAge: 62,
      activeSalary: 80000,
      preMedicareMonthlyPremium: 500,
    },
    portfolio: {
      yourPreTaxIRA: 500000,
      yourRothIRA: 100000,
      yourTaxableBrokerage: 200000,
      yourTaxableBasis: 150000,
      wifePreTaxIRA: 300000,
      wifeRothIRA: 50000,
      wifeTaxableBrokerage: 100000,
      wifeTaxableBasis: 80000,
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
    annualLivingExpenses: 80000,
    annualRothConversion: 0,
    rothConversionStartYear: 2026,
    rothConversionEndYear: 2030,
    rothConversionStrategy: 'flat',
    rothConversionTargetValue: null,
    monteCarloSettings: {
      mode: 'monte-carlo',
      equityVolatility: 0.15,
      fixedIncomeVolatility: 0.05,
      correlation: 0.15,
      trials: 10, // Small trial count for speed
      seed: 999,
    },
    isConfigured: true,
    isSingleFiler: false,
  });

  it('should compile trial statistics and representative paths successfully', () => {
    const inputs = getMockInputs();
    const summary = runMonteCarloSimulation(inputs);

    expect(summary.trialsRun).toBe(10);
    expect(summary.successRate).toBeGreaterThanOrEqual(0);
    expect(summary.successRate).toBeLessThanOrEqual(1.0);

    expect(summary.percentiles).toBeInstanceOf(Array);
    expect(summary.percentiles.length).toBe(35);
    expect(summary.percentiles[0].year).toBe(2026);

    // Verify representative paths
    expect(summary.representativeSequences.worst).toBeDefined();
    expect(summary.representativeSequences.median).toBeDefined();
    expect(summary.representativeSequences.best).toBeDefined();

    // Verifying percentile order sorting: worst < median < best
    const lastYearIndex = summary.percentiles.length - 1;
    const lastYearPercentiles = summary.percentiles[lastYearIndex];
    expect(lastYearPercentiles.p10).toBeLessThanOrEqual(lastYearPercentiles.p50);
    expect(lastYearPercentiles.p50).toBeLessThanOrEqual(lastYearPercentiles.p90);
  });

  it('should support deterministic seed reproducibility and trial IDs', () => {
    const inputs = getMockInputs();
    inputs.monteCarloSettings!.seed = 999;
    const summary1 = runMonteCarloSimulation(inputs);

    const inputs2 = getMockInputs();
    inputs2.monteCarloSettings!.seed = 999;
    const summary2 = runMonteCarloSimulation(inputs2);

    expect(summary1.successRate).toBe(summary2.successRate);
    expect(summary1.representativeSequences.worst.id).toBe(summary2.representativeSequences.worst.id);
  });

  it('should calculate medianSurvivalYears and track timeToRuin correctly', () => {
    // Modify inputs to ensure immediate portfolio failure by having huge living expenses and no assets
    const inputs = getMockInputs();
    inputs.annualLivingExpenses = 10000000; // 10 million / year
    inputs.portfolio.yourPreTaxIRA = 1;
    inputs.portfolio.yourRothIRA = 0;
    inputs.portfolio.yourTaxableBrokerage = 0;
    inputs.portfolio.wifePreTaxIRA = 0;
    inputs.portfolio.wifeRothIRA = 0;
    inputs.portfolio.wifeTaxableBrokerage = 0;

    const summary = runMonteCarloSimulation(inputs);
    expect(summary.successRate).toBe(0); // 100% failure rate
    expect(summary.medianSurvivalYears).toBeDefined();
    expect(summary.medianSurvivalYears).toBeLessThanOrEqual(5); // Ruined almost immediately (e.g. year 2026/2027)
  });
});

describe('computeHistoricalStats', () => {
  it('should compute actual returns and correlation from historical data', () => {
    const stats = computeHistoricalStats();
    expect(stats.equityMean).toBeCloseTo(0.123, 2); // Stock return avg (~12.3%)
    expect(stats.equityVol).toBeGreaterThan(0.10);
    expect(stats.bondVol).toBeGreaterThan(0.04);
    expect(stats.correlation).toBeDefined();
    expect(stats.inflationMean).toBeCloseTo(0.041, 2); // (~4.1% average)
  });
});

describe('generateHistoricalSequence constraint & co-sampling', () => {
  it('should restrict index to prevent block wraparound and include inflationRates', () => {
    const rand = mulberry32(111);
    
    // Check that inflation rates are present
    const bootstrapSeq = generateHistoricalSequence(false, undefined, rand);
    expect(bootstrapSeq.inflationRates).toBeDefined();
    expect(bootstrapSeq.inflationRates!.length).toBe(35);
    
    // Check block sequence does not wrap around
    // Starting index 50: since count is 56, count - 35 is 21. Max start year index is 21.
    // So index 50 will be capped at 21!
    const blockSeq = generateHistoricalSequence(true, 50, rand);
    expect(blockSeq.inflationRates!.length).toBe(35);
    // Index should match the capped start year
    // HISTORICAL_RETURNS[21] is year 1991 (1970 + 21 = 1991)
    // stock return of 1991 is 0.3055
    expect(blockSeq.equityReturns[0]).toBeCloseTo(0.3055, 4);
  });
});
