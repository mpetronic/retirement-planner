import { describe, it, expect } from 'vitest';
import { calculateStateAndLocalTax } from '../stateTaxRegistry';
import { applyBrackets, phaseOutFraction, resolveYearRules } from './stateTaxPrimitives';

const NO_LOCAL_RATE = 0;

function mdStateTax(params: Parameters<typeof calculateStateAndLocalTax>[1]): number {
  return calculateStateAndLocalTax('MD', params, NO_LOCAL_RATE).stateTax;
}

describe('Maryland state tax', () => {
  it('applies the flat standard deduction and personal exemption for a single filer', () => {
    // 60,000 - 3,350 deduction - 3,200 exemption = 53,450 taxable
    // 90 on the first 3,000 plus 4.75% of the rest
    expect(mdStateTax({ fedAGI: 60000, taxableSS: 0, isSingle: true, taxYear: 2025 })).toBeCloseTo(
      90 + (53450 - 3000) * 0.0475,
      6
    );
  });

  it('adds the age 65 exemption per aged filer for a joint return', () => {
    // 120,000 - 6,700 deduction - (2 x 3,200 + 2 x 1,000) exemptions = 104,900 taxable
    const expected = 90 + (104900 - 3000) * 0.0475;
    expect(mdStateTax({ fedAGI: 120000, taxableSS: 0, isSingle: false, agedFilerCount: 2, taxYear: 2025 })).toBeCloseTo(
      expected,
      6
    );
  });

  it('phases the exemption out as income rises', () => {
    // Single at 110,000 keeps half the exemption: 110,000 - 3,350 - 1,600 = 105,050 taxable
    const expected = 90 + 97000 * 0.0475 + 5050 * 0.05;
    expect(mdStateTax({ fedAGI: 110000, taxableSS: 0, isSingle: true, taxYear: 2025 })).toBeCloseTo(expected, 6);
    // Above 150,000 single there is no exemption: 200,000 - 3,350 = 196,650 taxable
    const noExemption = 90 + 97000 * 0.0475 + 25000 * 0.05 + 25000 * 0.0525 + (196650 - 150000) * 0.055;
    expect(mdStateTax({ fedAGI: 200000, taxableSS: 0, isSingle: true, taxYear: 2025 })).toBeCloseTo(noExemption, 6);
  });

  it('does not tax Social Security and ignores any pension exclusion policy', () => {
    const withSS = mdStateTax({ fedAGI: 60000, taxableSS: 20000, isSingle: true, taxYear: 2025 });
    const withoutSS = mdStateTax({ fedAGI: 40000, taxableSS: 0, isSingle: true, taxYear: 2025 });
    expect(withSS).toBeCloseTo(withoutSS, 6);
  });

  it('taxes income above 1,000,000 single at 6.5%', () => {
    const base = mdStateTax({ fedAGI: 2000000, taxableSS: 0, isSingle: true, taxYear: 2025 });
    const more = mdStateTax({ fedAGI: 2001000, taxableSS: 0, isSingle: true, taxYear: 2025 });
    expect(more - base).toBeCloseTo(1000 * 0.065, 6);
  });

  it('uses the 6.25% bracket between 600,000 and 1,200,000 joint', () => {
    const base = mdStateTax({ fedAGI: 900000, taxableSS: 0, isSingle: false, taxYear: 2025 });
    const more = mdStateTax({ fedAGI: 901000, taxableSS: 0, isSingle: false, taxYear: 2025 });
    expect(more - base).toBeCloseTo(1000 * 0.0625, 6);
  });

  it('adds a 2% surtax on net capital gains only when federal AGI exceeds 350,000', () => {
    const noGains = mdStateTax({ fedAGI: 400000, taxableSS: 0, isSingle: true, taxYear: 2025, capitalGains: 0 });
    const withGains = mdStateTax({ fedAGI: 400000, taxableSS: 0, isSingle: true, taxYear: 2025, capitalGains: 100000 });
    expect(withGains - noGains).toBeCloseTo(100000 * 0.02, 6);

    const belowThreshold = mdStateTax({ fedAGI: 350000, taxableSS: 0, isSingle: true, taxYear: 2025, capitalGains: 100000 });
    const belowNoGains = mdStateTax({ fedAGI: 350000, taxableSS: 0, isSingle: true, taxYear: 2025, capitalGains: 0 });
    expect(belowThreshold).toBeCloseTo(belowNoGains, 6);
  });

  it('indexes the standard deduction with the CPI factor', () => {
    const base = mdStateTax({ fedAGI: 60000, taxableSS: 0, isSingle: true, taxYear: 2025, cpiFactor: 1 });
    const indexed = mdStateTax({ fedAGI: 60000, taxableSS: 0, isSingle: true, taxYear: 2025, cpiFactor: 1.1 });
    expect(base - indexed).toBeCloseTo(3350 * 0.1 * 0.0475, 6);
  });

  it('adds the local tax on the same taxable income', () => {
    const res = calculateStateAndLocalTax('MD', { fedAGI: 60000, taxableSS: 0, isSingle: true, taxYear: 2025 }, 0.032);
    expect(res.localTax).toBeCloseTo(53450 * 0.032, 6);
    expect(res.totalTax).toBeCloseTo(res.stateTax + res.localTax, 6);
  });
});

describe('state tax primitives', () => {
  it('applies graduated tiers', () => {
    const tiers = [{ rate: 0.1, limit: 100 }, { rate: 0.2, limit: Infinity }];
    expect(applyBrackets(150, tiers)).toBeCloseTo(10 + 10, 6);
    expect(applyBrackets(50, tiers)).toBeCloseTo(5, 6);
    expect(applyBrackets(0, tiers)).toBe(0);
  });

  it('resolves rules to the latest entry at or before the year', () => {
    const table = { 2025: 'a', 2028: 'b' };
    expect(resolveYearRules(table, 2024)).toBe('a');
    expect(resolveYearRules(table, 2027)).toBe('a');
    expect(resolveYearRules(table, 2030)).toBe('b');
    expect(resolveYearRules(table)).toBe('b');
  });

  it('returns the allowed fraction of a phase-out', () => {
    const steps = [{ agiLimit: 100, allowedFraction: 1 }, { agiLimit: 200, allowedFraction: 0.5 }];
    expect(phaseOutFraction(100, steps)).toBe(1);
    expect(phaseOutFraction(150, steps)).toBe(0.5);
    expect(phaseOutFraction(201, steps)).toBe(0);
  });
});
