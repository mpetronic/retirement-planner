import { describe, it, expect } from 'vitest';
import {
  calculateSSBenefit,
  calculateSpousalBenefit,
  calculateTaxableSS,
  calculateFedTax,
  calculateMDStateTax,
  runRetirementSimulation,
  calculateFedTaxWithLTCG,
  getRMDStartAge,
} from './simulationEngine';
import { DEFAULT_DETAILED_EXPENSES, DEFAULT_EXPENSE_FREQUENCIES } from '../types';

describe('calculateSSBenefit', () => {
  const PIA = 1000;

  it('should return 100% of PIA when claiming at Full Retirement Age (67)', () => {
    const benefit = calculateSSBenefit(PIA, 67);
    expect(benefit).toBeCloseTo(1000, 1);
  });

  it('should increase benefit by 8% per year delayed past FRA (67) up to age 70', () => {
    // 3 years delay: 3 * 8% = 24% increase
    const benefit70 = calculateSSBenefit(PIA, 70);
    expect(benefit70).toBeCloseTo(1240, 1);

    // Caps at 70 even if claimingAge is entered higher
    const benefit72 = calculateSSBenefit(PIA, 72);
    expect(benefit72).toBeCloseTo(1240, 1);
  });

  it('should apply the correct reduction schedule for early claiming', () => {
    // 3 years (36 months) early (age 64)
    // Reduction: 36 * (5/900) = 20%
    const benefit64 = calculateSSBenefit(PIA, 64);
    expect(benefit64).toBeCloseTo(800, 1);

    // 5 years (60 months) early (age 62)
    // Reduction: 36 * (5/900) + 24 * (5/1200) = 20% + 10% = 30%
    const benefit62 = calculateSSBenefit(PIA, 62);
    expect(benefit62).toBeCloseTo(700, 1);

    // Floors at age 62 claiming reduction even if claimingAge is entered lower
    const benefit60 = calculateSSBenefit(PIA, 60);
    expect(benefit60).toBeCloseTo(700, 1);
  });
});

describe('calculateSpousalBenefit', () => {
  const primaryPIA = 2000; // Base spousal benefit would be 1000 (50%)

  it('should return 50% of primary PIA at FRA (67)', () => {
    const benefit = calculateSpousalBenefit(primaryPIA, 67);
    expect(benefit).toBeCloseTo(1000, 1);
  });

  it('should not provide delayed credits past FRA (67)', () => {
    const benefit70 = calculateSpousalBenefit(primaryPIA, 70);
    expect(benefit70).toBeCloseTo(1000, 1);
  });

  it('should return 0 if primary PIA is 0 or negative', () => {
    expect(calculateSpousalBenefit(0, 67)).toBe(0);
    expect(calculateSpousalBenefit(-100, 67)).toBe(0);
  });

  it('should apply spousal early claim reduction schedule (25/36% first 36m, 5/12% next)', () => {
    // 3 years (36 months) early (age 64)
    // Reduction: 36 * (25/3600) = 25% reduction
    // Spousal benefit: 1000 * 0.75 = 750
    const benefit64 = calculateSpousalBenefit(primaryPIA, 64);
    expect(benefit64).toBeCloseTo(750, 1);

    // 5 years (60 months) early (age 62)
    // Reduction: 36 * (25/3600) + 24 * (5/1200) = 25% + 10% = 35% reduction
    // Spousal benefit: 1000 * 0.65 = 650
    const benefit62 = calculateSpousalBenefit(primaryPIA, 62);
    expect(benefit62).toBeCloseTo(650, 1);
  });
});

