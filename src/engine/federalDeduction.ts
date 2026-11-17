import {
  STATUTORY_AGED_DEDUCTION_AGE,
  OBBBA_SENIOR_DEDUCTION_FIRST_YEAR,
  OBBBA_SENIOR_DEDUCTION_LAST_YEAR,
  OBBBA_SENIOR_DEDUCTION_PER_FILER,
  OBBBA_SENIOR_DEDUCTION_PHASEOUT_RATE,
  OBBBA_SENIOR_DEDUCTION_PHASEOUT_THRESHOLD_MFJ,
  OBBBA_SENIOR_DEDUCTION_PHASEOUT_THRESHOLD_SINGLE,
  OBBBA_SALT_CAP_FIRST_YEAR,
  OBBBA_SALT_CAP_LAST_YEAR,
  OBBBA_SALT_CAP_FIRST_YEAR_AMOUNT,
  OBBBA_SALT_CAP_ANNUAL_GROWTH,
  OBBBA_SALT_PHASEDOWN_THRESHOLD_FIRST_YEAR,
  OBBBA_SALT_PHASEDOWN_RATE,
  PRE_OBBBA_SALT_CAP,
  OBBBA_CHARITABLE_FIRST_YEAR,
  OBBBA_CHARITABLE_ITEMIZED_AGI_FLOOR_RATE,
  OBBBA_NON_ITEMIZER_CHARITABLE_DEDUCTION_MFJ,
  OBBBA_NON_ITEMIZER_CHARITABLE_DEDUCTION_SINGLE,
} from './taxRates';
import type { FederalIndexing } from './federalTaxRules';

/**
 * Counts filers age 65 or older on the return.
 * A single return is judged by the one remaining filer's age: the plan's only filer, or whichever
 * spouse survived. A joint return counts both spouses, including one who died that year, because
 * the year-of-death return is still joint.
 */
export function countAgedFilers(
  isSingle: boolean,
  isSingleFilerPlan: boolean,
  yourAge: number,
  wifeAge: number,
  youDeceased: boolean
): number {
  if (isSingle) {
    const activeAge = isSingleFilerPlan || !youDeceased ? yourAge : wifeAge;
    return activeAge >= STATUTORY_AGED_DEDUCTION_AGE ? 1 : 0;
  }
  let count = 0;
  if (yourAge >= STATUTORY_AGED_DEDUCTION_AGE) count++;
  if (wifeAge >= STATUTORY_AGED_DEDUCTION_AGE) count++;
  return count;
}

/** SALT deduction cap for a tax year, before the high-income phase-down. Not inflation indexed. */
export function getSaltCap(year: number): number {
  if (year < OBBBA_SALT_CAP_FIRST_YEAR || year > OBBBA_SALT_CAP_LAST_YEAR) return PRE_OBBBA_SALT_CAP;
  return OBBBA_SALT_CAP_FIRST_YEAR_AMOUNT * Math.pow(1 + OBBBA_SALT_CAP_ANNUAL_GROWTH, year - OBBBA_SALT_CAP_FIRST_YEAR);
}

/** SALT cap after the MAGI phase-down: reduced by a share of MAGI over the threshold, floored at the old cap. */
export function getEffectiveSaltCap(year: number, magi: number): number {
  const cap = getSaltCap(year);
  if (year < OBBBA_SALT_CAP_FIRST_YEAR || year > OBBBA_SALT_CAP_LAST_YEAR) return cap;
  const threshold =
    OBBBA_SALT_PHASEDOWN_THRESHOLD_FIRST_YEAR * Math.pow(1 + OBBBA_SALT_CAP_ANNUAL_GROWTH, year - OBBBA_SALT_CAP_FIRST_YEAR);
  const reduction = OBBBA_SALT_PHASEDOWN_RATE * Math.max(0, magi - threshold);
  return Math.max(PRE_OBBBA_SALT_CAP, cap - reduction);
}

