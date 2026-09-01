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

export const CONVERSION_TARGET_PRESETS: ConversionTargetPreset[] = [
  // Federal Tax Brackets (Taxable Income ceilings)
  {
    id: 'bracket_10',
    type: 'bracket',
    rateLabel: '10%',
    shortLabel: '10% ($24.8k)',
    description: 'Top of 10% Fed Tax Bracket ($24,800 Taxable Income)',
    jointBase: 24800,
    singleBase: 12400,
    targetValue: 24800,
    color: 'rgba(244, 63, 94, 0.9)',
  },
  {
    id: 'bracket_12',
    type: 'bracket',
    rateLabel: '12%',
    shortLabel: '12% ($100.8k)',
    description: 'Top of 12% Fed Tax Bracket ($100,800 Taxable Income)',
    jointBase: 100800,
    singleBase: 50400,
    targetValue: 100800,
    color: 'rgba(244, 63, 94, 0.9)',
  },
  {
    id: 'bracket_22',
    type: 'bracket',
    rateLabel: '22%',
    shortLabel: '22% ($211.4k)',
    description: 'Top of 22% Fed Tax Bracket ($211,400 Taxable Income)',
    jointBase: 211400,
    singleBase: 105700,
    targetValue: 211400,
    color: 'rgba(249, 115, 22, 0.9)',
  },
  {
    id: 'bracket_24',
    type: 'bracket',
    rateLabel: '24%',
    shortLabel: '24% ($403.6k)',
    description: 'Top of 24% Fed Tax Bracket ($403,550 Taxable Income)',
    jointBase: 403550,
    singleBase: 201775,
    targetValue: 403550,
    color: 'rgba(236, 72, 153, 0.9)',
  },
  {
    id: 'bracket_32',
    type: 'bracket',
    rateLabel: '32%',
    shortLabel: '32% ($512.5k)',
    description: 'Top of 32% Fed Tax Bracket ($512,450 Taxable Income)',
    jointBase: 512450,
    singleBase: 256225,
    targetValue: 512450,
    color: 'rgba(168, 85, 247, 0.9)',
  },
  {
    id: 'bracket_35',
    type: 'bracket',
    rateLabel: '35%',
    shortLabel: '35% ($768.7k)',
    description: 'Top of 35% Fed Tax Bracket ($768,700 Taxable Income)',
    jointBase: 768700,
    singleBase: 640600,
    targetValue: 768700,
    color: 'rgba(239, 68, 68, 0.9)',
  },

  // IRMAA Tiers (MAGI ceilings)
  {
    id: 'irmaa_1',
    type: 'irmaa',
    rateLabel: 'Tier 1',
    shortLabel: 'Tier 1 ($218k)',
    description: 'IRMAA Tier 1 Cliff ($218,000 MAGI)',
    jointBase: 218000,
    singleBase: 109000,
    targetValue: 218000,
    color: 'rgba(16, 185, 129, 0.9)',
  },
  {
    id: 'irmaa_2',
    type: 'irmaa',
    rateLabel: 'Tier 2',
    shortLabel: 'Tier 2 ($274k)',
    description: 'IRMAA Tier 2 Cliff ($274,000 MAGI)',
    jointBase: 274000,
    singleBase: 137000,
    targetValue: 274000,
    color: 'rgba(245, 158, 11, 0.9)',
  },
  {
    id: 'irmaa_3',
    type: 'irmaa',
    rateLabel: 'Tier 3',
    shortLabel: 'Tier 3 ($342k)',
    description: 'IRMAA Tier 3 Cliff ($342,000 MAGI)',
    jointBase: 342000,
    singleBase: 171000,
    targetValue: 342000,
    color: 'rgba(59, 130, 246, 0.9)',
  },
  {
    id: 'irmaa_4',
    type: 'irmaa',
    rateLabel: 'Tier 4',
    shortLabel: 'Tier 4 ($410k)',
    description: 'IRMAA Tier 4 Cliff ($410,000 MAGI)',
    jointBase: 410000,
    singleBase: 205000,
    targetValue: 410000,
    color: 'rgba(236, 72, 153, 0.9)',
  },
  {
    id: 'irmaa_5',
    type: 'irmaa',
    rateLabel: 'Tier 5',
    shortLabel: 'Tier 5 ($750k)',
    description: 'IRMAA Tier 5 Cliff ($750,000 MAGI)',
    jointBase: 750000,
    singleBase: 500000,
    targetValue: 750000,
    color: 'rgba(239, 68, 68, 0.9)',
  },
];

export function getTargetPresetInfo(targetValue: number | null): ConversionTargetPreset | null {
  if (targetValue === null || targetValue === undefined || targetValue <= 0) return null;

  switch (targetValue) {
    case 24800:
    case 57000:
      return CONVERSION_TARGET_PRESETS[0]; // 10%
    case 100800:
    case 133000:
      return CONVERSION_TARGET_PRESETS[1]; // 12%
    case 211400:
    case 243600:
      return CONVERSION_TARGET_PRESETS[2]; // 22%
    case 403550:
    case 435750:
      return CONVERSION_TARGET_PRESETS[3]; // 24%
    case 512450:
    case 544650:
      return CONVERSION_TARGET_PRESETS[4]; // 32%
    case 768700:
    case 800900:
      return CONVERSION_TARGET_PRESETS[5]; // 35%
    case 217999:
    case 218000:
      return CONVERSION_TARGET_PRESETS[6]; // IRMAA 1
    case 273999:
    case 274000:
      return CONVERSION_TARGET_PRESETS[7]; // IRMAA 2
    case 341999:
    case 342000:
      return CONVERSION_TARGET_PRESETS[8]; // IRMAA 3
    case 409999:
    case 410000:
      return CONVERSION_TARGET_PRESETS[9]; // IRMAA 4
    case 749999:
    case 750000:
      return CONVERSION_TARGET_PRESETS[10]; // IRMAA 5
    default:
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
}

// 2026 Federal Standard Deductions
export const FED_STANDARD_DEDUCTION_MFJ = 32200;
export const FED_STANDARD_DEDUCTION_SINGLE = 16100;

// 2026 Federal Brackets (MFJ)
export const FED_BRACKETS_MFJ: TaxBracket[] = [
  { rate: 0.10, limit: 24800 },
  { rate: 0.12, limit: 100800 },
  { rate: 0.22, limit: 211400 },
  { rate: 0.24, limit: 403550 },
  { rate: 0.32, limit: 512450 },
  { rate: 0.35, limit: 768700 },
  { rate: 0.37, limit: Infinity }
];

// 2026 Federal Brackets (Single)
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
