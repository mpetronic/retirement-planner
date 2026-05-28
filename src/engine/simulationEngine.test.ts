import { describe, it, expect } from 'vitest';
import {
  calculateSSBenefit,
  calculateSpousalBenefit,
  calculateTaxableSS,
  calculateFedTax,
  calculateMDStateTax,
} from './simulationEngine';

describe('calculateSSBenefit', () => {
  const PIA = 1000;

  it('should return 100% of PIA when claiming at Full Retirement Age (67)', () => {
    const benefit = calculateSSBenefit(PIA, 67);
    expect(benefit).toBeCloseTo(1000, 1);
  });

  it('should increase benefit by 8% per year delayed past FRA (67) up to age 70', () => {
    // 3 years delay: 3 * 8% = 24% increase
    const benefit70 = calculateSSBenefit(PIA, 70);
    expect(benefit70).toBeCloseTo(1240, 1);

    // Caps at 70 even if claimingAge is entered higher
    const benefit72 = calculateSSBenefit(PIA, 72);
    expect(benefit72).toBeCloseTo(1240, 1);
  });

  it('should apply the correct reduction schedule for early claiming', () => {
    // 3 years (36 months) early (age 64)
    // Reduction: 36 * (5/900) = 20%
    const benefit64 = calculateSSBenefit(PIA, 64);
    expect(benefit64).toBeCloseTo(800, 1);

    // 5 years (60 months) early (age 62)
    // Reduction: 36 * (5/900) + 24 * (5/1200) = 20% + 10% = 30%
    const benefit62 = calculateSSBenefit(PIA, 62);
    expect(benefit62).toBeCloseTo(700, 1);

    // Floors at age 62 claiming reduction even if claimingAge is entered lower
    const benefit60 = calculateSSBenefit(PIA, 60);
    expect(benefit60).toBeCloseTo(700, 1);
  });
});

describe('calculateSpousalBenefit', () => {
  const primaryPIA = 2000; // Base spousal benefit would be 1000 (50%)

  it('should return 50% of primary PIA at FRA (67)', () => {
    const benefit = calculateSpousalBenefit(primaryPIA, 67);
    expect(benefit).toBeCloseTo(1000, 1);
  });

  it('should not provide delayed credits past FRA (67)', () => {
    const benefit70 = calculateSpousalBenefit(primaryPIA, 70);
    expect(benefit70).toBeCloseTo(1000, 1);
  });

  it('should return 0 if primary PIA is 0 or negative', () => {
    expect(calculateSpousalBenefit(0, 67)).toBe(0);
    expect(calculateSpousalBenefit(-100, 67)).toBe(0);
  });

  it('should apply spousal early claim reduction schedule (25/36% first 36m, 5/12% next)', () => {
    // 3 years (36 months) early (age 64)
    // Reduction: 36 * (25/3600) = 25% reduction
    // Spousal benefit: 1000 * 0.75 = 750
    const benefit64 = calculateSpousalBenefit(primaryPIA, 64);
    expect(benefit64).toBeCloseTo(750, 1);

    // 5 years (60 months) early (age 62)
    // Reduction: 36 * (25/3600) + 24 * (5/1200) = 25% + 10% = 35% reduction
    // Spousal benefit: 1000 * 0.65 = 650
    const benefit62 = calculateSpousalBenefit(primaryPIA, 62);
    expect(benefit62).toBeCloseTo(650, 1);
  });
});

describe('calculateTaxableSS', () => {
  const totalSS = 10000;

  describe('Single filers', () => {
    it('should have 0% taxable SS when provisional income is <= $25,000', () => {
      // Provisional income: otherAGI + 0.5 * SS = 19000 + 5000 = 24000
      const taxable = calculateTaxableSS(totalSS, 19000, true);
      expect(taxable).toBe(0);
    });

    it('should calculate up to 50% taxable SS between $25,000 and $34,000 provisional income', () => {
      // Provisional income: 24000 + 5000 = 29000
      // Formula: min(0.5 * SS, 0.5 * (PI - 25000)) = min(5000, 0.5 * 4000) = 2000
      const taxable = calculateTaxableSS(totalSS, 24000, true);
      expect(taxable).toBeCloseTo(2000, 1);
    });

    it('should apply 85% rule correctly when provisional income is > $34,000', () => {
      // Provisional income: 45000 + 5000 = 50000
      // Base: min(4500, 0.5 * min(SS, 9000)) = min(4500, 4500) = 4500
      // Formula: min(0.85 * SS, base + 0.85 * (PI - 34000)) = min(8500, 4500 + 0.85 * 16000) = min(8500, 4500 + 13600) = 8500
      const taxable = calculateTaxableSS(totalSS, 45000, true);
      expect(taxable).toBeCloseTo(8500, 1);
    });
  });

  describe('MFJ filers', () => {
    it('should have 0% taxable SS when provisional income is <= $32,000', () => {
      // Provisional income: 26000 + 5000 = 31000
      const taxable = calculateTaxableSS(totalSS, 26000, false);
      expect(taxable).toBe(0);
    });

    it('should calculate up to 50% taxable SS between $32,000 and $44,000 provisional income', () => {
      // Provisional income: 33000 + 5000 = 38000
      // Formula: min(5000, 0.5 * 6000) = 3000
      const taxable = calculateTaxableSS(totalSS, 33000, false);
      expect(taxable).toBeCloseTo(3000, 1);
    });

    it('should apply 85% rule correctly when provisional income is > $44,000', () => {
      // Provisional income: 55000 + 5000 = 60000
      // Base: min(6000, 4500) = 4500
      // Formula: min(8500, 4500 + 0.85 * 16000) = 8500
      const taxable = calculateTaxableSS(totalSS, 55000, false);
      expect(taxable).toBeCloseTo(8500, 1);
    });
  });
});

describe('Tax calculations', () => {
  it('should calculate federal income tax correctly', () => {
    // 0 taxable income = 0 tax
    const zeroTax = calculateFedTax(0, false, 1.0);
    expect(zeroTax).toBe(0);

    // MFJ with 50,000 taxable income, 1.0 CPI factor
    // 2026 brackets MFJ: 10% on first $24,800, then 12% on the rest
    // Expected: 24800 * 0.10 + (50000 - 24800) * 0.12 = 2480 + 25200 * 0.12 = 2480 + 3024 = 5504
    const mfjTax = calculateFedTax(50000, false, 1.0);
    expect(mfjTax).toBeCloseTo(5504, 1);
  });

  it('should calculate Maryland state tax correctly with standard piggyback rate', () => {
    // AGI: 60000, taxableSS: 0, isSingle: false
    const mdTaxMFJ = calculateMDStateTax(60000, 0, false);
    expect(mdTaxMFJ).toBeGreaterThan(0);

    // AGI: 60000, taxableSS: 0, isSingle: true
    const mdTaxSingle = calculateMDStateTax(60000, 0, true);
    expect(mdTaxSingle).toBeGreaterThan(0);
  });
});
