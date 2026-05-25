import { AppStateInputs, LockedReturnSequence } from '../types';
import { runRetirementSimulation } from './simulationEngine';

// Modern historical stock (S&P 500 total return) and bond (US 10-Yr Treasury total return) annual returns from 1970 to 2025.
// These 56 years provide a highly realistic distribution of modern inflation and interest rate regimes.
export interface HistoricalYear {
  year: number;
  stock: number;
  bond: number;
}

export const HISTORICAL_RETURNS: HistoricalYear[] = [
  { year: 1970, stock: 0.0401, bond: 0.1675 },
  { year: 1971, stock: 0.1431, bond: 0.0911 },
  { year: 1972, stock: 0.1898, bond: 0.0210 },
  { year: 1973, stock: -0.1466, bond: 0.0366 },
  { year: 1974, stock: -0.2647, bond: 0.0435 },
  { year: 1975, stock: 0.3720, bond: 0.0783 },
  { year: 1976, stock: 0.2384, bond: 0.1287 },
  { year: 1977, stock: -0.0718, bond: 0.0129 },
  { year: 1978, stock: 0.0656, bond: -0.0118 },
  { year: 1979, stock: 0.1844, bond: 0.0067 },
  { year: 1980, stock: 0.3242, bond: -0.0299 },
  { year: 1981, stock: -0.0491, bond: 0.0820 },
  { year: 1982, stock: 0.2141, bond: 0.2909 },
  { year: 1983, stock: 0.2251, bond: 0.0074 },
  { year: 1984, stock: 0.0627, bond: 0.1548 },
  { year: 1985, stock: 0.3216, bond: 0.3097 },
  { year: 1986, stock: 0.1847, bond: 0.2453 },
  { year: 1987, stock: 0.0525, bond: -0.0496 },
  { year: 1988, stock: 0.1681, bond: 0.0822 },
  { year: 1989, stock: 0.3149, bond: 0.1769 },
  { year: 1990, stock: -0.0317, bond: 0.0688 },
  { year: 1991, stock: 0.3055, bond: 0.1500 },
  { year: 1992, stock: 0.0762, bond: 0.0936 },
  { year: 1993, stock: 0.0999, bond: 0.1421 },
  { year: 1994, stock: 0.0132, bond: -0.0804 },
  { year: 1995, stock: 0.3743, bond: 0.2348 },
  { year: 1996, stock: 0.2296, bond: 0.0143 },
  { year: 1997, stock: 0.3336, bond: 0.0994 },
  { year: 1998, stock: 0.2858, bond: 0.1492 },
  { year: 1999, stock: 0.2104, bond: -0.0825 },
  { year: 2000, stock: -0.0910, bond: 0.1666 },
  { year: 2001, stock: -0.1189, bond: 0.0543 },
  { year: 2002, stock: -0.2210, bond: 0.1512 },
  { year: 2003, stock: 0.2868, bond: 0.0038 },
  { year: 2004, stock: 0.1088, bond: 0.0449 },
  { year: 2005, stock: 0.0491, bond: 0.0287 },
  { year: 2006, stock: 0.1579, bond: 0.0194 },
  { year: 2007, stock: 0.0549, bond: 0.1021 },
  { year: 2008, stock: -0.3700, bond: 0.2010 },
  { year: 2009, stock: 0.2646, bond: -0.1112 },
  { year: 2010, stock: 0.1506, bond: 0.0846 },
  { year: 2011, stock: 0.0211, bond: 0.1604 },
  { year: 2012, stock: 0.1600, bond: 0.0297 },
  { year: 2013, stock: 0.3239, bond: -0.0750 },
  { year: 2014, stock: 0.1369, bond: 0.1075 },
  { year: 2015, stock: 0.0138, bond: 0.0128 },
  { year: 2016, stock: 0.1196, bond: 0.0104 },
  { year: 2017, stock: 0.2183, bond: 0.0265 },
  { year: 2018, stock: -0.0438, bond: -0.0002 },
  { year: 2019, stock: 0.3149, bond: 0.0964 },
  { year: 2020, stock: 0.1840, bond: 0.0800 },
  { year: 2021, stock: 0.2871, bond: -0.0147 },
  { year: 2022, stock: -0.1811, bond: -0.1783 }, // Unprecedented joint equities and bonds drop (inflation shock)
  { year: 2023, stock: 0.2629, bond: 0.0388 },
  { year: 2024, stock: 0.2400, bond: 0.0250 },
  { year: 2025, stock: 0.1000, bond: 0.0300 },
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
 * Generates joint stock/bond returns for 35 years using bivariate normal distribution
 */
export function generateSyntheticSequence(
  equityMean: number,
  equityVol: number,
  bondMean: number,
  bondVol: number,
  correlation: number,
  rand: () => number = Math.random
): Omit<LockedReturnSequence, 'id'> {
  const equityReturns: number[] = [];
  const fixedIncomeReturns: number[] = [];
  
  for (let i = 0; i < 35; i++) {
    const z1 = nextGaussian(rand);
    const z2 = nextGaussian(rand);
    
    // Bivariate correlated transform
    const x1 = z1;
    const x2 = correlation * z1 + Math.sqrt(1 - correlation * correlation) * z2;
    
    const equityReturn = equityMean + equityVol * x1;
    const bondReturn = bondMean + bondVol * x2;
    
    equityReturns.push(equityReturn);
    fixedIncomeReturns.push(bondReturn);
  }
  
  return {
    mode: 'monte-carlo',
    equityReturns,
    fixedIncomeReturns,
  };
}

/**
 * Generates a historical bootstrapped sequence of 35 years.
 * Can be random sampling (with replacement) or contiguous block sampling.
 */
export function generateHistoricalSequence(
  blockSampling: boolean = false,
  startYearIndex?: number,
  rand: () => number = Math.random
): Omit<LockedReturnSequence, 'id'> {
  const equityReturns: number[] = [];
  const fixedIncomeReturns: number[] = [];
  
  if (blockSampling) {
    // Select a continuous 35-year historical segment.
    // If it reaches the end (2025), wrap around to 1970.
    const count = HISTORICAL_RETURNS.length;
    let idx = startYearIndex !== undefined 
      ? startYearIndex 
      : Math.floor(rand() * count);
      
    for (let i = 0; i < 35; i++) {
      const yearData = HISTORICAL_RETURNS[idx % count];
      equityReturns.push(yearData.stock);
      fixedIncomeReturns.push(yearData.bond);
      idx++;
    }
  } else {
    // Standard random year bootstrap (sampling with replacement)
    for (let i = 0; i < 35; i++) {
      const idx = Math.floor(rand() * HISTORICAL_RETURNS.length);
      const yearData = HISTORICAL_RETURNS[idx];
      equityReturns.push(yearData.stock);
      fixedIncomeReturns.push(yearData.bond);
    }
  }
  
  return {
    mode: 'historical',
    equityReturns,
    fixedIncomeReturns,
  };
}

export interface MonteCarloTrialResult {
  trialIndex: number;
  success: boolean; // Portfolio survived (ended above $0)
  endingEstate: number;
  portfolioHistory: number[]; // Length 35, portfolio value each year
  sequence: LockedReturnSequence;
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
  const rand = seed !== null && seed !== undefined ? mulberry32(seed) : Math.random;
  
  const results: MonteCarloTrialResult[] = [];
  
  for (let t = 0; t < trials; t++) {
    // Generate returns for this trial
    let seqData: Omit<LockedReturnSequence, 'id'>;
    if (preGeneratedSequences && preGeneratedSequences[t]) {
      seqData = preGeneratedSequences[t];
    } else if (mode === 'historical') {
      // 30% block bootstrapping, 70% random year sampling to preserve real historical cycles
      const block = rand() < 0.35;
      seqData = generateHistoricalSequence(block, undefined, rand);
    } else {
      seqData = generateSyntheticSequence(equityMean, equityVol, bondMean, bondVol, correlation, rand);
    }
    
    const sequence: LockedReturnSequence = {
      ...seqData,
      id: `trial_${t}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    };
    
    // Run the retirement simulation with this specific trial return sequence
    const ledger = runRetirementSimulation(inputs, simulateSurvivor, sequence);
    const portfolioHistory = ledger.map(r => r.totalPortfolioValue);
    const endingEstate = portfolioHistory[portfolioHistory.length - 1] || 0;
    const success = endingEstate > 0;
    
    results.push({
      trialIndex: t,
      success,
      endingEstate,
      portfolioHistory,
      sequence,
    });
  }
  
  // Calculate success rate
  const successCount = results.filter(r => r.success).length;
  const successRate = successCount / trials;
  
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
  };
}