describe('calculateTaxableSS', () => {
  const totalSS = 10000;

  describe('Single filers', () => {
    it('should have 0% taxable SS when provisional income is <= $25,000', () => {
      // Provisional income: otherAGI + 0.5 * SS = 19000 + 5000 = 24000
      const taxable = calculateTaxableSS(totalSS, 19000, true);
      expect(taxable).toBe(0);
    });

    it('should calculate up to 50% taxable SS between $25,000 and $34,000 provisional income', () => {
      // Provisional income: 24000 + 5000 = 29000
      // Formula: min(0.5 * SS, 0.5 * (PI - 25000)) = min(5000, 0.5 * 4000) = 2000
      const taxable = calculateTaxableSS(totalSS, 24000, true);
      expect(taxable).toBeCloseTo(2000, 1);
    });

    it('should apply 85% rule correctly when provisional income is > $34,000', () => {
      // Provisional income: 45000 + 5000 = 50000
      // Base: min(4500, 0.5 * min(SS, 9000)) = min(4500, 4500) = 4500
      // Formula: min(0.85 * SS, base + 0.85 * (PI - 34000)) = min(8500, 4500 + 0.85 * 16000) = min(8500, 4500 + 13600) = 8500
      const taxable = calculateTaxableSS(totalSS, 45000, true);
      expect(taxable).toBeCloseTo(8500, 1);
    });
  });

  describe('MFJ filers', () => {
    it('should have 0% taxable SS when provisional income is <= $32,000', () => {
      // Provisional income: 26000 + 5000 = 31000
      const taxable = calculateTaxableSS(totalSS, 26000, false);
      expect(taxable).toBe(0);
    });

    it('should calculate up to 50% taxable SS between $32,000 and $44,000 provisional income', () => {
      // Provisional income: 33000 + 5000 = 38000
      // Formula: min(5000, 0.5 * 6000) = 3000
      const taxable = calculateTaxableSS(totalSS, 33000, false);
      expect(taxable).toBeCloseTo(3000, 1);
    });

    it('should apply 85% rule correctly when provisional income is > $44,000', () => {
      // Provisional income: 55000 + 5000 = 60000
      // Base: min(6000, 4500) = 4500
      // Formula: min(8500, 4500 + 0.85 * 16000) = 8500
      const taxable = calculateTaxableSS(totalSS, 55000, false);
      expect(taxable).toBeCloseTo(8500, 1);
    });
  });
});

describe('Tax calculations', () => {
  it('should calculate federal income tax correctly', () => {
    // 0 taxable income = 0 tax
    const zeroTax = calculateFedTax(0, false, 1.0);
    expect(zeroTax).toBe(0);

    // MFJ with 50,000 taxable income, 1.0 CPI factor
    // 2026 brackets MFJ: 10% on first $24,800, then 12% on the rest
    // Expected: 24800 * 0.10 + (50000 - 24800) * 0.12 = 2480 + 25200 * 0.12 = 2480 + 3024 = 5504
    const mfjTax = calculateFedTax(50000, false, 1.0);
    expect(mfjTax).toBeCloseTo(5504, 1);
  });

  it('should calculate Maryland state tax correctly with standard piggyback rate', () => {
    // AGI: 60000, taxableSS: 0, isSingle: false
    const mdTaxMFJ = calculateMDStateTax(60000, 0, false);
    expect(mdTaxMFJ).toBeGreaterThan(0);

    // AGI: 60000, taxableSS: 0, isSingle: true
    const mdTaxSingle = calculateMDStateTax(60000, 0, true);
    expect(mdTaxSingle).toBeGreaterThan(0);
  });
});

