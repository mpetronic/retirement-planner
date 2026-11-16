import { describe, it, expect, afterEach } from 'vitest';
import {
  FED_YEAR_RULES,
  FederalYearRules,
  federalIndexFactor,
  getFederalIndexing,
  getFederalRules,
  getFederalRulesBaseYear,
  indexedIrmaaLimit,
} from './federalTaxRules';
import { calculateFedTax, runRetirementSimulation } from './simulationEngine';
import { CONVERSION_TARGET_PRESETS, presetIndexFactor } from './taxRates';
import { AppStateInputs } from '../types';

const FIRST_RULE_YEAR = 2026;
const LATER_RULE_YEAR = 2027;
const CPI_RATE = 0.025;
const LATER_YEAR_BRACKET_SCALE = 1.03;

const withLaterYear = (): void => {
  const base = FED_YEAR_RULES[FIRST_RULE_YEAR];
  const scaled: FederalYearRules = {
    ...base,
    brackets: {
      mfj: base.brackets.mfj.map((b) => ({ ...b, limit: b.limit * LATER_YEAR_BRACKET_SCALE })),
      single: base.brackets.single.map((b) => ({ ...b, limit: b.limit * LATER_YEAR_BRACKET_SCALE })),
    },
  };
  FED_YEAR_RULES[LATER_RULE_YEAR] = scaled;
};

describe('federal year-keyed rule tables', () => {
  afterEach(() => {
    delete FED_YEAR_RULES[LATER_RULE_YEAR];
  });

  it('uses the latest known entry for years after the table and the earliest for years before it', () => {
    expect(getFederalRulesBaseYear(2040)).toBe(FIRST_RULE_YEAR);
    expect(getFederalRulesBaseYear(2020)).toBe(FIRST_RULE_YEAR);
    expect(getFederalRules(2040)).toBe(FED_YEAR_RULES[FIRST_RULE_YEAR]);
  });

  it('carries limits from the rule year, not the simulation start year, for later start years', () => {
    // Starting in 2028, 2026 limits must be inflated two years even though the start year CPI factor is 1.0
    const factor = federalIndexFactor(2028, 1, 2028, CPI_RATE);
    expect(factor).toBeCloseTo(Math.pow(1 + CPI_RATE, 2), 10);
  });

  it('matches the simulation CPI factor when the simulation starts in the rule year', () => {
    const cpiFactor = Math.pow(1 + CPI_RATE, 3);
    expect(federalIndexFactor(2029, cpiFactor, FIRST_RULE_YEAR, CPI_RATE)).toBeCloseTo(cpiFactor, 10);
  });

  it('switches to a newly published year and inflates from that year forward', () => {
    withLaterYear();
    expect(getFederalRulesBaseYear(2026)).toBe(FIRST_RULE_YEAR);
    expect(getFederalRulesBaseYear(2027)).toBe(LATER_RULE_YEAR);
    expect(getFederalRulesBaseYear(2030)).toBe(LATER_RULE_YEAR);

    // Start 2026: the 2027 entry is in 2027 dollars, so it is deflated by one year of CPI to
    // undo the simulation CPI factor already applied for 2027, giving an index factor of exactly 1.0.
    const cpiFactor2027 = 1 + CPI_RATE;
    expect(federalIndexFactor(2027, cpiFactor2027, FIRST_RULE_YEAR, CPI_RATE)).toBeCloseTo(1, 10);
    // Two years past the entry: one more year of inflation
    const cpiFactor2029 = Math.pow(1 + CPI_RATE, 3);
    expect(federalIndexFactor(2029, cpiFactor2029, FIRST_RULE_YEAR, CPI_RATE)).toBeCloseTo(Math.pow(1 + CPI_RATE, 2), 10);
  });

  it('taxes with the newly published brackets instead of an inflated older table', () => {
    const income = 200000;
    const taxBefore = calculateFedTax(income, false, getFederalIndexing(2027, 1 + CPI_RATE, FIRST_RULE_YEAR, CPI_RATE));
    withLaterYear();
    const taxAfter = calculateFedTax(income, false, getFederalIndexing(2027, 1 + CPI_RATE, FIRST_RULE_YEAR, CPI_RATE));
    // The published 2027 limits are higher than the CPI projection, so the same income owes less
    expect(taxAfter).toBeLessThan(taxBefore);
  });
});

