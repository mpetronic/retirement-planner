import { AppStateInputs, LockedReturnSequence, StressTestConfig, StressTestYearOverride } from '../types';
import { runRetirementSimulation } from './simulationEngine';

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
 * Generates joint stock/bond returns for 35 years using bivariate Student-t distribution
 * with optional 2-state Markov regime-switching and Ornstein-Uhlenbeck mean reversion.
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
  enableRegimeSwitching: boolean = true
): Omit<LockedReturnSequence, 'id'> {
  const equityReturns: number[] = [];
  const fixedIncomeReturns: number[] = [];
  const inflationRates: number[] = [];
  
  const df = 5; // Degrees of freedom for Student-t distribution to capture fat tails
  
  // Markov 2-State regime parameters:
  // State 0: Expansion / Normal Growth (80% unconditional probability)
  // State 1: Contraction / Crisis / Bear Market (20% unconditional probability)
  const p00 = 0.85; // 85% chance of remaining in expansion (avg duration ~6.7 yrs)
  const p11 = 0.40; // 40% chance of remaining in bear/crisis (avg duration ~1.67 yrs)
  
  // Ergodic stationary distribution: pi_0 = (1 - p11) / ((1 - p00) + (1 - p11)) = 0.60 / 0.75 = 0.80
  const pi0 = (1 - p11) / ((1 - p00) + (1 - p11));
  const pi1 = 1 - pi0;
  
  // In crisis state, expected equity return is negative (-8%)
  const muCrisis = -0.08;
  // Calibrate expansion mean mu_0 so that unconditional weighted expectation equals equityMean:
  // pi0 * mu_0 + pi1 * muCrisis = equityMean  =>  mu_0 = (equityMean - pi1 * muCrisis) / pi0
  const muExpansion = (equityMean - pi1 * muCrisis) / pi0;
  
  // Initial state selection based on stationary probability
  let currentState = rand() < pi0 ? 0 : 1;
  
  // Cumulative log return tracking for Ornstein-Uhlenbeck mean reversion
  let cumulativeRealizedLogReturn = 0;
  const targetLogRate = Math.log(Math.max(0.001, 1 + equityMean));
  const kappa = 0.20; // Mean-reversion speed: 20% annual correction of cumulative tracking gap
  
  for (let i = 0; i < 35; i++) {
    // 1. Advance Markov State if regime switching is enabled
    if (enableRegimeSwitching && i > 0) {
      if (currentState === 0) {
        currentState = rand() < p00 ? 0 : 1;
      } else {
        currentState = rand() < p11 ? 1 : 0;
      }
    }
    
    // 2. Base expected returns and volatilities per state
    let effEquityMean = equityMean;
    let effEquityVol = equityVol;
    let effBondMean = bondMean;
    let effBondVol = bondVol;
    let effCorrelation = correlation;
    
    if (enableRegimeSwitching) {
      if (currentState === 0) {
        // Normal Expansion State
        effEquityMean = muExpansion;
        effEquityVol = equityVol * 0.85;
        effBondMean = bondMean;
        effBondVol = bondVol;
      } else {
        // Contraction / Crisis State: High volatility, depressed returns, flight-to-safety bond boost
        effEquityMean = muCrisis;
        effEquityVol = equityVol * 1.50;
        effBondMean = bondMean + 0.015; // +1.5% flight-to-safety / rate-cut boost
        effBondVol = bondVol * 1.20;
        effCorrelation = Math.min(0.60, correlation + 0.20); // Correlation rises during systemic panics
      }
      
      // 3. Mean Reversion Drift Adjustment
      const targetCumLog = i * targetLogRate;
      const trackingGap = cumulativeRealizedLogReturn - targetCumLog;
      // Clamp drift adjustment to prevent over-correction / extreme swings ([-4%, +4%])
      const driftAdjustment = Math.max(-0.04, Math.min(0.04, -kappa * trackingGap));
      effEquityMean += driftAdjustment;
    }
    
    // 4. Correlated standard normal variables (Box-Muller)
    const z1 = nextGaussian(rand);
    const z2 = nextGaussian(rand);
    
    // Correlated transformation
    const x1 = z1;
    const x2 = effCorrelation * z1 + Math.sqrt(Math.max(0.0001, 1 - effCorrelation * effCorrelation)) * z2;
    
    // 5. Student-t scaling (df = 5) for fat tails
    let v = 0;
    for (let j = 0; j < df; j++) {
      const zi = nextGaussian(rand);
      v += zi * zi;
    }
    const tScale = Math.sqrt((df - 2) / Math.max(0.0001, v));
    
    const t1 = x1 * tScale;
    const t2 = x2 * tScale;
    
    const equityReturn = effEquityMean + effEquityVol * t1;
    const bondReturn = effBondMean + effBondVol * t2;
    
    equityReturns.push(equityReturn);
    fixedIncomeReturns.push(bondReturn);
    
    // Update cumulative realized log return for next year's mean reversion
    cumulativeRealizedLogReturn += Math.log(Math.max(0.01, 1 + equityReturn));
    
    // 6. Inflation sampling
    if (randomizeCPI) {
      if (enableRegimeSwitching && currentState === 1 && rand() < 0.40) {
        // In crisis state, 40% probability of sampling elevated historical stagflation CPI
        const stagflationIndices = [3, 4, 10, 11, 51, 52]; // 1973, 1974, 1980, 1981, 2021, 2022
        const sIdx = stagflationIndices[Math.floor(rand() * stagflationIndices.length)];
        inflationRates.push(HISTORICAL_RETURNS[sIdx].inflation);
      } else {
        const histIdx = Math.floor(rand() * HISTORICAL_RETURNS.length);
        inflationRates.push(HISTORICAL_RETURNS[histIdx].inflation);
      }
    } else {
      inflationRates.push(constantCPIRate ?? 0.025);
    }
  }
  
  return {
    mode: 'monte-carlo',
    equityReturns,
    fixedIncomeReturns,
    inflationRates,
  };
}

