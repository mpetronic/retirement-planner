# Comprehensive Project Specification: Retirement Scenario Optimizer

## 1. Project Objective & Architecture
Build a highly visual, interactive, single-page retirement scenario modeling application.
- Tech Stack: React (Vite-backed), Tailwind CSS, Lucide React icons, and Chart.js or D3.js for high-performance timeline data mapping.
- State Management: Use a single, immutable, pure-function processing pipeline engine. All arithmetic logic must remain inside the centralized engine script, not spread across layout views.

## 2. Core Stakeholder Timeline Rules
The engine will map a multi-decade time-series ledger from 2026 through 2060 based on these exact constraints:
- Primary User: Born June 27, 1960. Transitions to Medicare in June 2025. Full Retirement Age (FRA) is 67 in June 2027. Maximum Social Security capping age is 70 in June 2030. Required Minimum Distributions (RMD) strictly begin at Age 75 in calendar year 2035.
- Spouse: Born March 11, 1964. Transitions to Medicare in March 2029. Full Retirement Age (FRA) is 67 in March 2031. Maximum Social Security capping age is 70 in March 2034. Required Minimum Distributions (RMD) strictly begin at Age 75 in calendar year 2039.
- Two-Year Lookback Rule: The Modified Adjusted Gross Income (MAGI) calculated in calendar year t directly dictates the Medicare premium surcharges applied in calendar year t+2.

## 3. Data Schema Configuration (TypeScript)
The engine state store must adhere to the following strict object models:

interface SpouseProfile {
  birthDate: string;
  estimatedPIA: number; 
  targetSSClaimingAge: number; 
}

interface PortfolioBalances {
  yourPreTaxIRA: number;
  yourRothIRA: number;
  yourTaxableBrokerage: number;
  yourTaxableBasis: number;
  wifePreTaxIRA: number;
  wifeRothIRA: number;
  wifeTaxableBrokerage: number;
  wifeTaxableBasis: number;
}

interface AppStateInputs {
  you: SpouseProfile;
  wife: SpouseProfile;
  portfolio: PortfolioBalances;
  jurisdiction: {
    currentState: string;
    targetState: string;
    relocationYear: number | null;
  };
  growthAssumptions: {
    equityReturnRate: number;
    fixedIncomeReturnRate: number;
    cpiInflationRate: number;
    healthcareInflationRate: number;
  };
}

## 4. Specific State Jurisdictional Tax Logic
The engine must dynamically process state-level changes over the timeline based on the user's location input:
- Florida Rules: If state is 'FL', assign a flat 0% state income tax drag across all income, RMD, and conversion lines.
- Maryland Rules: If state is 'MD', apply the localized graduated state income tax tiers (up to 5.75%) plus a standard local piggyback tax rate of 3.20% (totaling an 8.95% top marginal state hit).
- Maryland Exemption Modeling: Natively model the Maryland rules where Social Security benefits are fully exempt from state tax. Model the traditional Maryland Pension Exclusion as a subtraction modification from Federal AGI, but ensure traditional IRA withdrawals and active Roth conversions are explicitly flagged as ineligible for standard pension subtractions.

## 5. Pure-Function Processing Pipeline
For each annual iteration loop, the simulation script must process updates in this precise sequence:
1. Age Tracking: Verify exact ages for the year to flag the onset of individual age-75 RMD distributions via the IRS Uniform Lifetime Table.
2. MAGI Calculation: Sum all taxable items to output the baseline MAGI: Federal AGI + Tax-Exempt Interest. This includes active Social Security benefits, forced RMD values, portfolio capital gains, and intentional Roth conversions.
3. Two-Year Lookback Surcharge Evaluation: Query the simulation history array at index position currentYear minus 2. Evaluate that specific historical MAGI against the 2026 Married Filing Jointly (MFJ) IRMAA tiers to apply standard or surcharged Part B and Part D premiums for the current row.
4. Drawdown and Tax Matching: If baseline income streams fall short of projected living expenses and calculated tax bills, liquidate assets sequentially: Taxable Brokerages first (triggering capital gains processing against stored basis parameters), Pre-Tax traditional accounts second, and Roth balances last.
5. Inflation and Indexing: Apply asset return percentages to ending balances. Automatically expand federal tax brackets, standard deductions, and the first four IRMAA tier cliffs annually by the defined CPI inflation parameter.

## 6. Official 2026 Medicare Premium and IRMAA Tier References
The engine must use these exact pricing structures for its lookup functions. (Base Part B Premium: $202.90 per month. Base Part D Premium: $34.50 per month):

- Tier 0 (Standard): Joint MAGI less than or equal to $218,000. Part B Surcharge = $0.00. Part D Surcharge = $0.00.
- Tier 1 Surcharge: Joint MAGI between $218,001 and $274,000. Part B Surcharge = $81.20. Part D Surcharge = $14.50.
- Tier 2 Surcharge: Joint MAGI between $274,001 and $342,000. Part B Surcharge = $202.90. Part D Surcharge = $37.50.
- Tier 3 Surcharge: Joint MAGI between $342,001 and $410,000. Part B Surcharge = $324.60. Part D Surcharge = $60.40.
- Tier 4 Surcharge: Joint MAGI between $410,001 and $749,999. Part B Surcharge = $446.30. Part D Surcharge = $83.30.
- Tier 5 Surcharge: Joint MAGI equal to or greater than $750,000. Part B Surcharge = $487.00. Part D Surcharge = $91.00.

Single Filer Thresholds (For Survivor Simulations):
- Tier 0: MAGI less than or equal to $109,000.
- Tier 1: MAGI $109,001 to $137,000.
- Tier 2: MAGI $137,001 to $171,000.
- Tier 3: MAGI $171,001 to $205,000.
- Tier 4: MAGI $205,001 to $499,999.
- Tier 5: MAGI equal to or greater than $500,000.

## 7. UI/UX Workspace Layout Specifications

### Workspace 1: Interactive Tax and IRMAA Bracket Map
- Visuals: A stacked vertical bar chart tracking calendar years on the X-axis and total dollars on the Y-axis. The base stack represents fixed income, with a bright contrasting color layer for active Roth Conversions.
- Horizon Guidelines: Draw fixed horizontal lines across the timeline for Federal marginal brackets, and bold, distinct horizontal lines mapping out the exact IRMAA Cliff levels.
- Automation Clicks: Provide automated scenario macro toggles: "Fill to Top of 12% Federal Bracket", "Fill to $1 Below Nearest IRMAA Surcharge Cliff", and a manual custom annual conversion input slider.

### Workspace 2: Lookback Linkage Ledger Table
- Create a data table tracking the dynamic lookback delay across columns:
  Tax Action Year -> Total Resulting MAGI -> Identified IRMAA Surcharge Tier -> Affected Premium Year -> Combined Monthly Surcharge Total for Couple.
- Safety Flags: If a user manual entry places an annual MAGI within $5,000 over any IRMAA cliff limit, style that table row in warning yellow and print a text alert detailing the total unexpected premium penalty cost.

### Workspace 3: Social Security Claiming Matrix Grid
- Build an interactive 8x8 grid canvas. The rows represent your wife's potential claiming ages (62 to 70) and columns represent your potential claiming ages (62 to 70).
- Clicking any grid intersection re-triggers the centralized projection engine loop, dynamically updating a line graph below tracking the final Ending Net Estate Value at age 90.
- Feature Switch: Provide a prominent "Simulate Survivor Health View" toggle. When enabled, it recalculates the matrix by eliminating the smaller individual Social Security stream upon the first projected death, switching all tax math structures to Single Filer thresholds to reveal the long-term tax protection value of early conversions.