const NON_2026_START_YEAR = 2028;
const IRMAA_TIER_1_PRESET_ID = 'irmaa_1';
const IRMAA_TOP_CLIFF_TIER_INDEX = 4;
const MAGI_TARGET_TOLERANCE = 1.0;

describe('IRMAA top cliff and target presets', () => {
  it('indexes tier limits except the statutory top cliff', () => {
    const tiers = getFederalRules(2026).irmaaTiers.mfj;
    const factor = 1.1;
    expect(indexedIrmaaLimit(tiers[0], factor)).toBeCloseTo(tiers[0].limit * factor, 6);
    expect(indexedIrmaaLimit(tiers[IRMAA_TOP_CLIFF_TIER_INDEX], factor)).toBe(tiers[IRMAA_TOP_CLIFF_TIER_INDEX].limit);
    expect(indexedIrmaaLimit(tiers[tiers.length - 1], factor)).toBe(Infinity);
  });

  it('picks the index factor from the preset indexing mode', () => {
    const cpi = 1.2;
    const federal = 1.3;
    expect(presetIndexFactor({ indexing: 'federal' }, cpi, federal)).toBe(federal);
    expect(presetIndexFactor({ indexing: 'start-year' }, cpi, federal)).toBe(cpi);
    expect(presetIndexFactor({ indexing: 'fixed' }, cpi, federal)).toBe(1);
    const topCliff = CONVERSION_TARGET_PRESETS.find((p) => p.id === 'irmaa_5')!;
    expect(topCliff.indexing).toBe('fixed');
  });

  it('fills to the IRMAA preset indexed from its rule year when the simulation starts after it', () => {
    const inputs: AppStateInputs = {
      you: { birthDate: '1960-01-01', plannedRetirementAge: 65, activeSalary: 0, targetSSClaimingAge: 67, estimatedPIA: 3000 },
      wife: { birthDate: '1964-01-01', plannedRetirementAge: 61, activeSalary: 0, targetSSClaimingAge: 67, estimatedPIA: 1500 },
      portfolio: { yourPreTaxIRA: 1500000, yourRothIRA: 50000, yourTaxableBrokerage: 400000, yourTaxableBasis: 0, yourCash: 50000, wifePreTaxIRA: 0, wifeRothIRA: 0, wifeTaxableBrokerage: 0, wifeTaxableBasis: 0, wifeCash: 0 },
      jurisdiction: { currentState: 'FL', targetState: 'FL', relocationYear: null },
      growthAssumptions: { equityReturnRate: 0.07, fixedIncomeReturnRate: 0.04, cpiInflationRate: CPI_RATE, healthcareInflationRate: 0.05 },
      annualLivingExpenses: 60000,
      annualRothConversion: 50000,
      simulationStartYear: NON_2026_START_YEAR,
      rothConversionStartYear: NON_2026_START_YEAR,
      rothConversionEndYear: NON_2026_START_YEAR + 3,
      rothConversionStrategy: 'fill-to-target',
      rothConversionTargetValue: CONVERSION_TARGET_PRESETS.find((p) => p.id === IRMAA_TIER_1_PRESET_ID)!.targetValue,
      monteCarloSettings: { mode: 'monte-carlo', trials: 10, equityVolatility: 0.15, fixedIncomeVolatility: 0.05, correlation: 0.15, seed: null },
      isConfigured: true,
      isSingleFiler: false,
    };
    const tier0Limit = getFederalRules(2026).irmaaTiers.mfj[0].limit;
    const rows = runRetirementSimulation(inputs).filter((r) => r.year >= NON_2026_START_YEAR && r.year <= NON_2026_START_YEAR + 3);
    for (const row of rows) {
      const expectedMAGI = tier0Limit * row.federalIndexFactor!;
      // Starting in 2028, the 2026 limit is already two years of CPI above its published value
      expect(row.federalIndexFactor!).toBeGreaterThan(row.cpiFactor);
      expect(Math.abs(row.magi - expectedMAGI)).toBeLessThanOrEqual(MAGI_TARGET_TOLERANCE);
    }
  });
});
