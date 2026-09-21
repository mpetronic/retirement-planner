# 3-Bucket Management Strategy Specification

## 1. Overview & Vision

The **3-Bucket Management Strategy Workspace** provides a comprehensive management, visualization, and modeling system for a 3-Bucket (3B) retirement income strategy within the Retirement Planner application. 

The strategy divides retirement wealth into three distinct temporal horizons, each mapped to a specific account type and tax wrapper:
1. **Bucket 1: Cash Bucket (Near-Term: 1–2 Years)** → Mapped to **Taxable Brokerage Account**.
2. **Bucket 2: Income Bucket (Intermediate-Term: 3–7 Years)** → Mapped to **Tax-Deferred Pre-Tax IRA**.
3. **Bucket 3: Growth Bucket (Long-Term: 8+ Years)** → Mapped to **Roth IRA**.

The workspace serves as an interactive advisory, visualization, and projection engine. It mirrors real-world brokerage activity (e.g., Fidelity bond ladders and checking transfers), generates actionable transaction recommendations for the current year, and projects multi-year bucket mechanics across historical actuals and Monte Carlo / deterministic simulations.

---

## 2. Core Architecture & Account Mapping

### 2.1 Bucket to Account Mapping
- **Bucket 1 (Cash) = Taxable Brokerage Account**
  - **Purpose**: Liquid reserves to fund living expenses decoupled from short-term market fluctuations and pay taxes on Roth conversions.
  - **Internal Sub-Reserves**:
    - *Living Expenses Reserve*: Target runway of 1–2+ years (e.g., default 24 months) of net living expenses, dynamically linked to the inflation-adjusted expense catalog (including planned one-time capital expenditures such as a new roof or vehicle).
    - *Roth Conversion Tax Reserve*: Earmarked cash reserve to cover estimated income tax liabilities resulting from annual Roth conversions.
    - *Unallocated Brokerage Equities / Buffer*: Remaining invested assets within the taxable brokerage that serve as secondary liquidity.
  - **External Outflows**: Dumps funds periodically (e.g., monthly transfer of 1/12th annual budget) into an **External Checking/Bank Account** for day-to-day spending. The external bank account is outside the 3-bucket system.

- **Bucket 2 (Income) = Tax-Deferred Pre-Tax IRA**
  - **Purpose**: Mid-term funding engine protecting capital over a 3–7 year horizon while generating income.
  - **Internal Structure**:
    - *Bond Ladder*: A multi-rung fixed-income ladder (e.g., 5 annual rungs) consisting of Treasuries, CDs, or high-grade bonds.
    - *IRA Equities & Core Buffer*: Equities and money market reserves held within the IRA.
  - **Ladder Mechanics**:
    - *Maturity Distribution*: Ladder rungs do **not** auto-roll. When a rung matures, its principal disperses directly into Bucket 1 (Taxable Cash) as a modeled IRA distribution.
    - *Ladder Replenishment*: In normal markets, a new far-end rung (e.g., Year 5) is purchased by selling IRA equities (supplemented by accumulated IRA cash/coupons).
    - *Pause Rebuilding Mode (Market Down Protection)*: The user can pause ladder replenishment during market downturns. In this mode, the ladder naturally shortens as rungs mature, drawing down fixed income without liquidating depressed equity holdings.

- **Bucket 3 (Growth) = Roth IRA**
  - **Purpose**: Long-term wealth accumulation and inflation protection over an 8+ year horizon with maximum equity exposure.
  - **Interaction**:
    - Remains untouched as the last resort for living expenses.
    - Receives inflows via annual **Roth Conversions from Bucket 2 (Pre-Tax IRA)**.
    - Conversion taxes are disbursed from Bucket 1's Roth Conversion Tax Reserve.

---

## 3. Money Flow & Refill Rules

```
[ Bucket 2: Income (Pre-Tax IRA) ]
  ├── (1) Bond Ladder Rung Matures ────────────────────────┐
  │                                                        │
  ├── (2) Roth Conversion (Planned Bracket Target) ──┐     │
  │                                                  │     │
  └── (3) IRA Equities Sold -> Rebuild Ladder Rung   │     │
      (Paused during market downturns)               │     │
                                                     ▼     ▼
                                  [ Bucket 3: Growth ]  [ Bucket 1: Cash (Taxable Brokerage) ]
                                    (Roth IRA Equities)   ├── Living Expense Reserve (1-2 Yrs)
                                                          ├── Roth Conversion Tax Reserve
                                                          └── Core Taxable Equities
                                                                   │
                                                                   ├── (4) Periodic Monthly Outflows ──> [ External Checking ]
                                                                   └── (5) Tax Payments ───────────────> [ Tax Authorities ]
```

### 3.1 Flow Rules
1. **Bond Rung Distribution**: On maturity, rung funds disperse from Bucket 2 into Bucket 1 (Taxable Cash) as a taxable IRA distribution.
2. **Cash Reserve Replenishment**: If Bucket 1 cash reserves fall below the minimum threshold (e.g., 12 months), the engine flags a replenishment recommendation from maturing rungs or discretionary IRA distributions.
3. **External Living Outflow**: Systematic monthly/quarterly disbursements from Bucket 1 to the external checking account.
4. **Roth Conversion & Tax Settlement**: Earmarks tax liabilities in Bucket 1's tax reserve when a Roth conversion is modeled from Bucket 2 to Bucket 3.
5. **Ladder Rebuild Execution / Pause**:
   - *Active Rebuild*: Model liquidates a portion of IRA equities equal to target rung funding to construct the new Year 5 rung.
   - *Paused Rebuild*: Model suspends equity liquidation, steps the ladder down, and tracks remaining bond runway months.

