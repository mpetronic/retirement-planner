import {
  MD_GRADUATED_TIERS_SINGLE,
  MD_GRADUATED_TIERS_MFJ,
  MD_PIGGYBACK_RATE,
} from './taxRates2026';

export interface SubJurisdiction {
  id: string;
  name: string;
  defaultLocalRate: number;
}

export interface StateTaxCalculationParams {
  fedAGI: number;
  taxableSS: number;
  isSingle: boolean;
  cpiFactor?: number;
  pensionExclusion?: number;
  ordinaryIncome?: number;
  capitalGains?: number;
  retirementDistributions?: number;
  yourAge?: number;
  wifeAge?: number;
  youDeceased?: boolean;
  wifeDeceased?: boolean;
}

export interface StateTaxResult {
  stateTax: number;
  localTax: number;
  totalTax: number;
}

export interface StateTaxProfile {
  code: string;
  name: string;
  hasIncomeTax: boolean;
  hasLocalTax: boolean;
  topRate: number;
  effectiveTaxRateEstimate: number;
  subJurisdictionLabel?: string;
  subJurisdictions: SubJurisdiction[];
  calculateTax: (params: StateTaxCalculationParams, effectiveLocalRate?: number) => StateTaxResult;
  getDefaultLocalRate: (countyId?: string | null) => number;
}

