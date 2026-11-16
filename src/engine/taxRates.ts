// Tax rates & reference data for the Retirement Scenario Optimizer. Federal brackets, deductions and
// IRMAA tiers live in the year-keyed tables in federalTaxRules.ts.
import { getFederalRules } from './federalTaxRules';
export type { TaxBracket, IRMAATier } from './federalTaxRules';

export const BASE_MEDICARE_PART_B = 202.90;
export const BASE_MEDICARE_PART_D = 34.50;

/**
 * Latest-known-year federal rules, for static UI presets and defaults only. Engine calculations must
 * look rules up by tax year through getFederalIndexing so each simulated year uses its own table.
 */
const LATEST_FEDERAL_RULES = getFederalRules();
export const FED_BRACKETS_MFJ = LATEST_FEDERAL_RULES.brackets.mfj;
export const FED_BRACKETS_SINGLE = LATEST_FEDERAL_RULES.brackets.single;
export const FED_STANDARD_DEDUCTION_MFJ = LATEST_FEDERAL_RULES.standardDeduction.mfj;
export const FED_STANDARD_DEDUCTION_SINGLE = LATEST_FEDERAL_RULES.standardDeduction.single;
export const IRMAA_TIERS_MFJ = LATEST_FEDERAL_RULES.irmaaTiers.mfj;
export const IRMAA_TIERS_SINGLE = LATEST_FEDERAL_RULES.irmaaTiers.single;
export const STATUTORY_STD_DEDUCTION_SINGLE_MFJ_MIDPOINT = (FED_STANDARD_DEDUCTION_SINGLE + FED_STANDARD_DEDUCTION_MFJ) / 2;

/**
 * Net Investment Income Tax (NIIT) Statutory Constants (IRC Section 1411)
 */
export const STATUTORY_NIIT_RATE = 0.038;
export const STATUTORY_NIIT_THRESHOLD_SINGLE = 200000;
export const STATUTORY_NIIT_THRESHOLD_MFJ = 250000;

/**
 * Social Security Taxability Statutory Constants (IRC Section 86)
 */
export const STATUTORY_MAX_TAXABLE_SS_PORTION = 0.85;
export const STATUTORY_SS_TORPEDO_MULTIPLIER = 1 + STATUTORY_MAX_TAXABLE_SS_PORTION; // 1.85

/**
 * Statutory lookback period for Medicare Part B and Part D IRMAA determinations (Social Security Act Section 1839(i))
 */
export const STATUTORY_IRMAA_LOOKBACK_YEARS = 2;

/**
 * Statutory Medicare eligibility age (Title XVIII of the Social Security Act)
 */
export const STATUTORY_MEDICARE_ELIGIBILITY_AGE = 65;

/**
 * Default Fill-to-Target benchmark target (derived dynamically from the 12% Federal Tax Bracket ceiling in FED_BRACKETS_MFJ)
 */
export const DEFAULT_FILL_TO_TARGET_VALUE = FED_BRACKETS_MFJ.find((b) => b.rate === 0.12)?.limit ?? 100800;

export interface ConversionTargetPreset {
  id: string;
  type: 'bracket' | 'irmaa';
  rateLabel: string;
  shortLabel: string;
  description: string;
  jointBase: number;  // Taxable income ceiling for brackets, MAGI ceiling for IRMAA
  singleBase: number; // Single filer equivalent
  targetValue: number; // Preset value passed to inputs.rothConversionTargetValue
  color: string;
}

const BRACKET_COLORS: Record<number, string> = {
  0.10: 'rgba(244, 63, 94, 0.9)',
  0.12: 'rgba(244, 63, 94, 0.9)',
  0.22: 'rgba(249, 115, 22, 0.9)',
  0.24: 'rgba(236, 72, 153, 0.9)',
  0.32: 'rgba(168, 85, 247, 0.9)',
  0.35: 'rgba(239, 68, 68, 0.9)',
};

const IRMAA_TIER_COLORS: Record<number, string> = {
  1: 'rgba(16, 185, 129, 0.9)',
  2: 'rgba(245, 158, 11, 0.9)',
  3: 'rgba(59, 130, 246, 0.9)',
  4: 'rgba(236, 72, 153, 0.9)',
  5: 'rgba(239, 68, 68, 0.9)',
};