/** OBBBA senior deduction for a tax year after the MAGI phase-out. Zero outside the enhanced years. */
export function getSeniorDeduction(year: number, isSingle: boolean, agedFilerCount: number, magi: number): number {
  if (year < OBBBA_SENIOR_DEDUCTION_FIRST_YEAR || year > OBBBA_SENIOR_DEDUCTION_LAST_YEAR) return 0;
  const threshold = isSingle
    ? OBBBA_SENIOR_DEDUCTION_PHASEOUT_THRESHOLD_SINGLE
    : OBBBA_SENIOR_DEDUCTION_PHASEOUT_THRESHOLD_MFJ;
  const gross = OBBBA_SENIOR_DEDUCTION_PER_FILER * agedFilerCount;
  const reduction = OBBBA_SENIOR_DEDUCTION_PHASEOUT_RATE * Math.max(0, magi - threshold);
  return Math.max(0, gross - reduction);
}

export interface FederalDeductionParams {
  year: number;
  isSingle: boolean;
  /** Year-keyed federal rules and the factor that indexes their dollar limits to this year. */
  federal: FederalIndexing;
  agedFilerCount: number;
  /** Federal AGI, used as the MAGI proxy for every phase-out and the charitable floor. */
  fedAGI: number;
  stateIncomeTax: number;
  /** Property tax in nominal dollars from expense items flagged as SALT eligible. */
  propertyTax: number;
  /** Non-QCD charitable gifts in nominal dollars. */
  nonQcdTithe: number;
}

export interface FederalDeductionResult {
  /** Total deduction subtracted from AGI. */
  totalDeduction: number;
  standardDeduction: number;
  itemizedDeduction: number;
  seniorDeduction: number;
  usesItemized: boolean;
}

/**
 * Federal deduction for one tax year: the larger of the standard deduction (with age additions and the
 * non-itemizer charitable deduction) or itemized deductions (capped SALT plus charity above the AGI floor),
 * plus the OBBBA senior deduction, which applies either way.
 */
export function calculateFederalDeduction(params: FederalDeductionParams): FederalDeductionResult {
  const { year, isSingle, federal, agedFilerCount, fedAGI, stateIncomeTax, propertyTax, nonQcdTithe } = params;

  const status = isSingle ? 'single' : 'mfj';
  const baseStandard = federal.rules.standardDeduction[status] * federal.indexFactor;
  const agedAddition = agedFilerCount * federal.rules.additionalStandardDeductionAged[status] * federal.indexFactor;
  const charitableRulesApply = year >= OBBBA_CHARITABLE_FIRST_YEAR;

  const nonItemizerCharity = charitableRulesApply
    ? Math.min(
        nonQcdTithe,
        isSingle ? OBBBA_NON_ITEMIZER_CHARITABLE_DEDUCTION_SINGLE : OBBBA_NON_ITEMIZER_CHARITABLE_DEDUCTION_MFJ
      )
    : 0;
  const standardDeduction = baseStandard + agedAddition;

  const saltDeduction = Math.min(getEffectiveSaltCap(year, fedAGI), stateIncomeTax + propertyTax);
  const itemizedCharity = charitableRulesApply
    ? Math.max(0, nonQcdTithe - OBBBA_CHARITABLE_ITEMIZED_AGI_FLOOR_RATE * Math.max(0, fedAGI))
    : nonQcdTithe;
  const itemizedDeduction = saltDeduction + itemizedCharity;

  const usesItemized = itemizedDeduction > standardDeduction + nonItemizerCharity;
  const seniorDeduction = getSeniorDeduction(year, isSingle, agedFilerCount, fedAGI);
  const baseDeduction = usesItemized ? itemizedDeduction : standardDeduction + nonItemizerCharity;

  return {
    totalDeduction: baseDeduction + seniorDeduction,
    standardDeduction,
    itemizedDeduction,
    seniorDeduction,
    usesItemized,
  };
}