export interface TaxBracketTier {
  rate: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Sub-jurisdiction definitions
// ---------------------------------------------------------------------------

// 24 Maryland local jurisdictions (23 counties + Baltimore City)
export const MD_COUNTIES: SubJurisdiction[] = [
  { id: 'allegany', name: 'Allegany County', defaultLocalRate: 0.0305 },
  { id: 'anne_arundel', name: 'Anne Arundel County', defaultLocalRate: 0.0270 },
  { id: 'baltimore_city', name: 'Baltimore City', defaultLocalRate: 0.0320 },
  { id: 'baltimore_county', name: 'Baltimore County', defaultLocalRate: 0.0320 },
  { id: 'calvert', name: 'Calvert County', defaultLocalRate: 0.0300 },
  { id: 'caroline', name: 'Caroline County', defaultLocalRate: 0.0320 },
  { id: 'carroll', name: 'Carroll County', defaultLocalRate: 0.0303 },
  { id: 'cecil', name: 'Cecil County', defaultLocalRate: 0.0280 },
  { id: 'charles', name: 'Charles County', defaultLocalRate: 0.0303 },
  { id: 'dorchester', name: 'Dorchester County', defaultLocalRate: 0.0320 },
  { id: 'frederick', name: 'Frederick County', defaultLocalRate: 0.0296 },
  { id: 'garrett', name: 'Garrett County', defaultLocalRate: 0.0265 },
  { id: 'harford', name: 'Harford County', defaultLocalRate: 0.0306 },
  { id: 'howard', name: 'Howard County', defaultLocalRate: 0.0320 },
  { id: 'kent', name: 'Kent County', defaultLocalRate: 0.0320 },
  { id: 'montgomery', name: 'Montgomery County', defaultLocalRate: 0.0320 },
  { id: 'prince_georges', name: "Prince George's County", defaultLocalRate: 0.0320 },
  { id: 'queen_annes', name: "Queen Anne's County", defaultLocalRate: 0.0320 },
  { id: 'st_marys', name: "St. Mary's County", defaultLocalRate: 0.0300 },
  { id: 'somerset', name: 'Somerset County', defaultLocalRate: 0.0320 },
  { id: 'talbot', name: 'Talbot County', defaultLocalRate: 0.0240 },
  { id: 'washington', name: 'Washington County', defaultLocalRate: 0.0295 },
  { id: 'wicomico', name: 'Wicomico County', defaultLocalRate: 0.0320 },
  { id: 'worcester', name: 'Worcester County', defaultLocalRate: 0.0225 },
];

// Representative Indiana Counties (all 92 levy Adopted Local Income Tax)
export const IN_COUNTIES: SubJurisdiction[] = [
  { id: 'marion', name: 'Marion County (Indianapolis)', defaultLocalRate: 0.0202 },
  { id: 'hamilton', name: 'Hamilton County (Carmel/Fishers)', defaultLocalRate: 0.0110 },
  { id: 'allen', name: 'Allen County (Fort Wayne)', defaultLocalRate: 0.0148 },
  { id: 'lake', name: 'Lake County (Crown Point)', defaultLocalRate: 0.0150 },
  { id: 'st_joseph', name: 'St. Joseph County (South Bend)', defaultLocalRate: 0.0175 },
  { id: 'elkhart', name: 'Elkhart County', defaultLocalRate: 0.0200 },
  { id: 'tippecanoe', name: 'Tippecanoe County (Lafayette)', defaultLocalRate: 0.0156 },
  { id: 'vanderburgh', name: 'Vanderburgh County (Evansville)', defaultLocalRate: 0.0125 },
  { id: 'porter', name: 'Porter County (Valparaiso)', defaultLocalRate: 0.0050 },
  { id: 'hendricks', name: 'Hendricks County', defaultLocalRate: 0.0170 },
  { id: 'johnson', name: 'Johnson County', defaultLocalRate: 0.0140 },
  { id: 'monroe', name: 'Monroe County (Bloomington)', defaultLocalRate: 0.0203 },
];

// New York Local Jurisdictions (NYC and Yonkers)
export const NY_MUNICIPALITIES: SubJurisdiction[] = [
  { id: 'none', name: 'Outside NYC / Yonkers (0.00%)', defaultLocalRate: 0.0000 },
  { id: 'nyc', name: 'New York City (NYC Resident Tax)', defaultLocalRate: 0.03876 },
  { id: 'yonkers', name: 'Yonkers (Resident Income Surcharge)', defaultLocalRate: 0.0110 },
];

// ---------------------------------------------------------------------------
// Profile Builder Helpers
// ---------------------------------------------------------------------------

interface ProfileOptions {
  stdDeductionSingle?: number | 'federal' | ((fedAGI: number, cpi: number) => number);
  stdDeductionMFJ?: number | 'federal' | ((fedAGI: number, cpi: number) => number);
  personalExemptionSingle?: number;
  personalExemptionMFJ?: number;
  taxSocialSecurity?: boolean; // Default false (100% exempt from state income tax)
  exemptAllRetirement?: boolean; // E.g. PA, IL, IA, MS 100% exempt retirement distributions
  retirementExclusionPerPerson?: number; // E.g. NY $20k, GA $65k, DE $12.5k, SC $15k, CO $24k
  subJurisdictionLabel?: string;
  subJurisdictions?: SubJurisdiction[];
  defaultLocalRate?: number;
}

function resolveDeduction(
  spec: number | 'federal' | ((fedAGI: number, cpi: number) => number) | undefined,
  isSingle: boolean,
  fedAGI: number,
  cpiFactor: number
): number {
  if (spec === undefined) return 0;
  if (spec === 'federal') {
    return (isSingle ? 15000 : 30000) * cpiFactor;
  }
  if (typeof spec === 'function') {
    return spec(fedAGI, cpiFactor);
  }
  return spec * cpiFactor;
}

function computeStateTaxableIncome(
  params: StateTaxCalculationParams,
  options: ProfileOptions
): number {
  const {
    fedAGI,
    taxableSS,
    isSingle,
    cpiFactor = 1,
    pensionExclusion = 0,
    retirementDistributions = 0,
  } = params;

  // 1. Social Security exemption
  const ssExclusion = options.taxSocialSecurity ? 0 : taxableSS;

  // 2. Standard Deduction
  const stdDeductionSpec = isSingle ? options.stdDeductionSingle : options.stdDeductionMFJ;
  const stdDeduction = resolveDeduction(stdDeductionSpec, isSingle, fedAGI, cpiFactor);

  // 3. Personal Exemption
  const personalExSpec = isSingle ? options.personalExemptionSingle : options.personalExemptionMFJ;
  const personalExemption = (personalExSpec ?? 0) * cpiFactor;

  // 4. Retirement distribution exclusions (pensions, IRAs, 401ks, conversions)
  let retirementExclusion = 0;
  if (options.exemptAllRetirement) {
    retirementExclusion = retirementDistributions;
  } else if (options.retirementExclusionPerPerson) {
    const numRetirees = isSingle ? 1 : 2;
    const maxRetirementExclusion = options.retirementExclusionPerPerson * numRetirees * cpiFactor;
    retirementExclusion = Math.min(retirementDistributions, maxRetirementExclusion);
  }

  // Combine exclusions
  const totalSubtractions = ssExclusion + stdDeduction + personalExemption + retirementExclusion + pensionExclusion;
  return Math.max(0, fedAGI - totalSubtractions);
}

function createZeroTaxProfile(code: string, name: string): StateTaxProfile {
  return {
    code,
    name,
    hasIncomeTax: false,
    hasLocalTax: false,
    topRate: 0,
    effectiveTaxRateEstimate: 0,
    subJurisdictions: [],
    getDefaultLocalRate(): number {
      return 0;
    },
    calculateTax(params: StateTaxCalculationParams, effectiveLocalRate?: number): StateTaxResult {
      const localRate = effectiveLocalRate ?? 0;
      const localTax = Math.max(0, params.fedAGI) * localRate;
      return { stateTax: 0, localTax, totalTax: localTax };
    },
  };
}

function createFlatTaxProfile(
  code: string,
  name: string,
  flatRate: number,
  options: ProfileOptions = {}
): StateTaxProfile {
  return {
    code,
    name,
    hasIncomeTax: true,
    hasLocalTax: (options.subJurisdictions && options.subJurisdictions.length > 0) || false,
    topRate: flatRate,
    effectiveTaxRateEstimate: flatRate * 0.85,
    subJurisdictionLabel: options.subJurisdictionLabel,
    subJurisdictions: options.subJurisdictions || [],
    getDefaultLocalRate(countyId?: string | null): number {
      if (options.subJurisdictions && countyId) {
        const found = options.subJurisdictions.find((c) => c.id === countyId);
        if (found) return found.defaultLocalRate;
      }
      return options.defaultLocalRate ?? 0;
    },
    calculateTax(params: StateTaxCalculationParams, effectiveLocalRate?: number): StateTaxResult {
      const taxableIncome = computeStateTaxableIncome(params, options);
      const stateTax = taxableIncome * flatRate;
      const localRate = effectiveLocalRate !== undefined ? effectiveLocalRate : (options.defaultLocalRate ?? 0);
      const localTax = taxableIncome * localRate;
      return {
        stateTax,
        localTax,
        totalTax: stateTax + localTax,
      };
    },
  };
}

function createGraduatedTaxProfile(
  code: string,
  name: string,
  tiersSingle: TaxBracketTier[],
  tiersMFJ: TaxBracketTier[],
  options: ProfileOptions = {}
): StateTaxProfile {
  const topRate = Math.max(...tiersSingle.map((t) => t.rate));
  return {
    code,
    name,
    hasIncomeTax: true,
    hasLocalTax: (options.subJurisdictions && options.subJurisdictions.length > 0) || false,
    topRate,
    effectiveTaxRateEstimate: topRate * 0.75,
    subJurisdictionLabel: options.subJurisdictionLabel,
    subJurisdictions: options.subJurisdictions || [],
    getDefaultLocalRate(countyId?: string | null): number {
      if (options.subJurisdictions && countyId) {
        const found = options.subJurisdictions.find((c) => c.id === countyId);
        if (found) return found.defaultLocalRate;
      }
      return options.defaultLocalRate ?? 0;
    },
    calculateTax(params: StateTaxCalculationParams, effectiveLocalRate?: number): StateTaxResult {
      const taxableIncome = computeStateTaxableIncome(params, options);
      if (taxableIncome <= 0) {
        return { stateTax: 0, localTax: 0, totalTax: 0 };
      }

      const tiers = params.isSingle ? tiersSingle : tiersMFJ;
      let stateTax = 0;
      let previousLimit = 0;

      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        if (taxableIncome > tier.limit) {
          stateTax += (tier.limit - previousLimit) * tier.rate;
          previousLimit = tier.limit;
        } else {
          stateTax += (taxableIncome - previousLimit) * tier.rate;
          break;
        }
      }

      const localRate = effectiveLocalRate !== undefined ? effectiveLocalRate : (options.defaultLocalRate ?? 0);
      const localTax = taxableIncome * localRate;

      return {
        stateTax,
        localTax,
        totalTax: stateTax + localTax,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Maryland Profile (Exact statutory calculation with sliding 15% deduction)
// ---------------------------------------------------------------------------
export const MARYLAND_PROFILE: StateTaxProfile = {
  code: 'MD',
  name: 'Maryland',
  hasIncomeTax: true,
  hasLocalTax: true,
  topRate: 0.0575,
  effectiveTaxRateEstimate: 0.0475,
  subJurisdictionLabel: 'County',
  subJurisdictions: MD_COUNTIES,
  getDefaultLocalRate(countyId?: string | null): number {
    if (!countyId) return MD_PIGGYBACK_RATE;
    const match = MD_COUNTIES.find((c) => c.id === countyId);
    return match ? match.defaultLocalRate : MD_PIGGYBACK_RATE;
  },
  calculateTax(params: StateTaxCalculationParams, effectiveLocalRate?: number): StateTaxResult {
    const { fedAGI, taxableSS, isSingle, cpiFactor = 1, pensionExclusion = 0 } = params;

    const stdDeductionRate = 0.15 * fedAGI;
    let stdDeduction = 0;
    if (isSingle) {
      stdDeduction = Math.min(Math.max(stdDeductionRate, 1700 * cpiFactor), 2550 * cpiFactor);
    } else {
      stdDeduction = Math.min(Math.max(stdDeductionRate, 3450 * cpiFactor), 5150 * cpiFactor);
    }

    const mdTaxableIncome = fedAGI - stdDeduction - taxableSS - pensionExclusion;
    if (mdTaxableIncome <= 0) {
      return { stateTax: 0, localTax: 0, totalTax: 0 };
    }

    const tiers = isSingle ? MD_GRADUATED_TIERS_SINGLE : MD_GRADUATED_TIERS_MFJ;
    let stateTax = 0;
    let previousLimit = 0;

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (mdTaxableIncome > tier.limit) {
        stateTax += (tier.limit - previousLimit) * tier.rate;
        previousLimit = tier.limit;
      } else {
        stateTax += (mdTaxableIncome - previousLimit) * tier.rate;
        break;
      }
    }

    const localRate = effectiveLocalRate !== undefined ? effectiveLocalRate : MD_PIGGYBACK_RATE;
    const localTax = mdTaxableIncome * localRate;

    return {
      stateTax,
      localTax,
      totalTax: stateTax + localTax,
    };
  },
};

// ---------------------------------------------------------------------------
// All 50 States + DC Registry
// ---------------------------------------------------------------------------

export const STATE_TAX_REGISTRY: Record<string, StateTaxProfile> = {
  // AK - Alaska (No income tax)
  AK: createZeroTaxProfile('AK', 'Alaska'),

  // AL - Alabama (Graduated: 2%, 4%, 5%)
  AL: createGraduatedTaxProfile(
    'AL',
    'Alabama',
    [
      { rate: 0.02, limit: 500 },
      { rate: 0.04, limit: 3000 },
      { rate: 0.05, limit: Infinity },
    ],
    [
      { rate: 0.02, limit: 1000 },
      { rate: 0.04, limit: 6000 },
      { rate: 0.05, limit: Infinity },
    ],
    { stdDeductionSingle: 3000, stdDeductionMFJ: 8500 }
  ),

  // AR - Arkansas (Graduated: 2% to 4.4%)
  AR: createGraduatedTaxProfile(
    'AR',
    'Arkansas',
    [
      { rate: 0.02, limit: 4400 },
      { rate: 0.04, limit: 8900 },
      { rate: 0.044, limit: Infinity },
    ],
    [
      { rate: 0.02, limit: 8800 },
      { rate: 0.04, limit: 17800 },
      { rate: 0.044, limit: Infinity },
    ],
    { stdDeductionSingle: 2340, stdDeductionMFJ: 4680, retirementExclusionPerPerson: 6000 }
  ),

  // AZ - Arizona (Flat 2.50%)
  AZ: createFlatTaxProfile('AZ', 'Arizona', 0.025, {
    stdDeductionSingle: 'federal',
    stdDeductionMFJ: 'federal',
  }),

  // CA - California (Graduated: 1.0% to 13.3%)
  CA: createGraduatedTaxProfile(
    'CA',
    'California',
    [
      { rate: 0.01, limit: 10412 },
      { rate: 0.02, limit: 24684 },
      { rate: 0.04, limit: 38959 },
      { rate: 0.06, limit: 54081 },
      { rate: 0.08, limit: 68350 },
      { rate: 0.093, limit: 349137 },
      { rate: 0.103, limit: 418961 },
      { rate: 0.113, limit: 698271 },
      { rate: 0.123, limit: 1000000 },
      { rate: 0.133, limit: Infinity }, // 1% mental health surcharge over $1M
    ],
    [
      { rate: 0.01, limit: 20824 },
      { rate: 0.02, limit: 49368 },
      { rate: 0.04, limit: 77918 },
      { rate: 0.06, limit: 108162 },
      { rate: 0.08, limit: 136700 },
      { rate: 0.093, limit: 698274 },
      { rate: 0.103, limit: 837922 },
      { rate: 0.113, limit: 1000000 },
      { rate: 0.123, limit: 1396542 },
      { rate: 0.133, limit: Infinity },
    ],
    { stdDeductionSingle: 5540, stdDeductionMFJ: 11080 }
  ),

  // CO - Colorado (Flat 4.40%, allows $24k retirement exclusion for 65+)
  CO: createFlatTaxProfile('CO', 'Colorado', 0.044, {
    stdDeductionSingle: 'federal',
    stdDeductionMFJ: 'federal',
    retirementExclusionPerPerson: 24000,
    taxSocialSecurity: true, // Social Security taxed subject to $24k exclusion
  }),

  // CT - Connecticut (Graduated: 2.0% to 6.99%)
  CT: createGraduatedTaxProfile(
    'CT',
    'Connecticut',
    [
      { rate: 0.02, limit: 10000 },
      { rate: 0.045, limit: 50000 },
      { rate: 0.055, limit: 100000 },
      { rate: 0.06, limit: 200000 },
      { rate: 0.065, limit: 250000 },
      { rate: 0.069, limit: 500000 },
      { rate: 0.0699, limit: Infinity },
    ],
    [
      { rate: 0.02, limit: 20000 },
      { rate: 0.045, limit: 100000 },
      { rate: 0.055, limit: 200000 },
      { rate: 0.06, limit: 400000 },
      { rate: 0.065, limit: 500000 },
      { rate: 0.069, limit: 1000000 },
      { rate: 0.0699, limit: Infinity },
    ],
    { stdDeductionSingle: 15000, stdDeductionMFJ: 24000 }
  ),

  // DC - District of Columbia (Graduated: 4.0% to 10.75%)
  DC: createGraduatedTaxProfile(
    'DC',
    'District of Columbia',
    [
      { rate: 0.04, limit: 10000 },
      { rate: 0.06, limit: 40000 },
      { rate: 0.065, limit: 60000 },
      { rate: 0.085, limit: 250000 },
      { rate: 0.0925, limit: 500000 },
      { rate: 0.0975, limit: 1000000 },
      { rate: 0.1075, limit: Infinity },
    ],
    [
      { rate: 0.04, limit: 10000 },
      { rate: 0.06, limit: 40000 },
      { rate: 0.065, limit: 60000 },
      { rate: 0.085, limit: 250000 },
      { rate: 0.0925, limit: 500000 },
      { rate: 0.0975, limit: 1000000 },
      { rate: 0.1075, limit: Infinity },
    ],
    { stdDeductionSingle: 'federal', stdDeductionMFJ: 'federal' }
  ),

  // DE - Delaware (Graduated: 2.2% to 6.6%, $12.5k pension exclusion for 60+)
  DE: createGraduatedTaxProfile(
    'DE',
    'Delaware',
    [
      { rate: 0.022, limit: 5000 },
      { rate: 0.039, limit: 10000 },
      { rate: 0.048, limit: 20000 },
      { rate: 0.052, limit: 25000 },
      { rate: 0.0555, limit: 60000 },
      { rate: 0.066, limit: Infinity },
    ],
    [
      { rate: 0.022, limit: 5000 },
      { rate: 0.039, limit: 10000 },
      { rate: 0.048, limit: 20000 },
      { rate: 0.052, limit: 25000 },
      { rate: 0.0555, limit: 60000 },
      { rate: 0.066, limit: Infinity },
    ],
    { stdDeductionSingle: 3250, stdDeductionMFJ: 6500, retirementExclusionPerPerson: 12500 }
  ),

  // FL - Florida (No income tax)
  FL: createZeroTaxProfile('FL', 'Florida'),

  // GA - Georgia (Flat 5.39%, $65k exclusion for 65+)
  GA: createFlatTaxProfile('GA', 'Georgia', 0.0539, {
    stdDeductionSingle: 12000,
    stdDeductionMFJ: 24000,
    retirementExclusionPerPerson: 65000,
  }),

  // HI - Hawaii (Graduated: 1.4% to 11.0%)
  HI: createGraduatedTaxProfile(
    'HI',
    'Hawaii',
    [
      { rate: 0.014, limit: 2400 },
      { rate: 0.032, limit: 4800 },
      { rate: 0.055, limit: 9600 },
      { rate: 0.064, limit: 14400 },
      { rate: 0.068, limit: 19200 },
      { rate: 0.072, limit: 24000 },
      { rate: 0.076, limit: 36000 },
      { rate: 0.079, limit: 48000 },
      { rate: 0.0825, limit: 150000 },
      { rate: 0.09, limit: 175000 },
      { rate: 0.10, limit: 200000 },
      { rate: 0.11, limit: Infinity },
    ],
    [
      { rate: 0.014, limit: 4800 },
      { rate: 0.032, limit: 9600 },
      { rate: 0.055, limit: 19200 },
      { rate: 0.064, limit: 28800 },
      { rate: 0.068, limit: 38400 },
      { rate: 0.072, limit: 48000 },
      { rate: 0.076, limit: 72000 },
      { rate: 0.079, limit: 96000 },
      { rate: 0.0825, limit: 300000 },
      { rate: 0.09, limit: 350000 },
      { rate: 0.10, limit: 400000 },
      { rate: 0.11, limit: Infinity },
    ],
    { stdDeductionSingle: 2200, stdDeductionMFJ: 4400 }
  ),

  // IA - Iowa (Flat 3.80%, 100% exempts retirement income age 55+)
  IA: createFlatTaxProfile('IA', 'Iowa', 0.038, {
    exemptAllRetirement: true,
  }),

  // ID - Idaho (Flat 5.695%)
  ID: createFlatTaxProfile('ID', 'Idaho', 0.05695, {
    stdDeductionSingle: 'federal',
    stdDeductionMFJ: 'federal',
  }),

  // IL - Illinois (Flat 4.95%, 100% EXEMPTS all qualified retirement income & Social Security)
  IL: createFlatTaxProfile('IL', 'Illinois', 0.0495, {
    personalExemptionSingle: 2775,
    personalExemptionMFJ: 5550,
    exemptAllRetirement: true,
  }),

  // IN - Indiana (Flat 3.05% + County Taxes)
  IN: createFlatTaxProfile('IN', 'Indiana', 0.0305, {
    personalExemptionSingle: 1000,
    personalExemptionMFJ: 2000,
    subJurisdictionLabel: 'County',
    subJurisdictions: IN_COUNTIES,
    defaultLocalRate: 0.0175,
  }),

  // KS - Kansas (Graduated up to 5.20%, Social Security 100% exempt)
  KS: createGraduatedTaxProfile(
    'KS',
    'Kansas',
    [
      { rate: 0.031, limit: 15000 },
      { rate: 0.052, limit: Infinity },
    ],
    [
      { rate: 0.031, limit: 30000 },
      { rate: 0.052, limit: Infinity },
    ],
    { stdDeductionSingle: 3500, stdDeductionMFJ: 8000 }
  ),

  // KY - Kentucky (Flat 4.00%, $31,110 pension exclusion)
  KY: createFlatTaxProfile('KY', 'Kentucky', 0.040, {
    stdDeductionSingle: 3160,
    stdDeductionMFJ: 6320,
    retirementExclusionPerPerson: 31110,
  }),

  // LA - Louisiana (Graduated: 1.85% to 4.25%)
  LA: createGraduatedTaxProfile(
    'LA',
    'Louisiana',
    [
      { rate: 0.0185, limit: 12500 },
      { rate: 0.035, limit: 50000 },
      { rate: 0.0425, limit: Infinity },
    ],
    [
      { rate: 0.0185, limit: 25000 },
      { rate: 0.035, limit: 100000 },
      { rate: 0.0425, limit: Infinity },
    ],
    { stdDeductionSingle: 4500, stdDeductionMFJ: 9000 }
  ),

  // MA - Massachusetts (Flat 5.00% + 4% surtax over $1M)
  MA: createGraduatedTaxProfile(
    'MA',
    'Massachusetts',
    [
      { rate: 0.05, limit: 1000000 },
      { rate: 0.09, limit: Infinity },
    ],
    [
      { rate: 0.05, limit: 1000000 },
      { rate: 0.09, limit: Infinity },
    ],
    { stdDeductionSingle: 4400, stdDeductionMFJ: 8800 }
  ),

  // MD - Maryland (Official statutory profile)
  MD: MARYLAND_PROFILE,

  // ME - Maine (Graduated: 5.8% to 7.15%, up to $35k pension exclusion)
  ME: createGraduatedTaxProfile(
    'ME',
    'Maine',
    [
      { rate: 0.058, limit: 26050 },
      { rate: 0.0675, limit: 61600 },
      { rate: 0.0715, limit: Infinity },
    ],
    [
      { rate: 0.058, limit: 52100 },
      { rate: 0.0675, limit: 123250 },
      { rate: 0.0715, limit: Infinity },
    ],
    { stdDeductionSingle: 'federal', stdDeductionMFJ: 'federal', retirementExclusionPerPerson: 35000 }
  ),

  // MI - Michigan (Flat 4.25%)
  MI: createFlatTaxProfile('MI', 'Michigan', 0.0425, {
    personalExemptionSingle: 5600,
    personalExemptionMFJ: 11200,
  }),

  // MN - Minnesota (Graduated: 5.35% to 9.85%)
  MN: createGraduatedTaxProfile(
    'MN',
    'Minnesota',
    [
      { rate: 0.0535, limit: 31690 },
      { rate: 0.068, limit: 104090 },
      { rate: 0.0785, limit: 193240 },
      { rate: 0.0985, limit: Infinity },
    ],
    [
      { rate: 0.0535, limit: 46330 },
      { rate: 0.068, limit: 184080 },
      { rate: 0.0785, limit: 321450 },
      { rate: 0.0985, limit: Infinity },
    ],
    { stdDeductionSingle: 'federal', stdDeductionMFJ: 'federal' }
  ),

  // MO - Missouri (Graduated top rate 4.80%, Social Security 100% exempt)
  MO: createGraduatedTaxProfile(
    'MO',
    'Missouri',
    [
      { rate: 0.02, limit: 1207 },
      { rate: 0.025, limit: 2414 },
      { rate: 0.03, limit: 3621 },
      { rate: 0.035, limit: 4828 },
      { rate: 0.04, limit: 6035 },
      { rate: 0.045, limit: 7242 },
      { rate: 0.048, limit: Infinity },
    ],
    [
      { rate: 0.02, limit: 2414 },
      { rate: 0.025, limit: 4828 },
      { rate: 0.03, limit: 7242 },
      { rate: 0.035, limit: 9656 },
      { rate: 0.04, limit: 12070 },
      { rate: 0.045, limit: 14484 },
      { rate: 0.048, limit: Infinity },
    ],
    { stdDeductionSingle: 'federal', stdDeductionMFJ: 'federal' }
  ),

  // MS - Mississippi (Flat 4.70%, 100% EXEMPTS all qualified retirement & Social Security)
  MS: createFlatTaxProfile('MS', 'Mississippi', 0.047, {
    stdDeductionSingle: 2300,
    stdDeductionMFJ: 4600,
    exemptAllRetirement: true,
  }),

  // MT - Montana (Graduated: 4.7% and 5.9%)
  MT: createGraduatedTaxProfile(
    'MT',
    'Montana',
    [
      { rate: 0.047, limit: 20500 },
      { rate: 0.059, limit: Infinity },
    ],
    [
      { rate: 0.047, limit: 41000 },
      { rate: 0.059, limit: Infinity },
    ],
    { stdDeductionSingle: 'federal', stdDeductionMFJ: 'federal' }
  ),

  // NC - North Carolina (Flat 4.50%)
  NC: createFlatTaxProfile('NC', 'North Carolina', 0.045, {
    stdDeductionSingle: 12750,
    stdDeductionMFJ: 25500,
  }),

  // ND - North Dakota (Graduated: 0% up to $44k, then 1.95% to 2.5%)
  ND: createGraduatedTaxProfile(
    'ND',
    'North Dakota',
    [
      { rate: 0.00, limit: 44725 },
      { rate: 0.0195, limit: 225975 },
      { rate: 0.025, limit: Infinity },
    ],
    [
      { rate: 0.00, limit: 74750 },
      { rate: 0.0195, limit: 225975 },
      { rate: 0.025, limit: Infinity },
    ],
    { stdDeductionSingle: 'federal', stdDeductionMFJ: 'federal' }
  ),

  // NE - Nebraska (Graduated: 2.46% to 5.84%, Social Security 100% exempt)
  NE: createGraduatedTaxProfile(
    'NE',
    'Nebraska',
    [
      { rate: 0.0246, limit: 3700 },
      { rate: 0.0351, limit: 22170 },
      { rate: 0.0501, limit: 35730 },
      { rate: 0.0584, limit: Infinity },
    ],
    [
      { rate: 0.0246, limit: 7390 },
      { rate: 0.0351, limit: 44350 },
      { rate: 0.0501, limit: 71460 },
      { rate: 0.0584, limit: Infinity },
    ],
    { stdDeductionSingle: 'federal', stdDeductionMFJ: 'federal' }
  ),

  // NH - New Hampshire (No wage or retirement income tax)
  NH: createZeroTaxProfile('NH', 'New Hampshire'),

  // NJ - New Jersey (Graduated: 1.4% to 10.75%, up to $100k pension exclusion for MFJ under $100k)
  NJ: createGraduatedTaxProfile(
    'NJ',
    'New Jersey',
    [
      { rate: 0.014, limit: 20000 },
      { rate: 0.0175, limit: 35000 },
      { rate: 0.035, limit: 40000 },
      { rate: 0.05525, limit: 75000 },
      { rate: 0.0637, limit: 500000 },
      { rate: 0.0897, limit: 1000000 },
      { rate: 0.1075, limit: Infinity },
    ],
    [
      { rate: 0.014, limit: 20000 },
      { rate: 0.0175, limit: 50000 },
      { rate: 0.0245, limit: 70000 },
      { rate: 0.035, limit: 80000 },
      { rate: 0.05525, limit: 150000 },
      { rate: 0.0637, limit: 500000 },
      { rate: 0.0897, limit: 1000000 },
      { rate: 0.1075, limit: Infinity },
    ],
    { stdDeductionSingle: 1000, stdDeductionMFJ: 2000, retirementExclusionPerPerson: 50000 }
  ),

  // NM - New Mexico (Graduated: 1.7% to 5.9%)
  NM: createGraduatedTaxProfile(
    'NM',
    'New Mexico',
    [
      { rate: 0.017, limit: 5500 },
      { rate: 0.032, limit: 11000 },
      { rate: 0.047, limit: 16000 },
      { rate: 0.049, limit: 210000 },
      { rate: 0.059, limit: Infinity },
    ],
    [
      { rate: 0.017, limit: 8000 },
      { rate: 0.032, limit: 16000 },
      { rate: 0.047, limit: 24000 },
      { rate: 0.049, limit: 315000 },
      { rate: 0.059, limit: Infinity },
    ],
    { stdDeductionSingle: 'federal', stdDeductionMFJ: 'federal' }
  ),

  // NV - Nevada (No income tax)
  NV: createZeroTaxProfile('NV', 'Nevada'),

  // NY - New York (Graduated: 4.0% to 10.9%, up to $20k pension exclusion per person age 59.5+)
  NY: createGraduatedTaxProfile(
    'NY',
    'New York',
    [
      { rate: 0.04, limit: 8500 },
      { rate: 0.045, limit: 11700 },
      { rate: 0.0525, limit: 13900 },
      { rate: 0.0585, limit: 80650 },
      { rate: 0.0625, limit: 215400 },
      { rate: 0.0685, limit: 1077550 },
      { rate: 0.0965, limit: 5000000 },
      { rate: 0.103, limit: 25000000 },
      { rate: 0.109, limit: Infinity },
    ],
    [
      { rate: 0.04, limit: 17150 },
      { rate: 0.045, limit: 23600 },
      { rate: 0.0525, limit: 27900 },
      { rate: 0.0585, limit: 161550 },
      { rate: 0.0625, limit: 323200 },
      { rate: 0.0685, limit: 2155350 },
      { rate: 0.0965, limit: 5000000 },
      { rate: 0.103, limit: 25000000 },
      { rate: 0.109, limit: Infinity },
    ],
    {
      stdDeductionSingle: 8000,
      stdDeductionMFJ: 16050,
      retirementExclusionPerPerson: 20000,
      subJurisdictionLabel: 'City/Locality',
      subJurisdictions: NY_MUNICIPALITIES,
      defaultLocalRate: 0.00,
    }
  ),

  // OH - Ohio (Graduated up to 3.50%, first $26k exempt)
  OH: createGraduatedTaxProfile(
    'OH',
    'Ohio',
    [
      { rate: 0.00, limit: 26050 },
      { rate: 0.0275, limit: 100000 },
      { rate: 0.035, limit: Infinity },
    ],
    [
      { rate: 0.00, limit: 26050 },
      { rate: 0.0275, limit: 100000 },
      { rate: 0.035, limit: Infinity },
    ]
  ),

  // OK - Oklahoma (Graduated: 0.25% to 4.75%, $10k retirement exclusion)
  OK: createGraduatedTaxProfile(
    'OK',
    'Oklahoma',
    [
      { rate: 0.0025, limit: 1000 },
      { rate: 0.0075, limit: 2500 },
      { rate: 0.0175, limit: 3750 },
      { rate: 0.0275, limit: 4900 },
      { rate: 0.0375, limit: 7200 },
      { rate: 0.0475, limit: Infinity },
    ],
    [
      { rate: 0.0025, limit: 2000 },
      { rate: 0.0075, limit: 5000 },
      { rate: 0.0175, limit: 7500 },
      { rate: 0.0275, limit: 9800 },
      { rate: 0.0375, limit: 12200 },
      { rate: 0.0475, limit: Infinity },
    ],
    { stdDeductionSingle: 6350, stdDeductionMFJ: 12700, retirementExclusionPerPerson: 10000 }
  ),

  // OR - Oregon (Graduated: 4.75% to 9.90%)
  OR: createGraduatedTaxProfile(
    'OR',
    'Oregon',
    [
      { rate: 0.0475, limit: 4050 },
      { rate: 0.0675, limit: 10200 },
      { rate: 0.0875, limit: 125000 },
      { rate: 0.099, limit: Infinity },
    ],
    [
      { rate: 0.0475, limit: 8100 },
      { rate: 0.0675, limit: 20400 },
      { rate: 0.0875, limit: 250000 },
      { rate: 0.099, limit: Infinity },
    ],
    { stdDeductionSingle: 2745, stdDeductionMFJ: 5490 }
  ),

  // PA - Pennsylvania (Flat 3.07%, 100% EXEMPTS all qualified retirement distributions & Social Security)
  PA: createFlatTaxProfile('PA', 'Pennsylvania', 0.0307, {
    exemptAllRetirement: true,
  }),

  // RI - Rhode Island (Graduated: 3.75% to 5.99%)
  RI: createGraduatedTaxProfile(
    'RI',
    'Rhode Island',
    [
      { rate: 0.0375, limit: 77450 },
      { rate: 0.0475, limit: 176050 },
      { rate: 0.0599, limit: Infinity },
    ],
    [
      { rate: 0.0375, limit: 77450 },
      { rate: 0.0475, limit: 176050 },
      { rate: 0.0599, limit: Infinity },
    ],
    { stdDeductionSingle: 'federal', stdDeductionMFJ: 'federal' }
  ),

  // SC - South Carolina (Graduated up to 6.40%, $15k retirement exclusion age 65+)
  SC: createGraduatedTaxProfile(
    'SC',
    'South Carolina',
    [
      { rate: 0.00, limit: 3460 },
      { rate: 0.03, limit: 17330 },
      { rate: 0.064, limit: Infinity },
    ],
    [
      { rate: 0.00, limit: 3460 },
      { rate: 0.03, limit: 17330 },
      { rate: 0.064, limit: Infinity },
    ],
    { stdDeductionSingle: 'federal', stdDeductionMFJ: 'federal', retirementExclusionPerPerson: 15000 }
  ),

  // SD - South Dakota (No income tax)
  SD: createZeroTaxProfile('SD', 'South Dakota'),

  // TN - Tennessee (No income tax)
  TN: createZeroTaxProfile('TN', 'Tennessee'),

  // TX - Texas (No income tax)
  TX: createZeroTaxProfile('TX', 'Texas'),

  // UT - Utah (Flat 4.65%)
  UT: createFlatTaxProfile('UT', 'Utah', 0.0465, {
    stdDeductionSingle: 15000,
    stdDeductionMFJ: 30000,
  }),

  // VA - Virginia (Graduated: 2.0% to 5.75%, age 65+ deduction up to $12k)
  VA: createGraduatedTaxProfile(
    'VA',
    'Virginia',
    [
      { rate: 0.02, limit: 3000 },
      { rate: 0.03, limit: 5000 },
      { rate: 0.05, limit: 17000 },
      { rate: 0.0575, limit: Infinity },
    ],
    [
      { rate: 0.02, limit: 3000 },
      { rate: 0.03, limit: 5000 },
      { rate: 0.05, limit: 17000 },
      { rate: 0.0575, limit: Infinity },
    ],
    { stdDeductionSingle: 8500, stdDeductionMFJ: 17000, retirementExclusionPerPerson: 12000 }
  ),

  // VT - Vermont (Graduated: 3.35% to 8.75%)
  VT: createGraduatedTaxProfile(
    'VT',
    'Vermont',
    [
      { rate: 0.0335, limit: 45400 },
      { rate: 0.066, limit: 110050 },
      { rate: 0.076, limit: 229550 },
      { rate: 0.0875, limit: Infinity },
    ],
    [
      { rate: 0.0335, limit: 75850 },
      { rate: 0.066, limit: 183350 },
      { rate: 0.076, limit: 279450 },
      { rate: 0.0875, limit: Infinity },
    ],
    { stdDeductionSingle: 'federal', stdDeductionMFJ: 'federal' }
  ),

  // WA - Washington (No personal wage/retirement income tax)
  WA: createZeroTaxProfile('WA', 'Washington'),

  // WI - Wisconsin (Graduated: 3.50% to 7.65%)
  WI: createGraduatedTaxProfile(
    'WI',
    'Wisconsin',
    [
      { rate: 0.035, limit: 14320 },
      { rate: 0.044, limit: 28640 },
      { rate: 0.053, limit: 315310 },
      { rate: 0.0765, limit: Infinity },
    ],
    [
      { rate: 0.035, limit: 19090 },
      { rate: 0.044, limit: 38190 },
      { rate: 0.053, limit: 420420 },
      { rate: 0.0765, limit: Infinity },
    ],
    { stdDeductionSingle: 13810, stdDeductionMFJ: 25580, retirementExclusionPerPerson: 5000 }
  ),

  // WV - West Virginia (Graduated: 2.36% to 5.12%, Social Security 100% exempt)
  WV: createGraduatedTaxProfile(
    'WV',
    'West Virginia',
    [
      { rate: 0.0236, limit: 10000 },
      { rate: 0.0315, limit: 25000 },
      { rate: 0.0354, limit: 40000 },
      { rate: 0.0472, limit: 60000 },
      { rate: 0.0512, limit: Infinity },
    ],
    [
      { rate: 0.0236, limit: 10000 },
      { rate: 0.0315, limit: 25000 },
      { rate: 0.0354, limit: 40000 },
      { rate: 0.0472, limit: 60000 },
      { rate: 0.0512, limit: Infinity },
    ],
    { personalExemptionSingle: 2000, personalExemptionMFJ: 4000 }
  ),

  // WY - Wyoming (No income tax)
  WY: createZeroTaxProfile('WY', 'Wyoming'),
};

// ---------------------------------------------------------------------------
// Helper Accessor Functions
// ---------------------------------------------------------------------------

export function getSupportedStates(): Array<{ code: string; name: string }> {
  return Object.values(STATE_TAX_REGISTRY)
    .map((p) => ({ code: p.code, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getStateTaxProfile(stateCode: string): StateTaxProfile | undefined {
  if (!stateCode) return undefined;
  return STATE_TAX_REGISTRY[stateCode.trim().toUpperCase()];
}

export function getSubJurisdictions(stateCode: string): SubJurisdiction[] {
  const profile = getStateTaxProfile(stateCode);
  return profile ? profile.subJurisdictions : [];
}

export function getEffectiveLocalTaxRate(
  stateCode: string,
  countyId?: string | null,
  customRate?: number | null
): number {
  if (customRate !== undefined && customRate !== null && !isNaN(customRate)) {
    return customRate;
  }
  const profile = getStateTaxProfile(stateCode);
  if (!profile) return 0;
  return profile.getDefaultLocalRate(countyId);
}

export function calculateStateAndLocalTax(
  stateCode: string,
  params: StateTaxCalculationParams,
  effectiveLocalRate?: number
): StateTaxResult {
  const profile = getStateTaxProfile(stateCode);
  if (!profile) {
    const localRate = effectiveLocalRate ?? 0;
    const localTax = Math.max(0, params.fedAGI) * localRate;
    return { stateTax: 0, localTax, totalTax: localTax };
  }
  return profile.calculateTax(params, effectiveLocalRate);
}
