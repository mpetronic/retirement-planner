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
    // Initial launch year (2026): funded from staged reserve
    const calcLaunch = calculateBucketYearState(2026, mockLedgerRow, mockInputs, DEFAULT_BUCKET_STRATEGY_SETTINGS);

    expect(calcLaunch.year).toBe(2026);
    expect(calcLaunch.isInitialStrategyYear).toBe(true);
    // Bucket 1 (Taxable Brokerage: 380k + 100k + 40k + 25k = 545,000)
    expect(calcLaunch.bucket1.totalBalance).toBe(545000);
    // Target living reserve for 24 months at 120k/yr = 240,000
    expect(calcLaunch.bucket1.targetLivingReserve).toBe(240000);
    expect(calcLaunch.bucket1.runwayMonths).toBeGreaterThan(24);
    expect(calcLaunch.bucket1.status).toBe('healthy');

    // Bucket 2 (Pre-Tax IRA: 950k + 500k = 1,450,000)
    expect(calcLaunch.bucket2.totalBalance).toBe(1450000);
    expect(calcLaunch.bucket2.rungs.length).toBe(5);
    // In launch year, Rung 1 matures in 2027
    expect(calcLaunch.bucket2.rungs[0].targetYear).toBe(2027);
    expect(calcLaunch.bucket2.rungs[0].isMaturingThisYear).toBe(false);
    expect(calcLaunch.bucket2.maturingPrincipalThisYear).toBe(0);

    // Bucket 3 (Roth IRA: 350k + 200k = 550,000)
    expect(calcLaunch.bucket3.totalBalance).toBe(550000);
    expect(calcLaunch.bucket3.equityPercentage).toBe(1.0);

    // Year 2 of strategy (2027): First bond ladder rung matures to refill Bucket 1
    const row2027 = { ...mockLedgerRow, year: 2027 };
    const calcYear2 = calculateBucketYearState(2027, row2027, mockInputs, DEFAULT_BUCKET_STRATEGY_SETTINGS);
    expect(calcYear2.bucket2.rungs[0].isMaturingThisYear).toBe(true);
    expect(calcYear2.bucket2.maturingPrincipalThisYear).toBe(120000);

    const maturityAction = calcYear2.actions.find((a) => a.type === 'rung-maturity-distribute');
    expect(maturityAction).toBeDefined();
    expect(maturityAction?.amount).toBe(120000);
  });

  it('respects strategyStartYear transition phase', () => {
    const settingsWith2027Start = {
      ...DEFAULT_BUCKET_STRATEGY_SETTINGS,
      strategyStartYear: 2027,
      initialFundingSource: 'cash-savings' as const,
    };

    // Inspecting 2026 (Transition Year prior to 2027 launch)
    const calc2026 = calculateBucketYearState(2026, mockLedgerRow, mockInputs, settingsWith2027Start);
    expect(calc2026.isTransitionYear).toBe(true);
    expect(calc2026.isInitialStrategyYear).toBe(false);
    expect(calc2026.strategyStartYear).toBe(2027);

    // Should include transition funding and initial staging action items
    const transitionAction = calc2026.actions.find((a) => a.id.startsWith('transition-funding'));
    expect(transitionAction).toBeDefined();

    const stageAction = calc2026.actions.find((a) => a.id.startsWith('stage-initial-reserve'));
    expect(stageAction).toBeDefined();

    // Inspecting 2027 (Initial Launch Year)
    const row2027 = { ...mockLedgerRow, year: 2027 };
    const calc2027 = calculateBucketYearState(2027, row2027, mockInputs, settingsWith2027Start);
    expect(calc2027.isTransitionYear).toBe(false);
    expect(calc2027.isInitialStrategyYear).toBe(true);
    const initialLaunchItem = calc2027.actions.find((a) => a.id.startsWith('initial-launch-staged'));
    expect(initialLaunchItem).toBeDefined();
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

  it('sizes future bond ladder rungs with inflation progression', () => {
    const customInflationInputs = {
      ...mockInputs,
      growthAssumptions: {
        ...mockInputs.growthAssumptions,
        cpiInflationRate: 0.03, // 3% inflation
      },
    };

    const calc = calculateBucketYearState(2027, { ...mockLedgerRow, year: 2027 }, customInflationInputs, DEFAULT_BUCKET_STRATEGY_SETTINGS);
    const rungs = calc.bucket2.rungs;

    expect(rungs.length).toBe(5);
    // Rung 1: 2027 (0 years ahead): 120,000
    expect(rungs[0].targetYear).toBe(2027);
    expect(rungs[0].principal).toBe(120000);

    // Rung 2: 2028 (1 year ahead): 120,000 * 1.03 = 123,600
    expect(rungs[1].targetYear).toBe(2028);
    expect(rungs[1].principal).toBe(123600);

    // Rung 3: 2029 (2 years ahead): 120,000 * 1.03^2 = 127,308
    expect(rungs[2].targetYear).toBe(2029);
    expect(rungs[2].principal).toBe(127308);

    // Each subsequent rung principal should strictly increase
    for (let i = 1; i < rungs.length; i++) {
      expect(rungs[i].principal).toBeGreaterThan(rungs[i - 1].principal);
    }
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