export const CONVERSION_TARGET_PRESETS: ConversionTargetPreset[] = [
  // Federal Tax Brackets derived dynamically from statutory tables
  ...FED_BRACKETS_MFJ.filter((b) => isFinite(b.limit)).map((b, idx) => {
    const single = FED_BRACKETS_SINGLE[idx]?.limit ?? b.limit / 2;
    const pct = Math.round(b.rate * 100);
    const kStr = (b.limit / 1000).toFixed(b.limit % 1000 === 0 ? 0 : 1);
    return {
      id: `bracket_${pct}`,
      type: 'bracket' as const,
      rateLabel: `${pct}%`,
      shortLabel: `${pct}% ($${kStr}k)`,
      description: `Top of ${pct}% Fed Tax Bracket ($${b.limit.toLocaleString()} Taxable Income)`,
      jointBase: b.limit,
      singleBase: single,
      targetValue: b.limit,
      color: BRACKET_COLORS[b.rate] || 'rgba(244, 63, 94, 0.9)',
    };
  }),

  // IRMAA Tiers derived dynamically from statutory tables
  {
    id: 'irmaa_1',
    type: 'irmaa' as const,
    rateLabel: 'Tier 1',
    shortLabel: `Tier 1 ($${(IRMAA_TIERS_MFJ[0].limit / 1000).toFixed(0)}k)`,
    description: `IRMAA Tier 1 Cliff ($${IRMAA_TIERS_MFJ[0].limit.toLocaleString()} MAGI)`,
    jointBase: IRMAA_TIERS_MFJ[0].limit,
    singleBase: IRMAA_TIERS_SINGLE[0].limit,
    targetValue: IRMAA_TIERS_MFJ[0].limit,
    color: IRMAA_TIER_COLORS[1],
  },
  {
    id: 'irmaa_2',
    type: 'irmaa' as const,
    rateLabel: 'Tier 2',
    shortLabel: `Tier 2 ($${(IRMAA_TIERS_MFJ[1].limit / 1000).toFixed(0)}k)`,
    description: `IRMAA Tier 2 Cliff ($${IRMAA_TIERS_MFJ[1].limit.toLocaleString()} MAGI)`,
    jointBase: IRMAA_TIERS_MFJ[1].limit,
    singleBase: IRMAA_TIERS_SINGLE[1].limit,
    targetValue: IRMAA_TIERS_MFJ[1].limit,
    color: IRMAA_TIER_COLORS[2],
  },
  {
    id: 'irmaa_3',
    type: 'irmaa' as const,
    rateLabel: 'Tier 3',
    shortLabel: `Tier 3 ($${(IRMAA_TIERS_MFJ[2].limit / 1000).toFixed(0)}k)`,
    description: `IRMAA Tier 3 Cliff ($${IRMAA_TIERS_MFJ[2].limit.toLocaleString()} MAGI)`,
    jointBase: IRMAA_TIERS_MFJ[2].limit,
    singleBase: IRMAA_TIERS_SINGLE[2].limit,
    targetValue: IRMAA_TIERS_MFJ[2].limit,
    color: IRMAA_TIER_COLORS[3],
  },
  {
    id: 'irmaa_4',
    type: 'irmaa' as const,
    rateLabel: 'Tier 4',
    shortLabel: `Tier 4 ($${(IRMAA_TIERS_MFJ[3].limit / 1000).toFixed(0)}k)`,
    description: `IRMAA Tier 4 Cliff ($${IRMAA_TIERS_MFJ[3].limit.toLocaleString()} MAGI)`,
    jointBase: IRMAA_TIERS_MFJ[3].limit,
    singleBase: IRMAA_TIERS_SINGLE[3].limit,
    targetValue: IRMAA_TIERS_MFJ[3].limit,
    color: IRMAA_TIER_COLORS[4],
  },
  {
    id: 'irmaa_5',
    type: 'irmaa' as const,
    rateLabel: 'Tier 5',
    shortLabel: 'Tier 5 ($750k)',
    description: 'IRMAA Tier 5 Cliff ($750,000 MAGI)',
    jointBase: IRMAA_TIERS_MFJ[4].limit,
    singleBase: IRMAA_TIERS_SINGLE[4].limit,
    targetValue: 750000,
    color: IRMAA_TIER_COLORS[5],
  },
];

