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

export interface DetailedStateExpenses {
  // Recurring
  amenityFee: number;
  water: number;
  sewer: number;
  trash: number;
  electric: number;
  gas: number;
  internet: number;
  cableTV: number;
  propertyTaxes: number;
  cddBond: number;
  fireService: number;
  hoa: number;
  lawnCare: number;
  pestControl: number;
  irrigation: number;
  termiteBond: number;
  trailFees: number;
  cellPhone: number;

  autoGas: number;
  autoOilChanges: number;
  autoTires: number;
  autoMaintenance: number;
  autoInsurance: number;
  golfCartGas: number;
  golfCartOilChanges: number;
  golfCartTires: number;
  golfCartMaintenance: number;
  golfCartInsurance: number;

  woundedWarrior: number;
  tunnelsToTowers: number;
  stJude: number;
  tithe: number;

  visionInsurance: number;
  visionOutOfPocket: number;
  dentalInsurance: number;
  dentalOutOfPocket: number;
  healthOutOfPocket: number;
  medicarePartB: number;
  medicarePartD: number;
  otcDrugs: number;

  consumables: number;
  clothing: number;

  homeInsurance: number;
  homeMaintenance: number;
  umbrellaInsurance: number;

  diningOut: number;
  amazonPrime: number;
  golf: number;
  theVillagesNetwork: number;
  travel: number;
  woodshopMembership: number;

  // One-time
  masterBedFurniture: number;
  masterBedCloset: number;
  livingRoomFurniture: number;
  windowTreatments: number;
  areaRugs: number;
  lanaiFurnishings: number;
  shippingExpenses: number;
  storageExpenses: number;
}

export interface DetailedExpenseFrequencies {
  amenityFee: number;
  water: number;
  sewer: number;
  trash: number;
  electric: number;
  gas: number;
  internet: number;
  cableTV: number;
  propertyTaxes: number;
  cddBond: number;
  fireService: number;
  hoa: number;
  lawnCare: number;
  pestControl: number;
  irrigation: number;
  termiteBond: number;
  trailFees: number;
  cellPhone: number;

  autoGas: number;
  autoOilChanges: number;
  autoTires: number;
  autoMaintenance: number;
  autoInsurance: number;
  golfCartGas: number;
  golfCartOilChanges: number;
  golfCartTires: number;
  golfCartMaintenance: number;
  golfCartInsurance: number;

  woundedWarrior: number;
  tunnelsToTowers: number;
  stJude: number;
  tithe: number;

  visionInsurance: number;
  visionOutOfPocket: number;
  dentalInsurance: number;
  dentalOutOfPocket: number;
  healthOutOfPocket: number;
  medicarePartB: number;
  medicarePartD: number;
  otcDrugs: number;

  consumables: number;
  clothing: number;

  homeInsurance: number;
  homeMaintenance: number;
  umbrellaInsurance: number;

  diningOut: number;
  amazonPrime: number;
  golf: number;
  theVillagesNetwork: number;
  travel: number;
  woodshopMembership: number;
}

export interface RecurringExpenseMetadata {
  key: keyof DetailedExpenseFrequencies;
  label: string;
  category: 'Housing' | 'Transportation' | 'Charities' | 'Health' | 'Living' | 'Insurance' | 'Leisure';
  defaultFrequency: number;
}

export interface OneTimeExpenseMetadata {
  key: 'masterBedFurniture' | 'masterBedCloset' | 'livingRoomFurniture' | 'windowTreatments' | 'areaRugs' | 'lanaiFurnishings' | 'shippingExpenses' | 'storageExpenses';
  label: string;
}

