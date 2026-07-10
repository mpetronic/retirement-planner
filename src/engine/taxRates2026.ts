// 2026 Tax Rates & Reference Data for the Retirement Scenario Optimizer

export const BASE_MEDICARE_PART_B = 202.90;
export const BASE_MEDICARE_PART_D = 34.50;

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