---

## 4. UI & Workspace Architecture

The Bucket Management feature lives in its own dedicated top-level workspace accessible from the sidebar navigation.

### 4.1 Sub-Views (Tabbed Navigation)

#### Tab 1: Dashboard & Flow Visualization
- **Top Bar / Timeline Control**:
  - **Year Scrub Bar**: Slider / selector allowing navigation across any year from the start of retirement (2026) through the projection horizon (2060+).
  - **Actuals vs. Simulation Indicator**: Clear indicator showing whether the selected year reflects historical actuals or simulated forward projections.
  - **Strategy Status Badge**: Shows ladder status (Active vs. Paused) and overall Cash Runway (e.g., "24 Months Covered").
- **3-Bucket Visualizer (Interactive Cards / Fluid Gauges)**:
  - *Bucket 1 Card (Cash / Taxable)*:
    - Current vs. Target Fill Level (Gauge / Progress Bar).
    - Breakdown pills: Living Expenses Reserve ($), Roth Tax Reserve ($), Core Taxable Equities ($).
    - Runway indicator in months.
  - *Bucket 2 Card (Income / Pre-Tax IRA)*:
    - Asset allocation summary (e.g., 60% Equities, 40% Bond Ladder).
    - Interactive **Bond Ladder Widget**: Tiered visual step-ladder displaying Rungs 1 through 5, maturity dates, principal amounts, yields, holding tags (e.g., Treasury Note, CD, Corporate), and status (Active, Maturing This Year, Paused).
    - "Pause Ladder Rebuild" quick toggle with market condition guidance.
  - *Bucket 3 Card (Growth / Roth IRA)*:
    - Total balance, 100% equity composition, long-term runway horizon (8+ years).
    - Inflow badge showing modeled Roth conversions.
- **Interactive Flow Pipeline / Diagram**:
  - Visual animated/connective flow displaying the movement of funds:
    - IRA Rung Maturity → Taxable Cash
    - Taxable Cash → External Checking Account
    - Taxable Cash → Tax Payment
    - IRA Equities → New Ladder Rung (or Paused State)
    - IRA → Roth Conversion
- **Action Center & Transaction Ledger (Current Year)**:
  - List of actionable recommendations for the active year (e.g., *"Rung 1 matures Oct 15 ($100k) -> Confirm Distribution to Taxable Cash"*, *"Transfer $8,333/month to Checking"*, *"Rebuild Year 5 Rung ($105k) from IRA Equities"*).
  - **[Mark as Done]** action buttons allowing the user to record completed real-world Fidelity actions into the application's actuals ledger.

#### Tab 2: Rules & Strategy Configuration
- **Reserve & Target Settings**:
  - Target Cash Runway (in months or years, e.g., 24 months).
  - Roth Tax Reserve calculation mode (Auto-calculate from active tax plan vs. manual fixed target).
  - External Checking Transfer frequency (Monthly, Quarterly, Annual) and transfer amount rules.
- **Bond Ladder Configuration**:
  - Number of rungs (e.g., 3 to 7 years, default 5 years).
  - Target principal per rung (Auto-sync with annual living expense vs. custom dollar amount).
  - Detailed Holdings Editor: Form to input specific Treasuries/CDs with CUSIP/name, maturity date, face value, coupon/yield rate.
  - Pause Rules: Market drawdown triggers or manual override toggle.
- **Allocation & Rebalance Thresholds**:
  - Target equity/fixed-income split inside Bucket 2.
  - Minimum Cash trigger threshold to flag warnings.

#### Tab 3: Multi-Year Timeline & Runway Projection
- **30-Year Projection Table & Area Chart**:
  - Year-by-year table displaying projected beginning/ending balances of Bucket 1, Bucket 2 (Equities & Ladder), and Bucket 3.
  - Rung maturity and replenishment cash flow schedule.
  - Cash runway resilience chart showing stress-test survival (e.g., surviving a 5-year equity downturn entirely on Bucket 1 cash and Bucket 2 ladder maturities without selling equities).

---

## 5. Integration with Existing Systems

### 5.1 Simulation Engine Integration
- **Account Balances**: Pulls starting balances from `PortfolioBalances` (`yourTaxableBrokerage`, `yourPreTaxIRA`, `yourRothIRA`, `yourCash`).
- **Dynamic Expenses**: Ingests annual net expenses from `DetailedExpensesState` / `ExpenseCatalog`, including one-time capital expenditures in target years.
- **Taxes & Conversions**: Links with the Taxable Income Planner and Roth Conversion schedule for tax reserve sizing.
- **Return Sequences**: Honors active Monte Carlo stress tests and locked return sequences to model equity values in Buckets 2 and 3.

### 5.2 Actuals & Persistence Integration
- **Historical Blending**: For years where actual balances or transactions have been logged, actual numbers replace simulated numbers.
- **State Persistence**: All bucket configurations, ladder holdings, pause states, and logged transactions are persisted in `localStorage` and included in configuration export/import payloads.