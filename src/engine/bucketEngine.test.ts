import { describe, it, expect } from 'vitest';
import { calculateBucketYearState, generateBucketMultiYearProjection } from './bucketEngine';
import {
  AppStateInputs,
  DEFAULT_BUCKET_STRATEGY_SETTINGS,
  SimulationResultRow,
} from '../types';

const mockInputs: AppStateInputs = {
  isConfigured: true,
  isSingleFiler: false,
  simulationStartYear: 2026,
  annualLivingExpenses: 120000,
  annualRothConversion: 50000,
  rothConversionStrategy: 'flat',
  rothConversionTargetValue: null,
  you: { birthDate: '1965-05-15', estimatedPIA: 3000, targetSSClaimingAge: 70 },
  wife: { birthDate: '1967-08-20', estimatedPIA: 2500, targetSSClaimingAge: 67 },
  portfolio: {
    yourPreTaxIRA: 1000000,
    wifePreTaxIRA: 500000,
    yourRothIRA: 300000,
    wifeRothIRA: 200000,
    yourTaxableBrokerage: 400000,
    wifeTaxableBrokerage: 100000,
    yourTaxableBasis: 300000,
    wifeTaxableBasis: 80000,
    yourCash: 50000,
    wifeCash: 25000,
  },
  jurisdiction: { currentState: 'MD', targetState: 'FL', relocationYear: 2030 },
  growthAssumptions: {
    equityReturnRate: 0.07,
    fixedIncomeReturnRate: 0.04,
    cpiInflationRate: 0.025,
    healthcareInflationRate: 0.05,
    preTaxEquityPortion: 0.60,
    taxableEquityPortion: 0.80,
    rothEquityPortion: 1.00,
    cashYieldRate: 0.035,
    minCashReserveDollars: 100000,
  },
  monteCarloSettings: {
    mode: 'monte-carlo',
    equityVolatility: 0.15,
    fixedIncomeVolatility: 0.05,
    correlation: 0.15,
    trials: 100,
    seed: 12345,
  },
  bucketSettings: DEFAULT_BUCKET_STRATEGY_SETTINGS,
};

const mockLedgerRow: SimulationResultRow = {
  year: 2026,
  yourAge: 61,
  wifeAge: 59,
  yourSS: 0,
  wifeSS: 0,
  yourRMD: 0,
  wifeRMD: 0,
  capitalGainsTriggered: 0,
  intentionalRothConversion: 50000,
  otherTaxableIncome: 0,
  magi: 100000,
  fedAGI: 100000,
  standardDeduction: 30000,
  taxableIncome: 70000,
  fedIncomeTax: 10000,
  stateIncomeTax: 4000,
  totalIncomeTax: 14000,
  niitTax: 0,
  taxableSS: 0,
  taxableDividends: 5000,
  taxableInterest: 2000,
  cpiFactor: 1.0,
  magiTwoYearsAgo: 0,
  surchargeTier: 0,
  yourPartBSurcharge: 0,
  yourPartDSurcharge: 0,
  wifePartBSurcharge: 0,
  wifePartDSurcharge: 0,
  combinedSurchargeMonthly: 0,
  combinedSurchargeAnnual: 0,
  livingExpenses: 120000,
  medicareBasePremiums: 0,
  preMedicareHealthcareCost: 12000,
  totalExpenses: 146000,
  incomeInflow: 0,
  deficit: 146000,
  drawdownTaxable: 50000,
  drawdownPreTax: 0,
  drawdownRoth: 0,
  drawdownCash: 0,
  portfolioGrowth: 100000,
  charitableTithe: 0,
  qcdAmount: 0,
  nonQcdTithe: 0,
  qcdTaxSavings: 0,
  endYourPreTaxIRA: 950000,
  endWifePreTaxIRA: 500000,
  endYourRothIRA: 350000,
  endWifeRothIRA: 200000,
  endYourTaxableBrokerage: 380000,
  endYourTaxableBasis: 280000,
  endYourCash: 40000,
  endWifeTaxableBrokerage: 100000,
  endWifeTaxableBasis: 80000,
  endWifeCash: 25000,
  totalPortfolioValue: 2245000,
};

describe('bucketEngine', () => {
  it('calculates bucket states accurately for a given year', () => {
    const calc = calculateBucketYearState(2026, mockLedgerRow, mockInputs, DEFAULT_BUCKET_STRATEGY_SETTINGS);

    expect(calc.year).toBe(2026);
    // Bucket 1 (Taxable Brokerage: 380k + 100k + 40k + 25k = 545,000)
    expect(calc.bucket1.totalBalance).toBe(545000);
    // Target living reserve for 24 months at 120k/yr = 240,000
    expect(calc.bucket1.targetLivingReserve).toBe(240000);
    expect(calc.bucket1.runwayMonths).toBeGreaterThan(24);
    expect(calc.bucket1.status).toBe('healthy');

    // Bucket 2 (Pre-Tax IRA: 950k + 500k = 1,450,000)
    expect(calc.bucket2.totalBalance).toBe(1450000);
    expect(calc.bucket2.rungs.length).toBe(5);
    expect(calc.bucket2.rungs[0].isMaturingThisYear).toBe(true);
    expect(calc.bucket2.maturingPrincipalThisYear).toBe(120000);

    // Bucket 3 (Roth IRA: 350k + 200k = 550,000)
    expect(calc.bucket3.totalBalance).toBe(550000);
    expect(calc.bucket3.equityPercentage).toBe(1.0);

    // Action items generated
    expect(calc.actions.length).toBeGreaterThan(0);
    const maturityAction = calc.actions.find((a) => a.type === 'rung-maturity-distribute');
    expect(maturityAction).toBeDefined();
    expect(maturityAction?.amount).toBe(120000);
  });

  it('respects pause rebuild mode for bond ladder', () => {
    const pausedSettings = {
      ...DEFAULT_BUCKET_STRATEGY_SETTINGS,
      income: {
        ...DEFAULT_BUCKET_STRATEGY_SETTINGS.income,
        rebuildMode: 'paused' as const,
      },
    };

    const calc = calculateBucketYearState(2026, mockLedgerRow, mockInputs, pausedSettings);
    expect(calc.bucket2.rebuildMode).toBe('paused');
    // Ladder rebuild action should NOT be generated when paused
    const rebuildAction = calc.actions.find((a) => a.type === 'ladder-rebuild');
    expect(rebuildAction).toBeUndefined();
  });

  it('generates multi-year projections across simulation ledger', () => {
    const ledger = [
      mockLedgerRow,
      { ...mockLedgerRow, year: 2027 },
      { ...mockLedgerRow, year: 2028 },
    ];

    const projection = generateBucketMultiYearProjection(ledger, mockInputs, DEFAULT_BUCKET_STRATEGY_SETTINGS);
    expect(projection.length).toBe(3);
    expect(projection[0].year).toBe(2026);
    expect(projection[1].year).toBe(2027);
    expect(projection[2].year).toBe(2028);
  });
});