describe('runRetirementSimulation', () => {
  const getMockInputs = (): any => ({
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
      trials: 10,
      seed: 42,
    },
    isConfigured: true,
    isSingleFiler: false,
  });

  it('should run simulation and return a sequence of years starting from 2026', () => {
    const inputs = getMockInputs();
    const results = runRetirementSimulation(inputs);

    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].year).toBe(2026);
  });

  it('should correctly drop state income taxes to 0 when relocating to Florida', () => {
    const inputs = getMockInputs();
    // Relocate to Florida in 2030
    inputs.jurisdiction.relocationYear = 2030;
    inputs.jurisdiction.currentState = 'MD';
    inputs.jurisdiction.targetState = 'FL';

    const results = runRetirementSimulation(inputs);

    // Verify state taxes in MD (before 2030) are positive and become 0 starting in 2030
    const row2026 = results.find(r => r.year === 2026);
    const row2030 = results.find(r => r.year === 2030);

    expect(row2026).toBeDefined();
    expect(row2026!.stateIncomeTax).toBeGreaterThan(0);

    expect(row2030).toBeDefined();
    expect(row2030!.stateIncomeTax).toBe(0);
  });

  it('should calculate Social Security income starting at target claiming ages', () => {
    const inputs = getMockInputs();
    inputs.you.targetSSClaimingAge = 67; // John born 1965 => claims at 2032
    inputs.wife.targetSSClaimingAge = 66; // Jane born 1968 => claims at 2034

    const results = runRetirementSimulation(inputs);

    const row2026 = results.find(r => r.year === 2026); // John age 61, Jane age 58 => no SS
    const row2032 = results.find(r => r.year === 2032); // John age 67 => John claims SS
    const row2034 = results.find(r => r.year === 2034); // Jane age 66 => Jane claims SS

    expect(row2026!.yourSS).toBe(0);
    expect(row2026!.wifeSS).toBe(0);

    expect(row2032!.yourSS).toBeGreaterThan(0);
    expect(row2034!.wifeSS).toBeGreaterThan(0);
  });

  it('should calculate living expenses using detailed state-specific itemized entries and frequencies when useDetailedExpenses is true', () => {
    const inputs = getMockInputs();
    inputs.useDetailedExpenses = true;
    inputs.detailedExpenses = {
      MD: {
        ...DEFAULT_DETAILED_EXPENSES,
        amenityFee: 100, // Monthly
        water: 50,       // Monthly
        masterBedFurniture: 5000, // One-time
      },
      FL: {
        ...DEFAULT_DETAILED_EXPENSES,
        amenityFee: 150, // Monthly
        water: 60,       // Monthly
        masterBedFurniture: 8000, // One-time
      },
      frequencies: {
        ...DEFAULT_EXPENSE_FREQUENCIES,
        amenityFee: 12,
        water: 12,
      }
    };
    inputs.jurisdiction.currentState = 'MD';
    inputs.jurisdiction.targetState = 'FL';
    inputs.jurisdiction.relocationYear = 2030;

    const results = runRetirementSimulation(inputs);

    // In 2026 (first year, current state MD):
    // Recurring annual = (100 * 12) + (50 * 12) = 1200 + 600 = 1800
    // One-time MD = 5000
    // Total in 2026 (cpiFactor = 1.0) = 1800 + 5000 = 6800
    const row2026 = results.find(r => r.year === 2026);
    expect(row2026).toBeDefined();
    expect(row2026!.livingExpenses).toBeCloseTo(6800, 1);

    // In 2029 (still MD, cpiFactor):
    // Recurring annual = 1800 * cpiFactor
    // One-time = 0
    const row2029 = results.find(r => r.year === 2029);
    const cpiFactor2029 = Math.pow(1 + inputs.growthAssumptions.cpiInflationRate, 2029 - 2026);
    expect(row2029!.livingExpenses).toBeCloseTo(1800 * cpiFactor2029, 1);

    // In 2030 (relocated to FL, cpiFactor):
    // Recurring annual = (150 * 12) + (60 * 12) = 1800 + 720 = 2520
    // One-time FL = 8000
    // Total in 2030 = (2520 + 8000) * cpiFactor
    const row2030 = results.find(r => r.year === 2030);
    const cpiFactor2030 = Math.pow(1 + inputs.growthAssumptions.cpiInflationRate, 2030 - 2026);
    expect(row2030!.livingExpenses).toBeCloseTo((2520 + 8000) * cpiFactor2030, 1);
  });

  it('should reinvest annual surplus cash inflows (when SS + RMD > total outflows) back into taxable brokerage accounts and cost basis', () => {
    const inputs = getMockInputs();
    
    // Tweak inputs to force a huge surplus:
    // Low annual living expenses, large starting pre-tax balances, high claiming age to trigger high RMDs
    inputs.annualLivingExpenses = 20000; // very low expenses
    inputs.you.estimatedPIA = 3500;
    inputs.you.targetSSClaimingAge = 70;
    inputs.wife.estimatedPIA = 3000;
    inputs.wife.targetSSClaimingAge = 70;
    
    // Large Traditional pre-tax IRAs to produce huge RMDs
    inputs.portfolio.yourPreTaxIRA = 5000000;
    inputs.portfolio.wifePreTaxIRA = 4000000;
    
    // Moderate taxable account to see the surplus addition clearly
    inputs.portfolio.yourTaxableBrokerage = 100000;
    inputs.portfolio.yourTaxableBasis = 80000;
    inputs.portfolio.wifeTaxableBrokerage = 50000;
    inputs.portfolio.wifeTaxableBasis = 40000;
    
    // Set retirement age so they are not earning salary at 75
    inputs.you.plannedRetirementAge = 60;
    inputs.wife.plannedRetirementAge = 60;

    const results = runRetirementSimulation(inputs);
    
    // RMDs start at Age 75. Let's find a year where RMDs are active (e.g. John age 75, born 1965 => year 2040)
    const row2040 = results.find(r => r.year === 2040);
    expect(row2040).toBeDefined();
    
    const totalSS = row2040!.yourSS + row2040!.wifeSS;
    const totalRMD = row2040!.yourRMD + row2040!.wifeRMD;
    const totalInflow = totalSS + totalRMD;
    const totalOutflow = row2040!.livingExpenses + row2040!.fedIncomeTax + row2040!.stateIncomeTax + row2040!.medicareBasePremiums + row2040!.combinedSurchargeAnnual + row2040!.preMedicareHealthcareCost;
    
    const surplus = totalInflow - totalOutflow;
    expect(surplus).toBeGreaterThan(0); // Confirm we set up a surplus year
    
    // Let's check the previous year (2039) ending taxable balance
    const row2039 = results.find(r => r.year === 2039);
    const startTaxable = row2039!.endYourTaxableBrokerage + row2039!.endWifeTaxableBrokerage;
    
    // Expected ending taxable before growth: startTaxable + surplus
    // Expected ending taxable after growth: (startTaxable + surplus) * 1.058
    const expectedEndTaxable = (startTaxable + surplus) * 1.058;
    const actualEndTaxable = row2040!.endYourTaxableBrokerage + row2040!.endWifeTaxableBrokerage;
    
    expect(actualEndTaxable).toBeCloseTo(expectedEndTaxable, 1); // Allow slight float variance
  });

  it('should apply pre-Medicare premiums and detailed health expenses correctly based on age, work status, and retirement', () => {
    const inputs = getMockInputs();
    inputs.useDetailedExpenses = true;
    inputs.detailedExpenses = {
      MD: {
        ...DEFAULT_DETAILED_EXPENSES,
        visionOutOfPocket: 50, // Monthly recurring health expense => 50 * 12 = 600/yr per person
      },
      FL: {
        ...DEFAULT_DETAILED_EXPENSES,
        visionOutOfPocket: 50,
      },
      frequencies: {
        ...DEFAULT_EXPENSE_FREQUENCIES,
        visionOutOfPocket: 12,
      }
    };

    // Birth dates:
    // John: '1965-06-15' => turns 65 in 2030.
    // Jane: '1968-09-20' => turns 65 in 2033.
    inputs.you.birthDate = '1965-06-15';
    inputs.wife.birthDate = '1968-09-20';

    // Retirement ages:
    // John: 62 => retired from 2027 onwards
    // Jane: 60 => retired from 2028 onwards
    inputs.you.plannedRetirementAge = 62;
    inputs.wife.plannedRetirementAge = 60;

    // Pre-Medicare premiums:
    // John: 400/mo ($4800/yr)
    // Jane: 300/mo ($3600/yr)
    inputs.you.preMedicareMonthlyPremium = 400;
    inputs.wife.preMedicareMonthlyPremium = 300;

    const results = runRetirementSimulation(inputs);

    // Years to test:
    // 2026: John is 61 (working, age < 62), Jane is 58 (working, age < 60)
    //       => both working, so healthcare costs (both pre-Medicare and detailed health) are ignored.
    const row2026 = results.find(r => r.year === 2026);
    expect(row2026!.preMedicareHealthcareCost).toBe(0);
    // Since baseLivingExpensesAnnual is 0 (as amenityFee, water are 0, only visionOutOfPocket is 50/mo which is ignored),
    // livingExpenses should be 0.
    expect(row2026!.livingExpenses).toBe(0);

    // 2027: John is 62 (retired, under 65), Jane is 59 (working, age < 60)
    //       => John pays pre-Medicare (400 * 12 = 4800, inflated). Jane is working, so her health expenses are ignored.
    const row2027 = results.find(r => r.year === 2027);
    const hcFactor2027 = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, 2027 - 2026);
    expect(row2027!.preMedicareHealthcareCost).toBeCloseTo(4800 * hcFactor2027, 1);
    expect(row2027!.livingExpenses).toBe(0);

    // 2028: John is 63 (retired, under 65), Jane is 60 (retired, under 65)
    //       => Both are retired & under 65.
    //       => Pre-Medicare premium = (4800 + 3600) * hcFactor = 8400 * hcFactor
    //       => Detailed health expenses are still ignored (livingExpenses = 0).
    const row2028 = results.find(r => r.year === 2028);
    const hcFactor2028 = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, 2028 - 2026);
    expect(row2028!.preMedicareHealthcareCost).toBeCloseTo(8400 * hcFactor2028, 1);
    expect(row2028!.livingExpenses).toBe(0);

    // 2030: John is 65 (on Medicare, retired), Jane is 62 (retired, under 65)
    //       => John's pre-Medicare is ignored, and he pays detailed health (600/yr).
    //       => Jane still pays pre-Medicare (3600 * hcFactor).
    //       => Detailed health expenses should include 1x (John) = 600 * cpiFactor.
    const row2030 = results.find(r => r.year === 2030);
    const hcFactor2030 = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, 2030 - 2026);
    const cpiFactor2030 = Math.pow(1 + inputs.growthAssumptions.cpiInflationRate, 2030 - 2026);
    expect(row2030!.preMedicareHealthcareCost).toBeCloseTo(3600 * hcFactor2030, 1);
    expect(row2030!.livingExpenses).toBeCloseTo(600 * cpiFactor2030, 1);

    // 2033: John is 68 (on Medicare, retired), Jane is 65 (on Medicare, retired)
    //       => Both are on Medicare & retired.
    //       => Pre-Medicare premium is 0 for both.
    //       => Detailed health expenses should include 2x (both) = 1200 * cpiFactor.
    const row2033 = results.find(r => r.year === 2033);
    const cpiFactor2033 = Math.pow(1 + inputs.growthAssumptions.cpiInflationRate, 2033 - 2026);
    expect(row2033!.preMedicareHealthcareCost).toBe(0);
    expect(row2033!.livingExpenses).toBeCloseTo(1200 * cpiFactor2033, 1);
  });

  it('should apply 50% step-up in basis in MD and 100% in FL on death, and generate annual dividends', () => {
    const inputs = getMockInputs();
    inputs.isConfigured = true;
    inputs.isSingleFiler = false;
    inputs.simulateSurvivor = true;
    inputs.you.birthDate = '1960-01-01'; // Turns 85 in 2045 (Death Year)
    inputs.wife.birthDate = '1964-01-01';

    inputs.portfolio.yourTaxableBrokerage = 500000;
    inputs.portfolio.yourTaxableBasis = 200000;
    inputs.portfolio.wifeTaxableBrokerage = 500000;
    inputs.portfolio.wifeTaxableBasis = 200000;

    // Yield configuration
    inputs.portfolio.taxableDividendYield = 0.02; // 2% yield
    inputs.portfolio.taxableNonQualifiedPortion = 0.30;

    // MD Relocation Year is null (remain in MD)
    inputs.jurisdiction.currentState = 'MD';
    inputs.jurisdiction.targetState = 'MD';
    inputs.jurisdiction.relocationYear = null;

    // Run simulation in MD
    const resultsMD = runRetirementSimulation(inputs, true);
    
    // Let's verify dividends generated in 2026:
    // Total taxable balance at start of 2026: 500k + 500k = 1,000,000.
    // Expected dividends: 1,000,000 * 2% = 20,000.
    const row2026 = resultsMD.find(r => r.year === 2026);
    expect(row2026!.incomeInflow).toBeGreaterThanOrEqual(20000);

    // Verify basis step-up in MD: 50% step-up (deceased's account stepped up to FMV at death).
    const row2045MD = resultsMD.find(r => r.year === 2045);
    expect(row2045MD!.endWifeTaxableBasis).toBeGreaterThan(200000);

    // Now set current and target state to FL
    inputs.jurisdiction.currentState = 'FL';
    inputs.jurisdiction.targetState = 'FL';
    const resultsFL = runRetirementSimulation(inputs, true);
    const row2045FL = resultsFL.find(r => r.year === 2045);
    // In FL, 100% step-up (both husband's and wife's accounts stepped up to FMV at death).
    // The basis is static during the year, but the balance grows by 5.8% (taxableGrowthRate).
    expect(row2045FL!.endWifeTaxableBasis * 1.058).toBeCloseTo(row2045FL!.endWifeTaxableBrokerage, 1);
  });
});

describe('calculateFedTaxWithLTCG', () => {
  it('should compute tax with LTCG stacked correctly', () => {
    // Single filer, taxable ordinary = 40,000, taxable LTCG = 20,000.
    // Expected ltcgTax: 9,800 * 0.15 = 1470.
    const res = calculateFedTaxWithLTCG(40000, 20000, true, 1);
    expect(res.ltcgTax).toBeCloseTo(1470, 1);
    expect(res.ordinaryTax).toBe(calculateFedTax(40000, true, 1));
    expect(res.totalTax).toBe(res.ordinaryTax + 1470);
  });
});

describe('getRMDStartAge', () => {
  it('should return correct RMD start age based on birth year', () => {
    expect(getRMDStartAge(1950)).toBe(72);
    expect(getRMDStartAge(1955)).toBe(73);
    expect(getRMDStartAge(1960)).toBe(75);
  });
});
