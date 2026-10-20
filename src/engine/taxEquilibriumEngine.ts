import { AppStateInputs, SimulationResultRow, LockedReturnSequence, getSimulationStartYear } from '../types';
import { runRetirementSimulation } from './simulationEngine';
import {
  FED_BRACKETS_MFJ,
  FED_BRACKETS_SINGLE,
  STATUTORY_STD_DEDUCTION_SINGLE_MFJ_MIDPOINT,
  STATUTORY_NIIT_RATE,
  STATUTORY_NIIT_THRESHOLD_SINGLE,
  STATUTORY_NIIT_THRESHOLD_MFJ,
  STATUTORY_MAX_TAXABLE_SS_PORTION,
  STATUTORY_SS_TORPEDO_MULTIPLIER,
  STATUTORY_IRMAA_LOOKBACK_YEARS,
  STATUTORY_MEDICARE_ELIGIBILITY_AGE,
} from './taxRates2026';
import { getStateTaxProfile } from './stateTaxRegistry';

/**
 * Conversion Search Step Sizes for Coarse-to-Fine Convergence
 */
export const COARSE_CONVERSION_STEP = 10000;
export const MEDIUM_CONVERSION_STEP = 2500;
export const FINE_CONVERSION_STEP = 1000;
export const CONVERGENCE_TEST_STEPS = [
  COARSE_CONVERSION_STEP,
  MEDIUM_CONVERSION_STEP,
  FINE_CONVERSION_STEP,
] as const;

/**
 * Heuristic threshold for detecting an IRMAA cliff jump in marginal effective rate (30% additional drag)
 */
export const IRMAA_CLIFF_DRAG_DETECTION_THRESHOLD = 0.30;

/**
 * Default fallback rates and timeline parameters
 */
export const DEFAULT_TAX_EQUILIBRIUM_FLOOR_RATE = FED_BRACKETS_MFJ[1].rate; // 12% bracket rate
export const DEFAULT_AVERAGE_BENCHMARK_RATE = FED_BRACKETS_MFJ[2].rate; // 22% bracket rate
export const DEFAULT_ESTIMATED_STATE_INCOME_TAX_RATE = 0.05;
export const DEFAULT_SAFETY_RUNWAY_MONTHS = 6;
export const MONTHS_PER_YEAR = 12;
export const DEFAULT_CONVERSION_WINDOW_START_OFFSET_YEARS = 1;
export const DEFAULT_CONVERSION_WINDOW_DURATION_YEARS = 8;

export type TELimitingFactor =
  | 'Matched Future TE Benchmark'
  | 'IRMAA Cliff Boundary'
  | 'Capital Gains 0% Threshold'
  | 'Bracket Boundary'
  | 'Capped by Cash Reserves'
  | 'Pre-Tax IRA Depleted'
  | 'Conversion Window Complete';

export interface YearlyTaxEquilibriumPoint {
  year: number;
  yourAge: number;
  wifeAge: number;
  baseOrdinaryIncome: number;
  realizedGains: number;
  optimalConversion: number;
  marginalRate: number; // Marginal effective tax + IRMAA rate on the last conversion dollar
  futureBenchmarkRate: number; // Hurdle rate at this iteration
  limitingFactor: TELimitingFactor;
  projectedAnnualTax: number;
  projectedAnnualIRMAA: number;
}

export interface TaxEquilibriumResult {
  schedule: Record<number, number>; // year -> conversion amount
  yearlyDetails: YearlyTaxEquilibriumPoint[];
  averageBenchmarkRate: number;
  lifetimeImpact: {
    baselineLifetimeTaxes: number;
    optimizedLifetimeTaxes: number;
    lifetimeTaxSavings: number;
    baselineFirstRMD: number;
    optimizedFirstRMD: number;
    firstRMDDelta: number;
    baselineEndingEstate: number;
    optimizedEndingEstate: number;
    endingEstateDelta: number;
  };
}

