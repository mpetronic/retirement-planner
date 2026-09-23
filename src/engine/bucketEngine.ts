import {
  SimulationResultRow,
  AppStateInputs,
  BucketStrategySettings,
  BucketActionItem,
  BondLadderHolding,
  InitialFundingSource,
  InitialEquityAccount,
  getSimulationStartYear,
} from '../types';

export interface CalculatedRung {
  rungNumber: number;
  targetYear: number;
  principal: number;
  yieldRate: number;
  annualIncome: number;
  isMatured: boolean;
  isMaturingThisYear: boolean;
  holdings: BondLadderHolding[];
}

export interface Bucket1State {
  totalBalance: number;
  cashReserve: number;
  coreEquities: number;
  targetLivingReserve: number;
  annualLivingExpense: number;
  targetRothTaxReserve: number;
  totalTargetReserve: number;
  fillPercentage: number;
  runwayMonths: number;
  status: 'healthy' | 'caution' | 'critical';
  externalCheckingMonthlyAmount: number;
}

export interface Bucket2State {
  totalBalance: number;
  bondLadderTotal: number;
  equitiesTotal: number;
  rungs: CalculatedRung[];
  rebuildMode: 'active' | 'paused';
  rebuildTargetAmount: number;
  ladderRunwayYears: number;
  maturingPrincipalThisYear: number;
}

export interface Bucket3State {
  totalBalance: number;
  equityPercentage: number;
  rothInflowThisYear: number;
  unencumberedHorizonYears: number;
}

export interface BucketYearCalculation {
  year: number;
  isActual: boolean;
  isTransitionYear: boolean;
  isInitialStrategyYear: boolean;
  strategyStartYear: number;
  initialFundingSource: InitialFundingSource;
  initialEquitySourceAccount: InitialEquityAccount;
  initialStagedAmount: number;
  totalPortfolio: number;
  transitionWorkingMonths?: number;
  transitionPostRetirementMonths?: number;
  transitionExpense?: number;
  bucket1: Bucket1State;
  bucket2: Bucket2State;
  bucket3: Bucket3State;
  actions: BucketActionItem[];
}

/**
 * Computes working months vs post-retirement months in a given year.
 */
export function getPostRetirementMonthsInYear(
  year: number,
  inputs: AppStateInputs
): { workingMonths: number; postRetirementMonths: number; retireMonthName: string } {
  const simStartYear = getSimulationStartYear(inputs);
  const yearOffset = year - simStartYear;
  const yearStartMonthIdx = yearOffset * 12;

  const yourBirthYear = parseInt(inputs.you.birthDate?.split('-')[0] || '1960', 10);
  const yourBirthMonth = Math.max(0, parseInt(inputs.you.birthDate?.split('-')[1] || '1', 10) - 1);
  const youRetireAge = inputs.you.plannedRetirementAge ?? 65;
  const youRetireMonth =
    inputs.you.plannedRetirementMonth != null
      ? inputs.you.plannedRetirementMonth - 1
      : yourBirthMonth;

  const yourRetireMonthIdx = (yourBirthYear + youRetireAge - simStartYear) * 12 + youRetireMonth;
  const hasSalary = (inputs.you.activeSalary ?? 0) > 0;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const retireMonthName = monthNames[Math.min(11, Math.max(0, youRetireMonth))] || 'Oct';

  if (!hasSalary) {
    return { workingMonths: 0, postRetirementMonths: 12, retireMonthName };
  }

  const workingMonths = Math.max(0, Math.min(12, yourRetireMonthIdx - yearStartMonthIdx));
  const postRetirementMonths = Math.max(0, 12 - workingMonths);

  return { workingMonths, postRetirementMonths, retireMonthName };
}

/**
 * Calculates the 3-Bucket state and actionable recommendations for a given year.
 */
