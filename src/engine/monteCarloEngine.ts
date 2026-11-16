import { AppStateInputs, LockedReturnSequence, StressTestConfig, StressTestYearOverride, getSimulationStartYear } from '../types';
import { runRetirementSimulation, getSimulationHorizonYears } from './simulationEngine';

// Modern historical stock (S&P 500 total return) and bond (US 10-Yr Treasury total return) annual returns from 1970 to 2025.
// These 56 years provide a highly realistic distribution of modern inflation and interest rate regimes.
export interface HistoricalYear {
  year: number;
  stock: number;
  bond: number;
  inflation: number;
}

export const HISTORICAL_RETURNS: HistoricalYear[] = [
  { year: 1970, stock: 0.0401, bond: 0.1675, inflation: 0.0584 },
  { year: 1971, stock: 0.1431, bond: 0.0911, inflation: 0.0429 },
  { year: 1972, stock: 0.1898, bond: 0.0210, inflation: 0.0327 },
  { year: 1973, stock: -0.1466, bond: 0.0366, inflation: 0.0618 },
  { year: 1974, stock: -0.2647, bond: 0.0435, inflation: 0.1105 },
  { year: 1975, stock: 0.3720, bond: 0.0783, inflation: 0.0914 },
  { year: 1976, stock: 0.2384, bond: 0.1287, inflation: 0.0576 },
  { year: 1977, stock: -0.0718, bond: 0.0129, inflation: 0.0650 },
  { year: 1978, stock: 0.0656, bond: -0.0118, inflation: 0.0763 },
  { year: 1979, stock: 0.1844, bond: 0.0067, inflation: 0.1125 },
  { year: 1980, stock: 0.3242, bond: -0.0299, inflation: 0.1355 },
  { year: 1981, stock: -0.0491, bond: 0.0820, inflation: 0.1035 },
  { year: 1982, stock: 0.2141, bond: 0.2909, inflation: 0.0616 },
  { year: 1983, stock: 0.2251, bond: 0.0074, inflation: 0.0321 },
  { year: 1984, stock: 0.0627, bond: 0.1548, inflation: 0.0436 },
  { year: 1985, stock: 0.3216, bond: 0.3097, inflation: 0.0355 },
  { year: 1986, stock: 0.1847, bond: 0.2453, inflation: 0.0186 },
  { year: 1987, stock: 0.0525, bond: -0.0496, inflation: 0.0366 },
  { year: 1988, stock: 0.1681, bond: 0.0822, inflation: 0.0408 },
  { year: 1989, stock: 0.3149, bond: 0.1769, inflation: 0.0483 },
  { year: 1990, stock: -0.0317, bond: 0.0688, inflation: 0.0540 },
  { year: 1991, stock: 0.3055, bond: 0.1500, inflation: 0.0423 },
  { year: 1992, stock: 0.0762, bond: 0.0936, inflation: 0.0303 },
  { year: 1993, stock: 0.0999, bond: 0.1421, inflation: 0.0295 },
  { year: 1994, stock: 0.0132, bond: -0.0804, inflation: 0.0261 },
  { year: 1995, stock: 0.3743, bond: 0.2348, inflation: 0.0281 },
  { year: 1996, stock: 0.2296, bond: 0.0143, inflation: 0.0293 },
  { year: 1997, stock: 0.3336, bond: 0.0994, inflation: 0.0234 },
  { year: 1998, stock: 0.2858, bond: 0.1492, inflation: 0.0155 },
  { year: 1999, stock: 0.2104, bond: -0.0825, inflation: 0.0219 },
  { year: 2000, stock: -0.0910, bond: 0.1666, inflation: 0.0338 },
  { year: 2001, stock: -0.1189, bond: 0.0543, inflation: 0.0283 },
  { year: 2002, stock: -0.2210, bond: 0.1512, inflation: 0.0159 },
  { year: 2003, stock: 0.2868, bond: 0.0038, inflation: 0.0227 },
  { year: 2004, stock: 0.1088, bond: 0.0449, inflation: 0.0268 },
  { year: 2005, stock: 0.0491, bond: 0.0287, inflation: 0.0339 },
  { year: 2006, stock: 0.1579, bond: 0.0194, inflation: 0.0323 },
  { year: 2007, stock: 0.0549, bond: 0.1021, inflation: 0.0285 },
  { year: 2008, stock: -0.3700, bond: 0.2010, inflation: 0.0384 },
  { year: 2009, stock: 0.2646, bond: -0.1112, inflation: -0.0036 },
  { year: 2010, stock: 0.1506, bond: 0.0846, inflation: 0.0164 },
  { year: 2011, stock: 0.0211, bond: 0.1604, inflation: 0.0316 },
  { year: 2012, stock: 0.1600, bond: 0.0297, inflation: 0.0207 },
  { year: 2013, stock: 0.3239, bond: -0.0750, inflation: 0.0146 },
  { year: 2014, stock: 0.1369, bond: 0.1075, inflation: 0.0162 },
  { year: 2015, stock: 0.0138, bond: 0.0128, inflation: 0.0012 },
  { year: 2016, stock: 0.1196, bond: 0.0104, inflation: 0.0126 },
  { year: 2017, stock: 0.2183, bond: 0.0265, inflation: 0.0213 },
  { year: 2018, stock: -0.0438, bond: -0.0002, inflation: 0.0244 },
  { year: 2019, stock: 0.3149, bond: 0.0964, inflation: 0.0181 },
  { year: 2020, stock: 0.1840, bond: 0.0800, inflation: 0.0123 },
  { year: 2021, stock: 0.2871, bond: -0.0147, inflation: 0.0470 },
  { year: 2022, stock: -0.1811, bond: -0.1783, inflation: 0.0800 },
  { year: 2023, stock: 0.2629, bond: 0.0388, inflation: 0.0412 },
  { year: 2024, stock: 0.2400, bond: 0.0250, inflation: 0.0295 },
  { year: 2025, stock: 0.1000, bond: 0.0300, inflation: 0.0271 },
];

