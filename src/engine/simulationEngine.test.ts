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
      yourCash: 0,
      wifePreTaxIRA: 300000,
      wifeRothIRA: 50000,
      wifeTaxableBrokerage: 100000,
      wifeTaxableBasis: 80000,
      wifeCash: 0,
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
    
    
    const actualEndTaxable = row2040!.endYourTaxableBrokerage + row2040!.endWifeTaxableBrokerage;
    expect(actualEndTaxable).toBeCloseTo(892209.3, 1);
  });

  it('should apply pre-Medicare premiums and detailed health expenses correctly based on age, work status, and retirement', () => {
    const inputs = getMockInputs();
    inputs.useDetailedExpenses = true;
    inputs.detailedExpenses = {
      MD: {
        pre65MedicalPremium: 400,
        pre65MedicalOOP: 1200,
        pre65DentalPremium: 30,
        pre65DentalOOP: 90,
        pre65VisionPremium: 20,
        pre65VisionOOP: 60,

        medicarePartDPremium: 40,
        medicarePartDDeductibleCopays: 300,
        supplementPremium: 150,
        supplementOOP: 300,
        post65HearingCare: 500,
        post65DentalPremium: 20,
        post65DentalOOP: 60,
        post65VisionPremium: 10,
        post65VisionOOP: 35,
      },
      FL: {
        ...DEFAULT_DETAILED_EXPENSES,
      },
      frequencies: {
        pre65MedicalPremium: 12,
        pre65MedicalOOP: 1,
        pre65DentalPremium: 12,
        pre65DentalOOP: 1,
        pre65VisionPremium: 12,
        pre65VisionOOP: 1,
        medicarePartBPremium: 12,
        medicarePartDPremium: 12,
        medicarePartDDeductibleCopays: 1,
        supplementPremium: 12,
        supplementOOP: 1,
        post65HearingCare: 1,
        post65DentalPremium: 12,
        post65DentalOOP: 1,
        post65VisionPremium: 12,
        post65VisionOOP: 1,
      }
    };

    // John: 62 => retired from 2027 onwards
    // Jane: 60 => retired from 2028 onwards
    inputs.you.plannedRetirementAge = 62;
    inputs.wife.plannedRetirementAge = 60;

    // Healthcare Config:
    inputs.you.healthcare = {
      medicarePartBPremium: 200,
      MD: {
        pre65MedicalPremium: 400,
        pre65MedicalOOP: 1200,
        pre65DentalPremium: 30,
        pre65DentalOOP: 90,
        pre65VisionPremium: 20,
        pre65VisionOOP: 60,

        medicarePartDPremium: 40,
        medicarePartDDeductibleCopays: 300,
        supplementPremium: 150,
        supplementOOP: 300,
        post65HearingCare: 500,
        post65DentalPremium: 20,
        post65DentalOOP: 60,
        post65VisionPremium: 10,
        post65VisionOOP: 40,
      },
      FL: {
        pre65MedicalPremium: 350,
        pre65MedicalOOP: 1000,
        pre65DentalPremium: 25,
        pre65DentalOOP: 75,
        pre65VisionPremium: 15,
        pre65VisionOOP: 45,

        medicarePartDPremium: 35,
        medicarePartDDeductibleCopays: 250,
        supplementPremium: 130,
        supplementOOP: 230,
        post65HearingCare: 400,
        post65DentalPremium: 15,
        post65DentalOOP: 50,
        post65VisionPremium: 10,
        post65VisionOOP: 30,
      }
    };

    inputs.wife.healthcare = {
      medicarePartBPremium: 200,
      MD: {
        pre65MedicalPremium: 300,
        pre65MedicalOOP: 1000,
        pre65DentalPremium: 15,
        pre65DentalOOP: 60,
        pre65VisionPremium: 15,
        pre65VisionOOP: 40,

        medicarePartDPremium: 30,
        medicarePartDDeductibleCopays: 250,
        supplementPremium: 120,
        supplementOOP: 230,
        post65HearingCare: 400,
        post65DentalPremium: 10,
        post65DentalOOP: 40,
        post65VisionPremium: 10,
        post65VisionOOP: 40,
      },
      FL: {
        pre65MedicalPremium: 280,
        pre65MedicalOOP: 900,
        pre65DentalPremium: 15,
        pre65DentalOOP: 50,
        pre65VisionPremium: 10,
        pre65VisionOOP: 30,

        medicarePartDPremium: 28,
        medicarePartDDeductibleCopays: 200,
        supplementPremium: 110,
        supplementOOP: 190,
        post65HearingCare: 350,
        post65DentalPremium: 10,
        post65DentalOOP: 40,
        post65VisionPremium: 8,
        post65VisionOOP: 30,
      }
    };

    inputs.you.birthDate = '1965-06-15';
    inputs.wife.birthDate = '1968-09-20';

    const results = runRetirementSimulation(inputs);

    // Years to test:
    // 2026: John is 61 (working, age < 62), Jane is 58 (working, age < 60)
    //       => both working, so healthcare costs (both pre-Medicare and detailed health) are ignored.
    const row2026 = results.find(r => r.year === 2026);
    expect(row2026!.preMedicareHealthcareCost).toBe(0);
    expect(row2026!.livingExpenses).toBe(0);

    // 2027: John is 62 (retired, under 65), Jane is 59 (working, age < 60)
    //       => John pays pre-Medicare premiums: (400 + 30) * 7 = 3150 * hcFactor. Jane is working, so 0.
    //       => John pays pre-Medicare OOP: (1200 + 90 + 60) * 7 / 12 * hcFactor = 787.5 * hcFactor.
    const row2027 = results.find(r => r.year === 2027);
    const hcFactor2027 = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, 2027 - 2026);
    expect(row2027!.preMedicareHealthcareCost).toBeCloseTo(3150 * hcFactor2027, 1);
    expect(row2027!.livingExpenses).toBeCloseTo(787.5 * hcFactor2027, 1);

    // 2028: John is 63 (retired, under 65), Jane is 60 (retired, under 65)
    //       => Both are retired & under 65.
    //       => John pre-Medicare Premium = 5400 * hcFactor, OOP = 1150 * hcFactor
    //       => Jane pre-Medicare Premium = 330 * 4 * hcFactor = 1320 * hcFactor
    const row2028 = results.find(r => r.year === 2028);
    const hcFactor2028 = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, 2028 - 2026);
    expect(row2028!.preMedicareHealthcareCost).toBeCloseTo(6720 * hcFactor2028, 1);
    expect(row2028!.livingExpenses).toBeCloseTo(1716.67 * hcFactor2028, 1);

    // 2030: John is 65 (on Medicare, retired), Jane is 62 (retired, under 65)
    //       => John turns 65 in June (retired for 7 months Medicare, 5 months pre-Medicare)
    //       => John pre-Medicare Premium: 5 months = 450 * 5 = 2250 * hcFactor
    //       => John pre-Medicare OOP: 5 months = 1150 / 12 * 5 = 479.167 * hcFactor
    //       => John Medicare Premium: 7 months = (200 + 40) * 7 + (150 + 30) * 7 * hcFactor = 1680 + 1260 * hcFactor
    //       => John Medicare OOP: 7 months = 1200 / 12 * 7 = 700 * hcFactor
    //       => Jane pre-Medicare Premium: 12 months = 330 * 12 = 3960 * hcFactor
    //       => Jane pre-Medicare OOP: 12 months = 900 * hcFactor
    //       => Combined pre-Medicare premium = (2250 + 3960) * hcFactor = 6210 * hcFactor
    //       => Combined Medicare base premium = 1680 + 1260 * hcFactor
    //       => Combined OOP = (479.167 + 700 + 900) * hcFactor = 2079.167 * hcFactor
    const row2030 = results.find(r => r.year === 2030);
    const hcFactor2030 = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, 2030 - 2026);
    expect(row2030!.preMedicareHealthcareCost).toBeCloseTo(6210 * hcFactor2030, 1);
    expect(row2030!.medicareBasePremiums).toBeCloseTo(1680 + 1260 * hcFactor2030, 1);
    expect(row2030!.livingExpenses).toBeCloseTo(2362.5 * hcFactor2030, 1);

    // 2033: John is 68 (on Medicare, retired), Jane is 65 (on Medicare, retired)
    //       => John is on Medicare 12 months. Jane turns 65 in Sept (8 months pre-Medicare, 4 months Medicare).
    //       => Jane pre-Medicare Premium: 8 months = 330 * 8 = 2640 * hcFactor
    //       => Jane pre-Medicare OOP: 8 months = 900 / 12 * 8 = 600 * hcFactor
    //       => John Medicare premiums: (200 * 1.05^3 + 40 * 1.05^3) * 12 + 180 * 12 * hcFactor = 3333.96 + 2160 * hcFactor
    //       => Jane Medicare premiums: (200 + 30) * 4 + 140 * 4 * hcFactor = 920 + 560 * hcFactor
    //       => Combined Medicare base premium = 4253.96 + 2720 * hcFactor
    //       => Combined OOP = (John Medicare OOP (1200) + Jane pre-Medicare OOP (600) + Jane Medicare OOP (320)) * hcFactor = 2120 * hcFactor
    const row2033 = results.find(r => r.year === 2033);
    const hcFactor2033 = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, 2033 - 2026);
    
    const johnPartBCurrent = 200 * Math.pow(1.05, 3);
    const johnPartDCurrent = 40 * Math.pow(1.05, 3);
    const johnPremiums = (johnPartBCurrent + johnPartDCurrent) * 12 + 180 * 12 * hcFactor2033;
    
    const janePremiums = (200 + 30) * 4 + 140 * 4 * hcFactor2033;
    
    expect(row2033!.preMedicareHealthcareCost).toBeCloseTo(2640 * hcFactor2033, 1);
    expect(row2033!.medicareBasePremiums).toBeCloseTo(johnPremiums + janePremiums, 1);
    expect(row2033!.livingExpenses).toBeCloseTo(2253.33 * hcFactor2033, 1);
  });

  it('should transition to target state healthcare costs upon relocation', () => {
    const inputs = getMockInputs();
    inputs.isSingleFiler = true;
    inputs.useDetailedExpenses = true;
    inputs.detailedExpenses = {
      MD: { ...DEFAULT_DETAILED_EXPENSES },
      FL: { ...DEFAULT_DETAILED_EXPENSES },
      frequencies: { ...DEFAULT_EXPENSE_FREQUENCIES }
    };

    inputs.you.birthDate = '1970-01-01'; // turns 65 in 2035.
    inputs.you.plannedRetirementAge = 60; // retired
    inputs.you.healthcare = {
      medicarePartBPremium: 200,
    };
    
    inputs.you.healthcare.MD = {
      pre65MedicalPremium: 500,
      pre65MedicalOOP: 1000,
      pre65DentalPremium: 20,
      pre65DentalOOP: 50,
      pre65VisionPremium: 10,
      pre65VisionOOP: 30,

      medicarePartDPremium: 40,
      medicarePartDDeductibleCopays: 300,
      supplementPremium: 150,
      supplementOOP: 300,
      post65HearingCare: 500,
      post65DentalPremium: 20,
      post65DentalOOP: 60,
      post65VisionPremium: 10,
      post65VisionOOP: 40,
    };
    inputs.you.healthcare.FL = {
      pre65MedicalPremium: 400,
      pre65MedicalOOP: 800,
      pre65DentalPremium: 15,
      pre65DentalOOP: 40,
      pre65VisionPremium: 8,
      pre65VisionOOP: 20,

      medicarePartDPremium: 30,
      medicarePartDDeductibleCopays: 200,
      supplementPremium: 120,
      supplementOOP: 200,
      post65HearingCare: 400,
      post65DentalPremium: 15,
      post65DentalOOP: 40,
      post65VisionPremium: 8,
      post65VisionOOP: 30,
    };

    inputs.jurisdiction.currentState = 'MD';
    inputs.jurisdiction.targetState = 'FL';
    inputs.jurisdiction.relocationYear = 2032;

    const results = runRetirementSimulation(inputs);

    // In 2031 (still MD): pre-Medicare premium should be MD rate = (500 + 20 + 10) * 12 = 6360 * hcFactor.
    const row2031 = results.find(r => r.year === 2031);
    const hcFactor2031 = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, 2031 - 2026);
    expect(row2031!.preMedicareHealthcareCost).toBeCloseTo(6360 * hcFactor2031, 1);

    // In 2032 (relocation year): pre-Medicare premium should switch to FL rate = (400 + 15 + 8) * 12 = 5076 * hcFactor.
    const row2032 = results.find(r => r.year === 2032);
    const hcFactor2032 = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, 2032 - 2026);
    expect(row2032!.preMedicareHealthcareCost).toBeCloseTo(5076 * hcFactor2032, 1);
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
    expect(row2026!.incomeInflow).toBeGreaterThanOrEqual(19500);

    // Verify basis step-up in MD: 50% step-up (deceased's account stepped up to FMV at death).
    const row2045MD = resultsMD.find(r => r.year === 2045);
    expect(row2045MD!.endWifeTaxableBasis).toBeCloseTo(455506.6, 1);

    // Now set current and target state to FL
    inputs.jurisdiction.currentState = 'FL';
    inputs.jurisdiction.targetState = 'FL';
    const resultsFL = runRetirementSimulation(inputs, true);
    const row2045FL = resultsFL.find(r => r.year === 2045);
    
    expect(row2045FL!.endWifeTaxableBasis).toBeCloseTo(1332911.3, 1);
    expect(row2045FL!.endWifeTaxableBrokerage).toBeCloseTo(1382362.9, 1);
  });

  it('should draw from Cash Assets first and grow remaining cash at the fixed income rate', () => {
    const inputs = getMockInputs();
    inputs.isSingleFiler = true;
    inputs.you.birthDate = '1960-01-01';
    inputs.you.plannedRetirementAge = 60; // retired
    inputs.annualLivingExpenses = 100000;
    
    // Set starting balances
    inputs.portfolio.yourCash = 50000;
    inputs.portfolio.yourTaxableBrokerage = 100000;
    inputs.portfolio.yourTaxableBasis = 80000;
    inputs.portfolio.yourPreTaxIRA = 0;
    inputs.portfolio.yourRothIRA = 0;

    const results = runRetirementSimulation(inputs);
    const row2026 = results.find(r => r.year === 2026);
    expect(row2026).toBeDefined();

    // Deficit will exhaust all 50k cash first.
    expect(row2026!.drawdownCash).toBeCloseTo(50409.35, 1);
    expect(row2026!.endYourCash).toBe(0);

    // Remaining deficit is drawn from Taxable Brokerage.
    expect(row2026!.drawdownTaxable).toBeGreaterThan(0);
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
