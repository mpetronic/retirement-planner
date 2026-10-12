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
  mdPensionExclusion?: number;
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
  subJurisdictionLabel?: string;
  subJurisdictions: SubJurisdiction[];
  calculateTax: (params: StateTaxCalculationParams, effectiveLocalRate?: number) => StateTaxResult;
  getDefaultLocalRate: (countyId?: string | null) => number;
}

// 24 Maryland local jurisdictions (23 counties + Baltimore City) with official 2026 piggyback tax rates
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

export const MARYLAND_PROFILE: StateTaxProfile = {
  code: 'MD',
  name: 'Maryland',
  hasIncomeTax: true,
  hasLocalTax: true,
  subJurisdictionLabel: 'County',
  subJurisdictions: MD_COUNTIES,
  getDefaultLocalRate(countyId?: string | null): number {
    if (!countyId) return MD_PIGGYBACK_RATE;
    const match = MD_COUNTIES.find((c) => c.id === countyId);
    return match ? match.defaultLocalRate : MD_PIGGYBACK_RATE;
  },
  calculateTax(params: StateTaxCalculationParams, effectiveLocalRate?: number): StateTaxResult {
    const { fedAGI, taxableSS, isSingle, cpiFactor = 1, mdPensionExclusion = 0 } = params;

    const stdDeductionRate = 0.15 * fedAGI;
    let stdDeduction = 0;
    if (isSingle) {
      stdDeduction = Math.min(Math.max(stdDeductionRate, 1700 * cpiFactor), 2550 * cpiFactor);
    } else {
      stdDeduction = Math.min(Math.max(stdDeductionRate, 3450 * cpiFactor), 5150 * cpiFactor);
    }

    const mdTaxableIncome = fedAGI - stdDeduction - taxableSS - mdPensionExclusion;
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

export const FLORIDA_PROFILE: StateTaxProfile = {
  code: 'FL',
  name: 'Florida',
  hasIncomeTax: false,
  hasLocalTax: false,
  subJurisdictions: [],
  getDefaultLocalRate(): number {
    return 0;
  },
  calculateTax(): StateTaxResult {
    return {
      stateTax: 0,
      localTax: 0,
      totalTax: 0,
    };
  },
};

export const STATE_TAX_REGISTRY: Record<string, StateTaxProfile> = {
  MD: MARYLAND_PROFILE,
  FL: FLORIDA_PROFILE,
};

export function getSupportedStates(): Array<{ code: string; name: string }> {
  return Object.values(STATE_TAX_REGISTRY).map((p) => ({
    code: p.code,
    name: p.name,
  }));
}

export function getStateTaxProfile(stateCode: string): StateTaxProfile | undefined {
  return STATE_TAX_REGISTRY[stateCode?.toUpperCase()];
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
  if (!profile || !profile.hasIncomeTax) {
    return { stateTax: 0, localTax: 0, totalTax: 0 };
  }
  return profile.calculateTax(params, effectiveLocalRate);
}