export const RECURRING_EXPENSE_ITEMS: RecurringExpenseMetadata[] = [
  // Housing / Utilities
  { key: 'amenityFee', label: 'Amenity Fee', category: 'Housing', defaultFrequency: 12 },
  { key: 'water', label: 'Water', category: 'Housing', defaultFrequency: 12 },
  { key: 'sewer', label: 'Sewer', category: 'Housing', defaultFrequency: 12 },
  { key: 'trash', label: 'Trash', category: 'Housing', defaultFrequency: 12 },
  { key: 'electric', label: 'Electric', category: 'Housing', defaultFrequency: 12 },
  { key: 'gas', label: 'Gas', category: 'Housing', defaultFrequency: 12 },
  { key: 'internet', label: 'Internet', category: 'Housing', defaultFrequency: 12 },
  { key: 'cableTV', label: 'Cable TV', category: 'Housing', defaultFrequency: 12 },
  { key: 'propertyTaxes', label: 'Property Taxes', category: 'Housing', defaultFrequency: 1 },
  { key: 'cddBond', label: 'CDD Bond', category: 'Housing', defaultFrequency: 1 },
  { key: 'fireService', label: 'Fire Service', category: 'Housing', defaultFrequency: 1 },
  { key: 'hoa', label: 'HOA', category: 'Housing', defaultFrequency: 12 },
  { key: 'lawnCare', label: 'Lawn Care', category: 'Housing', defaultFrequency: 12 },
  { key: 'pestControl', label: 'Pest Control', category: 'Housing', defaultFrequency: 12 },
  { key: 'irrigation', label: 'Irrigation', category: 'Housing', defaultFrequency: 12 },
  { key: 'termiteBond', label: 'Termite Bond', category: 'Housing', defaultFrequency: 1 },
  { key: 'trailFees', label: 'Trail Fees', category: 'Housing', defaultFrequency: 12 },
  { key: 'cellPhone', label: 'Cell Phone', category: 'Housing', defaultFrequency: 12 },

  // Transportation
  { key: 'autoGas', label: 'Auto gas', category: 'Transportation', defaultFrequency: 12 },
  { key: 'autoOilChanges', label: 'Auto oil changes', category: 'Transportation', defaultFrequency: 1 },
  { key: 'autoTires', label: 'Auto tires', category: 'Transportation', defaultFrequency: 1 },
  { key: 'autoMaintenance', label: 'Auto maintenance', category: 'Transportation', defaultFrequency: 1 },
  { key: 'autoInsurance', label: 'Auto Insurance', category: 'Transportation', defaultFrequency: 12 },
  { key: 'golfCartGas', label: 'Golf cart gas', category: 'Transportation', defaultFrequency: 12 },
  { key: 'golfCartOilChanges', label: 'Golf cart oil changes', category: 'Transportation', defaultFrequency: 1 },
  { key: 'golfCartTires', label: 'Golf cart tires', category: 'Transportation', defaultFrequency: 1 },
  { key: 'golfCartMaintenance', label: 'Golf cart maintenance', category: 'Transportation', defaultFrequency: 1 },
  { key: 'golfCartInsurance', label: 'Golf cart insurance', category: 'Transportation', defaultFrequency: 12 },

  // Charities
  { key: 'woundedWarrior', label: 'Wounded Warrior', category: 'Charities', defaultFrequency: 12 },
  { key: 'tunnelsToTowers', label: 'Tunnels to Towers', category: 'Charities', defaultFrequency: 12 },
  { key: 'stJude', label: 'St. Jude', category: 'Charities', defaultFrequency: 12 },
  { key: 'tithe', label: 'Tithe', category: 'Charities', defaultFrequency: 12 },

  // Health
  { key: 'visionInsurance', label: 'Vision insurance', category: 'Health', defaultFrequency: 12 },
  { key: 'visionOutOfPocket', label: 'Vision out-of-pocket', category: 'Health', defaultFrequency: 12 },
  { key: 'dentalInsurance', label: 'Dental insurance', category: 'Health', defaultFrequency: 12 },
  { key: 'dentalOutOfPocket', label: 'Dental out-of-pocket', category: 'Health', defaultFrequency: 12 },
  { key: 'healthOutOfPocket', label: 'Health out-of-pocket', category: 'Health', defaultFrequency: 12 },
  { key: 'medicarePartB', label: 'Medicare Part B', category: 'Health', defaultFrequency: 12 },
  { key: 'medicarePartD', label: 'Medicare Part D', category: 'Health', defaultFrequency: 12 },
  { key: 'otcDrugs', label: 'OTC Drugs', category: 'Health', defaultFrequency: 12 },

  // Living
  { key: 'consumables', label: 'Consumables', category: 'Living', defaultFrequency: 12 },
  { key: 'clothing', label: 'Clothing', category: 'Living', defaultFrequency: 12 },

  // Insurance
  { key: 'homeInsurance', label: 'Home Insurance', category: 'Insurance', defaultFrequency: 12 },
  { key: 'homeMaintenance', label: 'Home Maintenance', category: 'Insurance', defaultFrequency: 12 },
  { key: 'umbrellaInsurance', label: 'Umbrella Insurance', category: 'Insurance', defaultFrequency: 12 },

  // Leisure
  { key: 'diningOut', label: 'Dining Out', category: 'Leisure', defaultFrequency: 12 },
  { key: 'amazonPrime', label: 'Amazon Prime', category: 'Leisure', defaultFrequency: 1 },
  { key: 'golf', label: 'Golf', category: 'Leisure', defaultFrequency: 12 },
  { key: 'theVillagesNetwork', label: 'The Villages Network', category: 'Leisure', defaultFrequency: 12 },
  { key: 'travel', label: 'Travel', category: 'Leisure', defaultFrequency: 1 },
  { key: 'woodshopMembership', label: 'Woodshop Membership', category: 'Leisure', defaultFrequency: 1 }
];

