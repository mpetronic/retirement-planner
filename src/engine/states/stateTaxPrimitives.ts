// Shared building blocks for per-state tax modules. State modules compose these and keep their
// own year-keyed rule tables, so a yearly update is a new table entry rather than a logic change.

export interface TaxBracketTier {
  rate: number;
  limit: number; // upper limit of the tier (Infinity for the top tier)
}

/** Applies graduated marginal tiers to taxable income. */
export function applyBrackets(taxableIncome: number, tiers: TaxBracketTier[]): number {
  let tax = 0;
  let previousLimit = 0;
  for (const tier of tiers) {
    if (taxableIncome > tier.limit) {
      tax += (tier.limit - previousLimit) * tier.rate;
      previousLimit = tier.limit;
    } else {
      tax += Math.max(0, taxableIncome - previousLimit) * tier.rate;
      break;
    }
  }
  return tax;
}

/**
 * Picks the rules for a tax year from a table keyed by the first year each rule set applies.
 * Uses the latest entry at or before the year. Years before the table use its earliest entry,
 * and a missing year uses its latest entry.
 */
export function resolveYearRules<T>(table: Record<number, T>, year?: number): T {
  const years = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (year === undefined) return table[years[years.length - 1]];
  const applicable = years.filter((y) => y <= year);
  return table[applicable.length > 0 ? applicable[applicable.length - 1] : years[0]];
}

/** A step of an income-based phase-out: the fraction of the benefit allowed up to and including agiLimit. */
export interface PhaseOutStep {
  agiLimit: number;
  allowedFraction: number;
}

/** Returns the fraction of a benefit allowed at the given AGI. Steps must be sorted by ascending agiLimit. */
export function phaseOutFraction(agi: number, steps: PhaseOutStep[]): number {
  const step = steps.find((s) => agi <= s.agiLimit);
  return step ? step.allowedFraction : 0;
}
