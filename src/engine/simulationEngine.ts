import { AppStateInputs, SimulationResultRow, LockedReturnSequence } from '../types';
import {
  BASE_MEDICARE_PART_B,
  BASE_MEDICARE_PART_D,
  FED_BRACKETS_MFJ,
  FED_BRACKETS_SINGLE,
  FED_STANDARD_DEDUCTION_MFJ,
  FED_STANDARD_DEDUCTION_SINGLE,
  IRMAA_TIERS_MFJ,
  IRMAA_TIERS_SINGLE,
  getIRSUniformLifetimeFactor,
  MD_GRADUATED_TIERS_MFJ,
  MD_GRADUATED_TIERS_SINGLE,
  MD_PIGGYBACK_RATE,
} from './taxRates2026';

// Helper to calculate Social Security benefit based on claiming age
export function calculateSSBenefit(pia: number, claimingAge: number): number {
  const FRA = 67;
  if (claimingAge < 62) claimingAge = 62;
  if (claimingAge > 70) claimingAge = 70;

  if (claimingAge < FRA) {
    // 5/9 of 1% per month for first 36 months before FRA
    // 5/12 of 1% per month for any additional months
    const totalMonthsBefore = (FRA - claimingAge) * 12;
    const first36Months = Math.min(totalMonthsBefore, 36);
    const additionalMonths = Math.max(0, totalMonthsBefore - 36);

    const first36Reduction = first36Months * (5 / 900);
    const additionalReduction = additionalMonths * (5 / 1200);
    const totalReduction = first36Reduction + additionalReduction;

    return pia * (1 - totalReduction);
  } else if (claimingAge > FRA) {
    // Delayed retirement credits: 2/3 of 1% per month (8% per year)
    const yearsAfter = claimingAge - FRA;
    const credit = yearsAfter * 0.08;
    return pia * (1 + credit);
  } else {
    return pia;
  }
}

// Calculate Social Security Taxability based on Provisional Income
export function calculateTaxableSS(
  totalSS: number,
  otherAGI: number,
  isSingle: boolean
): number {
  if (totalSS <= 0) return 0;
  
  // Provisional Income = AGI (excluding SS) + Tax-Exempt Interest + 50% of SS
  const provisionalIncome = otherAGI + (totalSS * 0.5);
  
  let taxableSS = 0;
  if (isSingle) {
    if (provisionalIncome <= 25000) {
      taxableSS = 0;
    } else if (provisionalIncome <= 34000) {
      taxableSS = Math.min(0.5 * totalSS, 0.5 * (provisionalIncome - 25000));
    } else {
      const base = Math.min(4500, 0.5 * Math.min(totalSS, 9000));
      taxableSS = Math.min(0.85 * totalSS, base + 0.85 * (provisionalIncome - 34000));
    }
  } else {
    // Married Filing Jointly
    if (provisionalIncome <= 32000) {
      taxableSS = 0;
    } else if (provisionalIncome <= 44000) {
      taxableSS = Math.min(0.5 * totalSS, 0.5 * (provisionalIncome - 32000));
    } else {
      const base = Math.min(6000, 0.5 * Math.min(totalSS, 12000));
      taxableSS = Math.min(0.85 * totalSS, base + 0.85 * (provisionalIncome - 44000));
    }
  }
  return Math.max(0, taxableSS);
}

// Helper to compute Federal Income Tax
export function calculateFedTax(
  taxableIncome: number,
  isSingle: boolean,
  cpiFactor: number
): number {
  if (taxableIncome <= 0) return 0;
  
  const brackets = isSingle ? FED_BRACKETS_SINGLE : FED_BRACKETS_MFJ;
  let tax = 0;
  let previousLimit = 0;
  
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
    // Inflate the bracket limit
    const inflatedLimit = bracket.limit === Infinity ? Infinity : bracket.limit * cpiFactor;
    
    if (taxableIncome > inflatedLimit) {
      tax += (inflatedLimit - previousLimit) * bracket.rate;
      previousLimit = inflatedLimit;
    } else {
      tax += (taxableIncome - previousLimit) * bracket.rate;
      break;
    }
  }
  
  return tax;
}