export function getTargetPresetInfo(targetValue: number | null): ConversionTargetPreset | null {
  if (targetValue === null || targetValue === undefined || targetValue <= 0) return null;

  const found = CONVERSION_TARGET_PRESETS.find(
    (p) =>
      p.targetValue === targetValue ||
      p.jointBase === targetValue ||
      Math.abs(p.jointBase - targetValue) <= 1 ||
      p.jointBase + FED_STANDARD_DEDUCTION_MFJ === targetValue
  );
  if (found) return found;

  return {
    id: `custom_${targetValue}`,
    type: 'irmaa',
    rateLabel: `$${targetValue.toLocaleString()}`,
    shortLabel: `$${(targetValue / 1000).toFixed(0)}k`,
    description: `Target MAGI Limit ($${targetValue.toLocaleString()} MAGI)`,
    jointBase: targetValue,
    singleBase: targetValue / 2,
    targetValue: targetValue,
    color: 'rgba(14, 165, 233, 0.9)',
  };
}

// IRS Uniform Lifetime Table (Table III) for Age 72 to 100+
// Used to compute annual Pre-Tax IRA RMDs
export function getIRSUniformLifetimeFactor(age: number): number {
  if (age < 72) return 0;
  
  const factors: { [key: number]: number } = {
    72: 27.4,
    73: 26.5,
    74: 25.5,
    75: 24.6,
    76: 23.7,
    77: 22.9,
    78: 22.0,
    79: 21.1,
    80: 20.2,
    81: 19.4,
    82: 18.5,
    83: 17.7,
    84: 16.8,
    85: 16.0,
    86: 15.2,
    87: 14.4,
    88: 13.7,
    89: 12.9,
    90: 12.1,
    91: 11.5,
    92: 10.8,
    93: 10.1,
    94: 9.5,
    95: 8.9,
    96: 8.4,
    97: 7.8,
    98: 7.3,
    99: 6.8,
    100: 6.4,
    101: 6.0,
    102: 5.6,
    103: 5.2,
    104: 4.9,
    105: 4.6,
    106: 4.3,
    107: 4.1,
    108: 3.9,
    109: 3.7,
    110: 3.5,
  };
  
  if (age >= 110) return 3.5;
  return factors[age] || factors[72];
}


export const STATUTORY_AGED_DEDUCTION_AGE = 65;

/**
 * One Big Beautiful Bill Act (Public Law 119-21) senior deduction, tax years 2025 through 2028.
 * Per filer age 65 or older, not inflation indexed, available whether or not the filer itemizes.
 */
export const OBBBA_SENIOR_DEDUCTION_FIRST_YEAR = 2025;
export const OBBBA_SENIOR_DEDUCTION_LAST_YEAR = 2028;
export const OBBBA_SENIOR_DEDUCTION_PER_FILER = 6000;
export const OBBBA_SENIOR_DEDUCTION_PHASEOUT_RATE = 0.06;
export const OBBBA_SENIOR_DEDUCTION_PHASEOUT_THRESHOLD_MFJ = 150000;
export const OBBBA_SENIOR_DEDUCTION_PHASEOUT_THRESHOLD_SINGLE = 75000;

/**
 * OBBBA state and local tax (SALT) deduction cap. Base cap and phase-down threshold apply in the first
 * year and grow 1% per year through the last enhanced year. After that the pre-OBBBA cap returns.
 * The cap shrinks by 30% of MAGI above the threshold but never below the pre-OBBBA cap.
 */
export const OBBBA_SALT_CAP_FIRST_YEAR = 2025;
export const OBBBA_SALT_CAP_LAST_YEAR = 2029;
export const OBBBA_SALT_CAP_FIRST_YEAR_AMOUNT = 40000;
export const OBBBA_SALT_CAP_ANNUAL_GROWTH = 0.01;
export const OBBBA_SALT_PHASEDOWN_THRESHOLD_FIRST_YEAR = 500000;
export const OBBBA_SALT_PHASEDOWN_RATE = 0.30;
export const PRE_OBBBA_SALT_CAP = 10000;

/**
 * OBBBA charitable changes effective 2026: itemized gifts are reduced by a floor of 0.5% of AGI, and
 * non-itemizers may deduct cash gifts up to a fixed amount. These amounts are not inflation indexed.
 */
export const OBBBA_CHARITABLE_FIRST_YEAR = 2026;
export const OBBBA_CHARITABLE_ITEMIZED_AGI_FLOOR_RATE = 0.005;
export const OBBBA_NON_ITEMIZER_CHARITABLE_DEDUCTION_MFJ = 2000;
export const OBBBA_NON_ITEMIZER_CHARITABLE_DEDUCTION_SINGLE = 1000;
