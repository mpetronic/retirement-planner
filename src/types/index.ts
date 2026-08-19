export interface StateHealthcareConfig {
  pre65MedicalPremium: number | null;
  pre65MedicalOOP: number | null;

  pre65DentalPremium: number | null;
  pre65DentalOOP: number | null;

  pre65VisionPremium: number | null;
  pre65VisionOOP: number | null;

  medicarePartDPremium: number | null;
  medicarePartDDeductibleCopays: number | null;
  supplementPremium: number | null;
  supplementOOP: number | null;
  post65HearingCare: number | null;

  post65DentalPremium: number | null;
  post65DentalOOP: number | null;

  post65VisionPremium: number | null;
  post65VisionOOP: number | null;
}

export interface HealthcareConfig {
  medicarePartBPremium: number | null;
  fileSSA44LifeChangingEvent?: boolean; // Form SSA-44 Life-Changing Event (Work Stoppage / Wage Reduction)
  MD: StateHealthcareConfig;
  FL: StateHealthcareConfig;
}

export interface SpouseProfile {
  name?: string; // Customizable display name
  birthDate: string; // YYYY-MM-DD
  estimatedPIA: number | null; // Primary Insurance Amount at Full Retirement Age (FRA)
  targetSSClaimingAge: number | null; // Claiming age (62 to 70)
  plannedRetirementAge?: number | null; // Planned retirement age (55 to 75)
  plannedRetirementMonth?: number | null; // 1-12: month within retirement year (null = use birth month)
  activeSalary?: number | null; // Pre-retirement annual active salary
  preMedicareMonthlyPremium?: number | null; // Pre-Medicare monthly premium (e.g. $800)
  healthcare?: HealthcareConfig;
  longevityAge?: number | null; // Configurable projected death age
}

export interface PortfolioBalances {
  yourPreTaxIRA: number | null;
  yourRothIRA: number | null;
  yourTaxableBrokerage: number | null;
  yourTaxableBasis: number | null;
  yourCash?: number | null;
  wifePreTaxIRA: number | null;
  wifeRothIRA: number | null;
  wifeTaxableBrokerage: number | null;
  wifeTaxableBasis: number | null;
  wifeCash?: number | null;
  taxableDividendYield?: number | null;
  taxableNonQualifiedPortion?: number | null;
}


export interface LockedReturnSequence {
  id: string; // Unique timestamp or ID of the sequence
  mode: 'monte-carlo' | 'historical';
  equityReturns: number[]; // Array of 35 rates (2026 to 2060)
  fixedIncomeReturns: number[]; // Array of 35 rates (2026 to 2060)
  inflationRates?: number[]; // Array of 35 inflation rates (2026 to 2060)
}

export interface StressTestYearOverride {
  year: number;            // e.g. 2028 (2026 to 2060)
  equityReturn: number;    // e.g. -0.25 (-25%)
  fixedIncomeReturn: number; // e.g. -0.05 (-5%)
}

export interface StressTestConfig {
  enabled: boolean;
  mode: 'absolute' | 'relative'; // 'absolute' fixed rate vs 'relative' shock delta offset
  overrides: StressTestYearOverride[];
}

export interface MonteCarloSettings {
  mode: 'monte-carlo' | 'historical';
  equityVolatility: number;      // e.g. 0.15 (15%)
  fixedIncomeVolatility: number; // e.g. 0.05 (5%)
  correlation: number;           // e.g. 0.15
  trials: number;                // e.g. 1000
  seed: number | null;           // Null for standard random, integer for deterministic reproducibility
  nonce?: number;                // Incremental counter to regenerate standard random sequences
  stressTest?: StressTestConfig; // Optional multi-year sequence of returns stress test config
  randomizeCPI?: boolean;        // If true (default), randomize annual CPI per trial; if false, hold constant
  constantCPIRate?: number | null; // Optional custom constant CPI rate if held constant (e.g. 0.025)
  enableRegimeSwitching?: boolean; // If true (default), apply Markov 2-state regime switching and Ornstein-Uhlenbeck mean reversion
  historicalSamplingStrategy?: 'hybrid' | 'block' | 'random'; // Historical bootstrap strategy (hybrid: 35% block / 65% random, block: 100% contiguous, random: 100% random resampled)
  calibrateHistoricalMeans?: boolean; // If true (default), calibrate historical return shocks to match user configured baseline means (e.g. 7% equity / 4% bond)
}

