import { describe, it, expect } from 'vitest';
import { optimizeRetirementScenario } from './optimizer';
import { AppStateInputs } from '../types';

describe('optimizeRetirementScenario', () => {
  const getMockInputs = (): AppStateInputs => ({
    you: {
      name: 'John',
      birthDate: '1965-06-15',
      estimatedPIA: 2000,
      targetSSClaimingAge: 67,
      plannedRetirementAge: 65,
      activeSalary: 120000,
      preMedicareMonthlyPremium: 500,
    },
    wife: {
      name: 'Jane',
      birthDate: '1968-09-20',
      estimatedPIA: 1200,
      targetSSClaimingAge: 67,
      plannedRetirementAge: 62,
      activeSalary: 80000,
      preMedicareMonthlyPremium: 500,
    },
    portfolio: {
      yourPreTaxIRA: 500000,
      yourRothIRA: 100000,
      yourTaxableBrokerage: 200000,
      yourTaxableBasis: 150000,
      wifePreTaxIRA: 300000,
      wifeRothIRA: 50000,
      wifeTaxableBrokerage: 100000,
      wifeTaxableBasis: 80000,
    },
    jurisdiction: {
      currentState: 'MD',
      targetState: 'FL',
      relocationYear: null,
    },
    growthAssumptions: {
      equityReturnRate: 0.07,
      fixedIncomeReturnRate: 0.04,
      cpiInflationRate: 0.025,
      healthcareInflationRate: 0.05,
    },
    annualLivingExpenses: 80000,
    annualRothConversion: 0,
    rothConversionStartYear: 2026,
    rothConversionEndYear: 2030,
    rothConversionStrategy: 'flat',
    rothConversionTargetValue: null,
    monteCarloSettings: {
      mode: 'monte-carlo',
      equityVolatility: 0.15,
      fixedIncomeVolatility: 0.05,
      correlation: 0.15,
      trials: 1,
      seed: 42,
    },
    isConfigured: true,
    isSingleFiler: false,
  });

  it('should successfully find optimal scenario settings matching a goal', () => {
    const inputs = getMockInputs();
    
    // Test 'max_portfolio' optimization
    const result = optimizeRetirementScenario(inputs, 'max_portfolio', false, null);

    expect(result).toBeDefined();
    expect(result.bestYourSSAge).toBeGreaterThanOrEqual(62);
    expect(result.bestYourSSAge).toBeLessThanOrEqual(70);
    expect(result.bestWifeSSAge).toBeGreaterThanOrEqual(62);
    expect(result.bestWifeSSAge).toBeLessThanOrEqual(70);

    expect(result.bestAnnualRothConversion).toBeGreaterThanOrEqual(0);
    expect(result.metricValue).toBeGreaterThan(0);

    // Verify detail outputs
    expect(result.details.endingEstate).toBeGreaterThan(0);
    expect(result.details.lifetimeTaxes).toBeGreaterThanOrEqual(0);
    expect(result.details.endingRoth).toBeGreaterThanOrEqual(0);
    expect(result.details.spousalAddOnAnnual).toBeDefined();
    expect(result.details.survivorBenefitAnnual).toBeDefined();
  });
});
