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
import { MEDICARE_STANDARD_AMOUNTS_BY_YEAR, getMedicareStandardAmounts } from './federalTaxRules';

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

describe('payroll and plan limits by year', () => {
  const START_2028 = 2028;
  const SALARY = 400000; // above the wage base and 401(k) limit in every year tested
  const YOUNG_BIRTH_YEAR_OFFSET = 40; // under 50, so no catch-up
  const SS_RATE = 0.062;
  const MEDICARE_RATE = 0.0145;
  const ADDITIONAL_MEDICARE_RATE = 0.009;

  const salaryInputs = (startYear: number): AppStateInputs => ({
    you: { birthDate: `${startYear - YOUNG_BIRTH_YEAR_OFFSET}-06-15`, plannedRetirementAge: 65, activeSalary: SALARY, targetSSClaimingAge: 67, estimatedPIA: 3000 },
    wife: { birthDate: '1964-01-01', plannedRetirementAge: 61, activeSalary: 0, targetSSClaimingAge: 67, estimatedPIA: 1500 },
    portfolio: { yourPreTaxIRA: 500000, yourRothIRA: 50000, yourTaxableBrokerage: 400000, yourTaxableBasis: 0, yourCash: 50000, wifePreTaxIRA: 0, wifeRothIRA: 0, wifeTaxableBrokerage: 0, wifeTaxableBasis: 0, wifeCash: 0 },
    jurisdiction: { currentState: 'FL', targetState: 'FL', relocationYear: null },
    growthAssumptions: { equityReturnRate: 0.07, fixedIncomeReturnRate: 0.04, cpiInflationRate: CPI_RATE, healthcareInflationRate: 0.05 },
    annualLivingExpenses: 60000,
    annualRothConversion: 0,
    simulationStartYear: startYear,
    rothConversionStartYear: startYear,
    rothConversionEndYear: startYear,
    monteCarloSettings: { mode: 'monte-carlo', trials: 10, equityVolatility: 0.15, fixedIncomeVolatility: 0.05, correlation: 0.15, seed: null },
    isConfigured: true,
    isSingleFiler: true,
  });

  afterEach(() => {
    delete FED_YEAR_RULES[LATER_RULE_YEAR];
  });

  it('indexes the 2026 limits by CPI when the simulation starts later', () => {
    const row = runRetirementSimulation(salaryInputs(START_2028))[0];
    const rules = getFederalRules(START_2028);
    const factor = row.federalIndexFactor!;
    expect(factor).toBeGreaterThan(row.cpiFactor);
    expect(row.employee401kContribution).toBeCloseTo(rules.payroll.elective401kLimit * factor, 0);
    const threshold = rules.payroll.additionalMedicareThreshold.single; // fixed by statute, not indexed
    const expectedFica = SS_RATE * rules.payroll.oasdiWageBase * factor + MEDICARE_RATE * SALARY + ADDITIONAL_MEDICARE_RATE * (SALARY - threshold);
    expect(row.ficaTaxesPaid).toBeCloseTo(expectedFica, 0);
  });

  it('uses a later entry limits from its own year onward', () => {
    const LATER_401K_LIMIT = 25500;
    const base = FED_YEAR_RULES[FIRST_RULE_YEAR];
    FED_YEAR_RULES[LATER_RULE_YEAR] = { ...base, payroll: { ...base.payroll, elective401kLimit: LATER_401K_LIMIT } };
    const row = runRetirementSimulation(salaryInputs(LATER_RULE_YEAR))[0];
    expect(row.employee401kContribution).toBeCloseTo(LATER_401K_LIMIT * row.federalIndexFactor!, 0);
  });
});

