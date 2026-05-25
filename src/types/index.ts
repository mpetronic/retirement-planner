export interface SpouseProfile {
  name?: string; // Customizable display name
  birthDate: string; // YYYY-MM-DD
  estimatedPIA: number | null; // Primary Insurance Amount at Full Retirement Age (FRA)
  targetSSClaimingAge: number | null; // Claiming age (62 to 70)
  plannedRetirementAge?: number | null; // Planned retirement age (55 to 75)
  activeSalary?: number | null; // Pre-retirement annual active salary
  preMedicareMonthlyPremium?: number | null; // Pre-Medicare monthly premium (e.g. $800)
}

export interface PortfolioBalances {
  yourPreTaxIRA: number | null;
  yourRothIRA: number | null;
  yourTaxableBrokerage: number | null;
  yourTaxableBasis: number | null;
  wifePreTaxIRA: number | null;
  wifeRothIRA: number | null;
  wifeTaxableBrokerage: number | null;
  wifeTaxableBasis: number | null;
}

export interface LockedReturnSequence {
  id: string; // Unique timestamp or ID of the sequence
  mode: 'monte-carlo' | 'historical';
  equityReturns: number[]; // Array of 35 rates (2026 to 2060)
  fixedIncomeReturns: number[]; // Array of 35 rates (2026 to 2060)
}

export interface MonteCarloSettings {
  mode: 'monte-carlo' | 'historical';
  equityVolatility: number;      // e.g. 0.15 (15%)
  fixedIncomeVolatility: number; // e.g. 0.05 (5%)
  correlation: number;           // e.g. 0.15
  trials: number;                // e.g. 1000
  seed: number | null;           // Null for standard random, integer for deterministic reproducibility
}

export interface AppStateInputs {
  you: SpouseProfile;
  wife: SpouseProfile;
  portfolio: PortfolioBalances;
  jurisdiction: {
    currentState: 'MD' | 'FL';
    targetState: 'MD' | 'FL';
    relocationYear: number | null;
  };
  growthAssumptions: {
    equityReturnRate: number; // e.g. 0.07 (7%)
    fixedIncomeReturnRate: number; // e.g. 0.04 (4%)
    cpiInflationRate: number; // e.g. 0.025 (2.5%)
    healthcareInflationRate: number; // e.g. 0.05 (5%)
  };
  annualLivingExpenses: number | null; // Current dollars, inflated annually
  annualRothConversion: number; // Custom conversion slider input
  rothConversionStartYear?: number; // Starting year for Roth conversions
  rothConversionEndYear?: number; // Ending year for Roth conversions
  rothConversionStrategy: 'flat' | 'fill-to-target';
  rothConversionTargetValue: number | null;
  monteCarloSettings: MonteCarloSettings;
  isConfigured: boolean;
  isSingleFiler: boolean;
}


export interface SimulationResultRow {
  year: number;
  
  // Ages
  yourAge: number;
  wifeAge: number;
  
  // Incomes (Today's inflated values)
  yourSS: number;
  wifeSS: number;
  yourRMD: number;
  wifeRMD: number;
  yourSalary?: number; // Pre-retirement annual active salary earned
  wifeSalary?: number; // Pre-retirement annual active salary earned
  capitalGainsTriggered: number;
  intentionalRothConversion: number;
  otherTaxableIncome: number; // Placeholder if needed
  
  // MAGI & Tax Calculations
  magi: number;
  fedAGI: number;
  standardDeduction: number;
  taxableIncome: number;
  fedIncomeTax: number;
  stateIncomeTax: number;
  totalIncomeTax: number;
  niitTax: number;
  
  // Medicare Surcharges (applied in Year t based on Year t-2 MAGI)
  magiTwoYearsAgo: number;
  surchargeTier: number;
  yourPartBSurcharge: number;
  yourPartDSurcharge: number;
  wifePartBSurcharge: number;
  wifePartDSurcharge: number;
  combinedSurchargeMonthly: number;
  combinedSurchargeAnnual: number;
  
  // Expenses & Cashflow
  livingExpenses: number;
  medicareBasePremiums: number;
  preMedicareHealthcareCost: number; // Annual pre-Medicare healthcare premium expenses
  totalExpenses: number; // Expenses + Taxes + Medicare Base & Surcharges + Pre-Medicare Premium
  incomeInflow: number; // SS + RMD
  deficit: number; // totalExpenses - incomeInflow
  
  // Drawdowns
  drawdownTaxable: number;
  drawdownPreTax: number;
  drawdownRoth: number;
  
  // Ending Balances (after growth and drawdowns)
  endYourPreTaxIRA: number;
  endYourRothIRA: number;
  endYourTaxableBrokerage: number;
  endYourTaxableBasis: number;
  
  endWifePreTaxIRA: number;
  endWifeRothIRA: number;
  endWifeTaxableBrokerage: number;
  endWifeTaxableBasis: number;
  
  totalPortfolioValue: number;
}

export interface SavedPlan {
  id: string;
  name: string;
  inputs: AppStateInputs;
  createdAt: string;
}