export interface ExpenseItemDefinition {
  id: string;
  name: string;
  category: string;
  description?: string;
  defaultFrequency: number;
  isOneTime?: boolean;
}

export interface ExpenseCatalog {
  categories: string[];
  items: ExpenseItemDefinition[];
}

export interface DetailedExpensesState {
  catalog: ExpenseCatalog;
  costs: {
    [stateCode: string]: Record<string, number>;
  };
  frequencies: Record<string, number>;
  MD?: Record<string, number>;
  FL?: Record<string, number>;
}

// Backward compatibility types
export type DetailedStateExpenses = Record<string, number>;
export type DetailedExpenseFrequencies = Record<string, number>;

export interface RecurringExpenseMetadata {
  key: string;
  label: string;
  category: string;
  defaultFrequency: number;
}

export interface OneTimeExpenseMetadata {
  key: string;
  label: string;
}

export const DEFAULT_EXPENSE_CATEGORIES: string[] = [
  'Housing',
  'Transportation',
  'Living',
  'Insurance',
  'Leisure',
  'Charities'
];

export const DEFAULT_EXPENSE_ITEMS: ExpenseItemDefinition[] = [
  // Housing / Utilities
  { id: 'amenityFee', name: 'Amenity Fee', category: 'Housing', defaultFrequency: 12 },
  { id: 'water', name: 'Water', category: 'Housing', defaultFrequency: 12 },
  { id: 'sewer', name: 'Sewer', category: 'Housing', defaultFrequency: 12 },
  { id: 'trash', name: 'Trash', category: 'Housing', defaultFrequency: 12 },
  { id: 'electric', name: 'Electric', category: 'Housing', defaultFrequency: 12 },
  { id: 'gas', name: 'Gas', category: 'Housing', defaultFrequency: 12 },
  { id: 'internet', name: 'Internet', category: 'Housing', defaultFrequency: 12 },
  { id: 'cableTV', name: 'Cable TV', category: 'Housing', defaultFrequency: 12 },
  { id: 'propertyTaxes', name: 'Property Taxes', category: 'Housing', defaultFrequency: 1 },
  { id: 'cddBond', name: 'CDD Bond', category: 'Housing', defaultFrequency: 1 },
  { id: 'fireService', name: 'Fire Service', category: 'Housing', defaultFrequency: 1 },
  { id: 'hoa', name: 'HOA', category: 'Housing', defaultFrequency: 12 },
  { id: 'lawnCare', name: 'Lawn Care', category: 'Housing', defaultFrequency: 12 },
  { id: 'pestControl', name: 'Pest Control', category: 'Housing', defaultFrequency: 12 },
  { id: 'irrigation', name: 'Irrigation', category: 'Housing', defaultFrequency: 12 },
  { id: 'termiteBond', name: 'Termite Bond', category: 'Housing', defaultFrequency: 1 },
  { id: 'trailFees', name: 'Trail Fees', category: 'Housing', defaultFrequency: 12 },
  { id: 'cellPhone', name: 'Cell Phone', category: 'Housing', defaultFrequency: 12 },

  // Transportation
  { id: 'autoGas', name: 'Auto gas', category: 'Transportation', defaultFrequency: 12 },
  { id: 'autoOilChanges', name: 'Auto oil changes', category: 'Transportation', defaultFrequency: 1 },
  { id: 'autoTires', name: 'Auto tires', category: 'Transportation', defaultFrequency: 1 },
  { id: 'autoMaintenance', name: 'Auto maintenance', category: 'Transportation', defaultFrequency: 1 },
  { id: 'autoInsurance', name: 'Auto Insurance', category: 'Transportation', defaultFrequency: 12 },
  { id: 'golfCartGas', name: 'Golf cart gas', category: 'Transportation', defaultFrequency: 12 },
  { id: 'golfCartOilChanges', name: 'Golf cart oil changes', category: 'Transportation', defaultFrequency: 1 },
  { id: 'golfCartTires', name: 'Golf cart tires', category: 'Transportation', defaultFrequency: 1 },
  { id: 'golfCartMaintenance', name: 'Golf cart maintenance', category: 'Transportation', defaultFrequency: 1 },
  { id: 'golfCartInsurance', name: 'Golf cart insurance', category: 'Transportation', defaultFrequency: 12 },

  // Living
  { id: 'consumables', name: 'Consumables', category: 'Living', defaultFrequency: 12 },
  { id: 'clothing', name: 'Clothing', category: 'Living', defaultFrequency: 12 },

  // Insurance
  { id: 'homeInsurance', name: 'Home Insurance', category: 'Insurance', defaultFrequency: 12 },
  { id: 'homeMaintenance', name: 'Home Maintenance', category: 'Insurance', defaultFrequency: 12 },
  { id: 'umbrellaInsurance', name: 'Umbrella Insurance', category: 'Insurance', defaultFrequency: 12 },

  // Leisure
  { id: 'diningOut', name: 'Dining Out', category: 'Leisure', defaultFrequency: 12 },
  { id: 'amazonPrime', name: 'Amazon Prime', category: 'Leisure', defaultFrequency: 1 },
  { id: 'golf', name: 'Golf', category: 'Leisure', defaultFrequency: 12 },
  { id: 'theVillagesNetwork', name: 'The Villages Network', category: 'Leisure', defaultFrequency: 12 },
  { id: 'travel', name: 'Travel', category: 'Leisure', defaultFrequency: 1 },
  { id: 'woodshopMembership', name: 'Woodshop Membership', category: 'Leisure', defaultFrequency: 1 },

  // Charities
  { id: 'woundedWarrior', name: 'Wounded Warrior', category: 'Charities', defaultFrequency: 12 },
  { id: 'tunnelsToTowers', name: 'Tunnels to Towers', category: 'Charities', defaultFrequency: 12 },
  { id: 'stJude', name: 'St. Jude', category: 'Charities', defaultFrequency: 12 },
  { id: 'tithe', name: 'Tithe', category: 'Charities', defaultFrequency: 12 },

  // One-Time Setup Costs
  { id: 'masterBedFurniture', name: 'Master bedroom furniture', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true },
  { id: 'masterBedCloset', name: 'Master bedroom closet organization system', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true },
  { id: 'livingRoomFurniture', name: 'Living room furniture', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true },
  { id: 'windowTreatments', name: 'Window treatments', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true },
  { id: 'areaRugs', name: 'Area rugs', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true },
  { id: 'lanaiFurnishings', name: 'Lanai furnishings', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true },
  { id: 'shippingExpenses', name: 'Shipping Expenses', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true },
  { id: 'storageExpenses', name: 'Storage Expenses', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true },
  { id: 'washer', name: 'Washer', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true },
  { id: 'dryer', name: 'Dryer', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true },
  { id: 'golfCartPurchase', name: 'Golf cart purchase', category: 'One-Time Setup Costs', defaultFrequency: 1, isOneTime: true }
];

