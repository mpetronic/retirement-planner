// 2026 Tax Rates & Reference Data for the Retirement Scenario Optimizer

export const BASE_MEDICARE_PART_B = 202.90;
export const BASE_MEDICARE_PART_D = 34.50;

/**
 * Maryland Maximum Pension Exclusion Baseline Cap ($34,300 per eligible individual age 65+)
 * Statutory cap set by Comptroller of Maryland equal to the max annual Social Security benefit at Full Retirement Age.
 */
export const MD_PENSION_EXCLUSION_BASE_CAP = 34300;

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

// 2026 Federal Standard Deductions
export const FED_STANDARD_DEDUCTION_MFJ = 32200;
export const FED_STANDARD_DEDUCTION_SINGLE = 16100;

// 2026 Federal Brackets (MFJ) - Single Source of Truth
export const FED_BRACKETS_MFJ: TaxBracket[] = [
  { rate: 0.10, limit: 24800 },
  { rate: 0.12, limit: 100800 },
  { rate: 0.22, limit: 211400 },
  { rate: 0.24, limit: 403550 },
  { rate: 0.32, limit: 512450 },
  { rate: 0.35, limit: 768700 },
  { rate: 0.37, limit: Infinity }
];

// 2026 Federal Brackets (Single) - Single Source of Truth
export const FED_BRACKETS_SINGLE: TaxBracket[] = [
  { rate: 0.10, limit: 12400 },
  { rate: 0.12, limit: 50400 },
  { rate: 0.22, limit: 105700 },
  { rate: 0.24, limit: 201775 },
  { rate: 0.32, limit: 256225 },
  { rate: 0.35, limit: 640600 },
  { rate: 0.37, limit: Infinity }
];

// 2026 Federal Long-Term Capital Gains Brackets (Single)
export const FED_LTCG_BRACKETS_SINGLE: TaxBracket[] = [
  { rate: 0.00, limit: 50200 },
  { rate: 0.15, limit: 554000 },
  { rate: 0.20, limit: Infinity }
];

// 2026 Federal Long-Term Capital Gains Brackets (MFJ)
export const FED_LTCG_BRACKETS_MFJ: TaxBracket[] = [
  { rate: 0.00, limit: 100500 },
  { rate: 0.15, limit: 623000 },
  { rate: 0.20, limit: Infinity }
];

// 2026 IRMAA Tiers (MFJ)
// Tier 5 represents greater than or equal to $750k, so we set its limit to Infinity
export const IRMAA_TIERS_MFJ: IRMAATier[] = [
  { tierNumber: 0, limit: 218000, partBSurcharge: 0.00, partDSurcharge: 0.00 },
  { tierNumber: 1, limit: 274000, partBSurcharge: 81.20, partDSurcharge: 14.50 },
  { tierNumber: 2, limit: 342000, partBSurcharge: 202.90, partDSurcharge: 37.50 },
  { tierNumber: 3, limit: 410000, partBSurcharge: 324.60, partDSurcharge: 60.40 },
  { tierNumber: 4, limit: 749999, partBSurcharge: 446.30, partDSurcharge: 83.30 },
  { tierNumber: 5, limit: Infinity, partBSurcharge: 487.00, partDSurcharge: 91.00 }
];

// 2026 IRMAA Tiers (Single)
export const IRMAA_TIERS_SINGLE: IRMAATier[] = [
  { tierNumber: 0, limit: 109000, partBSurcharge: 0.00, partDSurcharge: 0.00 },
  { tierNumber: 1, limit: 137000, partBSurcharge: 81.20, partDSurcharge: 14.50 },
  { tierNumber: 2, limit: 171000, partBSurcharge: 202.90, partDSurcharge: 37.50 },
  { tierNumber: 3, limit: 205000, partBSurcharge: 324.60, partDSurcharge: 60.40 },
  { tierNumber: 4, limit: 499999, partBSurcharge: 446.30, partDSurcharge: 83.30 },
  { tierNumber: 5, limit: Infinity, partBSurcharge: 487.00, partDSurcharge: 91.00 }
];

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
    jointBase: 750000,
    singleBase: 500000,
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

// Maryland State Tax Bracket Rates (Graduated)
// MD has piggyback local taxes which average 3.20% (added directly to the State's graduated rate)
export const MD_GRADUATED_TIERS_SINGLE = [
  { rate: 0.02, limit: 1000 },
  { rate: 0.03, limit: 2000 },
  { rate: 0.04, limit: 3000 },
  { rate: 0.0475, limit: 100000 },
  { rate: 0.05, limit: 125000 },
  { rate: 0.0525, limit: 150000 },
  { rate: 0.055, limit: 250000 },
  { rate: 0.0575, limit: Infinity }
];

export const MD_GRADUATED_TIERS_MFJ = [
  { rate: 0.02, limit: 1000 },
  { rate: 0.03, limit: 2000 },
  { rate: 0.04, limit: 3000 },
  { rate: 0.0475, limit: 150000 },
  { rate: 0.05, limit: 175000 },
  { rate: 0.0525, limit: 225000 },
  { rate: 0.055, limit: 300000 },
  { rate: 0.0575, limit: Infinity }
];

export const MD_PIGGYBACK_RATE = 0.0320; // flat 3.20% local tax