// Helper to compute Maryland State Tax
export function calculateMDStateTax(
  fedAGI: number,
  taxableSS: number,
  isSingle: boolean
): number {
  // MD Standard Deduction: 15% of AGI
  // For single: min $1,700, max $2,550
  // For MFJ: min $3,450, max $5,150
  const stdDeductionRate = 0.15 * fedAGI;
  let stdDeduction = 0;
  if (isSingle) {
    stdDeduction = Math.min(Math.max(stdDeductionRate, 1700), 2550);
  } else {
    stdDeduction = Math.min(Math.max(stdDeductionRate, 3450), 5150);
  }
  
  // MD taxable income starts from Fed AGI, subtracts MD standard deduction and 100% of taxable Social Security
  let mdTaxableIncome = fedAGI - stdDeduction - taxableSS;
  if (mdTaxableIncome <= 0) return 0;
  
  const tiers = isSingle ? MD_GRADUATED_TIERS_SINGLE : MD_GRADUATED_TIERS_MFJ;
  let stateTax = 0;
  let previousLimit = 0;
  
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (mdTaxableIncome > tier.limit) {
      stateTax += (tier.limit - previousLimit) * tier.rate;
      previousLimit = tier.limit;
    } else {
      stateTax += (mdTaxableIncome - previousLimit) * tier.rate;
      break;
    }
  }
  
  // Add local piggyback flat tax rate
  const piggybackTax = mdTaxableIncome * MD_PIGGYBACK_RATE;
  return stateTax + piggybackTax;
}