export const DEFAULT_EXPENSE_CATALOG: ExpenseCatalog = {
  categories: [...DEFAULT_EXPENSE_CATEGORIES],
  items: [...DEFAULT_EXPENSE_ITEMS]
};

// Legacy compatibility arrays for components that read metadata
export const RECURRING_EXPENSE_ITEMS: RecurringExpenseMetadata[] = DEFAULT_EXPENSE_ITEMS
  .filter((i) => !i.isOneTime)
  .map((i) => ({
    key: i.id,
    label: i.name,
    category: i.category,
    defaultFrequency: i.defaultFrequency
  }));

export const ONE_TIME_EXPENSE_ITEMS: OneTimeExpenseMetadata[] = DEFAULT_EXPENSE_ITEMS
  .filter((i) => i.isOneTime)
  .map((i) => ({
    key: i.id,
    label: i.name
  }));

export const DEFAULT_EXPENSE_FREQUENCIES: Record<string, number> = DEFAULT_EXPENSE_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item.defaultFrequency;
    return acc;
  },
  {} as Record<string, number>
);

export const DEFAULT_DETAILED_EXPENSES: Record<string, number> = DEFAULT_EXPENSE_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = 0;
    return acc;
  },
  {} as Record<string, number>
);

export const DEFAULT_DETAILED_EXPENSES_STATE: DetailedExpensesState = {
  catalog: {
    categories: [...DEFAULT_EXPENSE_CATEGORIES],
    items: [...DEFAULT_EXPENSE_ITEMS]
  },
  costs: {
    MD: { ...DEFAULT_DETAILED_EXPENSES },
    FL: { ...DEFAULT_DETAILED_EXPENSES }
  },
  frequencies: { ...DEFAULT_EXPENSE_FREQUENCIES },
  MD: { ...DEFAULT_DETAILED_EXPENSES },
  FL: { ...DEFAULT_DETAILED_EXPENSES }
};

