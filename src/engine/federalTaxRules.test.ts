import { describe, it, expect, afterEach } from 'vitest';
import {
  FED_YEAR_RULES,
  FederalYearRules,
  federalIndexFactor,
  getFederalIndexing,
  getFederalRules,
  getFederalRulesBaseYear,
} from './federalTaxRules';
import { calculateFedTax } from './simulationEngine';

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
