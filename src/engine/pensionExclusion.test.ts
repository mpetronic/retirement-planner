import { describe, it, expect } from 'vitest';
import { calculatePensionExclusion, resolveActiveJurisdiction } from './stateTaxRegistry';

const retiree = (over: Partial<{ age: number; isAlive: boolean; socialSecurityBenefit: number; eligibleDistributions: number }> = {}) => ({
  age: 70,
  isAlive: true,
  socialSecurityBenefit: 0,
  eligibleDistributions: 100000,
  ...over,
});

describe('calculatePensionExclusion', () => {
  it('caps the exclusion per person for a state that defines a policy', () => {
    const exclusion = calculatePensionExclusion('MD', [retiree(), retiree()], 1);
    expect(exclusion).toBeGreaterThan(0);
    expect(exclusion).toBeLessThan(200000);
  });

  it('reduces the cap by Social Security benefits and ignores ineligible people', () => {
    const full = calculatePensionExclusion('MD', [retiree()], 1);
    const reduced = calculatePensionExclusion('MD', [retiree({ socialSecurityBenefit: 10000 })], 1);
    expect(reduced).toBeCloseTo(full - 10000, 6);
    expect(calculatePensionExclusion('MD', [retiree({ age: 64 })], 1)).toBe(0);
    expect(calculatePensionExclusion('MD', [retiree({ isAlive: false })], 1)).toBe(0);
  });

  it('returns zero for states without a pension exclusion policy', () => {
    expect(calculatePensionExclusion('FL', [retiree()], 1)).toBe(0);
    expect(calculatePensionExclusion('TX', [retiree()], 1)).toBe(0);
  });
});

describe('resolveActiveJurisdiction', () => {
  const base = { currentState: 'MD', targetState: 'TX', relocationYear: 2030 };

  it('uses the current state before the relocation year and the target after', () => {
    expect(resolveActiveJurisdiction(base, 2029).state).toBe('MD');
    expect(resolveActiveJurisdiction(base, 2030).state).toBe('TX');
  });

  it('stays in the current state when there is no relocation or no target', () => {
    expect(resolveActiveJurisdiction({ ...base, relocationYear: null }, 2040).state).toBe('MD');
    expect(resolveActiveJurisdiction({ ...base, targetState: '' }, 2040).state).toBe('MD');
  });
});
