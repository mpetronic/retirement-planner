import { describe, it, expect } from 'vitest';
import {
  calculateFederalDeduction,
  countAgedFilers,
  getEffectiveSaltCap,
  getSaltCap,
  getSeniorDeduction,
  FederalDeductionParams,
} from './federalDeduction';
import {
  FED_STANDARD_DEDUCTION_MFJ,
  OBBBA_SENIOR_DEDUCTION_PER_FILER,
  OBBBA_SENIOR_DEDUCTION_PHASEOUT_RATE,
  OBBBA_SENIOR_DEDUCTION_PHASEOUT_THRESHOLD_MFJ,
  OBBBA_SALT_CAP_FIRST_YEAR_AMOUNT,
  OBBBA_SALT_CAP_ANNUAL_GROWTH,
  OBBBA_SALT_PHASEDOWN_RATE,
  OBBBA_SALT_PHASEDOWN_THRESHOLD_FIRST_YEAR,
  OBBBA_CHARITABLE_ITEMIZED_AGI_FLOOR_RATE,
  OBBBA_NON_ITEMIZER_CHARITABLE_DEDUCTION_MFJ,
  PRE_OBBBA_SALT_CAP,
} from './taxRates';
import { getFederalRules } from './federalTaxRules';

const FIRST_ENHANCED_SENIOR_YEAR = 2027;
const YEAR_AFTER_SENIOR_DEDUCTION = 2029;
const YEAR_AFTER_SALT_ENHANCEMENT = 2030;
const TWO_AGED_FILERS = 2;
const AGED_ADDITION_MFJ = getFederalRules(FIRST_ENHANCED_SENIOR_YEAR).additionalStandardDeductionAged.mfj;
const LOW_AGI = 100000;

const baseParams = (overrides: Partial<FederalDeductionParams>): FederalDeductionParams => ({
  year: FIRST_ENHANCED_SENIOR_YEAR,
  isSingle: false,
  federal: { rules: getFederalRules(FIRST_ENHANCED_SENIOR_YEAR), indexFactor: 1 },
  agedFilerCount: TWO_AGED_FILERS,
  fedAGI: LOW_AGI,
  stateIncomeTax: 0,
  propertyTax: 0,
  nonQcdTithe: 0,
  ...overrides,
});