/**
 * Normalizes any detailed expenses object (legacy or new) to guaranteed DetailedExpensesState
 */
export function normalizeDetailedExpenses(raw?: any): DetailedExpensesState {
  if (!raw) {
    return JSON.parse(JSON.stringify(DEFAULT_DETAILED_EXPENSES_STATE));
  }

  // If already in new format with catalog
  if (raw.catalog && Array.isArray(raw.catalog.items) && Array.isArray(raw.catalog.categories)) {
    const costs: Record<string, Record<string, number>> = { ...(raw.costs || {}) };
    if (raw.MD && !costs.MD) costs.MD = { ...raw.MD };
    if (raw.FL && !costs.FL) costs.FL = { ...raw.FL };
    
    // Ensure both MD and FL objects exist
    if (!costs.MD) costs.MD = { ...DEFAULT_DETAILED_EXPENSES };
    if (!costs.FL) costs.FL = { ...DEFAULT_DETAILED_EXPENSES };

    const frequencies: Record<string, number> = {
      ...DEFAULT_EXPENSE_FREQUENCIES,
      ...(raw.frequencies || {})
    };

    return {
      catalog: {
        categories: raw.catalog.categories.length > 0 ? [...raw.catalog.categories] : [...DEFAULT_EXPENSE_CATEGORIES],
        items: raw.catalog.items.length > 0 ? [...raw.catalog.items] : [...DEFAULT_EXPENSE_ITEMS]
      },
      costs,
      frequencies,
      MD: costs.MD,
      FL: costs.FL
    };
  }

  // Legacy format migration
  const legacyMD = raw.MD || {};
  const legacyFL = raw.FL || {};
  const legacyFreqs = raw.frequencies || {};

  const costs: Record<string, Record<string, number>> = {
    MD: { ...DEFAULT_DETAILED_EXPENSES, ...legacyMD },
    FL: { ...DEFAULT_DETAILED_EXPENSES, ...legacyFL }
  };

  const frequencies: Record<string, number> = {
    ...DEFAULT_EXPENSE_FREQUENCIES,
    ...legacyFreqs
  };

  return {
    catalog: {
      categories: [...DEFAULT_EXPENSE_CATEGORIES],
      items: [...DEFAULT_EXPENSE_ITEMS]
    },
    costs,
    frequencies,
    MD: costs.MD,
    FL: costs.FL
  };
}

export interface GrowthAssumptions {
  equityReturnRate: number;
  fixedIncomeReturnRate: number;
  cpiInflationRate: number;
  healthcareInflationRate: number;
  preTaxEquityPortion?: number;
  taxableEquityPortion?: number;
  rothEquityPortion?: number;
  cashYieldRate?: number | null;
}

export interface CharitySettings {
  enabled: boolean;
  growthPercentage: number; // e.g. 0.10 for 10%
  minAnnualTithe?: number | null; // Optional annual dollar floor (even if growth is 0)
  maxAnnualTithe?: number | null; // Optional annual dollar cap
  useQCD: boolean; // Enable Qualified Charitable Distributions (QCDs) at age 70.5+
}

