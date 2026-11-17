// Maryland state tax module. All Maryland-specific values live here, keyed by tax year.
// Sources: Maryland Comptroller Tax Alert (revised 22-Dec-2025) on the 2025 Budget Reconciliation and
// Financing Act for the standard deduction, brackets and capital gains surtax. The personal exemption
// phase-out steps and the age 65 exemption follow the Comptroller's Form 502 exemption table.
//
// Maryland's pension exclusion is deliberately not modeled: it covers employer plans and annuities but
// not traditional IRA distributions, and this plan has no qualifying income.
import type {
  StateTaxCalculationParams,
  StateTaxProfile,
  StateTaxResult,
  SubJurisdiction,
} from '../stateTaxRegistry';
import {
  applyBrackets,
  phaseOutFraction,
  resolveYearRules,
  type PhaseOutStep,
  type TaxBracketTier,
} from './stateTaxPrimitives';

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

const MD_PIGGYBACK_RATE = 0.0320; // flat 3.20% local tax when no county is selected

interface MdFilingAmounts<T> {
  single: T;
  mfj: T;
}

interface MdYearRules {
  /** Flat standard deduction. Indexed to inflation through cpiFactor. */
  standardDeduction: MdFilingAmounts<number>;
  /** Exemption per filer, plus the additional amount per filer aged 65 or older. Not indexed. */
  personalExemption: number;
  agedAdditionalExemption: number;
  exemptionPhaseOut: MdFilingAmounts<PhaseOutStep[]>;
  brackets: MdFilingAmounts<TaxBracketTier[]>;
  /** Additional tax on net capital gains once federal AGI exceeds the threshold. */
  capitalGainsSurtax: { rate: number; fagiThreshold: number };
}

// Each entry applies from its year until the next entry.
const MD_YEAR_RULES: Record<number, MdYearRules> = {
  2025: {
    standardDeduction: { single: 3350, mfj: 6700 },
    personalExemption: 3200,
    agedAdditionalExemption: 1000,
    exemptionPhaseOut: {
      single: [
        { agiLimit: 100000, allowedFraction: 1 },
        { agiLimit: 125000, allowedFraction: 0.5 },
        { agiLimit: 150000, allowedFraction: 0.25 },
      ],
      mfj: [
        { agiLimit: 150000, allowedFraction: 1 },
        { agiLimit: 175000, allowedFraction: 0.5 },
        { agiLimit: 200000, allowedFraction: 0.25 },
      ],
    },
    brackets: {
      single: [
        { rate: 0.02, limit: 1000 },
        { rate: 0.03, limit: 2000 },
        { rate: 0.04, limit: 3000 },
        { rate: 0.0475, limit: 100000 },
        { rate: 0.05, limit: 125000 },
        { rate: 0.0525, limit: 150000 },
        { rate: 0.055, limit: 250000 },
        { rate: 0.0575, limit: 500000 },
        { rate: 0.0625, limit: 1000000 },
        { rate: 0.065, limit: Infinity },
      ],
      mfj: [
        { rate: 0.02, limit: 1000 },
        { rate: 0.03, limit: 2000 },
        { rate: 0.04, limit: 3000 },
        { rate: 0.0475, limit: 150000 },
        { rate: 0.05, limit: 175000 },
        { rate: 0.0525, limit: 225000 },
        { rate: 0.055, limit: 300000 },
        { rate: 0.0575, limit: 600000 },
        { rate: 0.0625, limit: 1200000 },
        { rate: 0.065, limit: Infinity },
      ],
    },
    capitalGainsSurtax: { rate: 0.02, fagiThreshold: 350000 },
  },
};

const MD_TOP_RATE = 0.065;

function computeMarylandTaxableIncome(params: StateTaxCalculationParams, rules: MdYearRules): number {
  const { fedAGI, taxableSS, isSingle, cpiFactor = 1, pensionExclusion = 0, agedFilerCount = 0 } = params;
  const standardDeduction = (isSingle ? rules.standardDeduction.single : rules.standardDeduction.mfj) * cpiFactor;
  const filerCount = isSingle ? 1 : 2;
  const exemptionFraction = phaseOutFraction(
    fedAGI,
    isSingle ? rules.exemptionPhaseOut.single : rules.exemptionPhaseOut.mfj
  );
  const exemptions =
    (filerCount * rules.personalExemption + agedFilerCount * rules.agedAdditionalExemption) * exemptionFraction;
  return Math.max(0, fedAGI - standardDeduction - exemptions - taxableSS - pensionExclusion);
}

export const MARYLAND_PROFILE: StateTaxProfile = {
  code: 'MD',
  name: 'Maryland',
  hasIncomeTax: true,
  hasLocalTax: true,
  topRate: MD_TOP_RATE,
  effectiveTaxRateEstimate: 0.0475,
  subJurisdictionLabel: 'County',
  subJurisdictions: MD_COUNTIES,
  getDefaultLocalRate(countyId?: string | null): number {
    if (!countyId) return MD_PIGGYBACK_RATE;
    const match = MD_COUNTIES.find((c) => c.id === countyId);
    return match ? match.defaultLocalRate : MD_PIGGYBACK_RATE;
  },
  calculateTax(params: StateTaxCalculationParams, effectiveLocalRate?: number): StateTaxResult {
    const rules = resolveYearRules(MD_YEAR_RULES, params.taxYear);
    const taxableIncome = computeMarylandTaxableIncome(params, rules);
    if (taxableIncome <= 0) {
      return { stateTax: 0, localTax: 0, totalTax: 0 };
    }

    const brackets = params.isSingle ? rules.brackets.single : rules.brackets.mfj;
    const { rate: surtaxRate, fagiThreshold } = rules.capitalGainsSurtax;
    const surtax = params.fedAGI > fagiThreshold ? Math.max(0, params.capitalGains ?? 0) * surtaxRate : 0;
    const stateTax = applyBrackets(taxableIncome, brackets) + surtax;

    const localRate = effectiveLocalRate !== undefined ? effectiveLocalRate : MD_PIGGYBACK_RATE;
    const localTax = taxableIncome * localRate;

    return { stateTax, localTax, totalTax: stateTax + localTax };
  },
};