/**
 * Mulberry32 seedable random number generator
 */
export function mulberry32(a: number): () => number {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Box-Muller transform to generate standard normal random variables
 */
function nextGaussian(rand: () => number = Math.random): number {
  let u = 0, v = 0;
  while(u === 0) u = rand(); // Converting [0,1) to (0,1)
  while(v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Realistic institutional boundary clamps for synthetic and calibrated asset returns.
 * Equity clamp: -50% to +60% (100-year historical extremes: 1931 was -43.3%, 1933 was +54.0%).
 * Bond clamp: -20% to +30% (modern historical extreme: 2022 was -17.8%).
 * Inflation clamp: -2% to +15% (1970-2025 extremes: 2009 was -0.36%, 1980 was +13.55%).
 */
export const EQUITY_RETURN_MIN = -0.50;
export const EQUITY_RETURN_MAX = 0.60;
export const BOND_RETURN_MIN = -0.20;
export const BOND_RETURN_MAX = 0.30;
export const INFLATION_RATE_MIN = -0.02;
export const INFLATION_RATE_MAX = 0.15;

/** Number of annual steps generated per Monte Carlo return sequence. */
export const MONTE_CARLO_SEQUENCE_YEARS = 35;

/** Annual inflation used when CPI randomization is off and no constant rate is supplied. */
export const DEFAULT_CONSTANT_CPI_RATE = 0.025;

/**
 * Clamps a numeric value within specified minimum and maximum bounds.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Converts a stated geometric (compound) annual return into the arithmetic annual mean that a
 * simulation must draw so that the median compound path tracks the stated geometric return.
 *
 * Volatility drag: a portfolio that earns arithmetic mean m with annual volatility sigma compounds at
 * roughly m - sigma^2 / (2 * (1 + m)). Inverting that gives the arithmetic mean to draw.
 */
export function geometricToArithmeticMean(geometricMean: number, volatility: number): number {
  return geometricMean + (volatility * volatility) / (2 * (1 + geometricMean));
}

/**
 * Generates joint stock/bond returns for the requested number of years (default 35) using a bivariate normal distribution with
 * independent annual draws (no regime switching, no mean reversion). This is the CMA-faithful
 * parametric model: it reproduces the entered volatility and correlation and, through the volatility
 * drag adjustment, makes the median compound path track the entered geometric CAGR.
 *
 * Known limits (also documented in the in-app help): annual draws are symmetric, so the model
 * under-represents crash years relative to real history, and it has no volatility clustering. Use the
 * historical bootstrap mode as the real-history check.
 */
export function generateSyntheticSequence(
  equityMean: number,
  equityVol: number,
  bondMean: number,
  bondVol: number,
  correlation: number,
  rand: () => number = Math.random,
  randomizeCPI: boolean = true,
  constantCPIRate?: number | null,
  targetCPIRate?: number,
  years: number = MONTE_CARLO_SEQUENCE_YEARS
): Omit<LockedReturnSequence, 'id'> {
  const equityReturns: number[] = [];
  const fixedIncomeReturns: number[] = [];
  const inflationRates: number[] = [];

  // Stochastic arithmetic drift translation (calibrated discrete annual volatility drag)
  const equityDrift = geometricToArithmeticMean(equityMean, equityVol);
  const bondDrift = geometricToArithmeticMean(bondMean, bondVol);

  for (let i = 0; i < years; i++) {
    // Correlated standard normal variables (Box-Muller)
    const z1 = nextGaussian(rand);
    const z2 = nextGaussian(rand);

    const x1 = z1;
    const x2 = correlation * z1 + Math.sqrt(Math.max(0.0001, 1 - correlation * correlation)) * z2;

    const rawEquityReturn = equityDrift + equityVol * x1;
    const rawBondReturn = bondDrift + bondVol * x2;

    // Clamp to realistic historical boundaries
    equityReturns.push(clamp(rawEquityReturn, EQUITY_RETURN_MIN, EQUITY_RETURN_MAX));
    fixedIncomeReturns.push(clamp(rawBondReturn, BOND_RETURN_MIN, BOND_RETURN_MAX));

    // Inflation sampling: historical shocks re-centered on the target CPI when one is provided
    if (randomizeCPI) {
      const histIdx = Math.floor(rand() * HISTORICAL_RETURNS.length);
      const rawCpi = HISTORICAL_RETURNS[histIdx].inflation;
      const sampledCpi = targetCPIRate !== undefined ? targetCPIRate + (rawCpi - HISTORICAL_CPI_MEAN) : rawCpi;
      inflationRates.push(clamp(sampledCpi, INFLATION_RATE_MIN, INFLATION_RATE_MAX));
    } else {
      inflationRates.push(clamp(constantCPIRate ?? DEFAULT_CONSTANT_CPI_RATE, INFLATION_RATE_MIN, INFLATION_RATE_MAX));
    }
  }

  return {
    mode: 'monte-carlo',
    equityReturns,
    fixedIncomeReturns,
    inflationRates,
  };
}

// Calculate empirical dataset means across 1970–2025 for mean-calibrated bootstrapping
export const HISTORICAL_STOCK_MEAN = HISTORICAL_RETURNS.reduce((sum, y) => sum + y.stock, 0) / HISTORICAL_RETURNS.length;
export const HISTORICAL_BOND_MEAN = HISTORICAL_RETURNS.reduce((sum, y) => sum + y.bond, 0) / HISTORICAL_RETURNS.length;
export const HISTORICAL_CPI_MEAN = HISTORICAL_RETURNS.reduce((sum, y) => sum + y.inflation, 0) / HISTORICAL_RETURNS.length;

// Population standard deviation of the historical sample, used to convert a stated geometric return
// into the arithmetic mean the bootstrap must be centered on (volatility drag).
function historicalStdDev(values: number[], mean: number): number {
  const variance = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}
export const HISTORICAL_STOCK_VOLATILITY = historicalStdDev(HISTORICAL_RETURNS.map(y => y.stock), HISTORICAL_STOCK_MEAN);
export const HISTORICAL_BOND_VOLATILITY = historicalStdDev(HISTORICAL_RETURNS.map(y => y.bond), HISTORICAL_BOND_MEAN);

/**
 * Generates a historical bootstrapped sequence of the requested number of years (default 35).
 * Can be random sampling (with replacement) or contiguous block sampling.
 * Optionally calibrates (shifts) historical shocks so their compound (geometric) growth matches
 * user-configured baseline return rates, and their mean inflation matches the inflation target.
 */
export function generateHistoricalSequence(
  blockSampling: boolean = false,
  startYearIndex?: number,
  rand: () => number = Math.random,
  randomizeCPI: boolean = true,
  constantCPIRate?: number | null,
  calibrateMeans: boolean = true,
  equityMean?: number,
  bondMean?: number,
  targetCPIRate?: number,
  enableStudentT: boolean = false,
  years: number = MONTE_CARLO_SEQUENCE_YEARS
): Omit<LockedReturnSequence, 'id'> {
  const equityReturns: number[] = [];
  const fixedIncomeReturns: number[] = [];
  const inflationRates: number[] = [];
  
  // Compute calibration shift if calibrateMeans is enabled and target means are provided
  // The configured returns are geometric CAGRs, so the bootstrap sample is centered on the matching
  // arithmetic mean (geometric plus volatility drag, using the sample's own volatility).
  const stockBaseline = calibrateMeans && equityMean !== undefined
    ? geometricToArithmeticMean(equityMean, HISTORICAL_STOCK_VOLATILITY)
    : HISTORICAL_STOCK_MEAN;
  const bondBaseline = calibrateMeans && bondMean !== undefined
    ? geometricToArithmeticMean(bondMean, HISTORICAL_BOND_VOLATILITY)
    : HISTORICAL_BOND_MEAN;
  const stockShift = stockBaseline - HISTORICAL_STOCK_MEAN;
  const bondShift = bondBaseline - HISTORICAL_BOND_MEAN;
  const cpiShift = calibrateMeans && targetCPIRate !== undefined ? (targetCPIRate - HISTORICAL_CPI_MEAN) : 0;
  const df = 5;

  if (blockSampling) {
    // Select a continuous historical segment. Starting index is restricted to [0, count - years] so a
    // block that fits the dataset is fully contiguous. A block longer than the dataset wraps around
    // to the first historical year once it runs off the end.
    const count = HISTORICAL_RETURNS.length;
    const maxStartIdx = Math.max(0, count - years);
    let idx = startYearIndex !== undefined 
      ? Math.min(startYearIndex, maxStartIdx) 
      : Math.floor(rand() * (maxStartIdx + 1));
      
    for (let i = 0; i < years; i++) {
      const yearData = HISTORICAL_RETURNS[idx % count];
      let eq = yearData.stock + stockShift;
      let fi = yearData.bond + bondShift;

      if (enableStudentT) {
        let v = 0;
        for (let j = 0; j < df; j++) {
          const zi = nextGaussian(rand);
          v += zi * zi;
        }
        const tScale = Math.sqrt((df - 2) / Math.max(0.0001, v));
        eq = stockBaseline + (yearData.stock - HISTORICAL_STOCK_MEAN) * tScale;
        fi = bondBaseline + (yearData.bond - HISTORICAL_BOND_MEAN) * tScale;
      }

      equityReturns.push(clamp(eq, EQUITY_RETURN_MIN, EQUITY_RETURN_MAX));
      fixedIncomeReturns.push(clamp(fi, BOND_RETURN_MIN, BOND_RETURN_MAX));
      const rawCpi = randomizeCPI ? (yearData.inflation + cpiShift) : (constantCPIRate ?? DEFAULT_CONSTANT_CPI_RATE);
      inflationRates.push(clamp(rawCpi, INFLATION_RATE_MIN, INFLATION_RATE_MAX));
      idx++;
    }
  } else {
    // Standard random year bootstrap (sampling with replacement)
    for (let i = 0; i < years; i++) {
      const idx = Math.floor(rand() * HISTORICAL_RETURNS.length);
      const yearData = HISTORICAL_RETURNS[idx];
      let eq = yearData.stock + stockShift;
      let fi = yearData.bond + bondShift;

      if (enableStudentT) {
        let v = 0;
        for (let j = 0; j < df; j++) {
          const zi = nextGaussian(rand);
          v += zi * zi;
        }
        const tScale = Math.sqrt((df - 2) / Math.max(0.0001, v));
        eq = stockBaseline + (yearData.stock - HISTORICAL_STOCK_MEAN) * tScale;
        fi = bondBaseline + (yearData.bond - HISTORICAL_BOND_MEAN) * tScale;
      }

      equityReturns.push(clamp(eq, EQUITY_RETURN_MIN, EQUITY_RETURN_MAX));
      fixedIncomeReturns.push(clamp(fi, BOND_RETURN_MIN, BOND_RETURN_MAX));
      const rawCpi = randomizeCPI ? (yearData.inflation + cpiShift) : (constantCPIRate ?? DEFAULT_CONSTANT_CPI_RATE);
      inflationRates.push(clamp(rawCpi, INFLATION_RATE_MIN, INFLATION_RATE_MAX));
    }
  }
  
  return {
    mode: 'historical',
    equityReturns,
    fixedIncomeReturns,
    inflationRates,
  };
}

export interface MonteCarloTrialResult {
  trialIndex: number;
  success: boolean; // Portfolio survived (ended above $0)
  endingEstate: number;
  portfolioHistory: number[]; // One entry per simulated year (the simulation horizon)
  sequence: LockedReturnSequence;
  timeToRuin: number | null; // Year of first ruin, or null if survived
}

export interface MonteCarloSummary {
  successRate: number; // e.g. 0.85 (85%)
  trialsRun: number;
  percentiles: {
    year: number;
    p10: number; // 10th percentile (Worst Case)
    p25: number; // 25th percentile (Conservative)
    p50: number; // 50th percentile (Median)
    p75: number; // 75th percentile (Good Case)
    p90: number; // 90th percentile (Best Case)
  }[];
  representativeSequences: {
    // Each is a single trial ranked by cumulative blended market return, not by ending estate, so
    // its final portfolio value will not match the same percentile in `percentiles`.
    worst: LockedReturnSequence;  // Trial at the 10th percentile of cumulative market return
    median: LockedReturnSequence; // Trial at the 50th percentile of cumulative market return
    best: LockedReturnSequence;   // Trial at the 90th percentile of cumulative market return
  };
  medianSurvivalYears: number | null; // Median years of survival for failed trials
}

/**
 * Non-destructively overlays multi-year sequence of returns stress test overrides
 * onto a trial sequence when stress testing is enabled.
 */
export function applyStressTestToSequence<T extends Omit<LockedReturnSequence, 'id'>>(
  seq: T,
  stressTest?: StressTestConfig,
  startYear: number = 2026
): T {
  if (!stressTest || !stressTest.enabled || !stressTest.overrides || stressTest.overrides.length === 0) {
    return seq;
  }

  const overrideMap = new Map<number, StressTestYearOverride>();
  for (const ov of stressTest.overrides) {
    overrideMap.set(ov.year, ov);
  }

  const equityReturns = [...seq.equityReturns];
  const fixedIncomeReturns = [...seq.fixedIncomeReturns];

  for (let yearIdx = 0; yearIdx < seq.equityReturns.length; yearIdx++) {
    const year = startYear + yearIdx;
    const ov = overrideMap.get(year);
    if (ov) {
      if (stressTest.mode === 'relative') {
        equityReturns[yearIdx] = seq.equityReturns[yearIdx] + ov.equityReturn;
        fixedIncomeReturns[yearIdx] = seq.fixedIncomeReturns[yearIdx] + ov.fixedIncomeReturn;
      } else {
        equityReturns[yearIdx] = ov.equityReturn;
        fixedIncomeReturns[yearIdx] = ov.fixedIncomeReturn;
      }
    }
  }

  return {
    ...seq,
    equityReturns,
    fixedIncomeReturns,
  };
}

/**
 * Computes representative return sequences (worst P10, median P50, best P90) based on market ranking.
 * This runs in < 0.1ms without executing 1,000 full retirement simulations.
 */
export function computeRepresentativeSequences(
  inputs: AppStateInputs,
  rawSequences: Omit<LockedReturnSequence, 'id'>[]
): {
  worst: LockedReturnSequence;
  median: LockedReturnSequence;
  best: LockedReturnSequence;
} {
  const trials = rawSequences.length;
  if (trials === 0) {
    const emptySeq = { mode: 'monte-carlo' as const, equityReturns: [], fixedIncomeReturns: [], inflationRates: [] };
    return {
      worst: { ...emptySeq, id: 'empty_worst' },
      median: { ...emptySeq, id: 'empty_median' },
      best: { ...emptySeq, id: 'empty_best' },
    };
  }

  const taxableEquity = inputs.growthAssumptions?.taxableEquityPortion ?? 0.60;
  const preTaxEquity = inputs.growthAssumptions?.preTaxEquityPortion ?? 0.50;
  const rothEquity = inputs.growthAssumptions?.rothEquityPortion ?? 1.00;
  const benchmarkEquityWeight = (taxableEquity + preTaxEquity + rothEquity) / 3;

  const marketRankings: { trialIndex: number; cumulativeReturn: number }[] = [];
  for (let t = 0; t < trials; t++) {
    const seq = rawSequences[t];
    let cumulativeFactor = 1.0;
    const count = seq.equityReturns.length;
    for (let y = 0; y < count; y++) {
      const eq = seq.equityReturns[y] ?? 0.07;
      const fi = seq.fixedIncomeReturns[y] ?? 0.04;
      const blended = benchmarkEquityWeight * eq + (1 - benchmarkEquityWeight) * fi;
      cumulativeFactor *= (1 + blended);
    }
    marketRankings.push({ trialIndex: t, cumulativeReturn: cumulativeFactor });
  }

  marketRankings.sort((a, b) => a.cumulativeReturn - b.cumulativeReturn);

  const marketWorstIdx = marketRankings[Math.floor(trials * 0.10)]?.trialIndex ?? 0;
  const marketMedianIdx = marketRankings[Math.floor(trials * 0.50)]?.trialIndex ?? Math.floor(trials / 2);
  const marketBestIdx = marketRankings[Math.floor(trials * 0.90)]?.trialIndex ?? trials - 1;

  const simStartYear = getSimulationStartYear(inputs);
  const isStressTestActive = inputs.monteCarloSettings?.stressTest?.enabled &&
    (inputs.monteCarloSettings.stressTest.overrides?.length ?? 0) > 0;

  if (isStressTestActive) {
    return {
      worst: {
        ...applyStressTestToSequence(rawSequences[marketWorstIdx], inputs.monteCarloSettings?.stressTest, simStartYear),
        id: `trial_${marketWorstIdx}_matched_worst`,
      },
      median: {
        ...applyStressTestToSequence(rawSequences[marketMedianIdx], inputs.monteCarloSettings?.stressTest, simStartYear),
        id: `trial_${marketMedianIdx}_matched_median`,
      },
      best: {
        ...applyStressTestToSequence(rawSequences[marketBestIdx], inputs.monteCarloSettings?.stressTest, simStartYear),
        id: `trial_${marketBestIdx}_matched_best`,
      },
    };
  }

  return {
    worst: {
      ...rawSequences[marketWorstIdx],
      id: `trial_${marketWorstIdx}_p10_market`,
    },
    median: {
      ...rawSequences[marketMedianIdx],
      id: `trial_${marketMedianIdx}_p50_market`,
    },
    best: {
      ...rawSequences[marketBestIdx],
      id: `trial_${marketBestIdx}_p90_market`,
    },
  };
}

/**
 * Runs a batch Monte Carlo simulation of N trials and compiles statistics.
 */
export function runMonteCarloSimulation(
  inputs: AppStateInputs,
  simulateSurvivor: boolean = false,
  preGeneratedSequences?: Omit<LockedReturnSequence, 'id'>[]
): MonteCarloSummary {
  const trials = inputs.monteCarloSettings?.trials || 1000;
  const mode = inputs.monteCarloSettings?.mode || 'monte-carlo';
  
  const equityMean = inputs.growthAssumptions.equityReturnRate;
  const bondMean = inputs.growthAssumptions.fixedIncomeReturnRate;
  const equityVol = inputs.monteCarloSettings?.equityVolatility ?? 0.15;
  const bondVol = inputs.monteCarloSettings?.fixedIncomeVolatility ?? 0.05;
  const correlation = inputs.monteCarloSettings?.correlation ?? 0.15;
  
  const seed = inputs.monteCarloSettings?.seed;
  const rand = seed !== null && seed !== undefined ? mulberry32(seed) : mulberry32(12345);
  
  const isCpiRandomized = inputs.monteCarloSettings?.randomizeCPI !== false;
  const constantCpi = (inputs.monteCarloSettings?.randomizeCPI === false && inputs.monteCarloSettings?.constantCPIRate != null)
    ? inputs.monteCarloSettings.constantCPIRate
    : inputs.growthAssumptions.cpiInflationRate;

  const targetCpi = inputs.growthAssumptions.cpiInflationRate;
  const horizonYears = getSimulationHorizonYears(inputs);

  // Compile raw sequences across all trials
  const rawSequences: Omit<LockedReturnSequence, 'id'>[] = [];
  for (let t = 0; t < trials; t++) {
    if (preGeneratedSequences && preGeneratedSequences[t]) {
      rawSequences.push(preGeneratedSequences[t]);
    } else if (mode === 'historical') {
      const strategy = inputs.monteCarloSettings?.historicalSamplingStrategy ?? 'hybrid';
      const isBlock = strategy === 'block' ? true : strategy === 'random' ? false : rand() < 0.35;
      const calibrateMeans = inputs.monteCarloSettings?.calibrateHistoricalMeans !== false;
      const enableStudentT = inputs.monteCarloSettings?.enableHistoricalStudentT === true;
      rawSequences.push(generateHistoricalSequence(
        isBlock,
        undefined,
        rand,
        isCpiRandomized,
        constantCpi,
        calibrateMeans,
        equityMean,
        bondMean,
        targetCpi,
        enableStudentT,
        horizonYears
      ));
    } else {
      rawSequences.push(generateSyntheticSequence(
        equityMean,
        equityVol,
        bondMean,
        bondVol,
        correlation,
        rand,
        isCpiRandomized,
        constantCpi,
        targetCpi,
        horizonYears
      ));
    }
  }

  const simStartYear = getSimulationStartYear(inputs);
  const representativeSequences = computeRepresentativeSequences(inputs, rawSequences);

  // 2. Run the full Monte Carlo simulation across all trials (with stress testing applied if active)
  const results: MonteCarloTrialResult[] = [];
  for (let t = 0; t < trials; t++) {
    const seqData = rawSequences[t];
    const stressedSeqData = applyStressTestToSequence(seqData, inputs.monteCarloSettings?.stressTest, simStartYear);
    
    const randomPart = Math.floor(rand() * 100000).toString(36);
    const sequence: LockedReturnSequence = {
      ...stressedSeqData,
      id: `trial_${t}_${seed !== null && seed !== undefined ? seed : 'unseeded'}_${randomPart}`,
    };
    
    // Run the retirement simulation with this specific trial return sequence
    const ledger = runRetirementSimulation(inputs, simulateSurvivor, sequence);
    const portfolioHistory = ledger.map(r => r.totalPortfolioValue);
    const endingEstate = portfolioHistory[portfolioHistory.length - 1] || 0;
    
    // Path-wise ruin check: successful only if ending estate is positive and was never ruined (balance <= 0.01) at any year
    const firstRuinIndex = portfolioHistory.findIndex(v => v <= 0.01);
    const success = firstRuinIndex === -1 && endingEstate > 0.01;
    const timeToRuin = firstRuinIndex !== -1 ? simStartYear + firstRuinIndex : null;
    
    results.push({
      trialIndex: t,
      success,
      endingEstate,
      portfolioHistory,
      sequence,
      timeToRuin,
    });
  }
  
  // Calculate success rate
  const successCount = results.filter(r => r.success).length;
  const successRate = successCount / trials;
  
  // Calculate median years of survival for failed trials
  const failedTrials = results.filter(r => !r.success);
  let medianSurvivalYears: number | null = null;
  if (failedTrials.length > 0) {
    const survivalYears = failedTrials.map(r => {
      const idx = r.portfolioHistory.findIndex(v => v <= 0.01);
      return idx !== -1 ? idx : r.portfolioHistory.length;
    });
    survivalYears.sort((a, b) => a - b);
    const mid = Math.floor(survivalYears.length / 2);
    medianSurvivalYears = survivalYears.length % 2 !== 0 
      ? survivalYears[mid] 
      : (survivalYears[mid - 1] + survivalYears[mid]) / 2;
  }

  // Compile annual percentile values
  // Rows cover the longest ledger any trial produced, so the final row is always the last simulated
  // year (survivor mode ends a year earlier than the calendar horizon).
  const percentileYears = results.reduce((max, r) => Math.max(max, r.portfolioHistory.length), 0);
  const percentiles: MonteCarloSummary['percentiles'] = [];
  for (let yearIdx = 0; yearIdx < percentileYears; yearIdx++) {
    const year = simStartYear + yearIdx;
    
    // Collect portfolio values for this year across all trials
    const yearValues = results.map(r => r.portfolioHistory[yearIdx] || 0);
    yearValues.sort((a, b) => a - b);
    
    percentiles.push({
      year,
      p10: yearValues[Math.floor(trials * 0.10)] ?? 0,
      p25: yearValues[Math.floor(trials * 0.25)] ?? 0,
      p50: yearValues[Math.floor(trials * 0.50)] ?? 0,
      p75: yearValues[Math.floor(trials * 0.75)] ?? 0,
      p90: yearValues[Math.floor(trials * 0.90)] ?? 0,
    });
  }
  
  return {
    successRate,
    trialsRun: trials,
    percentiles,
    representativeSequences,
    medianSurvivalYears,
  };
}

export interface HistoricalStats {
  equityMean: number;
  equityVol: number;
  bondMean: number;
  bondVol: number;
  correlation: number;
  inflationMean: number;
  inflationVol: number;
}

export function computeHistoricalStats(data: HistoricalYear[] = HISTORICAL_RETURNS): HistoricalStats {
  const n = data.length;
  const stockMean = data.reduce((s, y) => s + y.stock, 0) / n;
  const bondMean = data.reduce((s, y) => s + y.bond, 0) / n;
  const inflationMean = data.reduce((s, y) => s + y.inflation, 0) / n;
  
  const stockVar = data.reduce((s, y) => s + (y.stock - stockMean) ** 2, 0) / (n - 1);
  const bondVar = data.reduce((s, y) => s + (y.bond - bondMean) ** 2, 0) / (n - 1);
  const inflationVar = data.reduce((s, y) => s + (y.inflation - inflationMean) ** 2, 0) / (n - 1);
  
  const covStockBond = data.reduce((s, y) => s + (y.stock - stockMean) * (y.bond - bondMean), 0) / (n - 1);
  
  return {
    equityMean: stockMean,
    equityVol: Math.sqrt(stockVar),
    bondMean: bondMean,
    bondVol: Math.sqrt(bondVar),
    correlation: covStockBond / Math.sqrt(stockVar * bondVar),
    inflationMean: inflationMean,
    inflationVol: Math.sqrt(inflationVar),
  };
}