export const DEFAULT_CHARITY_SETTINGS: CharitySettings = {
  enabled: false,
  growthPercentage: 0.10,
  minAnnualTithe: null,
  maxAnnualTithe: null,
  useQCD: true,
};

export const BASE_QCD_LIMIT = 105000;

export interface AppStateInputs {
  isConfigured: boolean;
  isSingleFiler: boolean;
  simulationStartYear?: number | null; // Configured base simulation start year (defaults to current year when initialized)
  useDetailedExpenses?: boolean;
  simulateSurvivor?: boolean;
  lockedReturnSequence?: LockedReturnSequence | null;
  you: SpouseProfile;
  wife: SpouseProfile;
  portfolio: PortfolioBalances;
  jurisdiction: {
    currentState: 'MD' | 'FL';
    targetState: 'MD' | 'FL';
    relocationYear: number | null;
  };
  growthAssumptions: GrowthAssumptions;
  annualLivingExpenses: number | null;
  annualRothConversion: number;
  rothConversionStartYear?: number;
  rothConversionEndYear?: number;
  rothConversionStrategy: 'flat' | 'fill-to-target';
  rothConversionTargetValue: number | null;
  monteCarloSettings: MonteCarloSettings;
  detailedExpenses?: DetailedExpensesState;
  charitySettings?: CharitySettings;
  fileSSA44LifeChangingEvent?: boolean; // Form SSA-44 Life-Changing Event (Work Stoppage / Wage Reduction)
}

/**
 * Resolves the starting year for a retirement plan simulation.
 * If explicitly configured on the plan inputs, returns that constant year.
 * Otherwise, defaults to current calendar year (e.g. 2026).
 */
export function getSimulationStartYear(inputs?: { simulationStartYear?: number | null } | null): number {
  if (inputs?.simulationStartYear !== undefined && inputs?.simulationStartYear !== null && !isNaN(inputs.simulationStartYear) && inputs.simulationStartYear > 1900) {
    return inputs.simulationStartYear;
  }
  return new Date().getFullYear();
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
  taxableSS: number;
  taxableDividends: number;
  taxableInterest: number;
  cpiFactor: number;
  
  // Medicare Surcharges (applied in Year t based on Year t-2 MAGI)
  magiTwoYearsAgo: number;
  rawLookbackMAGI?: number; // Unadjusted 2-year lookback MAGI before Form SSA-44 life changing event adjustment
  isSSA44Applied?: boolean; // True if Form SSA-44 Work Stoppage adjustment was applied to reduce lookback MAGI
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
  drawdownCash: number;
  reinvestedSurplus?: number; // Total annual surplus reinvested into Taxable Brokerage

  // Pre-Retirement Contributions & Payroll
  employee401kContribution?: number; // Total annual employee pre-tax 401(k) contributions
  ficaTaxesPaid?: number; // Social Security (6.2%) + Medicare (1.45% + 0.9%) payroll taxes paid
  incomeTaxWithheld?: number; // Estimated federal and state paycheck income tax withholdings
  netTakeHomeSalary?: number; // Net take-home salary available for expenses

  // Charitable Giving & Tithing (with QCD)
  portfolioGrowth: number; // Total dollar return across accounts in the year
  charitableTithe: number; // Total annual tithe amount from growth
  qcdAmount: number; // Portion funded via tax-free QCDs from Traditional IRAs (offsets RMDs)
  nonQcdTithe: number; // Portion funded from Cash and Taxable Brokerage
  qcdTaxSavings: number; // Estimated direct tax savings via QCD vs taking taxable RMDs
  
  // Ending Balances (after growth and drawdowns)
  endYourPreTaxIRA: number;
  endYourRothIRA: number;
  endYourTaxableBrokerage: number;
  endYourTaxableBasis: number;
  endYourCash: number;
  
  endWifePreTaxIRA: number;
  endWifeRothIRA: number;
  endWifeTaxableBrokerage: number;
  endWifeTaxableBasis: number;
  endWifeCash: number;
  
  totalPortfolioValue: number;
}

export interface SavedPlan {
  id: string;
  name: string;
  inputs: AppStateInputs;
  createdAt: string;
}
