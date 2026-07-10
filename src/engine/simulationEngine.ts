import { AppStateInputs, SimulationResultRow, LockedReturnSequence, RECURRING_EXPENSE_ITEMS, ONE_TIME_EXPENSE_ITEMS } from '../types';
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

/**
 * Calculates the spousal benefit amount for the lower-earning spouse.
 * The spousal benefit is 50% of the primary earner's PIA, reduced if the
 * spouse claims before their own FRA. Critically, this uses the SPOUSAL
 * early-reduction schedule (slower than the worker schedule) and provides
 * NO delayed credits for claiming after FRA.
 *
 * Spousal early reduction schedule (months before own FRA = 67):
 *   First 36 months: 25/36 of 1% per month
 *   Additional months: 5/12 of 1% per month
 *   Maximum reduction at 62 (60 months before FRA): ~35%
 */
export function calculateSpousalBenefit(primaryPIA: number, spouseClaimingAge: number): number {
  if (primaryPIA <= 0) return 0;

  const FRA = 67;
  const baseSpousal = primaryPIA * 0.50;

  // Spousal benefit is NOT enhanced for delaying past FRA
  if (spouseClaimingAge >= FRA) {
    return baseSpousal;
  }

  // Apply spousal early-claim reduction (different schedule from worker benefit)
  const claimAge = Math.max(62, spouseClaimingAge);
  const totalMonthsBefore = (FRA - claimAge) * 12;
  const first36 = Math.min(totalMonthsBefore, 36);
  const additional = Math.max(0, totalMonthsBefore - 36);

  const reduction = (first36 * (25 / 3600)) + (additional * (5 / 1200));
  return baseSpousal * (1 - reduction);
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

function parseBirthYear(birthDateStr: string | undefined, fallback: number): number {
  if (!birthDateStr) return fallback;
  const match = birthDateStr.match(/^(\d{4})/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) {
      return parsed;
    }
  }
  return fallback;
}

