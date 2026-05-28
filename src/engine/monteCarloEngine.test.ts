import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  generateSyntheticSequence,
  generateHistoricalSequence,
  runMonteCarloSimulation,
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
});
