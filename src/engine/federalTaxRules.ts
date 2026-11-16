// Year-keyed federal tax rule tables. Each entry holds the published figures for the tax year in which
// it first applies. To add a new year, publish its figures as a new entry in FED_YEAR_RULES (source:
// the IRS inflation adjustment revenue procedure, e.g. Rev. Proc. 2025-32 for 2026). No logic changes.
import { resolveYearRules } from './states/stateTaxPrimitives';

export interface TaxBracket {
  rate: number;
  limit: number; // upper limit of this bracket (Infinity for the top bracket)
}

export interface IRMAATier {
  tierNumber: number;
  limit: number; // MAGI upper limit
  partBSurcharge: number;
  partDSurcharge: number;
}

export interface FilingStatusRules<T> {
  mfj: T;
  single: T;
}

export interface FederalYearRules {
  /** Ordinary income brackets, in the dollars of the rule year. */
  brackets: FilingStatusRules<TaxBracket[]>;
  /** Long-term capital gains brackets: 0%, 15% and 20% tiers. */
  ltcgBrackets: FilingStatusRules<TaxBracket[]>;
  standardDeduction: FilingStatusRules<number>;
  /** Additional standard deduction for each filer age 65 or older (IRC Section 63(f)). */
  additionalStandardDeductionAged: FilingStatusRules<number>;
  /** IRMAA MAGI tiers and monthly surcharges per person. The top tier limit is Infinity. */
  irmaaTiers: FilingStatusRules<IRMAATier[]>;
}

export const FED_YEAR_RULES: Record<number, FederalYearRules> = {
  // 2026: brackets and deductions per Rev. Proc. 2025-32. LTCG limits per its section 4.03.
  2026: {
    brackets: {
      mfj: [
        { rate: 0.10, limit: 24800 },
        { rate: 0.12, limit: 100800 },
        { rate: 0.22, limit: 211400 },
        { rate: 0.24, limit: 403550 },
        { rate: 0.32, limit: 512450 },
        { rate: 0.35, limit: 768700 },
        { rate: 0.37, limit: Infinity },
      ],
      single: [
        { rate: 0.10, limit: 12400 },
        { rate: 0.12, limit: 50400 },
        { rate: 0.22, limit: 105700 },
        { rate: 0.24, limit: 201775 },
        { rate: 0.32, limit: 256225 },
        { rate: 0.35, limit: 640600 },
        { rate: 0.37, limit: Infinity },
      ],
    },
    ltcgBrackets: {
      mfj: [
        { rate: 0.00, limit: 98900 },
        { rate: 0.15, limit: 613700 },
        { rate: 0.20, limit: Infinity },
      ],
      single: [
        { rate: 0.00, limit: 49450 },
        { rate: 0.15, limit: 545500 },
        { rate: 0.20, limit: Infinity },
      ],
    },
    standardDeduction: { mfj: 32200, single: 16100 },
    additionalStandardDeductionAged: { mfj: 1650, single: 1950 },
    irmaaTiers: {
      // Tier 5 represents MAGI at or above $750k (MFJ) or $500k (single), so its limit is Infinity
      mfj: [
        { tierNumber: 0, limit: 218000, partBSurcharge: 0.00, partDSurcharge: 0.00 },
        { tierNumber: 1, limit: 274000, partBSurcharge: 81.20, partDSurcharge: 14.50 },
        { tierNumber: 2, limit: 342000, partBSurcharge: 202.90, partDSurcharge: 37.50 },
        { tierNumber: 3, limit: 410000, partBSurcharge: 324.60, partDSurcharge: 60.40 },
        { tierNumber: 4, limit: 749999, partBSurcharge: 446.30, partDSurcharge: 83.30 },
        { tierNumber: 5, limit: Infinity, partBSurcharge: 487.00, partDSurcharge: 91.00 },
      ],
      single: [
        { tierNumber: 0, limit: 109000, partBSurcharge: 0.00, partDSurcharge: 0.00 },
        { tierNumber: 1, limit: 137000, partBSurcharge: 81.20, partDSurcharge: 14.50 },
        { tierNumber: 2, limit: 171000, partBSurcharge: 202.90, partDSurcharge: 37.50 },
        { tierNumber: 3, limit: 205000, partBSurcharge: 324.60, partDSurcharge: 60.40 },
        { tierNumber: 4, limit: 499999, partBSurcharge: 446.30, partDSurcharge: 83.30 },
        { tierNumber: 5, limit: Infinity, partBSurcharge: 487.00, partDSurcharge: 91.00 },
      ],
    },
  },
};

/** Rules in force for a tax year: the latest entry at or before it, or the latest entry when no year is given. */
export function getFederalRules(year?: number): FederalYearRules {
  return resolveYearRules(FED_YEAR_RULES, year);
}

/** The first year of the entry that governs a tax year. */
export function getFederalRulesBaseYear(year?: number): number {
  const years = Object.keys(FED_YEAR_RULES).map(Number).sort((a, b) => a - b);
  if (year === undefined) return years[years.length - 1];
  const applicable = years.filter((y) => y <= year);
  return applicable.length > 0 ? applicable[applicable.length - 1] : years[0];
}

/**
 * Rules for one simulated year paired with the factor that carries their dollar limits to that year.
 * Dollar limits (brackets, deductions, IRMAA tiers) are multiplied by indexFactor. Surcharge amounts and
 * rates are not.
 */
export interface FederalIndexing {
  rules: FederalYearRules;
  indexFactor: number;
}

/**
 * Index factor from a rule entry's dollars to a simulated year. The simulation CPI factor is 1.0 in the
 * simulation start year, so it is re-based to the rule year: a rule year before the start year is inflated
 * further, and one after the start year is deflated back to its own year.
 */
export function federalIndexFactor(
  year: number,
  cpiFactor: number,
  simStartYear: number,
  cpiRate: number
): number {
  const ruleYear = getFederalRulesBaseYear(year);
  return cpiFactor * Math.pow(1 + cpiRate, simStartYear - ruleYear);
}

export function getFederalIndexing(
  year: number,
  cpiFactor: number,
  simStartYear: number,
  cpiRate: number
): FederalIndexing {
  return {
    rules: getFederalRules(year),
    indexFactor: federalIndexFactor(year, cpiFactor, simStartYear, cpiRate),
  };
}