describe('Medicare standard amounts by year', () => {
  const HC_INFLATION = 0.05;
  const YEARS_AHEAD = 3;
  const PUBLISHED_2027 = { partB: 230.0, partD: 41.0, partBDeductible: 290 };

  afterEach(() => {
    delete MEDICARE_STANDARD_AMOUNTS_BY_YEAR[LATER_RULE_YEAR];
  });

  it('returns a published year unscaled', () => {
    expect(getMedicareStandardAmounts(FIRST_RULE_YEAR, HC_INFLATION)).toBe(MEDICARE_STANDARD_AMOUNTS_BY_YEAR[FIRST_RULE_YEAR]);
  });

  it('estimates a missing year by growing the latest earlier entry at healthcare inflation', () => {
    const known = MEDICARE_STANDARD_AMOUNTS_BY_YEAR[FIRST_RULE_YEAR];
    const growth = Math.pow(1 + HC_INFLATION, YEARS_AHEAD);
    const result = getMedicareStandardAmounts(FIRST_RULE_YEAR + YEARS_AHEAD, HC_INFLATION);
    expect(result.partB).toBeCloseTo(known.partB * growth, 6);
    expect(result.partD).toBeCloseTo(known.partD * growth, 6);
    expect(result.partBDeductible).toBeCloseTo(known.partBDeductible * growth, 6);
  });

  it('uses a published entry from its year and grows from it afterward', () => {
    MEDICARE_STANDARD_AMOUNTS_BY_YEAR[LATER_RULE_YEAR] = PUBLISHED_2027;
    expect(getMedicareStandardAmounts(LATER_RULE_YEAR, HC_INFLATION)).toBe(PUBLISHED_2027);
    expect(getMedicareStandardAmounts(LATER_RULE_YEAR + 1, HC_INFLATION).partB).toBeCloseTo(PUBLISHED_2027.partB * (1 + HC_INFLATION), 6);
    expect(getMedicareStandardAmounts(LATER_RULE_YEAR + 1, HC_INFLATION).partBDeductible).toBeCloseTo(PUBLISHED_2027.partBDeductible * (1 + HC_INFLATION), 6);
  });

  it('returns the first entry for a year before any published entry', () => {
    expect(getMedicareStandardAmounts(FIRST_RULE_YEAR - 1, HC_INFLATION)).toBe(MEDICARE_STANDARD_AMOUNTS_BY_YEAR[FIRST_RULE_YEAR]);
  });

  it('drives the engine premiums: a 2028 start grows 2026 premiums, a published 2028 does not', () => {
    const inputs = (): AppStateInputs => ({
      you: { birthDate: '1960-01-01', plannedRetirementAge: 62, activeSalary: 0, targetSSClaimingAge: 67, estimatedPIA: 0 },
      wife: { birthDate: '1960-01-01', plannedRetirementAge: 62, activeSalary: 0, targetSSClaimingAge: 67, estimatedPIA: 0 },
      portfolio: { yourPreTaxIRA: 0, yourRothIRA: 0, yourTaxableBrokerage: 0, yourTaxableBasis: 0, yourCash: 2000000, wifePreTaxIRA: 0, wifeRothIRA: 0, wifeTaxableBrokerage: 0, wifeTaxableBasis: 0, wifeCash: 0 },
      jurisdiction: { currentState: 'FL', targetState: 'FL', relocationYear: null },
      growthAssumptions: { equityReturnRate: 0.07, fixedIncomeReturnRate: 0.04, cpiInflationRate: CPI_RATE, healthcareInflationRate: HC_INFLATION },
      annualLivingExpenses: 50000,
      annualRothConversion: 0,
      simulationStartYear: 2028,
      rothConversionStartYear: 2028,
      rothConversionEndYear: 2028,
      monteCarloSettings: { mode: 'monte-carlo', trials: 10, equityVolatility: 0.15, fixedIncomeVolatility: 0.05, correlation: 0.15, seed: null },
      isConfigured: true,
      isSingleFiler: true,
    });
    const MONTHS = 12;
    const estimated = runRetirementSimulation(inputs())[0].medicareBasePremiums!;
    const base = MEDICARE_STANDARD_AMOUNTS_BY_YEAR[FIRST_RULE_YEAR];
    expect(estimated).toBeCloseTo((base.partB + base.partD) * MONTHS * Math.pow(1 + HC_INFLATION, 2), 0);

    const PUBLISHED_2028 = { partB: 250, partD: 45, partBDeductible: 300 };
    MEDICARE_STANDARD_AMOUNTS_BY_YEAR[2028] = PUBLISHED_2028;
    try {
      const published = runRetirementSimulation(inputs())[0].medicareBasePremiums!;
      expect(published).toBeCloseTo((PUBLISHED_2028.partB + PUBLISHED_2028.partD) * MONTHS, 0);
    } finally {
      delete MEDICARE_STANDARD_AMOUNTS_BY_YEAR[2028];
    }
  });
});
