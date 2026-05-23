export interface SpouseProfile {
  name?: string; // Customizable display name
  birthDate: string; // YYYY-MM-DD
  estimatedPIA: number; // Primary Insurance Amount at Full Retirement Age (FRA)
  targetSSClaimingAge: number; // Claiming age (62 to 70)
}

export interface PortfolioBalances {
  yourPreTaxIRA: number;
  yourRothIRA: number;
  yourTaxableBrokerage: number;
  yourTaxableBasis: number;
  wifePreTaxIRA: number;
  wifeRothIRA: number;
  wifeTaxableBrokerage: number;
  wifeTaxableBasis: number;
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
  annualLivingExpenses: number; // Current dollars, inflated annually
  annualRothConversion: number; // Custom conversion slider input
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
  totalExpenses: number; // Expenses + Taxes + Medicare Base & Surcharges
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