// Full multi-decade simulation runner
export function runRetirementSimulation(
  inputs: AppStateInputs,
  simulateSurvivor: boolean = false,
  overrideSequence?: LockedReturnSequence | null
): SimulationResultRow[] {
  if (!inputs.isConfigured) {
    return []; // Bypass calculations if not configured
  }

  const ledger: SimulationResultRow[] = [];
  
  // Initial portfolio balances
  let yourPreTax = inputs.portfolio.yourPreTaxIRA || 0;
  let yourRoth = inputs.portfolio.yourRothIRA || 0;
  let yourTaxable = inputs.portfolio.yourTaxableBrokerage || 0;
  let yourBasis = inputs.portfolio.yourTaxableBasis || 0;
  
  let wifePreTax = inputs.isSingleFiler ? 0 : (inputs.portfolio.wifePreTaxIRA || 0);
  let wifeRoth = inputs.isSingleFiler ? 0 : (inputs.portfolio.wifeRothIRA || 0);
  let wifeTaxable = inputs.isSingleFiler ? 0 : (inputs.portfolio.wifeTaxableBrokerage || 0);
  let wifeBasis = inputs.isSingleFiler ? 0 : (inputs.portfolio.wifeTaxableBasis || 0);
  
  // Actuarial death year definition for survivor mode:
  // Primary user (born 1960) passes away in 2045 (turning age 85)
  const DEATH_YEAR = 2045;
  
  // Check if a stochastic sequence of returns is active
  const activeSeq = overrideSequence !== undefined ? overrideSequence : inputs.lockedReturnSequence;

  // Let's run year-by-year from 2026 to 2060
  for (let year = 2026; year <= 2060; year++) {
    const yearsElapsed = year - 2026;
    
    // Inflation factors
    const cpiFactor = Math.pow(1 + inputs.growthAssumptions.cpiInflationRate, yearsElapsed);
    const healthcareFactor = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, yearsElapsed);
    
    // Growth rates by account type (Equities vs Fixed Income allocation)
    let equityRate = inputs.growthAssumptions.equityReturnRate;
    let bondRate = inputs.growthAssumptions.fixedIncomeReturnRate;
    
    if (activeSeq) {
      equityRate = activeSeq.equityReturns[yearsElapsed] !== undefined ? activeSeq.equityReturns[yearsElapsed] : equityRate;
      bondRate = activeSeq.fixedIncomeReturns[yearsElapsed] !== undefined ? activeSeq.fixedIncomeReturns[yearsElapsed] : bondRate;
    }

    const taxableGrowthRate = 0.60 * equityRate + 0.40 * bondRate;
    const preTaxGrowthRate = 0.50 * equityRate + 0.50 * bondRate;
    const rothGrowthRate = 1.00 * equityRate;

    
    // Spouse ages in this calendar year
    const yourAge = year - 1960;
    const wifeAge = year - 1964;

    // Active Salaries pre-retirement calculations
    let yourSalary = 0;
    let wifeSalary = 0;
    
    if (!(simulateSurvivor && (year >= DEATH_YEAR))) {
      const youRetireAge = inputs.you.plannedRetirementAge ?? 67;
      if (yourAge < youRetireAge) {
        const baseSalary = inputs.you.activeSalary ?? 0;
        yourSalary = baseSalary * cpiFactor;
      }
    }
    
    const wifeRetireAge = inputs.isSingleFiler ? 0 : (inputs.wife.plannedRetirementAge ?? 65);
    if (!inputs.isSingleFiler && wifeAge < wifeRetireAge) {
      const baseSalary = inputs.wife.activeSalary ?? 0;
      wifeSalary = baseSalary * cpiFactor;
    }
    
    const activeSalaryInflow = yourSalary + wifeSalary;
    
    // Survivor state determination
    const isSurvivorActive = simulateSurvivor && (year >= DEATH_YEAR);
    const youDeceased = isSurvivorActive;
    
    // If You are deceased, Your traditional Pre-Tax IRA is inherited by Wife and merged into her Pre-Tax IRA.
    // Let's do this merge at the start of the death year 2045.
    if (youDeceased && year === DEATH_YEAR) {
      wifePreTax += yourPreTax;
      yourPreTax = 0;
      
      wifeRoth += yourRoth;
      yourRoth = 0;
      
      wifeTaxable += yourTaxable;
      wifeBasis += yourBasis;
      yourTaxable = 0;
      yourBasis = 0;
    }
    
    // 1. Social Security calculations
    let yourSS = 0;
    let wifeSS = 0;
    
    if (!youDeceased) {
      if (inputs.you.targetSSClaimingAge && yourAge >= inputs.you.targetSSClaimingAge) {
        // Base SS inflated to current year
        const baseSS = calculateSSBenefit(inputs.you.estimatedPIA || 0, inputs.you.targetSSClaimingAge) * 12;
        yourSS = baseSS * cpiFactor;
      }
    }
    
    if (!inputs.isSingleFiler && inputs.wife.targetSSClaimingAge && wifeAge >= inputs.wife.targetSSClaimingAge) {
      const baseSS = calculateSSBenefit(inputs.wife.estimatedPIA || 0, inputs.wife.targetSSClaimingAge) * 12;
      wifeSS = baseSS * cpiFactor;
    }
    
    // Survivor Social Security benefit rules:
    // Surviving spouse inherits the larger of the two Social Security benefit streams, smaller is eliminated.
    if (youDeceased && !inputs.isSingleFiler) {
      const baseYourSS = calculateSSBenefit(inputs.you.estimatedPIA || 0, inputs.you.targetSSClaimingAge || 67) * 12 * cpiFactor;
      const baseWifeSS = calculateSSBenefit(inputs.wife.estimatedPIA || 0, inputs.wife.targetSSClaimingAge || 67) * 12 * cpiFactor;
      
      if (inputs.wife.targetSSClaimingAge && wifeAge >= inputs.wife.targetSSClaimingAge) {
        // If wife has claimed, she receives the maximum of her own or your SS benefit
        wifeSS = Math.max(baseYourSS, baseWifeSS);
      } else {
        // Wife hasn't claimed yet, but is eligible for survivor benefits (at or after 60).
        // Let's assume survivor claiming inherits your SS.
        wifeSS = baseYourSS;
      }
      yourSS = 0;
    }
    
    const combinedSS = yourSS + wifeSS;
    
    // 2. RMD calculations (Strictly starting at age 75)
    let yourRMD = 0;
    let wifeRMD = 0;
    
    if (!youDeceased && yourAge >= 75) {
      const factor = getIRSUniformLifetimeFactor(yourAge);
      if (factor > 0) yourRMD = yourPreTax / factor;
    }
    
    if (wifeAge >= 75) {
      const factor = getIRSUniformLifetimeFactor(wifeAge);
      if (factor > 0) wifeRMD = wifePreTax / factor;
    }
    
    const combinedRMD = yourRMD + wifeRMD;
    
    // Deduct forced RMDs from traditional balances immediately
    let yourPreTaxPostRMD = Math.max(0, yourPreTax - yourRMD);
    let wifePreTaxPostRMD = Math.max(0, wifePreTax - wifeRMD);
    
    // 3. Intentional Roth conversions (slider or strategy target controlled)
    // Only convert from traditional pre-tax balances if they exist and are greater than 0
    let yourConverted = 0;
    let wifeConverted = 0;
    
    const startYear = inputs.rothConversionStartYear !== undefined ? inputs.rothConversionStartYear : 2026;
    const endYear = inputs.rothConversionEndYear !== undefined ? inputs.rothConversionEndYear : 2035;
    
    let targetConversion = 0;
    
    if (inputs.rothConversionStrategy === 'fill-to-target' && inputs.rothConversionTargetValue !== null) {
      if (year >= startYear && year <= endYear) {
        const inflatedTarget = inputs.rothConversionTargetValue * cpiFactor;
        
        // Stack uncontrollable incomes first, then convert the remaining space up to the target fill limit.
        const uncontrollable = activeSalaryInflow + combinedSS + combinedRMD;
        targetConversion = Math.max(0, inflatedTarget - uncontrollable);
      }
    } else {
      // Flat strategy: base amount in the startYear, inflated for subsequent years
      if (year >= startYear && year <= endYear) {
        const conversionInflationFactor = Math.pow(1 + inputs.growthAssumptions.cpiInflationRate, year - startYear);
        targetConversion = inputs.annualRothConversion * conversionInflationFactor;
      } else {
        targetConversion = 0;
      }
    }
    
    if (targetConversion > 0) {
      if (isSurvivorActive || youDeceased) {
        wifeConverted = Math.min(targetConversion, wifePreTaxPostRMD);
        wifePreTaxPostRMD -= wifeConverted;
        wifeRoth += wifeConverted;
      } else {
        const halfTarget = targetConversion / 2;
        
        // Draw from husband Pre-Tax
        const husbandDrawn = Math.min(halfTarget, yourPreTaxPostRMD);
        yourConverted += husbandDrawn;
        yourPreTaxPostRMD -= husbandDrawn;
        yourRoth += husbandDrawn;
        
        // Draw from wife Pre-Tax
        const wifeDrawn = Math.min(halfTarget, wifePreTaxPostRMD);
        wifeConverted += wifeDrawn;
        wifePreTaxPostRMD -= wifeDrawn;
        wifeRoth += wifeDrawn;
        
        // Spousal remainder rollover: if one spouse ran out of pre-tax assets, draw the rest from the other
        const totalDrawn = husbandDrawn + wifeDrawn;
        const remainder = targetConversion - totalDrawn;
        if (remainder > 0.01) {
          if (yourPreTaxPostRMD > 0) {
            const extra = Math.min(remainder, yourPreTaxPostRMD);
            yourConverted += extra;
            yourPreTaxPostRMD -= extra;
            yourRoth += extra;
          } else if (wifePreTaxPostRMD > 0) {
            const extra = Math.min(remainder, wifePreTaxPostRMD);
            wifeConverted += extra;
            wifePreTaxPostRMD -= extra;
            wifeRoth += extra;
          }
        }
      }
    }
    
    const combinedRothConversion = yourConverted + wifeConverted;
    
    // 4. Medicare base premiums & lookback surcharges
    // Query ledger 2 years ago for MAGI
    let magiTwoYearsAgo = 0;
    const lookbackIndex = ledger.length - 2;
    if (lookbackIndex >= 0) {
      magiTwoYearsAgo = ledger[lookbackIndex].magi;
    } else {
      // Fallback: use first-year MAGI to establish immediate realistic surcharges
      // We will estimate the first year's baseline MAGI
      const estOtherAGI = combinedSS * 0.85 + combinedRMD + combinedRothConversion + activeSalaryInflow;
      magiTwoYearsAgo = estOtherAGI;
    }
    
    // Evaluate IRMAA surcharges based on lookback MAGI
    let yourPartBSurcharge = 0;
    let yourPartDSurcharge = 0;
    let wifePartBSurcharge = 0;
    let wifePartDSurcharge = 0;
    let surchargeTier = 0;
    
    const irmaaTiers = (isSurvivorActive || inputs.isSingleFiler) ? IRMAA_TIERS_SINGLE : IRMAA_TIERS_MFJ;
    
    // Identify surcharge tier by matching MAGI against inflated cliffs
    for (let i = irmaaTiers.length - 1; i >= 0; i--) {
      const prevTier = irmaaTiers[i - 1];
      let prevLimit = 0;
      if (prevTier) {
        prevLimit = prevTier.tierNumber < 4 ? prevTier.limit * cpiFactor : prevTier.limit;
      }
      
      if (magiTwoYearsAgo > prevLimit) {
        surchargeTier = irmaaTiers[i].tierNumber;
        // Inflate surcharges by healthcare inflation
        yourPartBSurcharge = irmaaTiers[i].partBSurcharge * healthcareFactor;
        yourPartDSurcharge = irmaaTiers[i].partDSurcharge * healthcareFactor;
        break;
      }
    }
    
    // Wife's Medicare transition: age 65 (attained in 2029)
    const isWifeOnMedicare = wifeAge >= 65;
    if (isWifeOnMedicare) {
      wifePartBSurcharge = yourPartBSurcharge;
      wifePartDSurcharge = yourPartDSurcharge;
    }
    
    if (youDeceased) {
      // You are deceased, no surcharge for You
      yourPartBSurcharge = 0;
      yourPartDSurcharge = 0;
    }
    
    const combinedSurchargeMonthly = yourPartBSurcharge + yourPartDSurcharge + wifePartBSurcharge + wifePartDSurcharge;
    const combinedSurchargeAnnual = combinedSurchargeMonthly * 12;
    
    // Medicare base premiums (Base Part B + Part D)
    let medicareBasePremiums = 0;
    // Primary user is always on Medicare in our 2026-2060 timeline (unless deceased)
    if (!youDeceased) {
      medicareBasePremiums += (BASE_MEDICARE_PART_B + BASE_MEDICARE_PART_D) * 12 * healthcareFactor;
    }
    // Wife is on Medicare from 2029 onwards
    if (isWifeOnMedicare) {
      medicareBasePremiums += (BASE_MEDICARE_PART_B + BASE_MEDICARE_PART_D) * 12 * healthcareFactor;
    }
    
    // Living expenses inflated
    const livingExpenses = (inputs.annualLivingExpenses ?? 120000) * cpiFactor;

    // Pre-Medicare healthcare premium calculations
    const youRetireAge = inputs.you.plannedRetirementAge ?? 67;
    const yourPreMedicareMonthly = inputs.you.preMedicareMonthlyPremium ?? 1000;
    const wifePreMedicareMonthly = inputs.wife.preMedicareMonthlyPremium ?? 1000;

    let yourPreMedicareAnnual = 0;
    if (yourAge < 65 && yourAge >= youRetireAge && !youDeceased) {
      yourPreMedicareAnnual = yourPreMedicareMonthly * 12 * healthcareFactor;
    }

    let wifePreMedicareAnnual = 0;
    if (wifeAge < 65 && (yourAge >= youRetireAge || youDeceased)) {
      wifePreMedicareAnnual = wifePreMedicareMonthly * 12 * healthcareFactor;
    }

    const combinedPreMedicarePremium = yourPreMedicareAnnual + wifePreMedicareAnnual;
    
    // 5. Drawdown and Tax Convergence Loop
    // Because tax bills depend on capital gains from drawdowns, we iterate to solve for taxes & drawdowns
    let drawdownTaxable = 0;
    let drawdownPreTax = 0;
    let drawdownRoth = 0;
    let capitalGainsTriggered = 0;
    let fedIncomeTax = 0;
    let stateIncomeTax = 0;
    
    let currentYourTaxable = yourTaxable;
    let currentYourBasis = yourBasis;
    let currentWifeTaxable = wifeTaxable;
    let currentWifeBasis = wifeBasis;
    let currentYourPreTax = yourPreTaxPostRMD;
    let currentWifePreTax = wifePreTaxPostRMD;
    let currentYourRoth = yourRoth;
    let currentWifeRoth = wifeRoth;
    
    // Convergence loop variables
    let totalTaxBill = 0;
    let lastTaxBill = -999999;
    let iterations = 0;
    
    while (Math.abs(totalTaxBill - lastTaxBill) > 1 && iterations < 15) {
      lastTaxBill = totalTaxBill;
      iterations++;
      
      // Reset values for this iteration
      drawdownTaxable = 0;
      drawdownPreTax = 0;
      drawdownRoth = 0;
      capitalGainsTriggered = 0;
      
      currentYourTaxable = yourTaxable;
      currentYourBasis = yourBasis;
      currentWifeTaxable = wifeTaxable;
      currentWifeBasis = wifeBasis;
      currentYourPreTax = yourPreTaxPostRMD;
      currentWifePreTax = wifePreTaxPostRMD;
      currentYourRoth = yourRoth;
      currentWifeRoth = wifeRoth;
      
      // Calculate current federal/state taxes based on:
      // SS taxable portion, forced RMD, capital gains, traditional Roth conversions, and any traditional draws
      
      // Let's solve the current drawdown deficit
      // Outflows: Living Expenses + Base Medicare + Medicare Surcharges + Pre-Medicare Premiums + Current estimated Tax Bill
      const totalOutflows = livingExpenses + medicareBasePremiums + combinedSurchargeAnnual + combinedPreMedicarePremium + totalTaxBill;
      
      // Inflow: Social Security (forced inflows) + forced RMD (forced inflows) + Active Salary (forced pre-retirement inflows)
      const baseInflows = combinedSS + combinedRMD + activeSalaryInflow;
      
      let deficit = totalOutflows - baseInflows;
      
      if (deficit > 0) {
        // Draw from Taxable Brokerages first
        // Draw from You first, then Wife
        if (!youDeceased && currentYourTaxable > 0) {
          const draw = Math.min(deficit, currentYourTaxable);
          const basisRatio = currentYourTaxable > 0 ? (currentYourBasis / currentYourTaxable) : 0;
          const gainPortion = draw * (1 - basisRatio);
          
          capitalGainsTriggered += Math.max(0, gainPortion);
          drawdownTaxable += draw;
          deficit -= draw;
          
          currentYourTaxable -= draw;
          currentYourBasis -= draw * basisRatio;
        }
        
        if (deficit > 0 && currentWifeTaxable > 0) {
          const draw = Math.min(deficit, currentWifeTaxable);
          const basisRatio = currentWifeTaxable > 0 ? (currentWifeBasis / currentWifeTaxable) : 0;
          const gainPortion = draw * (1 - basisRatio);
          
          capitalGainsTriggered += Math.max(0, gainPortion);
          drawdownTaxable += draw;
          deficit -= draw;
          
          currentWifeTaxable -= draw;
          currentWifeBasis -= draw * basisRatio;
        }
      }
      
      if (deficit > 0) {
        // Draw from Traditional Pre-Tax IRAs second
        // Traditional draws are 100% taxable!
        // We draw from You first, then Wife
        if (!youDeceased && currentYourPreTax > 0) {
          const draw = Math.min(deficit, currentYourPreTax);
          drawdownPreTax += draw;
          deficit -= draw;
          currentYourPreTax -= draw;
        }
        
        if (deficit > 0 && currentWifePreTax > 0) {
          const draw = Math.min(deficit, currentWifePreTax);
          drawdownPreTax += draw;
          deficit -= draw;
          currentWifePreTax -= draw;
        }
      }
      
      if (deficit > 0) {
        // Draw from Roth last (tax-free)
        if (!youDeceased && currentYourRoth > 0) {
          const draw = Math.min(deficit, currentYourRoth);
          drawdownRoth += draw;
          deficit -= draw;
          currentYourRoth -= draw;
        }
        
        if (deficit > 0 && currentWifeRoth > 0) {
          const draw = Math.min(deficit, currentWifeRoth);
          drawdownRoth += draw;
          deficit -= draw;
          currentWifeRoth -= draw;
        }
      }
      
      // Calculate federal and state taxes for this iteration
      // Federal AGI
      const totalTaxablePreTaxDraw = combinedRMD + combinedRothConversion + drawdownPreTax;
      
      // SS Taxability based on AGI excluding SS + 50% of SS
      // Other AGI includes traditional withdrawals, RMD, capital gains, conversions, active salaries
      const isSingle = isSurvivorActive || inputs.isSingleFiler;
      const otherAGI = totalTaxablePreTaxDraw + capitalGainsTriggered + activeSalaryInflow;
      const taxableSS = calculateTaxableSS(combinedSS, otherAGI, isSingle);
      
      const fedAGI = otherAGI + taxableSS;
      
      // Federal Taxable Income
      const stdDeduction = isSingle
        ? FED_STANDARD_DEDUCTION_SINGLE * cpiFactor
        : FED_STANDARD_DEDUCTION_MFJ * cpiFactor;
        
      const fedTaxableIncome = Math.max(0, fedAGI - stdDeduction);
      
      // Federal Income Tax
      fedIncomeTax = calculateFedTax(fedTaxableIncome, isSingle, cpiFactor);
      
      // State Income Tax
      const isStateFL = (inputs.jurisdiction.relocationYear !== null && year >= inputs.jurisdiction.relocationYear)
        ? (inputs.jurisdiction.targetState === 'FL')
        : (inputs.jurisdiction.currentState === 'FL');
        
      if (isStateFL) {
        stateIncomeTax = 0;
      } else {
        // Maryland State Tax
        stateIncomeTax = calculateMDStateTax(fedAGI, taxableSS, isSingle);
      }
      
      totalTaxBill = fedIncomeTax + stateIncomeTax;
    }
    
    // Commit the ending balances and apply growth
    yourTaxable = Math.max(0, currentYourTaxable) * (1 + taxableGrowthRate);
    yourBasis = Math.max(0, currentYourBasis) * (1 + taxableGrowthRate * 0.20); // Basis scales up slightly slower as growth is capital appreciation
    yourPreTax = Math.max(0, currentYourPreTax) * (1 + preTaxGrowthRate);
    yourRoth = Math.max(0, currentYourRoth) * (1 + rothGrowthRate);
    
    wifeTaxable = Math.max(0, currentWifeTaxable) * (1 + taxableGrowthRate);
    wifeBasis = Math.max(0, currentWifeBasis) * (1 + taxableGrowthRate * 0.20);
    wifePreTax = Math.max(0, currentWifePreTax) * (1 + preTaxGrowthRate);
    wifeRoth = Math.max(0, currentWifeRoth) * (1 + rothGrowthRate);
    
    // Safety checks for negative balances
    if (yourTaxable < 0.01) { yourTaxable = 0; yourBasis = 0; }
    if (yourPreTax < 0.01) yourPreTax = 0;
    if (yourRoth < 0.01) yourRoth = 0;
    if (wifeTaxable < 0.01) { wifeTaxable = 0; wifeBasis = 0; }
    if (wifePreTax < 0.01) wifePreTax = 0;
    if (wifeRoth < 0.01) wifeRoth = 0;
    
    const totalPortfolioValue = yourTaxable + yourPreTax + yourRoth + wifeTaxable + wifePreTax + wifeRoth;
    
    // Compute total actual inflows, MAGI, and other ledger parameters
    const isSingle = isSurvivorActive || inputs.isSingleFiler;
    const finalOtherAGI = combinedRMD + combinedRothConversion + drawdownPreTax + capitalGainsTriggered + activeSalaryInflow;
    const finalTaxableSS = calculateTaxableSS(combinedSS, finalOtherAGI, isSingle);
    const finalFedAGI = finalOtherAGI + finalTaxableSS;
    
    // MAGI for IRMAA is Federal AGI + Tax-Exempt Interest. Since we don't have tax-exempt interest in the inputs, MAGI = AGI.
    const magi = finalFedAGI;
    
    const totalExpenses = livingExpenses + fedIncomeTax + stateIncomeTax + medicareBasePremiums + combinedSurchargeAnnual + combinedPreMedicarePremium;
    const incomeInflow = combinedSS + combinedRMD + activeSalaryInflow;
    const deficit = Math.max(0, totalExpenses - incomeInflow);
    
    ledger.push({
      year,
      yourAge,
      wifeAge,
      yourSS,
      wifeSS,
      yourRMD,
      wifeRMD,
      yourSalary,
      wifeSalary,
      capitalGainsTriggered,
      intentionalRothConversion: combinedRothConversion,
      otherTaxableIncome: drawdownPreTax,
      magi,
      fedAGI: finalFedAGI,
      standardDeduction: isSingle ? FED_STANDARD_DEDUCTION_SINGLE * cpiFactor : FED_STANDARD_DEDUCTION_MFJ * cpiFactor,
      taxableIncome: Math.max(0, finalFedAGI - (isSingle ? FED_STANDARD_DEDUCTION_SINGLE * cpiFactor : FED_STANDARD_DEDUCTION_MFJ * cpiFactor)),
      fedIncomeTax,
      stateIncomeTax,
      totalIncomeTax: fedIncomeTax + stateIncomeTax,
      magiTwoYearsAgo,
      surchargeTier,
      yourPartBSurcharge,
      yourPartDSurcharge,
      wifePartBSurcharge,
      wifePartDSurcharge,
      combinedSurchargeMonthly,
      combinedSurchargeAnnual,
      livingExpenses,
      medicareBasePremiums,
      preMedicareHealthcareCost: combinedPreMedicarePremium,
      totalExpenses,
      incomeInflow,
      deficit,
      drawdownTaxable,
      drawdownPreTax,
      drawdownRoth,
      endYourPreTaxIRA: yourPreTax,
      endYourRothIRA: yourRoth,
      endYourTaxableBrokerage: yourTaxable,
      endYourTaxableBasis: yourBasis,
      endWifePreTaxIRA: wifePreTax,
      endWifeRothIRA: wifeRoth,
      endWifeTaxableBrokerage: wifeTaxable,
      endWifeTaxableBasis: wifeBasis,
      totalPortfolioValue,
    });
  }
  
  return ledger;
}