/**
 * Generates a historical bootstrapped sequence of 35 years.
 * Can be random sampling (with replacement) or contiguous block sampling.
 */
export function generateHistoricalSequence(
  blockSampling: boolean = false,
  startYearIndex?: number,
  rand: () => number = Math.random,
  randomizeCPI: boolean = true,
  constantCPIRate?: number | null
): Omit<LockedReturnSequence, 'id'> {
  const equityReturns: number[] = [];
  const fixedIncomeReturns: number[] = [];
  const inflationRates: number[] = [];
  
  if (blockSampling) {
    // Select a continuous 35-year historical segment.
    // Restrict starting index to [0, count - 35] so every block is fully contiguous without wrapping.
    const count = HISTORICAL_RETURNS.length;
    const maxStartIdx = Math.max(0, count - 35);
    let idx = startYearIndex !== undefined 
      ? Math.min(startYearIndex, maxStartIdx) 
      : Math.floor(rand() * (maxStartIdx + 1));
      
    for (let i = 0; i < 35; i++) {
      const yearData = HISTORICAL_RETURNS[idx];
      equityReturns.push(yearData.stock);
      fixedIncomeReturns.push(yearData.bond);
      inflationRates.push(randomizeCPI ? yearData.inflation : (constantCPIRate ?? 0.025));
      idx++;
    }
  } else {
    // Standard random year bootstrap (sampling with replacement)
    for (let i = 0; i < 35; i++) {
      const idx = Math.floor(rand() * HISTORICAL_RETURNS.length);
      const yearData = HISTORICAL_RETURNS[idx];
      equityReturns.push(yearData.stock);
      fixedIncomeReturns.push(yearData.bond);
      inflationRates.push(randomizeCPI ? yearData.inflation : (constantCPIRate ?? 0.025));
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
  portfolioHistory: number[]; // Length 35, portfolio value each year
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
    worst: LockedReturnSequence;  // Trial near 10th percentile
    median: LockedReturnSequence; // Trial near 50th percentile
    best: LockedReturnSequence;   // Trial near 90th percentile
  };
  medianSurvivalYears: number | null; // Median years of survival for failed trials
}

/**
 * Non-destructively overlays multi-year sequence of returns stress test overrides
 * onto a trial sequence when stress testing is enabled.
 */
export function applyStressTestToSequence<T extends Omit<LockedReturnSequence, 'id'>>(
  seq: T,
  stressTest?: StressTestConfig
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

  for (let yearIdx = 0; yearIdx < 35; yearIdx++) {
    const year = 2026 + yearIdx;
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
  const enableRegimeSwitching = inputs.monteCarloSettings?.enableRegimeSwitching !== false;
  
  const results: MonteCarloTrialResult[] = [];
  
  for (let t = 0; t < trials; t++) {
    // Generate returns for this trial
    let seqData: Omit<LockedReturnSequence, 'id'>;
    if (preGeneratedSequences && preGeneratedSequences[t]) {
      seqData = preGeneratedSequences[t];
    } else if (mode === 'historical') {
      // 30% block bootstrapping, 70% random year sampling to preserve real historical cycles
      const block = rand() < 0.35;
      seqData = generateHistoricalSequence(block, undefined, rand, isCpiRandomized, constantCpi);
    } else {
      seqData = generateSyntheticSequence(equityMean, equityVol, bondMean, bondVol, correlation, rand, isCpiRandomized, constantCpi, enableRegimeSwitching);
    }

    const stressedSeqData = applyStressTestToSequence(seqData, inputs.monteCarloSettings?.stressTest);
    
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
    const timeToRuin = firstRuinIndex !== -1 ? 2026 + firstRuinIndex : null;
    
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
      return idx !== -1 ? idx : 35;
    });
    survivalYears.sort((a, b) => a - b);
    const mid = Math.floor(survivalYears.length / 2);
    medianSurvivalYears = survivalYears.length % 2 !== 0 
      ? survivalYears[mid] 
      : (survivalYears[mid - 1] + survivalYears[mid]) / 2;
  }
  
  // Sort trials by ending estate value to calculate percentiles and extract representative sequences
  const sortedTrials = [...results].sort((a, b) => a.endingEstate - b.endingEstate);
  
  const worstIdx = Math.floor(trials * 0.10);  // 10th percentile
  const medianIdx = Math.floor(trials * 0.50); // 50th percentile
  const bestIdx = Math.floor(trials * 0.90);   // 90th percentile
  
  const worstTrial = sortedTrials[worstIdx] || sortedTrials[0];
  const medianTrial = sortedTrials[medianIdx] || sortedTrials[Math.floor(trials / 2)];
  const bestTrial = sortedTrials[bestIdx] || sortedTrials[trials - 1];
  
  // Compile annual percentile values
  const percentiles: MonteCarloSummary['percentiles'] = [];
  for (let yearIdx = 0; yearIdx < 35; yearIdx++) {
    const year = 2026 + yearIdx;
    
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
    representativeSequences: {
      worst: worstTrial.sequence,
      median: medianTrial.sequence,
      best: bestTrial.sequence,
    },
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