// Full multi-decade simulation runner
export function runRetirementSimulation(
  inputs: AppStateInputs,
  simulateSurvivor: boolean = false,
  activeSequence?: LockedReturnSequence | null
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
  // Primary user passes away turning age 85
  const yourBirthYear = parseBirthYear(inputs.you.birthDate, 1960);
  const wifeBirthYear = parseBirthYear(inputs.wife.birthDate, 1964);
  const DEATH_YEAR = yourBirthYear + 85;
  
  // Check if a stochastic sequence of returns is active
  const activeSeq = activeSequence;

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
    const yourAge = year - yourBirthYear;
    const wifeAge = year - wifeBirthYear;

    const youRetireAge = inputs.you.plannedRetirementAge ?? 67;
    const wifeRetireAge = inputs.isSingleFiler ? 0 : (inputs.wife.plannedRetirementAge ?? 65);

    // Active Salaries pre-retirement calculations
    let yourSalary = 0;
    let wifeSalary = 0;
    
    if (!(simulateSurvivor && (year >= DEATH_YEAR))) {
      if (yourAge < youRetireAge) {
        const baseSalary = inputs.you.activeSalary ?? 0;
        yourSalary = baseSalary * cpiFactor;
      }
    }
    
    if (!inputs.isSingleFiler && wifeAge < wifeRetireAge) {
      const baseSalary = inputs.wife.activeSalary ?? 0;
      wifeSalary = baseSalary * cpiFactor;
    }
    
    const activeSalaryInflow = yourSalary + wifeSalary;

    // State determination
    const activeState = (inputs.jurisdiction.relocationYear !== null && year >= inputs.jurisdiction.relocationYear)
      ? inputs.jurisdiction.targetState
      : inputs.jurisdiction.currentState;

    // Survivor state determination
    const isSurvivorActive = simulateSurvivor && (year >= DEATH_YEAR);
    const youDeceased = isSurvivorActive;

    let baseLivingExpensesAnnual = inputs.annualLivingExpenses ?? 120000;
    let baseHealthExpensesPerPerson = 0;
    if (inputs.useDetailedExpenses && inputs.detailedExpenses) {
      let detailedSum = 0;
      let healthSum = 0;
      const stateExpenses = inputs.detailedExpenses[activeState];
      const freqs = inputs.detailedExpenses.frequencies;
      if (stateExpenses && freqs) {
        for (const item of RECURRING_EXPENSE_ITEMS) {
          const cost = stateExpenses[item.key] ?? 0;
          const freq = freqs[item.key] ?? item.defaultFrequency;
          if (item.category === 'Health') {
            healthSum += cost * freq;
          } else {
            detailedSum += cost * freq;
          }
        }
      }
      baseLivingExpensesAnnual = detailedSum;
      baseHealthExpensesPerPerson = healthSum;
    }

    // Determine healthcare costs and status for You
    const isYouWorking = yourAge < youRetireAge && !youDeceased;
    let yourPreMedicareAnnual = 0;
    let yourDetailedHealthAnnual = 0;

    if (!youDeceased) {
      if (!isYouWorking) {
        if (yourAge < 65) {
          const yourPreMedicareMonthly = inputs.you.preMedicareMonthlyPremium ?? 0;
          yourPreMedicareAnnual = yourPreMedicareMonthly * 12 * healthcareFactor;
        } else {
          yourDetailedHealthAnnual = baseHealthExpensesPerPerson;
        }
      }
    }

    // Determine healthcare costs and status for Wife
    const isWifeWorking = !inputs.isSingleFiler && wifeAge < wifeRetireAge;
    let wifePreMedicareAnnual = 0;
    let wifeDetailedHealthAnnual = 0;

    if (!inputs.isSingleFiler) {
      if (!isWifeWorking) {
        if (wifeAge < 65) {
          const wifePreMedicareMonthly = inputs.wife.preMedicareMonthlyPremium ?? 0;
          wifePreMedicareAnnual = wifePreMedicareMonthly * 12 * healthcareFactor;
        } else {
          wifeDetailedHealthAnnual = baseHealthExpensesPerPerson;
        }
      }
    }

    // Dynamic detailed health expenses (sum of both spouses' active detailed costs)
    let activeDetailedHealthAnnual = 0;
    if (inputs.useDetailedExpenses && inputs.detailedExpenses) {
      activeDetailedHealthAnnual = yourDetailedHealthAnnual + wifeDetailedHealthAnnual;
    }

    let oneTimeCosts = 0;
    if (inputs.useDetailedExpenses && inputs.detailedExpenses) {
      if (year === 2026) {
        if (inputs.jurisdiction.relocationYear !== 2026) {
          const curExpenses = inputs.detailedExpenses[inputs.jurisdiction.currentState];
          if (curExpenses) {
            for (const item of ONE_TIME_EXPENSE_ITEMS) {
              oneTimeCosts += curExpenses[item.key] ?? 0;
            }
          }
        }
      }
      if (inputs.jurisdiction.relocationYear !== null && year === inputs.jurisdiction.relocationYear) {
        const tgtExpenses = inputs.detailedExpenses[inputs.jurisdiction.targetState];
        if (tgtExpenses) {
          for (const item of ONE_TIME_EXPENSE_ITEMS) {
            oneTimeCosts += tgtExpenses[item.key] ?? 0;
          }
        }
      }
    }

    const livingExpenses = baseLivingExpensesAnnual * cpiFactor + activeDetailedHealthAnnual * cpiFactor + oneTimeCosts * cpiFactor;
    
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
      const baseWifeSS = calculateSSBenefit(inputs.wife.estimatedPIA || 0, inputs.wife.targetSSClaimingAge) * 12;
      wifeSS = baseWifeSS * cpiFactor;

      // Apply spousal benefit floor: wife is entitled to the greater of her own benefit
      // or 50% of husband's PIA (reduced if she claims before her own FRA).
      // The spousal add-on only kicks in once the primary earner (husband) has claimed.
      if (yourSS > 0) {
        const spousalFloor = calculateSpousalBenefit(inputs.you.estimatedPIA || 0, inputs.wife.targetSSClaimingAge) * 12 * cpiFactor;
        wifeSS = Math.max(wifeSS, spousalFloor);
      }
    }
    
    // Survivor Social Security benefit rules:
    // Surviving spouse inherits the larger of the two Social Security benefit streams, smaller is eliminated.
    // SSA also guarantees a floor of 82.5% of the deceased's PIA even if they claimed early.
    if (youDeceased && !inputs.isSingleFiler) {
      const baseYourSS = calculateSSBenefit(inputs.you.estimatedPIA || 0, inputs.you.targetSSClaimingAge || 67) * 12 * cpiFactor;
      const baseWifeSS = calculateSSBenefit(inputs.wife.estimatedPIA || 0, inputs.wife.targetSSClaimingAge || 67) * 12 * cpiFactor;

      // 82.5% of the deceased's PIA is the SSA-guaranteed minimum survivor benefit,
      // regardless of what the deceased actually received (protects against early-claim penalty).
      const survivorFloor = (inputs.you.estimatedPIA || 0) * 0.825 * 12 * cpiFactor;

      if (inputs.wife.targetSSClaimingAge && wifeAge >= inputs.wife.targetSSClaimingAge) {
        // Wife has claimed — she receives the maximum of her own benefit, your SS (with delay credits),
        // or the guaranteed 82.5% survivor floor.
        wifeSS = Math.max(baseYourSS, baseWifeSS, survivorFloor);
      } else {
        // Wife hasn't claimed her own benefit yet, but is eligible for survivor benefits (age 60+).
        // She receives the higher of the deceased's benefit or the 82.5% floor.
        wifeSS = Math.max(baseYourSS, survivorFloor);
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
    
    // To prevent using pre-tax funds to pay for Roth conversion taxes (which is financially suboptimal),
    // we dynamically cap the target conversion based on the available taxable brokerage assets.
    if (targetConversion > 0) {
      const totalTaxableBrokerage = yourTaxable + (inputs.isSingleFiler ? 0 : wifeTaxable);
      
      // Estimate this year's net outflows before conversions
      const estLiving = livingExpenses;
      const estSS = combinedSS;
      const estSalary = activeSalaryInflow;
      
      // Deficit in base living expenses that must be funded by taxable brokerage
      const estBaseDeficit = Math.max(0, estLiving - (estSS + estSalary));
      
      // Taxable cash left specifically to pay for Roth conversion taxes
      const taxableCashForTaxes = Math.max(0, totalTaxableBrokerage - estBaseDeficit);
      
      // Safe conversion ceiling assuming 25% average tax rate (tax = 0.25 * conversion)
      // Every $1.00 of conversion requires roughly $0.25 of taxable cash to pay the tax.
      const maxSafeConversion = taxableCashForTaxes * 4;
      
      targetConversion = Math.min(targetConversion, maxSafeConversion);
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
    
    // Living expenses precalculated above

    // Pre-Medicare healthcare premium calculations (calculated at start of year loop)
    const combinedPreMedicarePremium = yourPreMedicareAnnual + wifePreMedicareAnnual;
    
    // 5. Drawdown and Tax Convergence Loop
    // Because tax bills depend on capital gains from drawdowns, we iterate to solve for taxes & drawdowns
    let drawdownTaxable = 0;
    let drawdownPreTax = 0;
    let drawdownRoth = 0;
    let capitalGainsTriggered = 0;
    let fedIncomeTax = 0;
    let stateIncomeTax = 0;
    let niitTax = 0;
    let stdDeduction = 0;
    
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
      // 1. Base Standard Deduction
      const stdDeductionBase = isSingle
        ? FED_STANDARD_DEDUCTION_SINGLE * cpiFactor
        : FED_STANDARD_DEDUCTION_MFJ * cpiFactor;

      // 2. Age 65+ Additional Standard Deduction
      let ageAddition = 0;
      if (isSingle) {
        if (yourAge >= 65) {
          ageAddition += 1950 * cpiFactor;
        }
      } else {
        if (yourAge >= 65) ageAddition += 1650 * cpiFactor;
        if (wifeAge >= 65) ageAddition += 1650 * cpiFactor;
      }

      // 3. Senior "Bonus" Deduction ($6,000 per person aged 65+)
      let seniorBonusRaw = 0;
      if (isSingle) {
        if (yourAge >= 65) seniorBonusRaw += 6000 * cpiFactor;
      } else {
        if (yourAge >= 65) seniorBonusRaw += 6000 * cpiFactor;
        if (wifeAge >= 65) seniorBonusRaw += 6000 * cpiFactor;
      }

      // 4. Senior "Bonus" Phase-out (threshold: $150,000 MFJ / $75,000 Single)
      const bonusThreshold = (isSingle ? 75000 : 150000) * cpiFactor;
      const excessBonusMAGI = Math.max(0, fedAGI - bonusThreshold);
      const bonusReduction = excessBonusMAGI * 0.06;
      const seniorBonusFinal = Math.max(0, seniorBonusRaw - bonusReduction);

      stdDeduction = stdDeductionBase + ageAddition + seniorBonusFinal;
        
      const fedTaxableIncome = Math.max(0, fedAGI - stdDeduction);
      
      // Federal Income Tax
      fedIncomeTax = calculateFedTax(fedTaxableIncome, isSingle, cpiFactor);
      
      // Calculate 3.8% Net Investment Income Tax (NIIT)
      // Thresholds: $200k for Single / $250k for MFJ (under tax code, these are NOT adjusted for inflation)
      const niitThreshold = isSingle ? 200000 : 250000;
      const excessMAGI = Math.max(0, fedAGI - niitThreshold);
      const niitBase = Math.min(capitalGainsTriggered, excessMAGI);
      niitTax = niitBase * 0.038;
      
      fedIncomeTax += niitTax;
      
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
    
    // Reinvest surplus cash inflows if any
    const totalOutflows = livingExpenses + medicareBasePremiums + combinedSurchargeAnnual + combinedPreMedicarePremium + totalTaxBill;
    const baseInflows = combinedSS + combinedRMD + activeSalaryInflow;
    const surplus = Math.max(0, baseInflows - totalOutflows);

    if (surplus > 0) {
      if (inputs.isSingleFiler) {
        currentYourTaxable += surplus;
        currentYourBasis += surplus;
      } else if (youDeceased) {
        currentWifeTaxable += surplus;
        currentWifeBasis += surplus;
      } else {
        const halfSurplus = surplus / 2;
        currentYourTaxable += halfSurplus;
        currentYourBasis += halfSurplus;
        currentWifeTaxable += halfSurplus;
        currentWifeBasis += halfSurplus;
      }
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
      standardDeduction: stdDeduction,
      taxableIncome: Math.max(0, finalFedAGI - stdDeduction),
      fedIncomeTax,
      stateIncomeTax,
      totalIncomeTax: fedIncomeTax + stateIncomeTax,
      niitTax,
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