export function calculateBucketYearState(
  selectedYear: number,
  ledgerRow: SimulationResultRow | undefined,
  inputs: AppStateInputs,
  bucketSettings: BucketStrategySettings,
  fullLedger?: SimulationResultRow[]
): BucketYearCalculation {
  const cashCfg = bucketSettings.cash;
  const incomeCfg = bucketSettings.income;
  const growthCfg = bucketSettings.growth;

  const simStartYear = getSimulationStartYear(inputs);
  const strategyStartYear = bucketSettings.strategyStartYear || simStartYear;
  const isTransitionYear = selectedYear < strategyStartYear;
  const isInitialStrategyYear = selectedYear === strategyStartYear;

  const initialFundingSource = bucketSettings.initialFundingSource || 'cash-savings';
  const initialEquitySourceAccount = bucketSettings.initialEquitySourceAccount || 'taxable';

  // Resolve balances from ledgerRow or inputs fallback
  const isActual = !!ledgerRow?.isActual;
  const taxableBalance =
    ledgerRow !== undefined
      ? (ledgerRow.endYourTaxableBrokerage || 0) +
        (ledgerRow.endWifeTaxableBrokerage || 0) +
        (ledgerRow.endYourCash || 0) +
        (ledgerRow.endWifeCash || 0)
      : (inputs.portfolio.yourTaxableBrokerage || 0) +
        (inputs.portfolio.wifeTaxableBrokerage || 0) +
        (inputs.portfolio.yourCash || 0) +
        (inputs.portfolio.wifeCash || 0);

  const preTaxBalance =
    ledgerRow !== undefined
      ? (ledgerRow.endYourPreTaxIRA || 0) + (ledgerRow.endWifePreTaxIRA || 0)
      : (inputs.portfolio.yourPreTaxIRA || 0) + (inputs.portfolio.wifePreTaxIRA || 0);

  const rothBalance =
    ledgerRow !== undefined
      ? (ledgerRow.endYourRothIRA || 0) + (ledgerRow.endWifeRothIRA || 0)
      : (inputs.portfolio.yourRothIRA || 0) + (inputs.portfolio.wifeRothIRA || 0);

  const totalPortfolio = taxableBalance + preTaxBalance + rothBalance;

  // 1. Calculate Bucket 1 (Cash / Taxable Brokerage)
  const annualLivingExpense = ledgerRow?.livingExpenses || inputs.annualLivingExpenses || 100000;
  
  const targetLivingReserve =
    cashCfg.customLivingReserveAmount !== null && cashCfg.customLivingReserveAmount !== undefined && cashCfg.customLivingReserveAmount > 0
      ? cashCfg.customLivingReserveAmount
      : (annualLivingExpense * (cashCfg.targetRunwayMonths || 24)) / 12;

  // Calculate Roth Tax Reserve
  let targetRothTaxReserve = 0;
  const rothConversionAmount =
    ledgerRow?.intentionalRothConversion !== undefined
      ? ledgerRow.intentionalRothConversion
      : inputs.annualRothConversion || 0;

  if (cashCfg.rothTaxReserveMode === 'manual' && cashCfg.customRothTaxReserveAmount) {
    targetRothTaxReserve = cashCfg.customRothTaxReserveAmount;
  } else if (rothConversionAmount > 0) {
    // Estimate effective tax rate for conversion
    const effectiveTaxRate =
      ledgerRow && ledgerRow.taxableIncome > 0
        ? Math.min(0.35, Math.max(0.12, ledgerRow.totalIncomeTax / ledgerRow.taxableIncome))
        : 0.22;
    targetRothTaxReserve = rothConversionAmount * effectiveTaxRate;
  }

  const totalTargetReserve = targetLivingReserve + targetRothTaxReserve;

  const initialStagedAmount =
    bucketSettings.initialStagedAmount !== null && bucketSettings.initialStagedAmount !== undefined && bucketSettings.initialStagedAmount > 0
      ? bucketSettings.initialStagedAmount
      : totalTargetReserve;
  
  // Cash reserve in Taxable Brokerage
  const cashReserve = Math.min(taxableBalance, totalTargetReserve);
  const coreEquities = Math.max(0, taxableBalance - cashReserve);
  
  const fillPercentage = totalTargetReserve > 0 ? Math.min(100, Math.round((cashReserve / totalTargetReserve) * 100)) : 100;
  const runwayMonths = annualLivingExpense > 0 ? Math.round((taxableBalance / (annualLivingExpense / 12)) * 10) / 10 : 0;
  
  let status: 'healthy' | 'caution' | 'critical' = 'healthy';
  if (runwayMonths < 12) {
    status = 'critical';
  } else if (runwayMonths < cashCfg.targetRunwayMonths) {
    status = 'caution';
  }

  const externalCheckingMonthlyAmount =
    cashCfg.customMonthlyTransferAmount && cashCfg.customMonthlyTransferAmount > 0
      ? cashCfg.customMonthlyTransferAmount
      : annualLivingExpense / 12;

  // Helper to lookup or project inflation-adjusted living expenses for a target maturity year
  const getTargetYearLivingExpense = (targetYear: number): number => {
    if (fullLedger && fullLedger.length > 0) {
      const match = fullLedger.find((r) => r.year === targetYear);
      if (match && match.livingExpenses > 0) {
        return match.livingExpenses;
      }
    }
    const inflationRate = inputs.growthAssumptions?.cpiInflationRate ?? 0.025;
    const yearsAhead = Math.max(0, targetYear - selectedYear);
    return annualLivingExpense * Math.pow(1 + inflationRate, yearsAhead);
  };

  // 2. Calculate Bucket 2 (Income / Pre-Tax IRA Bond Ladder)
  const rungsCount = incomeCfg.rungsCount || 5;

  const rungs: CalculatedRung[] = [];
  let maturingPrincipalThisYear = 0;

  for (let i = 1; i <= rungsCount; i++) {
    // In transition years or the initial strategy launch year, Rung 1 matures in (strategyStartYear + 1)
    // because the initial year (strategyStartYear) is funded by the staged cash reserve.
    // In steady-state years (selectedYear > strategyStartYear), Rung 1 matures in selectedYear.
    const targetRungYear =
      selectedYear <= strategyStartYear
        ? strategyStartYear + i
        : selectedYear + (i - 1);

    const rungHoldings = (incomeCfg.holdings || []).filter((h) => h.rungNumber === i || h.targetYear === targetRungYear);

    // Each rung replaces 1 year of living expenses at targetRungYear, adjusted for inflation
    const inflationAdjustedTarget = getTargetYearLivingExpense(targetRungYear);

    let rungPrincipal =
      incomeCfg.targetRungFundingMode === 'custom' && incomeCfg.customRungAmount && incomeCfg.customRungAmount > 0
        ? incomeCfg.customRungAmount
        : inflationAdjustedTarget;

    let rungYield = incomeCfg.defaultYieldRate || 0.04;

    if (rungHoldings.length > 0) {
      rungPrincipal = rungHoldings.reduce((sum, h) => sum + (h.principal || 0), 0);
      const totalWeightedYield = rungHoldings.reduce((sum, h) => sum + (h.principal || 0) * (h.couponRate || 0), 0);
      rungYield = rungPrincipal > 0 ? totalWeightedYield / rungPrincipal : rungYield;
    }

    // A rung matures in the selectedYear only if the strategy is past its launch year and it is Rung 1
    const isMaturingThisYear = !isTransitionYear && !isInitialStrategyYear && i === 1;
    if (isMaturingThisYear) {
      maturingPrincipalThisYear = rungPrincipal;
    }

    rungs.push({
      rungNumber: i,
      targetYear: targetRungYear,
      principal: rungPrincipal,
      yieldRate: rungYield,
      annualIncome: rungPrincipal * rungYield,
      isMatured: false,
      isMaturingThisYear,
      holdings: rungHoldings,
    });
  }

  const bondLadderTotal = rungs.reduce((sum, r) => sum + r.principal, 0);
  const cappedBondLadderTotal = Math.min(preTaxBalance, bondLadderTotal);
  const equitiesTotal = Math.max(0, preTaxBalance - cappedBondLadderTotal);
  
  const rebuildTargetYear =
    selectedYear <= strategyStartYear
      ? strategyStartYear + rungsCount
      : selectedYear + (rungsCount - 1) + 1;

  const rebuildTargetAmount =
    incomeCfg.targetRungFundingMode === 'custom' && incomeCfg.customRungAmount && incomeCfg.customRungAmount > 0
      ? incomeCfg.customRungAmount
      : getTargetYearLivingExpense(rebuildTargetYear);

  const ladderRunwayYears = annualLivingExpense > 0 ? Math.round((cappedBondLadderTotal / annualLivingExpense) * 10) / 10 : 0;

  // 3. Calculate Bucket 3 (Growth / Roth IRA)
  const rothInflowThisYear = rothConversionAmount;
  const unencumberedHorizonYears = growthCfg.unencumberedHorizonYears || 8;

  // 4. Generate Action Items for the active year
  const rawActions: BucketActionItem[] = [];

  let transitionWorkingMonths = 0;
  let transitionPostRetirementMonths = 12;
  let transitionExpense = annualLivingExpense;

  if (isTransitionYear) {
    const retirementInfo = getPostRetirementMonthsInYear(selectedYear, inputs);
    transitionWorkingMonths = retirementInfo.workingMonths;
    transitionPostRetirementMonths = retirementInfo.postRetirementMonths;
    transitionExpense =
      transitionPostRetirementMonths > 0
        ? Math.round((annualLivingExpense * transitionPostRetirementMonths) / 12)
        : 0;

    const monthRangeText =
      transitionPostRetirementMonths === 12
        ? 'Full Year'
        : transitionPostRetirementMonths > 0
        ? `${retirementInfo.retireMonthName}–Dec (${transitionPostRetirementMonths} mo)`
        : '0 mo (worked full year)';

    // Transition year prior to systematic strategy launch: only post-retirement months are funded from savings
    rawActions.push({
      id: `transition-funding-${selectedYear}`,
      year: selectedYear,
      type: 'external-checking-transfer',
      title: `Transition Funding: Post-Retirement Living Expenses ($${transitionExpense.toLocaleString()})`,
      description: `Year ${selectedYear} is a pre-retirement / transition year. Post-retirement living expenses for ${monthRangeText} are funded from staged work savings after active salary ceases, without liquidating bond ladder rungs.`,
      amount: transitionExpense,
      sourceBucket: 'none',
      destBucket: 'checking',
      status: 'completed',
    });

    const runwayMo = cashCfg.targetRunwayMonths || 24;
    const livingItemization = `living expenses reserve of $${Math.round(targetLivingReserve).toLocaleString()} (${runwayMo} mo @ $${Math.round(annualLivingExpense).toLocaleString()}/yr)`;
    const rothTaxItemization = targetRothTaxReserve > 0 ? ` + estimated Roth conversion tax reserve of $${Math.round(targetRothTaxReserve).toLocaleString()}` : '';
    const itemizedBreakdown = `Itemization: covers ${livingItemization}${rothTaxItemization}.`;

    rawActions.push({
      id: `stage-initial-reserve-${strategyStartYear}`,
      year: selectedYear,
      type: 'ladder-rebuild',
      title: `Stage Initial Year 1 (${strategyStartYear}) Reserve ($${Math.round(initialStagedAmount).toLocaleString()})`,
      description: `Stage $${Math.round(initialStagedAmount).toLocaleString()} into Bucket 1 Cash from ${
        initialFundingSource === 'cash-savings'
          ? 'Cash Savings / Active Work Buffer'
          : `Selling Equities in ${initialEquitySourceAccount === 'taxable' ? 'Taxable Brokerage' : initialEquitySourceAccount === 'pre-tax' ? 'Pre-Tax IRA' : 'Roth IRA'}`
      } to prepare for strategy launch on Jan 1, ${strategyStartYear}. ${itemizedBreakdown}`,
      amount: initialStagedAmount,
      sourceBucket: initialFundingSource === 'cash-savings' ? 1 : initialEquitySourceAccount === 'taxable' ? 1 : initialEquitySourceAccount === 'pre-tax' ? 2 : 3,
      destBucket: 1,
      status: 'pending',
    });
  } else {
    // Strategy is actively running in selectedYear

    // If Year 1 of strategy, include initial staged funding item with itemized breakdown
    if (isInitialStrategyYear) {
      const runwayMo = cashCfg.targetRunwayMonths || 24;
      const livingItemization = `living expenses of $${Math.round(annualLivingExpense).toLocaleString()}/yr (${runwayMo} mo target reserve: $${Math.round(targetLivingReserve).toLocaleString()})`;
      const rothTaxItemization = targetRothTaxReserve > 0 ? ` + Roth conversion tax reserve of $${Math.round(targetRothTaxReserve).toLocaleString()}` : '';
      const itemizedBreakdown = `Itemization: covers ${livingItemization}${rothTaxItemization}.`;

      rawActions.push({
        id: `initial-launch-staged-${selectedYear}`,
        year: selectedYear,
        type: 'external-checking-transfer',
        title: `Strategy Launch: Initial Staged Cash (${initialFundingSource === 'cash-savings' ? 'Cash Savings' : 'Equity Liquidation'})`,
        description: `Strategy active as of Jan 1, ${selectedYear}. Bucket 1 initialized with $${Math.round(initialStagedAmount).toLocaleString()} staged reserve. ${itemizedBreakdown}`,
        amount: initialStagedAmount,
        sourceBucket: 1,
        destBucket: 1,
        status: 'completed',
      });
    }

    // Action 1: Maturing rung distribution
    if (maturingPrincipalThisYear > 0) {
      rawActions.push({
        id: `rung-maturity-${selectedYear}`,
        year: selectedYear,
        type: 'rung-maturity-distribute',
        title: `Distribute Matured Rung 1 ($${Math.round(maturingPrincipalThisYear).toLocaleString()})`,
        description: `Rung 1 matures in ${selectedYear}. Execute taxable IRA distribution to refill Bucket 1 (Taxable Cash).`,
        amount: maturingPrincipalThisYear,
        sourceBucket: 2,
        destBucket: 1,
        status: 'pending',
      });
    }

    // Action 2: Periodic checking transfer
    rawActions.push({
      id: `checking-transfer-${selectedYear}`,
      year: selectedYear,
      type: 'external-checking-transfer',
      title: `Transfer Living Expenses to External Bank ($${Math.round(annualLivingExpense).toLocaleString()}/yr)`,
      description: `Disburse $${Math.round(externalCheckingMonthlyAmount).toLocaleString()}/month from Bucket 1 (Taxable Cash) to personal checking account.`,
      amount: annualLivingExpense,
      sourceBucket: 1,
      destBucket: 'checking',
      status: 'pending',
    });

    // Action 3: Roth Conversion Tax Payment
    if (targetRothTaxReserve > 0) {
      rawActions.push({
        id: `roth-tax-payment-${selectedYear}`,
        year: selectedYear,
        type: 'roth-tax-payment',
        title: `Pay Roth Conversion Taxes ($${Math.round(targetRothTaxReserve).toLocaleString()})`,
        description: `Pay estimated tax liability on $${Math.round(rothConversionAmount).toLocaleString()} Roth conversion from Bucket 1 tax reserve.`,
        amount: targetRothTaxReserve,
        sourceBucket: 1,
        destBucket: 'tax-authority',
        status: 'pending',
      });
    }

    // Action 4: Ladder Rebuild Action
    if (incomeCfg.rebuildMode === 'active') {
      rawActions.push({
        id: `ladder-rebuild-${selectedYear}`,
        year: selectedYear,
        type: 'ladder-rebuild',
        title: `Rebuild Year ${rungsCount} Rung ($${Math.round(rebuildTargetAmount).toLocaleString()})`,
        description: `Sell $${Math.round(rebuildTargetAmount).toLocaleString()} of equities/funds within Pre-Tax IRA to buy new far-end ${selectedYear + rungsCount - 1} bond rung.`,
        amount: rebuildTargetAmount,
        sourceBucket: 2,
        destBucket: 2,
        status: 'pending',
      });
    }

    // Action 5: Roth Conversion Execution
    if (rothConversionAmount > 0) {
      rawActions.push({
        id: `roth-conversion-${selectedYear}`,
        year: selectedYear,
        type: 'roth-conversion',
        title: `Execute Roth Conversion ($${Math.round(rothConversionAmount).toLocaleString()})`,
        description: `Convert $${Math.round(rothConversionAmount).toLocaleString()} from Pre-Tax IRA (Bucket 2) to Roth IRA (Bucket 3).`,
        amount: rothConversionAmount,
        sourceBucket: 2,
        destBucket: 3,
        status: 'pending',
      });
    }
  }

  // Merge with any persisted action statuses in actionLedger
  const persistedYearActions = bucketSettings.actionLedger?.[selectedYear] || [];
  const mergedActions = rawActions.map((action) => {
    const persisted = persistedYearActions.find((p) => p.id === action.id);
    if (persisted) {
      return {
        ...action,
        status: persisted.status,
        completedDate: persisted.completedDate,
      };
    }
    return action;
  });

  return {
    year: selectedYear,
    isActual,
    isTransitionYear,
    isInitialStrategyYear,
    strategyStartYear,
    initialFundingSource,
    initialEquitySourceAccount,
    initialStagedAmount,
    totalPortfolio,
    transitionWorkingMonths,
    transitionPostRetirementMonths,
    transitionExpense,
    bucket1: {
      totalBalance: taxableBalance,
      cashReserve,
      coreEquities,
      targetLivingReserve,
      annualLivingExpense,
      targetRothTaxReserve,
      totalTargetReserve,
      fillPercentage,
      runwayMonths,
      status,
      externalCheckingMonthlyAmount,
    },
    bucket2: {
      totalBalance: preTaxBalance,
      bondLadderTotal: cappedBondLadderTotal,
      equitiesTotal,
      rungs,
      rebuildMode: incomeCfg.rebuildMode,
      rebuildTargetAmount,
      ladderRunwayYears,
      maturingPrincipalThisYear,
    },
    bucket3: {
      totalBalance: rothBalance,
      equityPercentage: growthCfg.targetEquityPercentage || 1.0,
      rothInflowThisYear,
      unencumberedHorizonYears,
    },
    actions: mergedActions,
  };
}

/**
 * Generates multi-year 3-bucket projections across all years in the simulation ledger.
 */
export function generateBucketMultiYearProjection(
  ledger: SimulationResultRow[],
  inputs: AppStateInputs,
  bucketSettings: BucketStrategySettings
): BucketYearCalculation[] {
  if (!ledger || ledger.length === 0) {
    const baseYear = inputs.simulationStartYear || new Date().getFullYear();
    return [calculateBucketYearState(baseYear, undefined, inputs, bucketSettings, ledger)];
  }

  return ledger.map((row) => calculateBucketYearState(row.year, row, inputs, bucketSettings, ledger));
}