/**
 * Calculates the dynamic weighted-average marginal tax cost of forced RMDs across all future RMD years.
 * Evaluates:
 * - Top federal tax bracket for taxable income
 * - Social Security "tax torpedo" multiplier (up to 1.85x if in the 85% phase-in zone)
 * - State and local income taxes
 * - Net Investment Income Tax (NIIT) impact
 * - Single-filer tax brackets during survivor years
 */
export function calculateDynamicRMDHurdleRate(ledger: SimulationResultRow[], currentState: string): number {
  const rmdRows = ledger.filter((r) => (r.yourRMD ?? 0) > 0 || (r.wifeRMD ?? 0) > 0);
  if (rmdRows.length === 0) {
    return DEFAULT_TAX_EQUILIBRIUM_FLOOR_RATE;
  }

  const stateProfile = getStateTaxProfile(currentState);
  const baseStateRate = stateProfile?.hasIncomeTax ? (stateProfile.effectiveTaxRateEstimate || DEFAULT_ESTIMATED_STATE_INCOME_TAX_RATE) : 0;

  let totalWeightedRate = 0;
  let totalRMDVolume = 0;

  for (const row of rmdRows) {
    const annualRMD = (row.yourRMD ?? 0) + (row.wifeRMD ?? 0);
    if (annualRMD <= 0) continue;

    const isSingle = row.standardDeduction < STATUTORY_STD_DEDUCTION_SINGLE_MFJ_MIDPOINT * (row.cpiFactor || 1);
    const brackets = isSingle ? FED_BRACKETS_SINGLE : FED_BRACKETS_MFJ;
    const taxableIncome = row.taxableIncome || 0;

    // Find marginal federal bracket for top ordinary dollar
    let fedRate = brackets[0].rate;
    for (const b of brackets) {
      if (taxableIncome <= b.limit) {
        fedRate = b.rate;
        break;
      }
    }

    // Social Security tax torpedo check:
    // If Social Security is being collected and is not yet at statutory max (85%) taxed,
    // each additional $1 of ordinary income adds up to $0.85 of taxable Social Security,
    // multiplying the federal marginal tax rate by 1.85!
    const totalSS = (row.yourSS ?? 0) + (row.wifeSS ?? 0);
    const taxableSS = row.taxableSS ?? 0;
    let ssMultiplier = 1.0;
    if (totalSS > 0 && taxableSS < STATUTORY_MAX_TAXABLE_SS_PORTION * totalSS) {
      ssMultiplier = STATUTORY_SS_TORPEDO_MULTIPLIER;
    }

    const effectiveFedRate = fedRate * ssMultiplier;
    const effectiveLocal = row.effectiveLocalTaxRate || 0;
    const stateRate = baseStateRate + effectiveLocal;

    // NIIT drag (3.8% if MAGI exceeds statutory limits and investment income is present)
    const niitThreshold = isSingle ? STATUTORY_NIIT_THRESHOLD_SINGLE : STATUTORY_NIIT_THRESHOLD_MFJ;
    const niitRate = (row.magi > niitThreshold && (row.taxableDividends > 0 || row.capitalGainsTriggered > 0)) ? STATUTORY_NIIT_RATE : 0;

    const totalMarginalRate = effectiveFedRate + stateRate + niitRate;

    totalWeightedRate += totalMarginalRate * annualRMD;
    totalRMDVolume += annualRMD;
  }

  if (totalRMDVolume <= 0) return DEFAULT_TAX_EQUILIBRIUM_FLOOR_RATE;
  return totalWeightedRate / totalRMDVolume;
}

/**
 * Executes a candidate simulation for a specific year's conversion schedule
 * and extracts total taxes, NIIT, and 2-year lookback IRMAA.
 */
