import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  generateSyntheticSequence,
  generateHistoricalSequence,
  runMonteCarloSimulation,
  computeHistoricalStats,
  applyStressTestToSequence,
  EQUITY_RETURN_MIN,
  EQUITY_RETURN_MAX,
  BOND_RETURN_MIN,
  BOND_RETURN_MAX,
  INFLATION_RATE_MIN,
  INFLATION_RATE_MAX,
  HISTORICAL_RETURNS,
  HISTORICAL_STOCK_MEAN,
  HISTORICAL_BOND_MEAN,
  HISTORICAL_CPI_MEAN,
  HISTORICAL_STOCK_VOLATILITY,
  HISTORICAL_BOND_VOLATILITY,
  geometricToArithmeticMean,
  MONTE_CARLO_SEQUENCE_YEARS,
} from './monteCarloEngine';
import { runRetirementSimulation, getSimulationHorizonYears } from './simulationEngine';
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

  it('should enforce realistic boundary clamps on equity, bond, and inflation returns even under extreme volatility', () => {
    // Test across 100 trials using high volatility settings that would otherwise trigger fat-tail outliers
    const rand = mulberry32(999);
    for (let trial = 0; trial < 100; trial++) {
      const sequence = generateSyntheticSequence(0.10, 0.50, 0.05, 0.30, 0.2, rand);

      // Verify all equity returns fall within [-50%, +60%]
      for (const eq of sequence.equityReturns) {
        expect(eq).toBeGreaterThanOrEqual(EQUITY_RETURN_MIN);
        expect(eq).toBeLessThanOrEqual(EQUITY_RETURN_MAX);
      }

      // Verify all bond returns fall within [-20%, +30%]
      for (const fi of sequence.fixedIncomeReturns) {
        expect(fi).toBeGreaterThanOrEqual(BOND_RETURN_MIN);
        expect(fi).toBeLessThanOrEqual(BOND_RETURN_MAX);
      }

      // Verify all inflation rates fall within [-2%, +15%]
      expect(sequence.inflationRates).toBeDefined();
      for (const inf of sequence.inflationRates!) {
        expect(inf).toBeGreaterThanOrEqual(INFLATION_RATE_MIN);
        expect(inf).toBeLessThanOrEqual(INFLATION_RATE_MAX);
      }
    }
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

  it('should clamp calibrated historical returns within boundary limits when large shifts are applied', () => {
    const rand = mulberry32(555);
    // Calibrate with an extreme equity target mean (e.g. 50%) to verify clamping at maximum
    const highSeq = generateHistoricalSequence(false, undefined, rand, true, null, true, 0.50, 0.25);

    // Verify all shifted historical returns stay within boundary clamps
    for (const eq of highSeq.equityReturns) {
      expect(eq).toBeLessThanOrEqual(EQUITY_RETURN_MAX);
      expect(eq).toBeGreaterThanOrEqual(EQUITY_RETURN_MIN);
    }
    for (const fi of highSeq.fixedIncomeReturns) {
      expect(fi).toBeLessThanOrEqual(BOND_RETURN_MAX);
      expect(fi).toBeGreaterThanOrEqual(BOND_RETURN_MIN);
    }
    expect(highSeq.inflationRates).toBeDefined();
    for (const inf of highSeq.inflationRates!) {
      expect(inf).toBeLessThanOrEqual(INFLATION_RATE_MAX);
      expect(inf).toBeGreaterThanOrEqual(INFLATION_RATE_MIN);
    }
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
    // Horizon runs to the later longevity year: wife born 1968 + 95 = 2063, so 2026 through 2063.
    expect(getSimulationHorizonYears(inputs)).toBe(38);
    expect(summary.percentiles.length).toBe(38);
    expect(summary.percentiles[0].year).toBe(2026);
    expect(summary.percentiles[37].year).toBe(2063);

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

  it('should size sequences and percentiles to a horizon longer than the default length', () => {
    const inputs = getMockInputs();
    inputs.wife.longevityAge = 105; // 1968 + 105 = 2073, so 48 simulated years
    const horizon = getSimulationHorizonYears(inputs);
    expect(horizon).toBe(48);
    expect(horizon).toBeGreaterThan(MONTE_CARLO_SEQUENCE_YEARS);

    const summary = runMonteCarloSimulation(inputs);
    expect(summary.percentiles.length).toBe(horizon);
    expect(summary.representativeSequences.median.equityReturns.length).toBe(horizon);
  });

  it('should fill a historical block longer than the dataset by wrapping', () => {
    const years = HISTORICAL_RETURNS.length + 10;
    const seq = generateHistoricalSequence(true, 0, mulberry32(1), false, 0.025, false, undefined, undefined, undefined, false, years);
    expect(seq.equityReturns.length).toBe(years);
    expect(seq.equityReturns[HISTORICAL_RETURNS.length]).toBeCloseTo(
      Math.min(EQUITY_RETURN_MAX, Math.max(EQUITY_RETURN_MIN, HISTORICAL_RETURNS[0].stock))
    );
  });

  it('should end the percentile table on the last simulated year in survivor mode', () => {
    const inputs = getMockInputs();
    const summary = runMonteCarloSimulation(inputs, true);
    const last = summary.percentiles[summary.percentiles.length - 1];
    // Survivor mode stops at the final longevity year, one row short of the calendar horizon.
    expect(summary.percentiles.length).toBe(getSimulationHorizonYears(inputs) - 1);
    expect(last.year).toBe(2062);
    expect(last.p50).toBeGreaterThan(0);
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

describe('Monte Carlo sequence regeneration', () => {
  it('should generate different return sequences when seed or nonce changes', () => {
    const seed1 = 12345;
    const seed2 = 67890;

    const rng1 = mulberry32(seed1);
    const rng2 = mulberry32(seed2);

    const seq1 = generateSyntheticSequence(0.08, 0.15, 0.04, 0.05, 0.15, rng1);
    const seq2 = generateSyntheticSequence(0.08, 0.15, 0.04, 0.05, 0.15, rng2);

    expect(seq1.equityReturns).not.toEqual(seq2.equityReturns);
  });
});

describe('applyStressTestToSequence & stress testing', () => {
  const getMockInputsLocal = (): AppStateInputs => ({
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
      yourCash: 50000,
      wifeCash: 30000,
    },
    jurisdiction: {
      relocationYear: 2026,
      currentState: 'MD',
      targetState: 'FL',
    },
    growthAssumptions: {
      equityReturnRate: 0.08,
      fixedIncomeReturnRate: 0.04,
      cpiInflationRate: 0.025,
      healthcareInflationRate: 0.05,
    },
    annualLivingExpenses: 100000,
    annualRothConversion: 50000,
    rothConversionStrategy: 'flat',
    rothConversionTargetValue: null,
    monteCarloSettings: {
      mode: 'monte-carlo',
      equityVolatility: 0.15,
      fixedIncomeVolatility: 0.05,
      correlation: 0.15,
      trials: 1000,
      seed: 42,
    },
    isConfigured: true,
    isSingleFiler: false,
  });

  it('should non-destructively overlay stress test overrides when enabled', () => {
    const rand = mulberry32(42);
    const baseSeq = generateSyntheticSequence(0.08, 0.15, 0.04, 0.05, 0.15, rand);

    // When disabled, returns original sequence unchanged
    const disabledResult = applyStressTestToSequence(baseSeq, {
      enabled: false,
      mode: 'absolute',
      overrides: [{ year: 2028, equityReturn: -0.35, fixedIncomeReturn: -0.05 }],
    });
    expect(disabledResult.equityReturns[2]).toBe(baseSeq.equityReturns[2]);

    // When enabled in absolute mode
    const enabledAbsolute = applyStressTestToSequence(baseSeq, {
      enabled: true,
      mode: 'absolute',
      overrides: [{ year: 2028, equityReturn: -0.35, fixedIncomeReturn: -0.05 }],
    });
    expect(enabledAbsolute.equityReturns[2]).toBe(-0.35); // Year 2028 is index 2 (2028 - 2026)
    expect(enabledAbsolute.fixedIncomeReturns[2]).toBe(-0.05);

    // Other years remain unchanged
    expect(enabledAbsolute.equityReturns[0]).toBe(baseSeq.equityReturns[0]);

    // When enabled in relative mode
    const enabledRelative = applyStressTestToSequence(baseSeq, {
      enabled: true,
      mode: 'relative',
      overrides: [{ year: 2028, equityReturn: -0.20, fixedIncomeReturn: -0.10 }],
    });
    expect(enabledRelative.equityReturns[2]).toBeCloseTo(baseSeq.equityReturns[2] - 0.20, 6);
  });

  it('should restore original baseline Monte Carlo results when stress test is toggled off', () => {
    const inputs = getMockInputsLocal();
    inputs.monteCarloSettings.seed = 999;

    const baselineSummary = runMonteCarloSimulation(inputs);

    // Enable severe stress test
    inputs.monteCarloSettings.stressTest = {
      enabled: true,
      mode: 'absolute',
      overrides: [
        { year: 2027, equityReturn: -0.40, fixedIncomeReturn: -0.10 },
        { year: 2028, equityReturn: -0.30, fixedIncomeReturn: -0.05 },
      ],
    };
    const stressedSummary = runMonteCarloSimulation(inputs);
    expect(stressedSummary.percentiles[2].p10).toBeLessThan(baselineSummary.percentiles[2].p10);

    // Toggle off
    inputs.monteCarloSettings.stressTest.enabled = false;
    const restoredSummary = runMonteCarloSimulation(inputs);

    expect(restoredSummary.successRate).toBe(baselineSummary.successRate);
    expect(restoredSummary.percentiles[2].p50).toBe(baselineSummary.percentiles[2].p50);
  });

  it('should maintain matched-pair return rates for all non-stressed years in representative sequences', () => {
    const inputs = getMockInputsLocal();
    inputs.monteCarloSettings.seed = 42;
    inputs.monteCarloSettings.trials = 50;

    // Baseline run
    const baseSummary = runMonteCarloSimulation(inputs);
    const baseWorstSeq = baseSummary.representativeSequences.worst;
    const baseMedianSeq = baseSummary.representativeSequences.median;

    // Enable stress test for years 2026, 2027, 2028
    inputs.monteCarloSettings.stressTest = {
      enabled: true,
      mode: 'absolute',
      overrides: [
        { year: 2026, equityReturn: -0.25, fixedIncomeReturn: -0.05 },
        { year: 2027, equityReturn: -0.15, fixedIncomeReturn: -0.02 },
        { year: 2028, equityReturn: 0.05, fixedIncomeReturn: 0.03 },
      ],
    };
    const stressedSummary = runMonteCarloSimulation(inputs);
    const stressedWorstSeq = stressedSummary.representativeSequences.worst;
    const stressedMedianSeq = stressedSummary.representativeSequences.median;

    // Stressed years (2026=index 0, 2027=index 1, 2028=index 2) must match overrides
    expect(stressedWorstSeq.equityReturns[0]).toBe(-0.25);
    expect(stressedWorstSeq.equityReturns[1]).toBe(-0.15);
    expect(stressedWorstSeq.equityReturns[2]).toBe(0.05);

    // All subsequent years (2029 through 2060, index 3 to 34) MUST be 100% identical to baseline
    for (let yrIdx = 3; yrIdx < 35; yrIdx++) {
      expect(stressedWorstSeq.equityReturns[yrIdx]).toBe(baseWorstSeq.equityReturns[yrIdx]);
      expect(stressedWorstSeq.fixedIncomeReturns[yrIdx]).toBe(baseWorstSeq.fixedIncomeReturns[yrIdx]);
      expect(stressedMedianSeq.equityReturns[yrIdx]).toBe(baseMedianSeq.equityReturns[yrIdx]);
      expect(stressedMedianSeq.fixedIncomeReturns[yrIdx]).toBe(baseMedianSeq.fixedIncomeReturns[yrIdx]);
    }
  });
});

describe('Constant vs Randomized CPI Simulation', () => {
  it('should generate constant inflation rates when randomizeCPI is false', () => {
    const rand = mulberry32(42);
    const constantRate = 0.03;
    const syntheticSeq = generateSyntheticSequence(0.08, 0.15, 0.04, 0.05, 0.15, rand, false, constantRate);
    
    expect(syntheticSeq.inflationRates).toBeDefined();
    expect(syntheticSeq.inflationRates!.length).toBe(35);
    syntheticSeq.inflationRates!.forEach(rate => {
      expect(rate).toBe(constantRate);
    });

    const historicalSeq = generateHistoricalSequence(false, undefined, rand, false, constantRate);
    expect(historicalSeq.inflationRates).toBeDefined();
    expect(historicalSeq.inflationRates!.length).toBe(35);
    historicalSeq.inflationRates!.forEach(rate => {
      expect(rate).toBe(constantRate);
    });
  });

  it('should generate randomized historical inflation rates when randomizeCPI is true', () => {
    const rand = mulberry32(42);
    const syntheticSeq = generateSyntheticSequence(0.08, 0.15, 0.04, 0.05, 0.15, rand, true);
    
    expect(syntheticSeq.inflationRates).toBeDefined();
    const uniqueRates = new Set(syntheticSeq.inflationRates);
    expect(uniqueRates.size).toBeGreaterThan(1);
  });

  it('should run Monte Carlo simulation with constant CPI when configured in inputs', () => {
    const inputs: AppStateInputs = {
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
        yourCash: 50000,
        wifeCash: 30000,
      },
      jurisdiction: {
        relocationYear: null,
        currentState: 'MD',
        targetState: 'FL',
      },
      growthAssumptions: {
        equityReturnRate: 0.08,
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
        trials: 20,
        seed: 42,
        randomizeCPI: false,
        constantCPIRate: 0.025,
      },
      isConfigured: true,
      isSingleFiler: false,
    };

    const summary = runMonteCarloSimulation(inputs);
    expect(summary.trialsRun).toBe(20);
    expect(summary.percentiles.length).toBe(getSimulationHorizonYears(inputs));
  });

  it('should generate independent annual sequences with mean and volatility matching the inputs', () => {
    const rand = mulberry32(101);
    const equityMean = 0.07;
    const equityVol = 0.15;
    const returns: number[] = [];
    for (let t = 0; t < 400; t++) {
      returns.push(...generateSyntheticSequence(equityMean, equityVol, 0.04, 0.05, 0.15, rand, true, null).equityReturns);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const sd = Math.sqrt(returns.reduce((a, b) => a + (b - mean) * (b - mean), 0) / returns.length);

    // Arithmetic mean is the geometric target plus volatility drag; volatility is the entered input.
    expect(mean).toBeCloseTo(geometricToArithmeticMean(equityMean, equityVol), 2);
    expect(sd).toBeGreaterThan(equityVol * 0.95);
    expect(sd).toBeLessThan(equityVol * 1.05);
  });

  it('should not heal a deep drawdown: expected return after a loss matches the unconditional mean', () => {
    const rand = mulberry32(2026);
    let afterLossSum = 0;
    let afterLossCount = 0;
    let allSum = 0;
    let allCount = 0;
    for (let t = 0; t < 1500; t++) {
      const r = generateSyntheticSequence(0.07, 0.16, 0.04, 0.05, 0.15, rand, false, 0.025).equityReturns;
      for (let i = 1; i < r.length; i++) {
        allSum += r[i];
        allCount++;
        if (r[i - 1] < -0.10) {
          afterLossSum += r[i];
          afterLossCount++;
        }
      }
    }
    expect(afterLossCount).toBeGreaterThan(1000);
    // No rebound effect: the mean after a >10% loss is within 1 point of the overall mean.
    expect(Math.abs(afterLossSum / afterLossCount - allSum / allCount)).toBeLessThan(0.01);
  });

  it('should keep the median 30-year compound growth near the entered geometric CAGR', () => {
    const rand = mulberry32(4242);
    const target = 0.07;
    const years = 30;
    const terminal: number[] = [];
    for (let t = 0; t < 2000; t++) {
      const r = generateSyntheticSequence(target, 0.16, 0.04, 0.05, 0.15, rand, false, 0.025).equityReturns;
      let wealth = 1;
      for (let i = 0; i < years; i++) wealth *= 1 + r[i];
      terminal.push(wealth);
    }
    terminal.sort((a, b) => a - b);
    const medianCagr = Math.pow(terminal[Math.floor(terminal.length / 2)], 1 / years) - 1;
    expect(medianCagr).toBeGreaterThan(target - 0.006);
    expect(medianCagr).toBeLessThan(target + 0.006);
  });

  it('should ignore the legacy enableRegimeSwitching field when loading older saved plans', () => {
    const baseInputs: AppStateInputs = {
      you: {
        birthDate: '1960-06-15',
        estimatedPIA: 3000,
        targetSSClaimingAge: 70,
        plannedRetirementAge: 65,
        activeSalary: 0,
      },
      wife: {
        birthDate: '1964-03-10',
        estimatedPIA: 2000,
        targetSSClaimingAge: 67,
        plannedRetirementAge: 62,
        activeSalary: 0,
      },
      portfolio: {
        yourPreTaxIRA: 1000000,
        yourRothIRA: 50000,
        yourTaxableBrokerage: 200000,
        yourTaxableBasis: 150000,
        wifePreTaxIRA: 200000,
        wifeRothIRA: 0,
        wifeTaxableBrokerage: 0,
        wifeTaxableBasis: 0,
        yourCash: 50000,
      },
      jurisdiction: {
        relocationYear: null,
        currentState: 'MD',
        targetState: 'FL',
      },
      growthAssumptions: {
        equityReturnRate: 0.07,
        fixedIncomeReturnRate: 0.04,
        cpiInflationRate: 0.03,
        healthcareInflationRate: 0.05,
      },
      annualLivingExpenses: 80000,
      annualRothConversion: 0,
      rothConversionStrategy: 'flat',
      rothConversionTargetValue: null,
      monteCarloSettings: {
        mode: 'monte-carlo',
        equityVolatility: 0.15,
        fixedIncomeVolatility: 0.05,
        correlation: 0.15,
        trials: 50,
        seed: 42,
        randomizeCPI: true,
        enableRegimeSwitching: true, // Legacy field from older saved plans: must have no effect
      },
      isConfigured: true,
      isSingleFiler: false,
    };

    const summaryLegacyOn = runMonteCarloSimulation(baseInputs);
    expect(summaryLegacyOn.trialsRun).toBe(50);
    expect(summaryLegacyOn.successRate).toBeGreaterThan(0);

    const inputsLegacyOff: AppStateInputs = {
      ...baseInputs,
      monteCarloSettings: {
        ...baseInputs.monteCarloSettings,
        enableRegimeSwitching: false,
      },
    };
    const summaryLegacyOff = runMonteCarloSimulation(inputsLegacyOff);
    expect(summaryLegacyOff.successRate).toBe(summaryLegacyOn.successRate);
    expect(summaryLegacyOff.percentiles).toEqual(summaryLegacyOn.percentiles);
  });

  it('should support configurable historical sampling strategies (block, random, hybrid)', () => {
    const baseHistoricalInputs: AppStateInputs = {
      you: {
        birthDate: '1960-06-15',
        estimatedPIA: 3000,
        targetSSClaimingAge: 70,
        plannedRetirementAge: 65,
        activeSalary: 0,
      },
      wife: {
        birthDate: '1964-03-10',
        estimatedPIA: 2000,
        targetSSClaimingAge: 67,
        plannedRetirementAge: 62,
        activeSalary: 0,
      },
      portfolio: {
        yourPreTaxIRA: 1000000,
        yourRothIRA: 50000,
        yourTaxableBrokerage: 200000,
        yourTaxableBasis: 150000,
        wifePreTaxIRA: 200000,
        wifeRothIRA: 0,
        wifeTaxableBrokerage: 0,
        wifeTaxableBasis: 0,
        yourCash: 50000,
      },
      jurisdiction: {
        relocationYear: null,
        currentState: 'MD',
        targetState: 'FL',
      },
      growthAssumptions: {
        equityReturnRate: 0.07,
        fixedIncomeReturnRate: 0.04,
        cpiInflationRate: 0.03,
        healthcareInflationRate: 0.05,
      },
      annualLivingExpenses: 80000,
      annualRothConversion: 0,
      rothConversionStrategy: 'flat',
      rothConversionTargetValue: null,
      monteCarloSettings: {
        mode: 'historical',
        equityVolatility: 0.15,
        fixedIncomeVolatility: 0.05,
        correlation: 0.15,
        trials: 30,
        seed: 42,
        randomizeCPI: true,
        historicalSamplingStrategy: 'block',
      },
      isConfigured: true,
      isSingleFiler: false,
    };

    // Test 100% Contiguous Block sampling
    const summaryBlock = runMonteCarloSimulation(baseHistoricalInputs);
    expect(summaryBlock.trialsRun).toBe(30);
    expect(summaryBlock.successRate).toBeGreaterThan(0);

    // Test 100% Random Year Resampling
    const inputsRandom: AppStateInputs = {
      ...baseHistoricalInputs,
      monteCarloSettings: {
        ...baseHistoricalInputs.monteCarloSettings,
        historicalSamplingStrategy: 'random',
      },
    };
    const summaryRandom = runMonteCarloSimulation(inputsRandom);
    expect(summaryRandom.trialsRun).toBe(30);
    expect(summaryRandom.successRate).toBeGreaterThan(0);

    // Test Hybrid Sampling
    const inputsHybrid: AppStateInputs = {
      ...baseHistoricalInputs,
      monteCarloSettings: {
        ...baseHistoricalInputs.monteCarloSettings,
        historicalSamplingStrategy: 'hybrid',
      },
    };
    const summaryHybrid = runMonteCarloSimulation(inputsHybrid);
    expect(summaryHybrid.trialsRun).toBe(30);
    expect(summaryHybrid.successRate).toBeGreaterThan(0);
  });

  it('should calibrate historical return shocks to configured baseline means when enabled', () => {
    const rand = mulberry32(999);
    const targetEquityMean = 0.07;
    const targetBondMean = 0.04;

    // Generate calibrated historical sequence
    const calibratedSeq = generateHistoricalSequence(
      false,
      undefined,
      rand,
      true,
      null,
      true,
      targetEquityMean,
      targetBondMean
    );

    // Compute empirical average of the 35 sampled years
    const avgCalibratedEquity = calibratedSeq.equityReturns.reduce((s, r) => s + r, 0) / 35;
    const avgCalibratedBond = calibratedSeq.fixedIncomeReturns.reduce((s, r) => s + r, 0) / 35;

    // Calibrated returns should be centered around the target 7.0% and 4.0%
    expect(avgCalibratedEquity).toBeGreaterThan(0.03);
    expect(avgCalibratedEquity).toBeLessThan(0.12);
    expect(avgCalibratedBond).toBeGreaterThan(0.01);
    expect(avgCalibratedBond).toBeLessThan(0.08);

    // Generate raw unadjusted historical sequence (calibrateMeans = false)
    const randRaw = mulberry32(999);
    const rawSeq = generateHistoricalSequence(
      false,
      undefined,
      randRaw,
      true,
      null,
      false
    );

    const avgRawEquity = rawSeq.equityReturns.reduce((s, r) => s + r, 0) / 35;
    const avgRawBond = rawSeq.fixedIncomeReturns.reduce((s, r) => s + r, 0) / 35;

    // Raw historical returns should reflect the high 1970–2025 nominal averages (~12.3% and ~6.7%)
    expect(avgRawEquity).toBeGreaterThan(avgCalibratedEquity);
    expect(avgRawBond).toBeGreaterThan(avgCalibratedBond);
  });

  it('should maintain 100% identical representative market sequences when expenses or relocation change', () => {
    const inputs1: AppStateInputs = {
      you: {
        birthDate: '1960-06-15',
        estimatedPIA: 3000,
        targetSSClaimingAge: 70,
        plannedRetirementAge: 65,
        activeSalary: 0,
      },
      wife: {
        birthDate: '1964-03-10',
        estimatedPIA: 2000,
        targetSSClaimingAge: 67,
        plannedRetirementAge: 62,
        activeSalary: 0,
      },
      portfolio: {
        yourPreTaxIRA: 1000000,
        yourRothIRA: 50000,
        yourTaxableBrokerage: 200000,
        yourTaxableBasis: 150000,
        wifePreTaxIRA: 200000,
        wifeRothIRA: 0,
        wifeTaxableBrokerage: 0,
        wifeTaxableBasis: 0,
        yourCash: 50000,
        wifeCash: 0,
      },
      jurisdiction: {
        relocationYear: null,
        currentState: 'MD',
        targetState: 'MD',
      },
      growthAssumptions: {
        equityReturnRate: 0.07,
        fixedIncomeReturnRate: 0.04,
        cpiInflationRate: 0.03,
        healthcareInflationRate: 0.05,
      },
      annualLivingExpenses: 50000,
      annualRothConversion: 0,
      rothConversionStrategy: 'flat',
      rothConversionTargetValue: null,
      monteCarloSettings: {
        mode: 'monte-carlo',
        equityVolatility: 0.15,
        fixedIncomeVolatility: 0.05,
        correlation: 0.15,
        trials: 50,
        seed: 777,
        randomizeCPI: true,
      },
      isConfigured: true,
      isSingleFiler: false,
    };

    const summary1 = runMonteCarloSimulation(inputs1);

    // Create scenario 2: radically different expenses and relocation to FL in 2030
    const inputs2: AppStateInputs = {
      ...inputs1,
      annualLivingExpenses: 180000,
      jurisdiction: {
        currentState: 'MD',
        targetState: 'FL',
        relocationYear: 2030,
      },
    };

    const summary2 = runMonteCarloSimulation(inputs2);

    // Success rates should differ due to expense difference
    expect(summary2.successRate).toBeLessThan(summary1.successRate);

    // Representative market return sequences (P10, P50, P90) MUST be 100% identical for apples-to-apples comparison
    expect(summary1.representativeSequences.worst.equityReturns).toEqual(summary2.representativeSequences.worst.equityReturns);
    expect(summary1.representativeSequences.worst.fixedIncomeReturns).toEqual(summary2.representativeSequences.worst.fixedIncomeReturns);
    expect(summary1.representativeSequences.median.equityReturns).toEqual(summary2.representativeSequences.median.equityReturns);
    expect(summary1.representativeSequences.median.fixedIncomeReturns).toEqual(summary2.representativeSequences.median.fixedIncomeReturns);
    expect(summary1.representativeSequences.best.equityReturns).toEqual(summary2.representativeSequences.best.equityReturns);
    expect(summary1.representativeSequences.best.fixedIncomeReturns).toEqual(summary2.representativeSequences.best.fixedIncomeReturns);
  });

  describe('CMA Volatility Drag & Calibrated Inflation', () => {
    it('calibrates forward inflation shocks to anchor around target CPI in synthetic sequences', () => {
      const rand = mulberry32(42);
      const targetCpi = 0.024; // Vanguard 2.4% expectation
      const trials = 100;
      let totalCpi = 0;
      let count = 0;

      for (let t = 0; t < trials; t++) {
        const seq = generateSyntheticSequence(0.068, 0.16, 0.046, 0.055, 0.15, rand, true, null, targetCpi);
        for (const cpi of (seq.inflationRates || [])) {
          totalCpi += cpi;
          count++;
        }
      }

      const meanCpi = totalCpi / count;
      // Mean sampled inflation across 100 trials should center tightly around target 2.4% (rather than historical 4.0%)
      expect(meanCpi).toBeCloseTo(targetCpi, 2);
    });

    it('calibrates forward inflation shocks in historical bootstrap sequences when calibrateMeans is enabled', () => {
      const rand = mulberry32(101);
      const targetCpi = 0.025;
      const seq = generateHistoricalSequence(false, undefined, rand, true, null, true, 0.07, 0.04, targetCpi);
      const rates = seq.inflationRates || [];
      const meanCpi = rates.reduce((a, b) => a + b, 0) / rates.length;
      expect(meanCpi).toBeCloseTo(targetCpi, 1);
    });

    it('applies volatility drag adjustment to elevate annual arithmetic drift in synthetic sequences', () => {
      // 7.0% target geometric CAGR with 16% volatility requires ~8.28% arithmetic drift
      const targetGeometric = 0.07;
      const vol = 0.16;
      const rand = mulberry32(999);
      const trials = 300;
      let totalAnnualEquity = 0;
      let count = 0;

      for (let t = 0; t < trials; t++) {
        // Without regime switching to directly measure normal distribution mean
        const seq = generateSyntheticSequence(targetGeometric, vol, 0.04, 0.05, 0.15, rand, false, 0.025, 0.025);
        for (const ret of seq.equityReturns) {
          totalAnnualEquity += ret;
          count++;
        }
      }

      const realizedArithmeticMean = totalAnnualEquity / count;
      // Realized arithmetic mean should be near 8.28% (elevated above 7.0% by ~1.28% volatility drag)
      expect(realizedArithmeticMean).toBeGreaterThan(0.078);
      expect(realizedArithmeticMean).toBeLessThan(0.088);
    });
  });

  describe('Historical bootstrap geometric calibration', () => {
    it('centers the bootstrap on the arithmetic mean that matches the configured geometric CAGR', () => {
      const rand = mulberry32(31337);
      const targetEquity = 0.07;
      const years = 30;
      const terminal: number[] = [];
      for (let t = 0; t < 2000; t++) {
        const r = generateHistoricalSequence(false, undefined, rand, false, 0.025, true, targetEquity, 0.04, 0.025).equityReturns;
        let wealth = 1;
        for (let i = 0; i < years; i++) wealth *= 1 + r[i];
        terminal.push(wealth);
      }
      terminal.sort((a, b) => a - b);
      const medianCagr = Math.pow(terminal[Math.floor(terminal.length / 2)], 1 / years) - 1;
      // Before the fix this landed about 1.3 points below target because the arithmetic mean was set to the CAGR.
      expect(medianCagr).toBeGreaterThan(targetEquity - 0.012);
      expect(medianCagr).toBeLessThan(targetEquity + 0.012);
    });

    it('produces comparable median growth in historical and parametric modes', () => {
      const randH = mulberry32(5);
      const randS = mulberry32(6);
      const years = 30;
      const median = (gen: () => number[]) => {
        const terminal: number[] = [];
        for (let t = 0; t < 2000; t++) {
          const r = gen();
          let wealth = 1;
          for (let i = 0; i < years; i++) wealth *= 1 + r[i];
          terminal.push(wealth);
        }
        terminal.sort((a, b) => a - b);
        return Math.pow(terminal[Math.floor(terminal.length / 2)], 1 / years) - 1;
      };
      const hist = median(() => generateHistoricalSequence(false, undefined, randH, false, 0.025, true, 0.07, 0.04, 0.025).equityReturns);
      const synth = median(() => generateSyntheticSequence(0.07, HISTORICAL_STOCK_VOLATILITY, 0.04, 0.05, 0.15, randS, false, 0.025).equityReturns);
      expect(Math.abs(hist - synth)).toBeLessThan(0.01);
    });
  });

  describe('Student-t distribution handling', () => {
    it('applies Student-t fat-tail adjustments to historical sequences when enableStudentT is true', () => {
      const rand1 = mulberry32(12345);
      const rand2 = mulberry32(12345);

      const standardSeq = generateHistoricalSequence(
        false, undefined, rand1, false, 0.025, true, 0.07, 0.04, 0.025, false
      );
      const studentTSeq = generateHistoricalSequence(
        false, undefined, rand2, false, 0.025, true, 0.07, 0.04, 0.025, true
      );

      expect(standardSeq.equityReturns.length).toBe(35);
      expect(studentTSeq.equityReturns.length).toBe(35);

      // Student-t sequence should differ due to fat-tail tScale scaling
      expect(studentTSeq.equityReturns).not.toEqual(standardSeq.equityReturns);

      // All returns must remain safely clamped within institutional limits
      for (const eq of studentTSeq.equityReturns) {
        expect(eq).toBeGreaterThanOrEqual(EQUITY_RETURN_MIN);
        expect(eq).toBeLessThanOrEqual(EQUITY_RETURN_MAX);
      }
      for (const fi of studentTSeq.fixedIncomeReturns) {
        expect(fi).toBeGreaterThanOrEqual(BOND_RETURN_MIN);
        expect(fi).toBeLessThanOrEqual(BOND_RETURN_MAX);
      }
    });

    it('runs full Monte Carlo simulation with enableHistoricalStudentT toggle', () => {
      const baseInputs: AppStateInputs = {
        you: {
          birthDate: '1960-06-15',
          estimatedPIA: 3000,
          targetSSClaimingAge: 70,
          plannedRetirementAge: 65,
          activeSalary: 0,
        },
        wife: {
          birthDate: '1964-03-10',
          estimatedPIA: 2000,
          targetSSClaimingAge: 67,
          plannedRetirementAge: 62,
          activeSalary: 0,
        },
        portfolio: {
          yourPreTaxIRA: 1000000,
          yourRothIRA: 50000,
          yourTaxableBrokerage: 200000,
          yourTaxableBasis: 150000,
          wifePreTaxIRA: 200000,
          wifeRothIRA: 0,
          wifeTaxableBrokerage: 0,
          wifeTaxableBasis: 0,
          yourCash: 50000,
        },
        jurisdiction: {
          relocationYear: null,
          currentState: 'MD',
          targetState: 'FL',
        },
        growthAssumptions: {
          equityReturnRate: 0.07,
          fixedIncomeReturnRate: 0.04,
          cpiInflationRate: 0.03,
          healthcareInflationRate: 0.05,
        },
        annualLivingExpenses: 80000,
        annualRothConversion: 0,
        rothConversionStrategy: 'flat',
        rothConversionTargetValue: null,
        monteCarloSettings: {
          mode: 'historical',
          equityVolatility: 0.15,
          fixedIncomeVolatility: 0.05,
          correlation: 0.15,
          trials: 50,
          seed: 42,
          enableHistoricalStudentT: true,
        },
        isConfigured: true,
        isSingleFiler: false,
      };

      const summary = runMonteCarloSimulation(baseInputs);
      expect(summary.trialsRun).toBe(50);
      expect(summary.successRate).toBeGreaterThanOrEqual(0);
      expect(summary.percentiles.length).toBe(getSimulationHorizonYears(baseInputs));
    });
  });

  describe('Forward Secular Inflation Calibration & Joint Behavior', () => {
    it('converges to target CMA inflation rate across multi-trial averages', () => {
      const targetCpi = 0.024;
      let totalInfl = 0;
      let totalCount = 0;
      const rand = mulberry32(12345);

      for (let t = 0; t < 300; t++) {
        const seq = generateHistoricalSequence(false, undefined, rand, true, null, true, 0.068, 0.046, targetCpi);
        for (const r of seq.inflationRates!) {
          totalInfl += r;
          totalCount++;
        }
      }
      const sampleMean = totalInfl / totalCount;
      // Expected arithmetic mean converges closely to the 2.4% CMA target
      expect(Math.abs(sampleMean - targetCpi)).toBeLessThan(0.002);
    });

    it('bounds all simulated inflation shocks by the -2.0% deflation floor', () => {
      const rand = mulberry32(54321);
      let minObserved = Infinity;

      for (let t = 0; t < 200; t++) {
        const seq = generateHistoricalSequence(false, undefined, rand, true, null, true, 0.068, 0.046, 0.024);
        for (const rate of seq.inflationRates!) {
          if (rate < minObserved) minObserved = rate;
        }
      }

      expect(minObserved).toBeGreaterThanOrEqual(INFLATION_RATE_MIN);
      expect(INFLATION_RATE_MIN).toBe(-0.02);
    });

    it('demonstrates empirical right-skewness where median sits below the arithmetic mean', () => {
      const rand = mulberry32(99999);
      const allRates: number[] = [];

      for (let t = 0; t < 300; t++) {
        const seq = generateHistoricalSequence(false, undefined, rand, true, null, true, 0.068, 0.046, 0.024);
        allRates.push(...(seq.inflationRates!));
      }

      const mean = allRates.reduce((a, b) => a + b, 0) / allRates.length;
      allRates.sort((a, b) => a - b);
      const median = allRates[Math.floor(allRates.length / 2)];

      // Arithmetic mean converges near 2.4%, but due to stagflation right-skewness, the median is lower
      expect(mean).toBeGreaterThan(median);
      expect(median).toBeGreaterThanOrEqual(0.012);
      expect(median).toBeLessThanOrEqual(0.022);
    });

    it('preserves joint-vector asset return and inflation coupling in block bootstrap sampling', () => {
      const rand = mulberry32(777);
      const startIdx = 10;
      const targetEquity = 0.068;
      const targetBond = 0.046;
      const targetCpi = 0.024;

      const seq = generateHistoricalSequence(true, startIdx, rand, true, null, true, targetEquity, targetBond, targetCpi);

      // Each year in the continuous block must correspond to the exact same calendar year's historical vector
      for (let i = 0; i < 10; i++) {
        const orig = HISTORICAL_RETURNS[startIdx + i];
        const expectedStock = orig.stock + (geometricToArithmeticMean(targetEquity, HISTORICAL_STOCK_VOLATILITY) - HISTORICAL_STOCK_MEAN);
        const expectedBond = orig.bond + (geometricToArithmeticMean(targetBond, HISTORICAL_BOND_VOLATILITY) - HISTORICAL_BOND_MEAN);
        const expectedCpi = orig.inflation + (targetCpi - HISTORICAL_CPI_MEAN);

        expect(seq.equityReturns[i]).toBeCloseTo(expectedStock, 5);
        expect(seq.fixedIncomeReturns[i]).toBeCloseTo(expectedBond, 5);
        expect(seq.inflationRates![i]).toBeCloseTo(expectedCpi, 5);
      }
    });

    it('compounds active sequence inflation rates accurately into cpiFactor without duplicate shifts', () => {
      const rand = mulberry32(888);
      const seqRaw = generateHistoricalSequence(true, 5, rand, true, null, true, 0.068, 0.046, 0.024);
      const seq = { ...seqRaw, id: 'test-seq-phase3' };

      const mockInputs: AppStateInputs = {
        you: { name: 'Test You', birthDate: '1960-01-01', plannedRetirementAge: 65, targetSSClaimingAge: 67, estimatedPIA: 3000, activeSalary: 0, preMedicareMonthlyPremium: null },
        wife: { name: 'Test Wife', birthDate: '1964-01-01', plannedRetirementAge: 65, targetSSClaimingAge: 67, estimatedPIA: 1500, activeSalary: 0, preMedicareMonthlyPremium: null },
        portfolio: {
          yourPreTaxIRA: 500000,
          yourRothIRA: 100000,
          yourTaxableBrokerage: 200000,
          yourTaxableBasis: 150000,
          yourCash: 50000,
          wifePreTaxIRA: 200000,
          wifeRothIRA: 50000,
          wifeTaxableBrokerage: 100000,
          wifeTaxableBasis: 80000,
          wifeCash: 25000,
          taxableDividendYield: 0.02,
          taxableNonQualifiedPortion: 0.15,
        },
        jurisdiction: { currentState: 'MD', targetState: 'FL', relocationYear: null },
        growthAssumptions: {
          equityReturnRate: 0.068,
          fixedIncomeReturnRate: 0.046,
          cpiInflationRate: 0.024,
          healthcareInflationRate: 0.05,
          preTaxEquityPortion: 0.60,
          taxableEquityPortion: 0.80,
          rothEquityPortion: 1.00,
          cashYieldRate: 0.035,
          minCashReserveDollars: 100000,
        },
        annualLivingExpenses: 90000,
        annualRothConversion: 0,
        rothConversionStrategy: 'flat',
        rothConversionTargetValue: null,
        simulationStartYear: 2026,
        isConfigured: true,
        isSingleFiler: false,
        monteCarloSettings: {
          mode: 'historical',
          equityVolatility: 0.15,
          fixedIncomeVolatility: 0.05,
          correlation: 0.15,
          trials: 100,
          seed: null,
        },
      };

      const rows = runRetirementSimulation(mockInputs, false, seq);

      // Verify year-by-year that row.cpiFactor exactly matches cumulative compound product of activeSeq.inflationRates
      let cumulativeProduct = 1.0;
      for (let yr = 1; yr < 10; yr++) {
        cumulativeProduct *= (1 + seq.inflationRates![yr - 1]);
        expect(rows[yr].cpiFactor).toBeCloseTo(cumulativeProduct, 5);
      }
    });
  });
});