export const ONE_TIME_EXPENSE_ITEMS: OneTimeExpenseMetadata[] = [
  { key: 'masterBedFurniture', label: 'Master bedroom furniture' },
  { key: 'masterBedCloset', label: 'Master bedroom closet organization system' },
  { key: 'livingRoomFurniture', label: 'Living room furniture' },
  { key: 'windowTreatments', label: 'Window treatments' },
  { key: 'areaRugs', label: 'Area rugs' },
  { key: 'lanaiFurnishings', label: 'Lanai furnishings' },
  { key: 'shippingExpenses', label: 'Shipping Expenses' },
  { key: 'storageExpenses', label: 'Storage Expenses' }
];

export const DEFAULT_DETAILED_EXPENSES: DetailedStateExpenses = {
  amenityFee: 0, water: 0, sewer: 0, trash: 0, electric: 0, gas: 0, internet: 0, cableTV: 0,
  propertyTaxes: 0, cddBond: 0, fireService: 0, hoa: 0, lawnCare: 0, pestControl: 0, irrigation: 0,
  termiteBond: 0, trailFees: 0, cellPhone: 0,
  autoGas: 0, autoOilChanges: 0, autoTires: 0, autoMaintenance: 0, autoInsurance: 0,
  golfCartGas: 0, golfCartOilChanges: 0, golfCartTires: 0, golfCartMaintenance: 0, golfCartInsurance: 0,
  woundedWarrior: 0, tunnelsToTowers: 0, stJude: 0, tithe: 0,
  visionInsurance: 0, visionOutOfPocket: 0, dentalInsurance: 0, dentalOutOfPocket: 0,
  healthOutOfPocket: 0, medicarePartB: 0, medicarePartD: 0, otcDrugs: 0,
  consumables: 0, clothing: 0,
  homeInsurance: 0, homeMaintenance: 0, umbrellaInsurance: 0,
  diningOut: 0, amazonPrime: 0, golf: 0, theVillagesNetwork: 0, travel: 0, woodshopMembership: 0,
  masterBedFurniture: 0, masterBedCloset: 0, livingRoomFurniture: 0, windowTreatments: 0, areaRugs: 0,
  lanaiFurnishings: 0, shippingExpenses: 0, storageExpenses: 0
};

export const DEFAULT_EXPENSE_FREQUENCIES: DetailedExpenseFrequencies = {
  amenityFee: 12, water: 12, sewer: 12, trash: 12, electric: 12, gas: 12, internet: 12, cableTV: 12,
  propertyTaxes: 1, cddBond: 1, fireService: 1, hoa: 12, lawnCare: 12, pestControl: 12, irrigation: 12,
  termiteBond: 1, trailFees: 12, cellPhone: 12,
  autoGas: 12, autoOilChanges: 1, autoTires: 1, autoMaintenance: 1, autoInsurance: 12,
  golfCartGas: 12, golfCartOilChanges: 1, golfCartTires: 1, golfCartMaintenance: 1, golfCartInsurance: 12,
  woundedWarrior: 12, tunnelsToTowers: 12, stJude: 12, tithe: 12,
  visionInsurance: 12, visionOutOfPocket: 12, dentalInsurance: 12, dentalOutOfPocket: 12,
  healthOutOfPocket: 12, medicarePartB: 12, medicarePartD: 12, otcDrugs: 12,
  consumables: 12, clothing: 12,
  homeInsurance: 12, homeMaintenance: 12, umbrellaInsurance: 12,
  diningOut: 12, amazonPrime: 1, golf: 12, theVillagesNetwork: 12, travel: 1, woodshopMembership: 1
};

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
  useDetailedExpenses?: boolean;
  detailedExpenses?: {
    MD: DetailedStateExpenses;
    FL: DetailedStateExpenses;
    frequencies: DetailedExpenseFrequencies;
  };
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