function evaluatePlanTaxCostForYear(
  baseInputs: AppStateInputs,
  simulateSurvivor: boolean,
  activeSequence: LockedReturnSequence | null | undefined,
  activeSchedule: Record<number, number>,
  targetYear: number
): {
  conversionYearTax: number;
  lookbackIRMAA: number;
  totalDrag: number;
  ledgerRow: SimulationResultRow | undefined;
  irmaaRow: SimulationResultRow | undefined;
  ledger: SimulationResultRow[];
} {
  const customScenario = {
    id: 'te-eval-scenario',
    name: 'TE Evaluation Schedule',
    schedule: { ...activeSchedule },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const testInputs: AppStateInputs = {
    ...baseInputs,
    rothConversionStrategy: 'custom',
    customRothScenarios: [customScenario],
    activeCustomScenarioId: customScenario.id,
  };

  const ledger = runRetirementSimulation(testInputs, simulateSurvivor, activeSequence);
  const ledgerRow = ledger.find((r) => r.year === targetYear);
  const irmaaRow = ledger.find((r) => r.year === targetYear + STATUTORY_IRMAA_LOOKBACK_YEARS);

  const conversionYearTax = (ledgerRow?.totalIncomeTax ?? 0) + (ledgerRow?.niitTax ?? 0);
  const lookbackIRMAA = irmaaRow?.combinedSurchargeAnnual ?? 0;
  const totalDrag = conversionYearTax + lookbackIRMAA;

  return {
    conversionYearTax,
    lookbackIRMAA,
    totalDrag,
    ledgerRow,
    irmaaRow,
    ledger,
  };
}

/**
 * Computes the optimal Year-by-Year Tax Equilibrium (TE) Roth conversion schedule.
 */
export function calculateTaxEquilibriumSchedule(
  inputs: AppStateInputs,
  simulateSurvivor: boolean = false,
  overrideSequence?: LockedReturnSequence | null
): TaxEquilibriumResult {
  const simStartYear = getSimulationStartYear(inputs);
  const startYear = inputs.rothConversionStartYear !== undefined
    ? inputs.rothConversionStartYear
    : (simStartYear + DEFAULT_CONVERSION_WINDOW_START_OFFSET_YEARS);
  const endYear = inputs.rothConversionEndYear !== undefined
    ? inputs.rothConversionEndYear
    : (simStartYear + DEFAULT_CONVERSION_WINDOW_DURATION_YEARS);

  // 1. Run baseline 0-conversion simulation to establish initial future RMD metrics
  const baselineSchedule: Record<number, number> = {};
  for (let y = startYear; y <= endYear; y++) {
    baselineSchedule[y] = 0;
  }

  const baselineEval = evaluatePlanTaxCostForYear(inputs, simulateSurvivor, overrideSequence, baselineSchedule, startYear);
  const baselineLedger = baselineEval.ledger;

  const baselineLifetimeTaxes = baselineLedger.reduce((sum, r) => sum + r.totalIncomeTax + (r.niitTax || 0) + (r.combinedSurchargeAnnual || 0), 0);
  const baselineFirstRMD = baselineLedger.find((r) => (r.yourRMD ?? 0) > 0 || (r.wifeRMD ?? 0) > 0);
  const baselineFirstRMDVal = baselineFirstRMD ? (baselineFirstRMD.yourRMD ?? 0) + (baselineFirstRMD.wifeRMD ?? 0) : 0;
  const baselineEndingEstate = baselineLedger.length > 0 ? baselineLedger[baselineLedger.length - 1].totalPortfolioValue : 0;

  if (!inputs.isConfigured || baselineLedger.length === 0) {
    return {
      schedule: {},
      yearlyDetails: [],
      averageBenchmarkRate: 0,
      lifetimeImpact: {
        baselineLifetimeTaxes: 0,
        optimizedLifetimeTaxes: 0,
        lifetimeTaxSavings: 0,
        baselineFirstRMD: 0,
        optimizedFirstRMD: 0,
        firstRMDDelta: 0,
        baselineEndingEstate: 0,
        optimizedEndingEstate: 0,
        endingEstateDelta: 0,
      },
    };
  }

  const currentState = inputs.jurisdiction?.currentState || 'MD';
  const solvedSchedule: Record<number, number> = {};
  const yearlyDetails: YearlyTaxEquilibriumPoint[] = [];
  let totalBenchmarkSum = 0;
  let benchmarkCount = 0;

  // 2. Year-by-Year Optimization Window
  for (let year = startYear; year <= endYear; year++) {
    // Current state of schedule solved up to this year
    solvedSchedule[year] = 0;

    // Evaluate dynamic RMD hurdle rate based on current cumulative plan
    const currentRun = evaluatePlanTaxCostForYear(inputs, simulateSurvivor, overrideSequence, solvedSchedule, year);
    const dynamicHurdleRate = calculateDynamicRMDHurdleRate(currentRun.ledger, currentState);
    totalBenchmarkSum += dynamicHurdleRate;
    benchmarkCount++;

    const baseRow = currentRun.ledgerRow;
    if (!baseRow) continue;

    // Available pre-tax assets in this year
    const availablePreTax = (baseRow.endYourPreTaxIRA ?? 0) + (baseRow.endWifePreTaxIRA ?? 0);
    // Liquid non-retirement assets (cash + taxable brokerage)
    const availableLiquidity = (baseRow.endYourCash ?? 0) + (baseRow.endWifeCash ?? 0) +
      (baseRow.endYourTaxableBrokerage ?? 0) + (baseRow.endWifeTaxableBrokerage ?? 0);

    // Approximate safety floor: target runway months of living expenses
    const runwayMonths = inputs.bucketSettings?.cash?.targetRunwayMonths ?? DEFAULT_SAFETY_RUNWAY_MONTHS;
    const reserveFloor = (runwayMonths / MONTHS_PER_YEAR) * baseRow.livingExpenses;
    const maxUsableTaxLiquidity = Math.max(0, availableLiquidity - reserveFloor);

    // 3-Phase Coarse-to-Fine Search
    let currentOptimalConversion = 0;
    let limitingFactor: TELimitingFactor = 'Matched Future TE Benchmark';
    let lastMarginalRate = 0;

    for (let phaseIdx = 0; phaseIdx < CONVERGENCE_TEST_STEPS.length; phaseIdx++) {
      const step = CONVERGENCE_TEST_STEPS[phaseIdx];

      while (true) {
        const nextConversion = currentOptimalConversion + step;

        // Check pre-tax balance constraint
        if (nextConversion > availablePreTax) {
          limitingFactor = 'Pre-Tax IRA Depleted';
          break;
        }

        // Test next increment
        solvedSchedule[year] = nextConversion;
        const nextEval = evaluatePlanTaxCostForYear(inputs, simulateSurvivor, overrideSequence, solvedSchedule, year);
        
        // Check liquidity / cash reserve constraint
        // If conversion tax draws liquid reserves below floor or creates a cash deficit
        const totalConversionTax = nextEval.conversionYearTax - currentRun.conversionYearTax;
        if (totalConversionTax > maxUsableTaxLiquidity && maxUsableTaxLiquidity > 0) {
          limitingFactor = 'Capped by Cash Reserves';
          break;
        }

        // Compute marginal rate on this step
        solvedSchedule[year] = currentOptimalConversion;
        const curEval = evaluatePlanTaxCostForYear(inputs, simulateSurvivor, overrideSequence, solvedSchedule, year);
        const incrementalCost = nextEval.totalDrag - curEval.totalDrag;
        const marginalRate = incrementalCost / step;

        // Did we hit an IRMAA cliff or 0% LTCG threshold?
        const deltaIRMAA = nextEval.lookbackIRMAA - curEval.lookbackIRMAA;
        if (deltaIRMAA > 0 && deltaIRMAA / step > IRMAA_CLIFF_DRAG_DETECTION_THRESHOLD) {
          limitingFactor = 'IRMAA Cliff Boundary';
          break;
        }

        if (marginalRate > dynamicHurdleRate) {
          limitingFactor = 'Matched Future TE Benchmark';
          break;
        }

        currentOptimalConversion = nextConversion;
        lastMarginalRate = marginalRate;
      }

      // Back up one step if not the final phase, so the finer step can approach precisely
      solvedSchedule[year] = currentOptimalConversion;
    }

    // Capture finalized optimal amount for this year
    solvedSchedule[year] = currentOptimalConversion;
    const finalYearEval = evaluatePlanTaxCostForYear(inputs, simulateSurvivor, overrideSequence, solvedSchedule, year);
    const finalRow = finalYearEval.ledgerRow;

    const baseOrdinary = (finalRow?.yourSalary ?? 0) + (finalRow?.wifeSalary ?? 0) +
      (finalRow?.taxableDividends ?? 0) + (finalRow?.taxableInterest ?? 0) +
      (finalRow?.taxableSS ?? 0);
    const realizedGains = finalRow?.capitalGainsTriggered ?? 0;

    yearlyDetails.push({
      year,
      yourAge: finalRow?.yourAge ?? STATUTORY_MEDICARE_ELIGIBILITY_AGE,
      wifeAge: finalRow?.wifeAge ?? STATUTORY_MEDICARE_ELIGIBILITY_AGE,
      baseOrdinaryIncome: baseOrdinary,
      realizedGains,
      optimalConversion: currentOptimalConversion,
      marginalRate: lastMarginalRate > 0 ? lastMarginalRate : DEFAULT_TAX_EQUILIBRIUM_FLOOR_RATE,
      futureBenchmarkRate: dynamicHurdleRate,
      limitingFactor,
      projectedAnnualTax: finalYearEval.conversionYearTax,
      projectedAnnualIRMAA: finalYearEval.lookbackIRMAA,
    });
  }

  // 3. Final Simulation with the Full Solved TE Schedule
  const optimizedEval = evaluatePlanTaxCostForYear(inputs, simulateSurvivor, overrideSequence, solvedSchedule, startYear);
  const optimizedLedger = optimizedEval.ledger;

  const optimizedLifetimeTaxes = optimizedLedger.reduce((sum, r) => sum + r.totalIncomeTax + (r.niitTax || 0) + (r.combinedSurchargeAnnual || 0), 0);
  const optimizedFirstRMD = optimizedLedger.find((r) => (r.yourRMD ?? 0) > 0 || (r.wifeRMD ?? 0) > 0);
  const optimizedFirstRMDVal = optimizedFirstRMD ? (optimizedFirstRMD.yourRMD ?? 0) + (optimizedFirstRMD.wifeRMD ?? 0) : 0;
  const optimizedEndingEstate = optimizedLedger.length > 0 ? optimizedLedger[optimizedLedger.length - 1].totalPortfolioValue : 0;

  const averageBenchmarkRate = benchmarkCount > 0 ? totalBenchmarkSum / benchmarkCount : DEFAULT_AVERAGE_BENCHMARK_RATE;

  return {
    schedule: solvedSchedule,
    yearlyDetails,
    averageBenchmarkRate,
    lifetimeImpact: {
      baselineLifetimeTaxes,
      optimizedLifetimeTaxes,
      lifetimeTaxSavings: Math.max(0, baselineLifetimeTaxes - optimizedLifetimeTaxes),
      baselineFirstRMD: baselineFirstRMDVal,
      optimizedFirstRMD: optimizedFirstRMDVal,
      firstRMDDelta: Math.max(0, baselineFirstRMDVal - optimizedFirstRMDVal),
      baselineEndingEstate,
      optimizedEndingEstate,
      endingEstateDelta: optimizedEndingEstate - baselineEndingEstate,
    },
  };
}
