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
  FED_LTCG_BRACKETS_SINGLE,
  FED_LTCG_BRACKETS_MFJ,
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
 */
export function calculateSpousalBenefit(primaryPIA: number, spouseClaimingAge: number): number {
  if (primaryPIA <= 0) return 0;

  const FRA = 67;
  const baseSpousal = primaryPIA * 0.50;

  if (spouseClaimingAge >= FRA) {
    return baseSpousal;
  }

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

// Helper to compute Federal Income Tax separating ordinary income and capital gains
export function calculateFedTaxWithLTCG(
  taxableOrdinaryIncome: number,
  taxableCapitalGains: number,
  isSingle: boolean,
  cpiFactor: number
): { ordinaryTax: number; ltcgTax: number; totalTax: number } {
  const ordinaryTax = calculateFedTax(taxableOrdinaryIncome, isSingle, cpiFactor);

  if (taxableCapitalGains <= 0) {
    return {
      ordinaryTax,
      ltcgTax: 0,
      totalTax: ordinaryTax,
    };
  }

  const ltcgBrackets = isSingle ? FED_LTCG_BRACKETS_SINGLE : FED_LTCG_BRACKETS_MFJ;
  
  const limit0 = ltcgBrackets[0].limit * cpiFactor;
  const limit15 = ltcgBrackets[1].limit * cpiFactor;

  const totalTaxable = taxableOrdinaryIncome + taxableCapitalGains;

  const ltcg15Start = Math.max(taxableOrdinaryIncome, limit0);
  const ltcg15End = Math.min(totalTaxable, limit15);
  const ltcg15 = Math.max(0, ltcg15End - ltcg15Start);

  const ltcg20Start = Math.max(taxableOrdinaryIncome, limit15);
  const ltcg20 = Math.max(0, totalTaxable - ltcg20Start);

  const ltcgTax = (ltcg15 * 0.15) + (ltcg20 * 0.20);
  
  return {
    ordinaryTax,
    ltcgTax,
    totalTax: ordinaryTax + ltcgTax,
  };
}

export function getRMDStartAge(birthYear: number): number {
  if (birthYear < 1951) return 72;
  if (birthYear <= 1959) return 73;
  return 75;
}

// Helper to compute Maryland State Tax
export function calculateMDStateTax(
  fedAGI: number,
  taxableSS: number,
  isSingle: boolean,
  cpiFactor: number = 1,
  mdPensionExclusion: number = 0
): number {
  const stdDeductionRate = 0.15 * fedAGI;
  let stdDeduction = 0;
  if (isSingle) {
    stdDeduction = Math.min(Math.max(stdDeductionRate, 1700 * cpiFactor), 2550 * cpiFactor);
  } else {
    stdDeduction = Math.min(Math.max(stdDeductionRate, 3450 * cpiFactor), 5150 * cpiFactor);
  }
  
  let mdTaxableIncome = fedAGI - stdDeduction - taxableSS - mdPensionExclusion;
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
  
  const piggybackTax = mdTaxableIncome * MD_PIGGYBACK_RATE;
  return stateTax + piggybackTax;
}

function parseBirthYearAndMonth(dateStr: string | undefined, defaultYear: number): { year: number; month: number } {
  if (!dateStr) return { year: defaultYear, month: 0 };
  const parts = dateStr.split('-');
  if (parts.length < 2) return { year: defaultYear, month: 0 };
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed (Jan = 0, Dec = 11)
  return { year: isNaN(year) ? defaultYear : year, month: isNaN(month) ? 0 : month };
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
  let yourCash = inputs.portfolio.yourCash || 0;
  
  let wifePreTax = inputs.isSingleFiler ? 0 : (inputs.portfolio.wifePreTaxIRA || 0);
  let wifeRoth = inputs.isSingleFiler ? 0 : (inputs.portfolio.wifeRothIRA || 0);
  let wifeTaxable = inputs.isSingleFiler ? 0 : (inputs.portfolio.wifeTaxableBrokerage || 0);
  let wifeBasis = inputs.isSingleFiler ? 0 : (inputs.portfolio.wifeTaxableBasis || 0);
  let wifeCash = inputs.isSingleFiler ? 0 : (inputs.portfolio.wifeCash || 0);
  
  const taxableDividendYield = inputs.portfolio.taxableDividendYield !== undefined && inputs.portfolio.taxableDividendYield !== null ? inputs.portfolio.taxableDividendYield : 0.02;
  const taxableNonQualifiedPortion = inputs.portfolio.taxableNonQualifiedPortion !== undefined && inputs.portfolio.taxableNonQualifiedPortion !== null ? inputs.portfolio.taxableNonQualifiedPortion : 0.30;
  
  // Actuarial death year definition for survivor mode:
  // Primary user passes away turning age 85
  const { year: yourBirthYear, month: yourBirthMonth } = parseBirthYearAndMonth(inputs.you.birthDate, 1960);
  const { year: wifeBirthYear, month: wifeBirthMonth } = parseBirthYearAndMonth(inputs.wife.birthDate, 1964);
  const DEATH_YEAR = yourBirthYear + 85;
  
  // Check if a stochastic sequence of returns is active
  const activeSeq = activeSequence;

  let cpiFactor = 1.0;
  const startYear = inputs.rothConversionStartYear !== undefined ? inputs.rothConversionStartYear : 2026;
  const endYear = inputs.rothConversionEndYear !== undefined ? inputs.rothConversionEndYear : 2035;

  // Let's run year-by-year from 2026 to 2060
  for (let year = 2026; year <= 2060; year++) {
    const yearsElapsed = year - 2026;
    
    // Accumulate inflation index (CPI) dynamically based on co-sampled rates if available
    if (yearsElapsed > 0) {
      let annualInflation = inputs.growthAssumptions.cpiInflationRate;
      if (activeSeq && activeSeq.inflationRates) {
        const prevYearElapsed = yearsElapsed - 1;
        if (activeSeq.inflationRates[prevYearElapsed] !== undefined) {
          const historicalRate = activeSeq.inflationRates[prevYearElapsed];
          const historicalMean = 0.039942857142857155;
          annualInflation = Math.max(-0.02, historicalRate + (inputs.growthAssumptions.cpiInflationRate - historicalMean));
        }
      }
      cpiFactor *= (1 + annualInflation);
    }
    
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

    // Monthly Rates
    const monthlyTaxableRate = Math.pow(1 + taxableGrowthRate, 1 / 12) - 1;
    const monthlyPreTaxRate = Math.pow(1 + preTaxGrowthRate, 1 / 12) - 1;
    const monthlyRothRate = Math.pow(1 + rothGrowthRate, 1 / 12) - 1;
    const monthlyCashRate = Math.pow(1 + bondRate, 1 / 12) - 1;

    // State determination
    const activeState = (inputs.jurisdiction.relocationYear !== null && year >= inputs.jurisdiction.relocationYear)
      ? inputs.jurisdiction.targetState
      : inputs.jurisdiction.currentState;

    const isStateFL = activeState === 'FL';

    const isSurvivorActive = simulateSurvivor && (year >= DEATH_YEAR);
    const youDeceased = isSurvivorActive;

    // Spousal transition on primary death
    if (youDeceased && year === DEATH_YEAR) {
      wifePreTax += yourPreTax;
      yourPreTax = 0;
      wifeRoth += yourRoth;
      yourRoth = 0;

      if (isStateFL) {
        wifeBasis = wifeTaxable + yourTaxable;
      } else {
        wifeBasis += yourTaxable;
      }
      wifeTaxable += yourTaxable;
      yourTaxable = 0;
      yourBasis = 0;

      wifeCash += yourCash;
      yourCash = 0;
    }

    // Standard spouse ages for year
    const yourAge = year - yourBirthYear;
    const wifeAge = year - wifeBirthYear;
    const youRetireAge = inputs.you.plannedRetirementAge ?? 67;
    const wifeRetireAge = inputs.isSingleFiler ? 0 : (inputs.wife.plannedRetirementAge ?? 65);

    // Event month indexes relative to 2026 start
    // If plannedRetirementMonth is set (1-12), use it as the within-year month offset (0-indexed).
    // Otherwise fall back to birth month, which preserves the existing behavior.
    const youRetireMonth = (inputs.you.plannedRetirementMonth != null)
      ? inputs.you.plannedRetirementMonth - 1
      : yourBirthMonth;
    const wifeRetireMonth = (!inputs.isSingleFiler && inputs.wife.plannedRetirementMonth != null)
      ? inputs.wife.plannedRetirementMonth - 1
      : wifeBirthMonth;

    const yourRetireMonthIdx = (yourBirthYear + youRetireAge - 2026) * 12 + youRetireMonth;
    const wifeRetireMonthIdx = (wifeBirthYear + wifeRetireAge - 2026) * 12 + wifeRetireMonth;
    const yourSSClaimMonthIdx = inputs.you.targetSSClaimingAge
      ? (yourBirthYear + inputs.you.targetSSClaimingAge - 2026) * 12 + yourBirthMonth
      : Infinity;
    const wifeSSClaimMonthIdx = (!inputs.isSingleFiler && inputs.wife.targetSSClaimingAge)
      ? (wifeBirthYear + inputs.wife.targetSSClaimingAge - 2026) * 12 + wifeBirthMonth
      : Infinity;

    const yourMedicareMonthIdx = (yourBirthYear + 65 - 2026) * 12 + yourBirthMonth;
    const wifeMedicareMonthIdx = (wifeBirthYear + 65 - 2026) * 12 + wifeBirthMonth;
    const wifeSurvivorMonthIdx = (wifeBirthYear + 60 - 2026) * 12 + wifeBirthMonth;

    const yourRmdStartAge = getRMDStartAge(yourBirthYear);
    const wifeRmdStartAge = getRMDStartAge(wifeBirthYear);

    // Calculate baseline SS benefits
    const yourSSAnnualBase = calculateSSBenefit(inputs.you.estimatedPIA || 0, inputs.you.targetSSClaimingAge || 67) * 12 * cpiFactor;
    const wifeSSAnnualBase = calculateSSBenefit(inputs.wife.estimatedPIA || 0, inputs.wife.targetSSClaimingAge || 67) * 12 * cpiFactor;
    const spousalSSAnnualFloor = calculateSpousalBenefit(inputs.you.estimatedPIA || 0, inputs.wife.targetSSClaimingAge || 67) * 12 * cpiFactor;

    const survivorSSAnnualBase = calculateSSBenefit(inputs.you.estimatedPIA || 0, inputs.you.targetSSClaimingAge || 67) * 12 * cpiFactor;
    const survivorWifeSSAnnualBase = calculateSSBenefit(inputs.wife.estimatedPIA || 0, inputs.wife.targetSSClaimingAge || 67) * 12 * cpiFactor;
    const survivorFloor = (inputs.you.estimatedPIA || 0) * 0.825 * 12 * cpiFactor;
    const wifeSurvivorSSBenefit = Math.max(survivorSSAnnualBase, survivorWifeSSAnnualBase, survivorFloor);

    // 2. RMDs calculations (based on start-of-year balances)
    let yourRMD = 0;
    let wifeRMD = 0;
    if (!youDeceased && yourAge >= yourRmdStartAge) {
      const factor = getIRSUniformLifetimeFactor(yourAge);
      if (factor > 0) yourRMD = yourPreTax / factor;
    }
    if (wifeAge >= wifeRmdStartAge) {
      const factor = getIRSUniformLifetimeFactor(wifeAge);
      if (factor > 0) wifeRMD = wifePreTax / factor;
    }
    const combinedRMD = yourRMD + wifeRMD;

    // Define healthcare parameters once per year
    let yourPreMedicareAnnual = 0;
    let yourPreMedicareOOP = 0;
    let yourMedicarePremiums = 0;
    let yourMedicareOOP = 0;
    if (inputs.you.healthcare) {
      const stateHc = inputs.you.healthcare[activeState];
      yourPreMedicareAnnual = ((stateHc?.pre65MedicalPremium ?? 0) + (stateHc?.pre65DentalPremium ?? 0) + (stateHc?.pre65VisionPremium ?? 0)) * 12 * healthcareFactor;
      yourPreMedicareOOP = ((stateHc?.pre65MedicalOOP ?? 0) + (stateHc?.pre65DentalOOP ?? 0) + (stateHc?.pre65VisionOOP ?? 0)) * healthcareFactor;
      
      const yearsSinceBaseJohn = Math.max(0, year - Math.max(2026, yourBirthYear + 65));
      const customB = inputs.you.healthcare.medicarePartBPremium;
      const partB_current = (customB !== null && customB !== undefined) ? customB * Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, yearsSinceBaseJohn) : BASE_MEDICARE_PART_B * healthcareFactor;
      const customD = stateHc?.medicarePartDPremium;
      const partD_current = (customD !== null && customD !== undefined) ? customD * Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, yearsSinceBaseJohn) : BASE_MEDICARE_PART_D * healthcareFactor;
      const suppPrem = (stateHc?.supplementPremium ?? 0) * 12 * healthcareFactor;
      const dentalPrem = (stateHc?.post65DentalPremium ?? 0) * 12 * healthcareFactor;
      const visionPrem = (stateHc?.post65VisionPremium ?? 0) * 12 * healthcareFactor;
      yourMedicarePremiums = (partB_current + partD_current) * 12 + suppPrem + dentalPrem + visionPrem;
      yourMedicareOOP = ((stateHc?.medicarePartDDeductibleCopays ?? 0) + (stateHc?.supplementOOP ?? 0) + (stateHc?.post65HearingCare ?? 0) + (stateHc?.post65DentalOOP ?? 0) + (stateHc?.post65VisionOOP ?? 0)) * healthcareFactor;
    } else {
      yourPreMedicareAnnual = (inputs.you.preMedicareMonthlyPremium ?? 0) * 12 * healthcareFactor;
      yourMedicarePremiums = (BASE_MEDICARE_PART_B + BASE_MEDICARE_PART_D) * 12 * healthcareFactor;
    }

    let wifePreMedicareAnnual = 0;
    let wifePreMedicareOOP = 0;
    let wifeMedicarePremiums = 0;
    let wifeMedicareOOP = 0;
    if (!inputs.isSingleFiler) {
      if (inputs.wife.healthcare) {
        const stateHc = inputs.wife.healthcare[activeState];
        wifePreMedicareAnnual = ((stateHc?.pre65MedicalPremium ?? 0) + (stateHc?.pre65DentalPremium ?? 0) + (stateHc?.pre65VisionPremium ?? 0)) * 12 * healthcareFactor;
        wifePreMedicareOOP = ((stateHc?.pre65MedicalOOP ?? 0) + (stateHc?.pre65DentalOOP ?? 0) + (stateHc?.pre65VisionOOP ?? 0)) * healthcareFactor;
        
        const yearsSinceBaseWife = Math.max(0, year - Math.max(2026, wifeBirthYear + 65));
        const customB = inputs.wife.healthcare.medicarePartBPremium;
        const partB_current = (customB !== null && customB !== undefined) ? customB * Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, yearsSinceBaseWife) : BASE_MEDICARE_PART_B * healthcareFactor;
        const customD = stateHc?.medicarePartDPremium;
        const partD_current = (customD !== null && customD !== undefined) ? customD * Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, yearsSinceBaseWife) : BASE_MEDICARE_PART_D * healthcareFactor;
        const suppPrem = (stateHc?.supplementPremium ?? 0) * 12 * healthcareFactor;
        const dentalPrem = (stateHc?.post65DentalPremium ?? 0) * 12 * healthcareFactor;
        const visionPrem = (stateHc?.post65VisionPremium ?? 0) * 12 * healthcareFactor;
        wifeMedicarePremiums = (partB_current + partD_current) * 12 + suppPrem + dentalPrem + visionPrem;
        wifeMedicareOOP = ((stateHc?.medicarePartDDeductibleCopays ?? 0) + (stateHc?.supplementOOP ?? 0) + (stateHc?.post65HearingCare ?? 0) + (stateHc?.post65DentalOOP ?? 0) + (stateHc?.post65VisionOOP ?? 0)) * healthcareFactor;
      } else {
        wifePreMedicareAnnual = (inputs.wife.preMedicareMonthlyPremium ?? 0) * 12 * healthcareFactor;
        wifeMedicarePremiums = (BASE_MEDICARE_PART_B + BASE_MEDICARE_PART_D) * 12 * healthcareFactor;
      }
    }

    let baseLivingExpensesAnnual = inputs.annualLivingExpenses ?? 120000;
    if (inputs.useDetailedExpenses && inputs.detailedExpenses) {
      let detailedSum = 0;
      const stateExpenses = inputs.detailedExpenses[activeState];
      const freqs = inputs.detailedExpenses.frequencies;
      if (stateExpenses && freqs) {
        for (const item of RECURRING_EXPENSE_ITEMS) {
          const cost = stateExpenses[item.key] ?? 0;
          const freq = freqs[item.key] ?? item.defaultFrequency;
          detailedSum += cost * freq;
        }
      }
      baseLivingExpensesAnnual = detailedSum;
    }

    // Declaring yearly loop scope variables
    let targetConversion = 0;
    let drawdownCash = 0;
    let drawdownTaxable = 0;
    let drawdownPreTax = 0;
    let drawdownRoth = 0;
    let capitalGainsTriggered = 0;

    // Target Conversion
    if (inputs.rothConversionStrategy === 'fill-to-target' && inputs.rothConversionTargetValue !== null) {
      if (year >= startYear && year <= endYear) {
        const inflatedTarget = inputs.rothConversionTargetValue * cpiFactor;
        let estSS = 0;
        if (!youDeceased && yourAge >= (inputs.you.targetSSClaimingAge || 67)) estSS += yourSSAnnualBase;
        if (!inputs.isSingleFiler) {
          if (youDeceased) {
            if (wifeAge >= 60) estSS += wifeSurvivorSSBenefit;
          } else if (wifeAge >= (inputs.wife.targetSSClaimingAge || 67)) {
            estSS += Math.max(wifeSSAnnualBase, spousalSSAnnualFloor);
          }
        }
        let estSalary = 0;
        if (!youDeceased && yourAge < youRetireAge) estSalary += (inputs.you.activeSalary ?? 0) * cpiFactor;
        if (!inputs.isSingleFiler && wifeAge < wifeRetireAge) estSalary += (inputs.wife.activeSalary ?? 0) * cpiFactor;
        const estDividends = (yourTaxable + wifeTaxable) * taxableDividendYield;
        const uncontrollable = estSalary + estSS + combinedRMD + estDividends;
        targetConversion = Math.max(0, inflatedTarget - uncontrollable);
      }
    } else {
      if (year >= startYear && year <= endYear) {
        const conversionInflationFactor = Math.pow(1 + inputs.growthAssumptions.cpiInflationRate, year - startYear);
        targetConversion = inputs.annualRothConversion * conversionInflationFactor;
      }
    }

    // Cap conversion by available taxable assets.
    // Note: yourTaxable / wifeTaxable here are start-of-year (Jan 1) balances, before
    // any monthly drawdowns. This is intentionally conservative — a modest underestimate
    // of available funds — which prevents over-converting in years with heavy drawdowns.
    if (targetConversion > 0) {
      const totalTaxableBrokerage = yourTaxable + (inputs.isSingleFiler ? 0 : wifeTaxable);
      let estLiving = baseLivingExpensesAnnual * cpiFactor;
      const totalTaxableLeft = Math.max(0, totalTaxableBrokerage - estLiving);
      const maxSafeConversion = totalTaxableLeft * 4;
      targetConversion = Math.min(targetConversion, maxSafeConversion);
    }

    let combinedRothConversion = 0;
    let yourConverted = 0;
    let wifeConverted = 0;

    // Surcharges (lookback)
    let magiTwoYearsAgo = 0;
    const lookbackIndex = ledger.length - 2;
    if (lookbackIndex >= 0) {
      magiTwoYearsAgo = ledger[lookbackIndex].magi;
    } else {
      let estSS = 0;
      if (!youDeceased && yourAge >= (inputs.you.targetSSClaimingAge || 67)) estSS += yourSSAnnualBase;
      if (!inputs.isSingleFiler) {
        if (youDeceased) {
          if (wifeAge >= 60) estSS += wifeSurvivorSSBenefit;
        } else if (wifeAge >= (inputs.wife.targetSSClaimingAge || 67)) {
          estSS += Math.max(wifeSSAnnualBase, spousalSSAnnualFloor);
        }
      }
      let estSalary = 0;
      if (!youDeceased && yourAge < youRetireAge) estSalary += (inputs.you.activeSalary ?? 0) * cpiFactor;
      if (!inputs.isSingleFiler && wifeAge < wifeRetireAge) estSalary += (inputs.wife.activeSalary ?? 0) * cpiFactor;
      magiTwoYearsAgo = estSalary + estSS * 0.85 + combinedRMD + targetConversion + (yourTaxable + wifeTaxable) * taxableDividendYield;
    }

    let yourPartBSurcharge = 0;
    let yourPartDSurcharge = 0;
    let wifePartBSurcharge = 0;
    let wifePartDSurcharge = 0;
    let surchargeTier = 0;
    const irmaaTiers = (isSurvivorActive || inputs.isSingleFiler) ? IRMAA_TIERS_SINGLE : IRMAA_TIERS_MFJ;
    const lookbackCpi = (lookbackIndex >= 0) ? ledger[lookbackIndex].cpiFactor : cpiFactor;
    for (let i = irmaaTiers.length - 1; i >= 0; i--) {
      const prevTier = irmaaTiers[i - 1];
      let prevLimit = prevTier ? (prevTier.limit === Infinity ? Infinity : prevTier.limit * lookbackCpi) : 0;
      if (magiTwoYearsAgo > prevLimit) {
        surchargeTier = irmaaTiers[i].tierNumber;
        const basePartB = irmaaTiers[i].partBSurcharge * healthcareFactor;
        const basePartD = irmaaTiers[i].partDSurcharge * healthcareFactor;
        yourPartBSurcharge = basePartB;
        yourPartDSurcharge = basePartD;
        wifePartBSurcharge = basePartB;
        wifePartDSurcharge = basePartD;
        break;
      }
    }

    let oneTimeCosts = 0;
    if (inputs.useDetailedExpenses && inputs.detailedExpenses) {
      if (year === 2026 && inputs.jurisdiction.relocationYear !== 2026) {
        const curExpenses = inputs.detailedExpenses[inputs.jurisdiction.currentState];
        if (curExpenses) {
          for (const item of ONE_TIME_EXPENSE_ITEMS) oneTimeCosts += curExpenses[item.key] ?? 0;
        }
      }
      if (inputs.jurisdiction.relocationYear !== null && year === inputs.jurisdiction.relocationYear) {
        const tgtExpenses = inputs.detailedExpenses[inputs.jurisdiction.targetState];
        if (tgtExpenses) {
          for (const item of ONE_TIME_EXPENSE_ITEMS) oneTimeCosts += tgtExpenses[item.key] ?? 0;
        }
      }
    }

    // Running monthly accumulators for ledger rollups
    let annualYourSalary = 0;
    let annualWifeSalary = 0;
    let annualYourSS = 0;
    let annualWifeSS = 0;
    let annualYourDividends = 0;
    let annualWifeDividends = 0;
    let annualYourInterest = 0;
    let annualWifeInterest = 0;
    let annualPreMedicarePremium = 0;
    let annualMedicareBasePremiums = 0;
    let annualMedicareSurcharges = 0;
    let annualLivingExpenses = 0;
    let annualDrawdownCash = 0;
    let annualDrawdownTaxable = 0;
    let annualDrawdownPreTax = 0;
    let annualDrawdownRoth = 0;
    let annualYourTradDraw = 0;
    let annualWifeTradDraw = 0;
    let annualCapitalGainsTriggered = 0;

    // Medicare month counters — IRMAA surcharges are annual premium amounts,
    // so we count eligible months and pro-rate at the end (avoids 12× over-count).
    let yourMedicareMonthCount = 0;
    let wifeMedicareMonthCount = 0;

    // December month index hoisted here so it is available outside the solver loop.
    const decMonthIdx = (year - 2026) * 12 + 11;

    let monthlyYourDividends = 0;
    let monthlyWifeDividends = 0;

    // Monthly Loop: Jan to Nov
    for (let month = 0; month < 11; month++) {
      const monthIdx = (year - 2026) * 12 + month;

      // 1. Age in months (not needed here, calculated via month index)

      // 2. Working flags
      const isYouWorking = !youDeceased && (monthIdx < yourRetireMonthIdx);
      const isWifeWorking = !inputs.isSingleFiler && (monthIdx < wifeRetireMonthIdx);

      // 3. Salary
      const monthlyYourSalary = isYouWorking ? ((inputs.you.activeSalary ?? 0) * cpiFactor) / 12 : 0;
      const monthlyWifeSalary = isWifeWorking ? ((inputs.wife.activeSalary ?? 0) * cpiFactor) / 12 : 0;
      
      // 4. Social Security benefit
      let monthlyYourSS = 0;
      let monthlyWifeSS = 0;

      if (!youDeceased && (monthIdx >= yourSSClaimMonthIdx)) {
        monthlyYourSS = yourSSAnnualBase / 12;
      }
      if (!inputs.isSingleFiler) {
        if (youDeceased) {
          if (monthIdx >= wifeSurvivorMonthIdx) {
            monthlyWifeSS = wifeSurvivorSSBenefit / 12;
          }
        } else if (monthIdx >= wifeSSClaimMonthIdx) {
          const ownSS = wifeSSAnnualBase / 12;
          if (monthIdx >= yourSSClaimMonthIdx) {
            monthlyWifeSS = Math.max(ownSS, spousalSSAnnualFloor / 12);
          } else {
            monthlyWifeSS = ownSS;
          }
        }
      }

      annualYourSalary += monthlyYourSalary;
      annualWifeSalary += monthlyWifeSalary;
      annualYourSS += monthlyYourSS;
      annualWifeSS += monthlyWifeSS;

      // 5. Dividends
      monthlyYourDividends = youDeceased ? 0 : yourTaxable * taxableDividendYield / 12;
      monthlyWifeDividends = inputs.isSingleFiler ? 0 : wifeTaxable * taxableDividendYield / 12;
      annualYourDividends += monthlyYourDividends;
      annualWifeDividends += monthlyWifeDividends;

      yourTaxable = Math.max(0, yourTaxable - monthlyYourDividends);
      wifeTaxable = Math.max(0, wifeTaxable - monthlyWifeDividends);

      // 6. Base expenses
      const monthlyBaseExpenses = (baseLivingExpensesAnnual * cpiFactor) / 12;
      let monthlyYourOOP = 0;
      if (!youDeceased) {
        if (monthIdx < yourMedicareMonthIdx) {
          if (!isYouWorking) monthlyYourOOP = yourPreMedicareOOP / 12;
        } else {
          if (!isYouWorking) monthlyYourOOP = yourMedicareOOP / 12;
        }
      }
      let monthlyWifeOOP = 0;
      if (!inputs.isSingleFiler) {
        if (monthIdx < wifeMedicareMonthIdx) {
          if (!isWifeWorking) monthlyWifeOOP = wifePreMedicareOOP / 12;
        } else {
          if (!isWifeWorking) monthlyWifeOOP = wifeMedicareOOP / 12;
        }
      }
      const monthlyLiving = monthlyBaseExpenses + (month === 0 ? oneTimeCosts * cpiFactor : 0) + monthlyYourOOP + monthlyWifeOOP;
      annualLivingExpenses += monthlyLiving;

      // 7. Premiums
      let monthlyYourPremium = 0;
      if (!youDeceased) {
        if (monthIdx < yourMedicareMonthIdx) {
          if (!isYouWorking) monthlyYourPremium = yourPreMedicareAnnual / 12;
        } else {
          if (!isYouWorking) {
            monthlyYourPremium = yourMedicarePremiums / 12;
            yourMedicareMonthCount++; // tally for pro-rated surcharge at year end
          }
        }
      }
      let monthlyWifePremium = 0;
      if (!inputs.isSingleFiler) {
        if (monthIdx < wifeMedicareMonthIdx) {
          if (!isWifeWorking) monthlyWifePremium = wifePreMedicareAnnual / 12;
        } else {
          if (!isWifeWorking) {
            monthlyWifePremium = wifeMedicarePremiums / 12;
            wifeMedicareMonthCount++; // tally for pro-rated surcharge at year end
          }
        }
      }

      const monthlyPreMed = (monthIdx < yourMedicareMonthIdx ? monthlyYourPremium : 0) + (!inputs.isSingleFiler && monthIdx < wifeMedicareMonthIdx ? monthlyWifePremium : 0);
      const monthlyMedicare = (monthIdx >= yourMedicareMonthIdx ? monthlyYourPremium : 0) + (!inputs.isSingleFiler && monthIdx >= wifeMedicareMonthIdx ? monthlyWifePremium : 0);

      annualPreMedicarePremium += monthlyPreMed;
      annualMedicareBasePremiums += monthlyMedicare;

      // Drawdown for months Jan-Nov (December is deferred to the annual tax settlement loop)
      const totalOutflows = monthlyLiving + monthlyPreMed + monthlyMedicare + (monthIdx >= yourMedicareMonthIdx && !isYouWorking ? yourPartBSurcharge + yourPartDSurcharge : 0) + (!inputs.isSingleFiler && monthIdx >= wifeMedicareMonthIdx && !isWifeWorking ? wifePartBSurcharge + wifePartDSurcharge : 0);
      const totalInflows = monthlyYourSS + monthlyWifeSS + monthlyYourSalary + monthlyWifeSalary + monthlyYourDividends + monthlyWifeDividends;

      let deficit = totalOutflows - totalInflows;
      if (deficit > 0) {
        // Cash first
        if (!youDeceased && yourCash > 0) {
          const draw = Math.min(deficit, yourCash);
          annualDrawdownCash += draw;
          deficit -= draw;
          yourCash -= draw;
        }
        if (deficit > 0 && wifeCash > 0) {
          const draw = Math.min(deficit, wifeCash);
          annualDrawdownCash += draw;
          deficit -= draw;
          wifeCash -= draw;
        }

        // Brokerage second
        if (deficit > 0) {
          if (!youDeceased && yourTaxable > 0) {
            const draw = Math.min(deficit, yourTaxable);
            const basisRatio = yourTaxable > 0 ? (yourBasis / yourTaxable) : 0;
            annualCapitalGainsTriggered += Math.max(0, draw * (1 - basisRatio));
            annualDrawdownTaxable += draw;
            deficit -= draw;
            yourTaxable -= draw;
            yourBasis -= draw * basisRatio;
          }
          if (deficit > 0 && wifeTaxable > 0) {
            const draw = Math.min(deficit, wifeTaxable);
            const basisRatio = wifeTaxable > 0 ? (wifeBasis / wifeTaxable) : 0;
            annualCapitalGainsTriggered += Math.max(0, draw * (1 - basisRatio));
            annualDrawdownTaxable += draw;
            deficit -= draw;
            wifeTaxable -= draw;
            wifeBasis -= draw * basisRatio;
          }
        }

        // Pre-tax third
        if (deficit > 0) {
          if (!youDeceased && yourPreTax > 0) {
            const draw = Math.min(deficit, yourPreTax);
            annualYourTradDraw += draw;
            annualDrawdownPreTax += draw;
            deficit -= draw;
            yourPreTax -= draw;
          }
          if (deficit > 0 && wifePreTax > 0) {
            const draw = Math.min(deficit, wifePreTax);
            annualWifeTradDraw += draw;
            annualDrawdownPreTax += draw;
            deficit -= draw;
            wifePreTax -= draw;
          }
        }

        // Roth fourth
        if (deficit > 0) {
          if (!youDeceased && yourRoth > 0) {
            const draw = Math.min(deficit, yourRoth);
            annualDrawdownRoth += draw;
            deficit -= draw;
            yourRoth -= draw;
          }
          if (deficit > 0 && wifeRoth > 0) {
            const draw = Math.min(deficit, wifeRoth);
            annualDrawdownRoth += draw;
            deficit -= draw;
            wifeRoth -= draw;
          }
        }
      } else {
        // Reinvest surplus into Brokerage
        const surplus = -deficit;
        if (surplus > 0) {
          if (isSurvivorActive || youDeceased) {
            wifeTaxable += surplus;
            wifeBasis += surplus;
          } else {
            const halfSurplus = surplus / 2;
            yourTaxable += halfSurplus;
            yourBasis += halfSurplus;
            wifeTaxable += halfSurplus;
            wifeBasis += halfSurplus;
          }
        }
      }

      // Apply monthly growth at the end of the month
      yourTaxable = yourTaxable * (1 + monthlyTaxableRate);
      yourBasis = Math.max(0, yourBasis);
      yourPreTax = yourPreTax * (1 + monthlyPreTaxRate);
      yourRoth = yourRoth * (1 + monthlyRothRate);

      const yourInterest = youDeceased ? 0 : yourCash * monthlyCashRate;
      annualYourInterest += yourInterest;
      yourCash = yourCash + yourInterest;

      wifeTaxable = wifeTaxable * (1 + monthlyTaxableRate);
      wifeBasis = Math.max(0, wifeBasis);
      wifePreTax = wifePreTax * (1 + monthlyPreTaxRate);
      wifeRoth = wifeRoth * (1 + monthlyRothRate);

      const wifeInterest = inputs.isSingleFiler ? 0 : wifeCash * monthlyCashRate;
      annualWifeInterest += wifeInterest;
      wifeCash = wifeCash + wifeInterest;
    }

    // December (month 11) is now processed
    // Apply RMD and Roth Conversions first
    yourPreTax = Math.max(0, yourPreTax - yourRMD);
    wifePreTax = Math.max(0, wifePreTax - wifeRMD);

    if (targetConversion > 0) {
      if (isSurvivorActive || youDeceased) {
        wifeConverted = Math.min(targetConversion, wifePreTax);
        wifePreTax -= wifeConverted;
        wifeRoth += wifeConverted;
      } else {
        const halfTarget = targetConversion / 2;
        const husbandDrawn = Math.min(halfTarget, yourPreTax);
        yourConverted += husbandDrawn;
        yourPreTax -= husbandDrawn;
        yourRoth += husbandDrawn;

        const wifeDrawn = Math.min(halfTarget, wifePreTax);
        wifeConverted += wifeDrawn;
        wifePreTax -= wifeDrawn;
        wifeRoth += wifeDrawn;

        const totalDrawn = husbandDrawn + wifeDrawn;
        const remainder = targetConversion - totalDrawn;
        if (remainder > 0.01) {
          if (yourPreTax > 0) {
            const extra = Math.min(remainder, yourPreTax);
            yourConverted += extra;
            yourPreTax -= extra;
            yourRoth += extra;
          } else if (wifePreTax > 0) {
            const extra = Math.min(remainder, wifePreTax);
            wifeConverted += extra;
            wifePreTax -= extra;
            wifeRoth += extra;
          }
        }
      }
    }
    combinedRothConversion = yourConverted + wifeConverted;

    // Solver for December tax and drawdown
    let drawdownTaxableDec = 0;
    let drawdownPreTaxDec = 0;
    let drawdownRothDec = 0;
    let drawdownCashDec = 0;
    let capitalGainsTriggeredDec = 0;
    
    let fedIncomeTax = 0;
    let stateIncomeTax = 0;
    let niitTax = 0;
    let stdDeduction = 0;
    let mdPensionExclusion = 0;

    // Compute December dividends from the post-November brokerage balances (before any Dec drawdowns).
    // These must be computed once here (not inside the solver loop) so they aren't recalculated per iteration.
    const monthlyYourDividendsDec = youDeceased ? 0 : yourTaxable * taxableDividendYield / 12;
    const monthlyWifeDividendsDec = inputs.isSingleFiler ? 0 : wifeTaxable * taxableDividendYield / 12;

    // Dec starting account values (dividends leave the brokerage like Jan-Nov months)
    let decYourTaxable = Math.max(0, yourTaxable - monthlyYourDividendsDec);
    let decYourBasis = yourBasis;
    let decYourCash = yourCash;
    let decWifeTaxable = Math.max(0, wifeTaxable - monthlyWifeDividendsDec);
    let decWifeBasis = wifeBasis;
    let decWifeCash = wifeCash;
    let decYourPreTax = yourPreTax;
    let decWifePreTax = wifePreTax;
    let decYourRoth = yourRoth;
    let decWifeRoth = wifeRoth;

    let decYourTradDraw = 0;
    let decWifeTradDraw = 0;

    let totalTaxBill = 0;
    let lastTaxBill = -999999;
    let iterations = 0;

    // IRS rule: in the actual year of death the survivor still files MFJ for the full year.
    // isSingle only flips to true in years AFTER the death year (year > DEATH_YEAR).
    const isSingle = (simulateSurvivor && (year > DEATH_YEAR)) || inputs.isSingleFiler;

    // isYouWorkingDec / isWifeWorkingDec depend only on decMonthIdx (constant), so hoist above solver loop.
    const isYouWorkingDec = !youDeceased && (decMonthIdx < yourRetireMonthIdx);
    const isWifeWorkingDec = !inputs.isSingleFiler && (decMonthIdx < wifeRetireMonthIdx);

    while (Math.abs(totalTaxBill - lastTaxBill) > 1 && iterations < 15) {
      lastTaxBill = totalTaxBill;
      iterations++;

      drawdownTaxableDec = 0;
      drawdownPreTaxDec = 0;
      drawdownRothDec = 0;
      drawdownCashDec = 0;
      capitalGainsTriggeredDec = 0;
      decYourTradDraw = 0;
      decWifeTradDraw = 0;

      decYourTaxable = yourTaxable;
      decYourBasis = yourBasis;
      decYourCash = yourCash;
      decWifeTaxable = wifeTaxable;
      decWifeBasis = wifeBasis;
      decWifeCash = wifeCash;
      decYourPreTax = yourPreTax;
      decWifePreTax = wifePreTax;
      decYourRoth = yourRoth;
      decWifeRoth = wifeRoth;

      // Tax Calculations
      const totalSS = annualYourSS + annualWifeSS;
      const salary = annualYourSalary + annualWifeSalary;
      const rmd = combinedRMD;
      const rothConv = combinedRothConversion;
      const janToNovTradDraw = annualYourTradDraw + annualWifeTradDraw;
      
      const totalDividends = annualYourDividends + annualWifeDividends;
      const qualifiedDividends = totalDividends * (1 - taxableNonQualifiedPortion);
      const ordinaryDividends = totalDividends * taxableNonQualifiedPortion;

      const yourDecInterest = youDeceased ? 0 : decYourCash * monthlyCashRate;
      const wifeDecInterest = inputs.isSingleFiler ? 0 : decWifeCash * monthlyCashRate;
      const totalCashInterest = (annualYourInterest + annualWifeInterest) + (yourDecInterest + wifeDecInterest);

      const nonSSOrdinary = salary + rmd + rothConv + ordinaryDividends + totalCashInterest + janToNovTradDraw + decYourTradDraw + decWifeTradDraw;
      const capitalGains = annualCapitalGainsTriggered + capitalGainsTriggeredDec + qualifiedDividends;

      const otherAGI = nonSSOrdinary + capitalGains;
      const taxableSS = calculateTaxableSS(totalSS, otherAGI, isSingle);
      const fedAGI = nonSSOrdinary + taxableSS + capitalGains;

      const stdDeductionBase = isSingle ? FED_STANDARD_DEDUCTION_SINGLE * cpiFactor : FED_STANDARD_DEDUCTION_MFJ * cpiFactor;
      let ageAddition = 0;
      if (isSingle) {
        if (yourAge >= 65) ageAddition += 1950 * cpiFactor;
      } else {
        if (yourAge >= 65) ageAddition += 1650 * cpiFactor;
        if (wifeAge >= 65) ageAddition += 1650 * cpiFactor;
      }
      stdDeduction = stdDeductionBase + ageAddition;

      const capExcl = 34300 * cpiFactor;
      const exclusionCapJohn = Math.max(0, capExcl - annualYourSS);
      const exclusionCapWife = Math.max(0, capExcl - annualWifeSS);
      const exclJohn = (!youDeceased && yourAge >= 65) ? Math.min(yourRMD + annualYourTradDraw + decYourTradDraw, exclusionCapJohn) : 0;
      const exclWife = (wifeAge >= 65) ? Math.min(wifeRMD + annualWifeTradDraw + decWifeTradDraw, exclusionCapWife) : 0;
      mdPensionExclusion = exclJohn + exclWife;

      const taxableOrdinary = Math.max(0, fedAGI - capitalGains - stdDeduction);
      const { totalTax: fedBaseTax } = calculateFedTaxWithLTCG(taxableOrdinary, capitalGains, isSingle, cpiFactor);
      fedIncomeTax = fedBaseTax;

      const niitThreshold = isSingle ? 200000 : 250000;
      const excessMAGI = Math.max(0, fedAGI - niitThreshold);
      const netInvestmentIncome = (annualCapitalGainsTriggered + capitalGainsTriggeredDec) + totalDividends;
      const niitBase = Math.min(netInvestmentIncome, excessMAGI);
      niitTax = niitBase * 0.038;
      fedIncomeTax += niitTax;

      if (isStateFL) {
        stateIncomeTax = 0;
      } else {
        stateIncomeTax = calculateMDStateTax(fedAGI, taxableSS, isSingle, cpiFactor, mdPensionExclusion);
      }
      totalTaxBill = fedIncomeTax + stateIncomeTax;

      // Dec standard cash flow values (decMonthIdx, isYouWorkingDec, isWifeWorkingDec hoisted above the loop)

      const monthlyYourSalaryDec = isYouWorkingDec ? ((inputs.you.activeSalary ?? 0) * cpiFactor) / 12 : 0;
      const monthlyWifeSalaryDec = isWifeWorkingDec ? ((inputs.wife.activeSalary ?? 0) * cpiFactor) / 12 : 0;
      const monthlyYourSSDec = (!youDeceased && decMonthIdx >= yourSSClaimMonthIdx) ? yourSSAnnualBase / 12 : 0;
      let monthlyWifeSSDec = 0;
      if (!inputs.isSingleFiler) {
        if (youDeceased) {
          if (decMonthIdx >= wifeSurvivorMonthIdx) monthlyWifeSSDec = wifeSurvivorSSBenefit / 12;
        } else if (decMonthIdx >= wifeSSClaimMonthIdx) {
          monthlyWifeSSDec = (decMonthIdx >= yourSSClaimMonthIdx) ? Math.max(wifeSSAnnualBase / 12, spousalSSAnnualFloor / 12) : wifeSSAnnualBase / 12;
        }
      }

      const monthlyYourOOPDec = !youDeceased ? (decMonthIdx < yourMedicareMonthIdx ? (isYouWorkingDec ? 0 : yourPreMedicareOOP / 12) : (isYouWorkingDec ? 0 : yourMedicareOOP / 12)) : 0;
      const monthlyWifeOOPDec = !inputs.isSingleFiler ? (decMonthIdx < wifeMedicareMonthIdx ? (isWifeWorkingDec ? 0 : wifePreMedicareOOP / 12) : (isWifeWorkingDec ? 0 : wifeMedicareOOP / 12)) : 0;
      const decLiving = (baseLivingExpensesAnnual * cpiFactor) / 12 + monthlyYourOOPDec + monthlyWifeOOPDec;

      let monthlyYourPremDec = 0;
      if (!youDeceased) {
        if (decMonthIdx < yourMedicareMonthIdx) {
          if (!isYouWorkingDec) monthlyYourPremDec = yourPreMedicareAnnual / 12;
        } else {
          if (!isYouWorkingDec) monthlyYourPremDec = yourMedicarePremiums / 12;
        }
      }
      let monthlyWifePremDec = 0;
      if (!inputs.isSingleFiler) {
        if (decMonthIdx < wifeMedicareMonthIdx) {
          if (!isWifeWorkingDec) monthlyWifePremDec = wifePreMedicareAnnual / 12;
        } else {
          if (!isWifeWorkingDec) monthlyWifePremDec = wifeMedicarePremiums / 12;
        }
      }

      const decPreMed = (decMonthIdx < yourMedicareMonthIdx ? monthlyYourPremDec : 0) + (!inputs.isSingleFiler && decMonthIdx < wifeMedicareMonthIdx ? monthlyWifePremDec : 0);
      const decMed = (decMonthIdx >= yourMedicareMonthIdx ? monthlyYourPremDec : 0) + (!inputs.isSingleFiler && decMonthIdx >= wifeMedicareMonthIdx ? monthlyWifePremDec : 0);

      const decOutflows = decLiving + decPreMed + decMed + (decMonthIdx >= yourMedicareMonthIdx && !isYouWorkingDec ? yourPartBSurcharge + yourPartDSurcharge : 0) + (!inputs.isSingleFiler && decMonthIdx >= wifeMedicareMonthIdx && !isWifeWorkingDec ? wifePartBSurcharge + wifePartDSurcharge : 0) + totalTaxBill;
      const decInflows = monthlyYourSSDec + monthlyWifeSSDec + monthlyYourSalaryDec + monthlyWifeSalaryDec + monthlyYourDividendsDec + monthlyWifeDividendsDec + yourRMD + wifeRMD;

      let decDeficit = decOutflows - decInflows;

      if (decDeficit > 0) {
        // Cash first
        if (!youDeceased && decYourCash > 0) {
          const draw = Math.min(decDeficit, decYourCash);
          drawdownCashDec += draw;
          decDeficit -= draw;
          decYourCash -= draw;
        }
        if (decDeficit > 0 && decWifeCash > 0) {
          const draw = Math.min(decDeficit, decWifeCash);
          drawdownCashDec += draw;
          decDeficit -= draw;
          decWifeCash -= draw;
        }

        // Brokerage second
        if (decDeficit > 0) {
          if (!youDeceased && decYourTaxable > 0) {
            const draw = Math.min(decDeficit, decYourTaxable);
            const basisRatio = decYourTaxable > 0 ? (decYourBasis / decYourTaxable) : 0;
            capitalGainsTriggeredDec += Math.max(0, draw * (1 - basisRatio));
            drawdownTaxableDec += draw;
            decDeficit -= draw;
            decYourTaxable -= draw;
            decYourBasis -= draw * basisRatio;
          }
          if (decDeficit > 0 && decWifeTaxable > 0) {
            const draw = Math.min(decDeficit, decWifeTaxable);
            const basisRatio = decWifeTaxable > 0 ? (decWifeBasis / decWifeTaxable) : 0;
            capitalGainsTriggeredDec += Math.max(0, draw * (1 - basisRatio));
            drawdownTaxableDec += draw;
            decDeficit -= draw;
            decWifeTaxable -= draw;
            decWifeBasis -= draw * basisRatio;
          }
        }

        // Pre-tax third
        if (decDeficit > 0) {
          if (!youDeceased && decYourPreTax > 0) {
            const draw = Math.min(decDeficit, decYourPreTax);
            decYourTradDraw += draw;
            drawdownPreTaxDec += draw;
            decDeficit -= draw;
            decYourPreTax -= draw;
          }
          if (decDeficit > 0 && decWifePreTax > 0) {
            const draw = Math.min(decDeficit, decWifePreTax);
            decWifeTradDraw += draw;
            drawdownPreTaxDec += draw;
            decDeficit -= draw;
            decWifePreTax -= draw;
          }
        }

        // Roth fourth
        if (decDeficit > 0) {
          if (!youDeceased && decYourRoth > 0) {
            const draw = Math.min(decDeficit, decYourRoth);
            drawdownRothDec += draw;
            decDeficit -= draw;
            decYourRoth -= draw;
          }
          if (decDeficit > 0 && decWifeRoth > 0) {
            const draw = Math.min(decDeficit, decWifeRoth);
            drawdownRothDec += draw;
            decDeficit -= draw;
            decWifeRoth -= draw;
          }
        }
      } else {
        // Reinvest December surplus into Brokerage
        const surplus = -decDeficit;
        if (surplus > 0) {
          if (isSurvivorActive || youDeceased) {
            decWifeTaxable += surplus;
            decWifeBasis += surplus;
          } else {
            const halfSurplus = surplus / 2;
            decYourTaxable += halfSurplus;
            decYourBasis += halfSurplus;
            decWifeTaxable += halfSurplus;
            decWifeBasis += halfSurplus;
          }
        }
      }
    }

    // Commit December values
    yourTaxable = decYourTaxable;
    yourBasis = decYourBasis;
    yourPreTax = decYourPreTax;
    yourRoth = decYourRoth;
    yourCash = decYourCash;

    wifeTaxable = decWifeTaxable;
    wifeBasis = decWifeBasis;
    wifePreTax = decWifePreTax;
    wifeRoth = decWifeRoth;
    wifeCash = decWifeCash;

    // Apply December growth
    yourTaxable = yourTaxable * (1 + monthlyTaxableRate);
    yourBasis = Math.max(0, yourBasis);
    yourPreTax = yourPreTax * (1 + monthlyPreTaxRate);
    yourRoth = yourRoth * (1 + monthlyRothRate);

    const yourDecInterest = youDeceased ? 0 : yourCash * monthlyCashRate;
    annualYourInterest += yourDecInterest;
    yourCash = yourCash + yourDecInterest;

    wifeTaxable = wifeTaxable * (1 + monthlyTaxableRate);
    wifeBasis = Math.max(0, wifeBasis);
    wifePreTax = wifePreTax * (1 + monthlyPreTaxRate);
    wifeRoth = wifeRoth * (1 + monthlyRothRate);

    const wifeDecInterest = inputs.isSingleFiler ? 0 : wifeCash * monthlyCashRate;
    annualWifeInterest += wifeDecInterest;
    wifeCash = wifeCash + wifeDecInterest;

    // Negative checking safety
    if (yourTaxable < 0.01) { yourTaxable = 0; yourBasis = 0; }
    if (yourPreTax < 0.01) yourPreTax = 0;
    if (yourRoth < 0.01) yourRoth = 0;
    if (yourCash < 0.01) yourCash = 0;
    if (wifeTaxable < 0.01) { wifeTaxable = 0; wifeBasis = 0; }
    if (wifePreTax < 0.01) wifePreTax = 0;
    if (wifeRoth < 0.01) wifeRoth = 0;
    if (wifeCash < 0.01) wifeCash = 0;

    const totalPortfolioValue = yourTaxable + yourPreTax + yourRoth + yourCash + wifeTaxable + wifePreTax + wifeRoth + wifeCash;

    // december specific calculations for ledger (decMonthIdx, isYouWorkingDec, isWifeWorkingDec already computed above)

    const monthlyYourSalaryDec = isYouWorkingDec ? ((inputs.you.activeSalary ?? 0) * cpiFactor) / 12 : 0;
    const monthlyWifeSalaryDec = isWifeWorkingDec ? ((inputs.wife.activeSalary ?? 0) * cpiFactor) / 12 : 0;
    const monthlyYourSSDec = (!youDeceased && decMonthIdx >= yourSSClaimMonthIdx) ? yourSSAnnualBase / 12 : 0;
    let monthlyWifeSSDec = 0;
    if (!inputs.isSingleFiler) {
      if (youDeceased) {
        if (decMonthIdx >= wifeSurvivorMonthIdx) monthlyWifeSSDec = wifeSurvivorSSBenefit / 12;
      } else if (decMonthIdx >= wifeSSClaimMonthIdx) {
        monthlyWifeSSDec = (decMonthIdx >= yourSSClaimMonthIdx) ? Math.max(wifeSSAnnualBase / 12, spousalSSAnnualFloor / 12) : wifeSSAnnualBase / 12;
      }
    }
    const monthlyYourOOPDec = !youDeceased ? (decMonthIdx < yourMedicareMonthIdx ? (isYouWorkingDec ? 0 : yourPreMedicareOOP / 12) : (isYouWorkingDec ? 0 : yourMedicareOOP / 12)) : 0;
    const monthlyWifeOOPDec = !inputs.isSingleFiler ? (decMonthIdx < wifeMedicareMonthIdx ? (isWifeWorkingDec ? 0 : wifePreMedicareOOP / 12) : (isWifeWorkingDec ? 0 : wifeMedicareOOP / 12)) : 0;
    const decLiving = (baseLivingExpensesAnnual * cpiFactor) / 12 + monthlyYourOOPDec + monthlyWifeOOPDec;

    let monthlyYourPremDec = 0;
    if (!youDeceased) {
      if (decMonthIdx < yourMedicareMonthIdx) {
        if (!isYouWorkingDec) monthlyYourPremDec = yourPreMedicareAnnual / 12;
      } else {
        if (!isYouWorkingDec) monthlyYourPremDec = yourMedicarePremiums / 12;
      }
    }
    let monthlyWifePremDec = 0;
    if (!inputs.isSingleFiler) {
      if (decMonthIdx < wifeMedicareMonthIdx) {
        if (!isWifeWorkingDec) monthlyWifePremDec = wifePreMedicareAnnual / 12;
      } else {
        if (!isWifeWorkingDec) monthlyWifePremDec = wifeMedicarePremiums / 12;
      }
    }
    const decPreMed = (decMonthIdx < yourMedicareMonthIdx ? monthlyYourPremDec : 0) + (!inputs.isSingleFiler && decMonthIdx < wifeMedicareMonthIdx ? monthlyWifePremDec : 0);
    const decMed = (decMonthIdx >= yourMedicareMonthIdx ? monthlyYourPremDec : 0) + (!inputs.isSingleFiler && decMonthIdx >= wifeMedicareMonthIdx ? monthlyWifePremDec : 0);

    annualYourSalary += monthlyYourSalaryDec;
    annualWifeSalary += monthlyWifeSalaryDec;
    annualYourSS += monthlyYourSSDec;
    annualWifeSS += monthlyWifeSSDec;
    annualLivingExpenses += decLiving;
    annualPreMedicarePremium += decPreMed;
    annualMedicareBasePremiums += decMed;

    // Tally December for Medicare month counts
    if (!youDeceased && decMonthIdx >= yourMedicareMonthIdx && !isYouWorkingDec) yourMedicareMonthCount++;
    if (!inputs.isSingleFiler && decMonthIdx >= wifeMedicareMonthIdx && !isWifeWorkingDec) wifeMedicareMonthCount++;

    // Pro-rate IRMAA surcharges: annual tier amounts × (months on Medicare / 12).
    // This handles mid-year Medicare enrollment correctly (e.g., turning 65 in July → 6/12).
    annualMedicareSurcharges =
      (yourMedicareMonthCount / 12) * (yourPartBSurcharge + yourPartDSurcharge) +
      (wifeMedicareMonthCount / 12) * (wifePartBSurcharge + wifePartDSurcharge);

    annualYourDividends += monthlyYourDividendsDec;
    annualWifeDividends += monthlyWifeDividendsDec;

    const totalSS = annualYourSS + annualWifeSS;
    const salary = annualYourSalary + annualWifeSalary;
    const rmd = combinedRMD;
    const rothConv = combinedRothConversion;
    const janToNovTradDraw = annualYourTradDraw + annualWifeTradDraw;

    const totalDividends = annualYourDividends + annualWifeDividends;
    const ordinaryDividends = totalDividends * taxableNonQualifiedPortion;
    const qualifiedDividends = totalDividends * (1 - taxableNonQualifiedPortion);

    const nonSSOrdinary = salary + rmd + rothConv + ordinaryDividends + janToNovTradDraw + decYourTradDraw + decWifeTradDraw;
    const capitalGains = annualCapitalGainsTriggered + capitalGainsTriggeredDec + qualifiedDividends;

    const otherAGI = nonSSOrdinary + capitalGains;
    const taxableSS = calculateTaxableSS(totalSS, otherAGI, isSingle);
    const fedAGI = nonSSOrdinary + taxableSS + capitalGains;
    const magi = fedAGI;

    // Drawdowns rollup
    drawdownCash = annualDrawdownCash + drawdownCashDec;
    drawdownTaxable = annualDrawdownTaxable + drawdownTaxableDec;
    drawdownPreTax = annualDrawdownPreTax + drawdownPreTaxDec;
    drawdownRoth = annualDrawdownRoth + drawdownRothDec;
    capitalGainsTriggered = annualCapitalGainsTriggered + capitalGainsTriggeredDec;

    const totalExpenses = annualLivingExpenses + fedIncomeTax + stateIncomeTax + annualMedicareBasePremiums + annualMedicareSurcharges + annualPreMedicarePremium;
    const incomeInflow = totalSS + combinedRMD + (annualYourSalary + annualWifeSalary) + totalDividends;
    const deficit = Math.max(0, totalExpenses - incomeInflow);

    ledger.push({
      year,
      yourAge,
      wifeAge,
      yourSS: annualYourSS,
      wifeSS: annualWifeSS,
      yourRMD,
      wifeRMD,
      yourSalary: annualYourSalary,
      wifeSalary: annualWifeSalary,
      capitalGainsTriggered,
      intentionalRothConversion: combinedRothConversion,
      otherTaxableIncome: drawdownPreTax,
      magi,
      fedAGI,
      standardDeduction: stdDeduction,
      taxableIncome: Math.max(0, fedAGI - stdDeduction),
      fedIncomeTax,
      stateIncomeTax,
      totalIncomeTax: fedIncomeTax + stateIncomeTax,
      niitTax,
      taxableSS,
      taxableDividends: totalDividends,
      taxableInterest: annualYourInterest + annualWifeInterest,
      cpiFactor,
      magiTwoYearsAgo,
      surchargeTier,
      yourPartBSurcharge: yourAge >= 65 && !isYouWorkingDec ? yourPartBSurcharge : 0,
      yourPartDSurcharge: yourAge >= 65 && !isYouWorkingDec ? yourPartDSurcharge : 0,
      wifePartBSurcharge: wifeAge >= 65 && !isWifeWorkingDec ? wifePartBSurcharge : 0,
      wifePartDSurcharge: wifeAge >= 65 && !isWifeWorkingDec ? wifePartDSurcharge : 0,
      combinedSurchargeMonthly: (yourAge >= 65 && !isYouWorkingDec ? yourPartBSurcharge + yourPartDSurcharge : 0) + (wifeAge >= 65 && !isWifeWorkingDec ? wifePartBSurcharge + wifePartDSurcharge : 0),
      combinedSurchargeAnnual: annualMedicareSurcharges,
      livingExpenses: annualLivingExpenses,
      medicareBasePremiums: annualMedicareBasePremiums,
      preMedicareHealthcareCost: annualPreMedicarePremium,
      totalExpenses,
      incomeInflow,
      deficit,
      drawdownTaxable,
      drawdownPreTax,
      drawdownRoth,
      drawdownCash,
      endYourPreTaxIRA: yourPreTax,
      endYourRothIRA: yourRoth,
      endYourTaxableBrokerage: yourTaxable,
      endYourTaxableBasis: yourBasis,
      endYourCash: yourCash,
      endWifePreTaxIRA: wifePreTax,
      endWifeRothIRA: wifeRoth,
      endWifeTaxableBrokerage: wifeTaxable,
      endWifeTaxableBasis: wifeBasis,
      endWifeCash: wifeCash,
      totalPortfolioValue,
    });
  }
  
  return ledger;
}
