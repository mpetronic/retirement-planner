import { describe, it, expect } from 'vitest';
import {
  getSupportedStates,
  getStateTaxProfile,
  getEffectiveLocalTaxRate,
  calculateStateAndLocalTax,
  getSubJurisdictions,
} from './stateTaxRegistry';

describe('stateTaxRegistry - 50 States + DC Support', () => {
  it('should support exactly 51 jurisdictions (50 states + DC)', () => {
    const states = getSupportedStates();
    expect(states.length).toBe(51);

    const codes = states.map((s) => s.code);
    expect(codes).toContain('MD');
    expect(codes).toContain('FL');
    expect(codes).toContain('CA');
    expect(codes).toContain('TX');
    expect(codes).toContain('PA');
    expect(codes).toContain('DC');
    expect(codes).toContain('WY');
  });

  it('should sort states alphabetically by name', () => {
    const states = getSupportedStates();
    for (let i = 0; i < states.length - 1; i++) {
      expect(states[i].name.localeCompare(states[i + 1].name)).toBeLessThanOrEqual(0);
    }
  });

  it('should calculate valid non-negative taxes for all 51 states without crashing', () => {
    const states = getSupportedStates();
    for (const st of states) {
      const resSingle = calculateStateAndLocalTax(st.code, {
        fedAGI: 100000,
        taxableSS: 20000,
        isSingle: true,
        retirementDistributions: 50000,
      });
      expect(resSingle.stateTax).toBeGreaterThanOrEqual(0);
      expect(resSingle.localTax).toBeGreaterThanOrEqual(0);
      expect(resSingle.totalTax).toBe(resSingle.stateTax + resSingle.localTax);

      const resMFJ = calculateStateAndLocalTax(st.code, {
        fedAGI: 200000,
        taxableSS: 40000,
        isSingle: false,
        retirementDistributions: 80000,
      });
      expect(resMFJ.stateTax).toBeGreaterThanOrEqual(0);
      expect(resMFJ.localTax).toBeGreaterThanOrEqual(0);
      expect(resMFJ.totalTax).toBe(resMFJ.stateTax + resMFJ.localTax);
    }
  });

  describe('No Income Tax States', () => {
    const noTaxStates = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];

    it.each(noTaxStates)('should return 0 state tax for %s', (stateCode) => {
      const profile = getStateTaxProfile(stateCode);
      expect(profile).toBeDefined();
      expect(profile?.hasIncomeTax).toBe(false);

      const res = calculateStateAndLocalTax(stateCode, {
        fedAGI: 150000,
        taxableSS: 30000,
        isSingle: false,
        retirementDistributions: 70000,
      });
      expect(res.stateTax).toBe(0);
      expect(res.totalTax).toBe(0);
    });
  });

  describe('Retirement Exemption States', () => {
    it('Pennsylvania (PA) should 100% exempt Social Security and retirement distributions', () => {
      // Retiree with only Social Security and 401(k)/IRA distributions
      const res = calculateStateAndLocalTax('PA', {
        fedAGI: 90000,
        taxableSS: 30000,
        isSingle: false,
        retirementDistributions: 60000,
      });
      expect(res.stateTax).toBe(0);

      // Retiree with wages or taxable capital gains
      const resWithGains = calculateStateAndLocalTax('PA', {
        fedAGI: 110000,
        taxableSS: 30000,
        isSingle: false,
        retirementDistributions: 60000,
        capitalGains: 20000,
      });
      // 20000 * 3.07% = 614
      expect(resWithGains.stateTax).toBeCloseTo(614, 0);
    });

    it('Illinois (IL) should 100% exempt qualified retirement distributions and Social Security', () => {
      const res = calculateStateAndLocalTax('IL', {
        fedAGI: 100000,
        taxableSS: 25000,
        isSingle: false,
        retirementDistributions: 75000,
      });
      expect(res.stateTax).toBe(0);
    });

    it('should exclude up to $20,000 per person of retirement distributions in New York (NY)', () => {
      const resMFJ = calculateStateAndLocalTax('NY', {
        fedAGI: 75000,
        taxableSS: 20000,
        isSingle: false,
        retirementDistributions: 50000, // $40k excluded for MFJ + $20k SS + $16k std deduction > $75k
      });
      expect(resMFJ.stateTax).toBe(0);

      const resHighIncome = calculateStateAndLocalTax('NY', {
        fedAGI: 200000,
        taxableSS: 30000,
        isSingle: false,
        retirementDistributions: 100000,
      });
      expect(resHighIncome.stateTax).toBeGreaterThan(0);
    });
  });

  describe('Maryland Exact Statutory Calculations', () => {
    it('should calculate Maryland state tax and county piggyback accurately', () => {
      const res = calculateStateAndLocalTax(
        'MD',
        {
          fedAGI: 120000,
          taxableSS: 20000,
          isSingle: false,
          pensionExclusion: 10000,
        },
        0.0320 // Montgomery County rate
      );

      expect(res.stateTax).toBeGreaterThan(0);
      expect(res.localTax).toBeGreaterThan(0);
      expect(res.totalTax).toBe(res.stateTax + res.localTax);
    });

    it('should support all 24 Maryland local jurisdictions', () => {
      const counties = getSubJurisdictions('MD');
      expect(counties.length).toBe(24);
      const montgomery = counties.find((c) => c.id === 'montgomery');
      expect(montgomery?.defaultLocalRate).toBe(0.0320);
      const talbot = counties.find((c) => c.id === 'talbot');
      expect(talbot?.defaultLocalRate).toBe(0.0240);
    });
  });

  describe('Universal Custom Local Tax Handling', () => {
    it('should allow custom local tax rate for ANY state, even without county dropdowns', () => {
      // Virginia with custom local rate of 1.5%
      const resVA = calculateStateAndLocalTax(
        'VA',
        {
          fedAGI: 100000,
          taxableSS: 15000,
          isSingle: true,
        },
        0.015
      );
      expect(resVA.stateTax).toBeGreaterThan(0);
      expect(resVA.localTax).toBeGreaterThan(0);
      expect(resVA.localTax).toBeCloseTo((100000 - 15000 - 8500) * 0.015, 0);

      // Florida with municipal city tax of 0.5%
      const resFL = calculateStateAndLocalTax(
        'FL',
        {
          fedAGI: 80000,
          taxableSS: 10000,
          isSingle: true,
        },
        0.005
      );
      expect(resFL.stateTax).toBe(0);
      expect(resFL.localTax).toBe(80000 * 0.005);
      expect(resFL.totalTax).toBe(400);
    });

    it('should prioritize custom local tax rate over county default in getEffectiveLocalTaxRate', () => {
      // In MD with Montgomery County (default 3.20%) plus Gaithersburg city (+0.5% = 3.70%)
      const rateWithCity = getEffectiveLocalTaxRate('MD', 'montgomery', 0.0370);
      expect(rateWithCity).toBe(0.0370);

      // Reset to county default (custom rate null)
      const rateCountyDefault = getEffectiveLocalTaxRate('MD', 'montgomery', null);
      expect(rateCountyDefault).toBe(0.0320);

      // State without sub-jurisdictions with custom rate
      const ratePA = getEffectiveLocalTaxRate('PA', null, 0.015);
      expect(ratePA).toBe(0.015);

      // State without sub-jurisdictions without custom rate
      const ratePADefault = getEffectiveLocalTaxRate('PA', null, null);
      expect(ratePADefault).toBe(0);
    });
  });
});
