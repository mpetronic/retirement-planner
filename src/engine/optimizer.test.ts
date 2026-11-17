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

  it('should successfully find optimal scenario settings matching max_portfolio', () => {
    const inputs = getMockInputs();
    
    // Test 'max_portfolio' optimization
    const result = optimizeRetirementScenario(inputs, 'max_portfolio', null);

    expect(result).toBeDefined();
    expect(result.bestStrategy).toMatch(/^(flat|fill-to-target|custom)$/);
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

  it('should handle hyphenated goals like max-portfolio gracefully', () => {
    const inputs = getMockInputs();
    const result = optimizeRetirementScenario(inputs, 'max-portfolio', null);

    expect(result).toBeDefined();
    expect(result.bestStrategy).toBeDefined();
    expect(result.details.endingEstate).toBeGreaterThan(0);
  });

  it('should successfully optimize for max_roth and min_taxes', () => {
    const inputs = getMockInputs();

    const rothResult = optimizeRetirementScenario(inputs, 'max_roth', null);
    expect(rothResult.details.endingRoth).toBeGreaterThan(0);

    const taxResult = optimizeRetirementScenario(inputs, 'min_taxes', null);
    expect(taxResult.details.lifetimeTaxes).toBeGreaterThanOrEqual(0);
  });

  it('should preserve wife claiming age for single filers and set survivorBenefitAnnual to 0', () => {
    const inputs = getMockInputs();
    inputs.isSingleFiler = true;
    inputs.wife.targetSSClaimingAge = 64;

    const result = optimizeRetirementScenario(inputs, 'max_portfolio', null);
    expect(result.bestWifeSSAge).toBe(64);
    expect(result.details.survivorBenefitAnnual).toBe(0);
    expect(result.details.spousalAddOnAnnual).toBe(0);
  });

  it('should evaluate and preserve user custom Roth strategy candidate', () => {
    const inputs = getMockInputs();
    inputs.rothConversionStrategy = 'custom';
    inputs.customRothScenarios = [
      {
        id: 'scenario-1',
        name: 'Aggressive Early',
        schedule: { 2026: 50000, 2027: 50000, 2028: 50000 },
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];
    inputs.activeCustomScenarioId = 'scenario-1';

    const result = optimizeRetirementScenario(inputs, 'max_portfolio', null);
    expect(['flat', 'fill-to-target', 'custom']).toContain(result.bestStrategy);
  });

  it('should accept none as the active strategy and still return a valid recommendation', () => {
    const inputs = getMockInputs();
    inputs.rothConversionStrategy = 'none';

    const result = optimizeRetirementScenario(inputs, 'max_portfolio', null);
    expect(['none', 'flat', 'fill-to-target', 'custom']).toContain(result.bestStrategy);
    expect(Number.isFinite(result.metricValue)).toBe(true);
  });

  it('should report none instead of a flat $0 conversion when conversions cannot help', () => {
    const inputs = getMockInputs();
    // With no pre-tax balances every conversion candidate produces an identical result, so the first
    // candidate (no conversions) must win and be reported as none, never as a flat $0 conversion.
    // Salaries are zeroed too, because working years add pre-tax 401(k) contributions.
    inputs.portfolio.yourPreTaxIRA = 0;
    inputs.portfolio.wifePreTaxIRA = 0;
    inputs.you.activeSalary = 0;
    inputs.wife.activeSalary = 0;

    for (const goal of ['max_portfolio', 'min_taxes', 'min_surcharges'] as const) {
      const result = optimizeRetirementScenario(inputs, goal, null);
      expect(result.bestStrategy).toBe('none');
      expect(result.bestAnnualRothConversion).toBe(0);
    }
  });

  it('should never report a flat strategy with a zero annual conversion', () => {
    const inputs = getMockInputs();
    for (const goal of ['max_portfolio', 'min_taxes', 'min_surcharges', 'max_roth'] as const) {
      const result = optimizeRetirementScenario(inputs, goal, null);
      expect(result.bestStrategy === 'flat' && result.bestAnnualRothConversion === 0).toBe(false);
    }
  });

  it('should keep none as the strategy when the inputs are not configured', () => {
    const inputs = getMockInputs();
    inputs.rothConversionStrategy = 'none';
    inputs.isConfigured = false;

    const result = optimizeRetirementScenario(inputs, 'max_portfolio', null);
    expect(result.bestStrategy).toBe('none');
  });

  it('should return finite metricValue and safe defaults when isConfigured is false', () => {
    const inputs = getMockInputs();
    inputs.isConfigured = false;

    const result = optimizeRetirementScenario(inputs, 'min_taxes', null);
    expect(result.metricValue).toBe(0);
    expect(isFinite(result.metricValue)).toBe(true);
    expect(result.details.endingEstate).toBe(0);
  });

  it('should calculate a positive survivorBenefitAnnual for the default plan', () => {
    const inputs = getMockInputs();
    const result = optimizeRetirementScenario(inputs, 'max_portfolio', null);
    expect(result.details.survivorBenefitAnnual).toBeGreaterThan(0);
  });

  it('should compute survivorBenefitAnnual and spousalAddOnAnnual symmetrically when wife has higher PIA and predeceases husband', () => {
    const inputs = getMockInputs();
    inputs.you.birthDate = '1965-01-01';
    inputs.you.longevityAge = 90;
    inputs.you.estimatedPIA = 800;
    inputs.wife.birthDate = '1965-01-01';
    inputs.wife.longevityAge = 75;
    inputs.wife.estimatedPIA = 3000;

    const result = optimizeRetirementScenario(inputs, 'max_portfolio', null);
    expect(result.details.spousalAddOnAnnual).toBeGreaterThan(0);
    expect(result.details.survivorBenefitAnnual).toBeGreaterThan(0);
  });
});