describe('federalDeduction', () => {
  describe('senior deduction', () => {
    it('applies per aged filer in 2027 and is gone in 2029', () => {
      expect(getSeniorDeduction(FIRST_ENHANCED_SENIOR_YEAR, false, TWO_AGED_FILERS, LOW_AGI)).toBe(
        OBBBA_SENIOR_DEDUCTION_PER_FILER * TWO_AGED_FILERS
      );
      expect(getSeniorDeduction(YEAR_AFTER_SENIOR_DEDUCTION, false, TWO_AGED_FILERS, LOW_AGI)).toBe(0);
    });

    it('phases out at the statutory rate above the MAGI threshold', () => {
      const excess = 50000;
      const magi = OBBBA_SENIOR_DEDUCTION_PHASEOUT_THRESHOLD_MFJ + excess;
      const expected = OBBBA_SENIOR_DEDUCTION_PER_FILER * TWO_AGED_FILERS - OBBBA_SENIOR_DEDUCTION_PHASEOUT_RATE * excess;
      expect(getSeniorDeduction(FIRST_ENHANCED_SENIOR_YEAR, false, TWO_AGED_FILERS, magi)).toBeCloseTo(expected);
    });

    it('never goes negative at very high income', () => {
      expect(getSeniorDeduction(FIRST_ENHANCED_SENIOR_YEAR, false, TWO_AGED_FILERS, 10_000_000)).toBe(0);
    });
  });

  describe('SALT cap', () => {
    it('follows the enhanced schedule then reverts', () => {
      expect(getSaltCap(2025)).toBe(OBBBA_SALT_CAP_FIRST_YEAR_AMOUNT);
      expect(getSaltCap(2026)).toBeCloseTo(OBBBA_SALT_CAP_FIRST_YEAR_AMOUNT * (1 + OBBBA_SALT_CAP_ANNUAL_GROWTH));
      expect(getSaltCap(2029)).toBeCloseTo(OBBBA_SALT_CAP_FIRST_YEAR_AMOUNT * Math.pow(1 + OBBBA_SALT_CAP_ANNUAL_GROWTH, 4));
      expect(getSaltCap(YEAR_AFTER_SALT_ENHANCEMENT)).toBe(PRE_OBBBA_SALT_CAP);
    });

    it('phases down above the MAGI threshold but not below the old cap', () => {
      const excess = 10000;
      const threshold2026 = OBBBA_SALT_PHASEDOWN_THRESHOLD_FIRST_YEAR * (1 + OBBBA_SALT_CAP_ANNUAL_GROWTH);
      expect(getEffectiveSaltCap(2026, threshold2026 + excess)).toBeCloseTo(getSaltCap(2026) - OBBBA_SALT_PHASEDOWN_RATE * excess);
      expect(getEffectiveSaltCap(2026, 10_000_000)).toBe(PRE_OBBBA_SALT_CAP);
    });
  });

  describe('calculateFederalDeduction', () => {
    it('uses the standard deduction plus age and senior additions when itemizing is smaller', () => {
      const result = calculateFederalDeduction(baseParams({}));
      const standard = FED_STANDARD_DEDUCTION_MFJ + TWO_AGED_FILERS * AGED_ADDITION_MFJ;
      expect(result.usesItemized).toBe(false);
      expect(result.standardDeduction).toBe(standard);
      expect(result.totalDeduction).toBe(standard + OBBBA_SENIOR_DEDUCTION_PER_FILER * TWO_AGED_FILERS);
    });

    it('itemizes when state income tax plus property tax under the cap beats the standard deduction', () => {
      const result = calculateFederalDeduction(baseParams({ stateIncomeTax: 15000, propertyTax: 25000 }));
      expect(result.usesItemized).toBe(true);
      expect(result.itemizedDeduction).toBe(40000);
      expect(result.totalDeduction).toBe(40000 + OBBBA_SENIOR_DEDUCTION_PER_FILER * TWO_AGED_FILERS);
    });

    it('caps SALT at the old limit after 2029 so the same taxes no longer itemize', () => {
      const result = calculateFederalDeduction(baseParams({ year: YEAR_AFTER_SALT_ENHANCEMENT, stateIncomeTax: 15000, propertyTax: 20000 }));
      expect(result.itemizedDeduction).toBe(PRE_OBBBA_SALT_CAP);
      expect(result.usesItemized).toBe(false);
    });

    it('counts property tax toward SALT even with no state income tax', () => {
      const result = calculateFederalDeduction(baseParams({ propertyTax: 36000 }));
      expect(result.itemizedDeduction).toBe(36000);
      expect(result.usesItemized).toBe(true);
    });

    it('applies the 0.5% AGI floor to itemized charity from 2026 only', () => {
      const tithe = 10000;
      const itemizedFloor = OBBBA_CHARITABLE_ITEMIZED_AGI_FLOOR_RATE * LOW_AGI;
      const after = calculateFederalDeduction(baseParams({ year: 2027, propertyTax: 36000, nonQcdTithe: tithe }));
      expect(after.itemizedDeduction).toBeCloseTo(36000 + tithe - itemizedFloor);
      const before = calculateFederalDeduction(baseParams({ year: 2025, propertyTax: 36000, nonQcdTithe: tithe }));
      expect(before.itemizedDeduction).toBe(36000 + tithe);
    });

    it('gives non-itemizers the capped charitable deduction from 2026', () => {
      const tithe = 10000;
      const result = calculateFederalDeduction(baseParams({ nonQcdTithe: tithe }));
      const standard = FED_STANDARD_DEDUCTION_MFJ + TWO_AGED_FILERS * AGED_ADDITION_MFJ;
      expect(result.totalDeduction).toBe(
        standard + OBBBA_NON_ITEMIZER_CHARITABLE_DEDUCTION_MFJ + OBBBA_SENIOR_DEDUCTION_PER_FILER * TWO_AGED_FILERS
      );
    });
  });

  describe('countAgedFilers', () => {
    it('counts both spouses, a lone survivor and none', () => {
      expect(countAgedFilers(false, false, 70, 68, false)).toBe(2);
      expect(countAgedFilers(false, false, 70, 60, false)).toBe(1);
      expect(countAgedFilers(true, false, 70, 68, false)).toBe(1);
      expect(countAgedFilers(true, true, 60, 68, false)).toBe(0);
    });
  });
});
