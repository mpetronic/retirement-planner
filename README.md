# Retirement Planner Dashboard

An interactive, premium, 35-year financial planning web application. This tool empowers users to model market trajectories (using Flat, stochastic Monte Carlo, or historical backfill conditions), spousal claiming scenarios, and tax optimization strategies (such as Roth conversions and state residency relocations) while calculating federal taxes, Maryland/Florida state taxes, capital gains, Medicare base premiums, and Modified Adjusted Gross Income (MAGI) lookback IRMAA surcharges.

---

## 📋 Table of Contents

- [Overview & Core Features](#overview--core-features)
- [Workspace Structure](#workspace-structure)
  - [1. Overview (Bracket Map Chart)](#1-overview-bracket-map-chart)
  - [2. Taxable Income Planner](#2-taxable-income-planner)
  - [3. Lookback Ledger](#3-lookback-ledger)
  - [4. Monte Carlo Analysis](#4-monte-carlo-analysis)
  - [5. Plan Comparison](#5-plan-comparison)
  - [6. Actuals & Guardrails](#6-actuals--guardrails)
- [Interactive Controls & Scenario Planning Drawer](#interactive-controls--scenario-planning-drawer)
  - [Scenario Planner Drawer](#scenario-planner-drawer)
  - [Global Keyboard Shortcuts](#global-keyboard-shortcuts)
- [Advanced Optimization & Analytics Engine](#advanced-optimization--analytics-engine)
- [🛠️ Development & Environment Setup](#️-development--environment-setup)
  - [System Requirements](#system-requirements)
  - [🐧 Linux & WSL Setup](#-linux--wsl-setup)
  - [🍎 macOS Setup](#-macos-setup)
  - [🪟 Windows Setup (Native PowerShell/CMD)](#-windows-setup-native-powershellcmd)
    - [Option A: With Administrator Access](#option-a-with-administrator-access)
    - [Option B: Without Administrator Access (Non-Admin)](#option-b-without-administrator-access-non-admin)
- [🛠️ Verification, Testing & Build Commands](#️-verification-testing--build-commands)
  - [Unit Test Suite](#unit-test-suite)
  - [Type Check & Production Build](#type-check--production-build)
  - [🐳 Docker Container Deployment](#-docker-container-deployment)
- [💻 Recommended Developer Tools](#-recommended-developer-tools)
- [📄 License & Disclaimer](#-license--disclaimer)

---

## Overview & Core Features

- **Interactive Onboarding Wizard**: Guided 4-step setup flow for first-time users to configure personal profiles, retirement timing, initial portfolio balances, and return assumptions.
- **35-Year Spousal Timeline Engine**: Tracks annual income, Social Security claiming ages (62-70), active employment salaries, 401(k) contributions, asset compounding, and priority-based drawdown waterfalls.
- **Federal & State Tax Engine**: Models Federal ordinary income brackets (10% to 37%), standard deductions with age 65+ senior bumps, preferential long-term capital gains rates (0%, 15%, 20%), and state income tax systems (Maryland MD with county piggyback rates vs. Florida FL zero-income tax) with custom relocation year support.
- **Medicare IRMAA & Form SSA-44 Modeling**: Simulates 2-year MAGI lookback Medicare IRMAA surcharge tiers (Part B & Part D) with Form SSA-44 life-changing event income adjustments upon retirement.
- **Multi-Strategy Roth Conversion Planner**: Models flat annual conversions or dynamic "Fill-to-Bracket / Fill-to-IRMAA" strategies with customizable conversion start and end year windows.
- **Automated Scenario Optimizer**: Algorithms to identify optimal Social Security claiming ages and Roth conversion schedules to maximize ending estate, minimize lifetime tax, or minimize IRMAA surcharges.
- **Charitable QCD & Tithe Engine**: Models Qualified Charitable Distributions (QCDs) directly from Pre-Tax IRAs starting at age 70½ to satisfy Required Minimum Distributions (RMDs) tax-free, alongside annual cash tithe contributions.
- **Itemized vs. Simple Aggregate Expenses**: Supports both simple inflation-adjusted annual living budgets and granular itemized expense categories (housing, medical, lifestyle, discretionary, and future one-off expenses).
- **Stochastic Monte Carlo Stress Testing**: Simulates 1,000+ parallel trials with seedable pseudo-random generation (Mulberry32 PRNG), sequence-of-returns risk analysis, regime switching, historical bootstrapping (1928-present data), and market crash override stress tests.
- **Dual Valuation Mode**: Toggle instantly between Nominal Future Dollars and Real Today's Purchasing Power Dollars across all charts, ledgers, and summary metrics.
- **Sankey Flow Diagram**: Interactive visual cashflow diagrams illustrating the flow of gross income, tax liabilities, living expenses, and portfolio reinvestment/drawdown balances.
- **Plan Exporting & PDF Reports**: Save plans locally, export/import JSON configurations, and generate PDF executive summary reports.
- **Accessibility & Typography Scaling**: Global root font scaling (12px to 24px) for responsive sizing across all displays and full keyboard navigation shortcuts.

---

## Workspace Structure

The application is structured into five dedicated, synchronized workspaces:

### 1. Overview (Bracket Map Chart)
Visual tax bracket planning and Roth conversion modeling.
- **Stacked Income Chart**: Visualizes Active Salary, Social Security, Pre-Tax Drawdowns/RMDs, and Roth Conversions against Federal income tax brackets (10%, 12%, 22%, 24%, 32%, 35%, 37%) and Medicare IRMAA cliff thresholds.
- **Quick-Fill Target Presets**: One-click benchmark targets to test conversion strategies filling to the top of specific tax brackets or IRMAA tiers.
- **Integrated Strategy Optimizer**: Built-in optimizer dialog to evaluate conversion schedules against portfolio longevity and estate outcomes.

### 2. Taxable Income Planner
Granular taxable income and deduction analysis.
- **Stacked Taxable Base Visualization**: Displays Net Non-Conversion Taxable Income, Taxable Roth Conversions, and Standard Deductions alongside Federal Tax Bracket and IRMAA benchmark guidelines.
- **Income Source Breakdown**: Component-level inspection of Social Security, Salaried Earnings, Traditional IRA distributions/RMDs, Net Investments & Capital Gains, and Other Taxable Income.
- **In-Workspace Controls**: Direct controls for conversion year ranges, target thresholds, and real-time benchmark line adjustments.

### 3. Lookback Ledger
Comprehensive 35-year financial ledger.
- **Full Cashflow Accounting**: Year-by-year columns tracking asset balances (Pre-tax, Roth, Taxable, Cash), Social Security benefits, RMDs, employee 401(k) contributions, standard deductions, tax brackets, effective tax rates, state taxes, Form SSA-44 lookback MAGI, Medicare base & IRMAA surcharges, charitable QCDs & tithes, and estate values.
- **Row Inspection Drilldown**: Click any year row to open a detailed inspection modal breaking down that specific year's tax calculations, MAGI adjustments, and account movements.
- **KPI Summary Banner**: Quick-toggle summary bar displaying ending estate, total lifetime taxes paid, Medicare surcharges, base premiums, and charitable contributions.

### 4. Monte Carlo Analysis
Long-term market stress testing and sequence-of-returns risk modeling.
- **Parallel Stochastic Engine**: Runs 1,000+ randomized simulations displaying percentile paths (P10 worst-case, P25, P50 median, P75, P90 best-case).
- **Customizable Simulation Parameters**: Adjust equity/bond return means, annual volatility, asset correlation, inflation randomness, and historical sampling strategies (hybrid, block, or random).
- **Stress Test Control Panel**: Apply custom market shock overrides (e.g., severe initial market drop, elevated inflation) to evaluate sequence risk.
- **Global Scenario Synchronization**: Switch the active global scenario between Flat Expected, P10, P50, and P90 returns to synchronize the entire application.

### 5. Plan Comparison
Multi-scenario comparison and plan management.
- **Plan Repository**: Save active scenario configurations, load saved plans, clone scenarios, and export/import plan files via JSON.
- **Side-by-Side Delta Analysis**: Select any two saved plans (Plan A vs. Plan B) to compare lifetime taxes, IRMAA surcharges, ending estate values, Monte Carlo success rates, and year-by-year drawdown differences.
- **Comparative Charts & Diff Tables**: Visual portfolio trajectory comparisons and delta summary cards highlighting net financial advantages.

### 6. Actuals & Guardrails
Real-world plan execution tracking, historical replay, portfolio reconciliation, and dynamic spending governance.
- **Historical Actuals Replay**: Substitute real-world equity returns, bond returns, CPI inflation, healthcare inflation, and living expenses for completed years into the deterministic ledger and forward Monte Carlo sequence.
- **Year-End Balance Reconciliation**: Lock in verified brokerage, Traditional IRA, Roth IRA, cost basis, and cash balances to ensure forward projections branch from verified real-world account values.
- **2-Year Lookback MAGI Stitching**: Chains historical actual MAGI directly into downstream Medicare IRMAA surcharge calculations.
- **Dynamic Guardrail Governance**: Guyton-Klinger style spending guardrails featuring an Upper Ceiling (+15%) to prevent unsustainable lifestyle creep and a Lower Floor (-15%) to protect capital during market contractions.
- **Permission to Spend Advisory**: Transparently analyzes net surplus into direct Expense Savings and Market Growth Share (10% surplus share), providing a 1-click button to apply earned bonuses to next year's budget.
- **Visual Status Badges**: Lookback Ledger displays `ACTUAL` and `BRIDGED` pill badges with direct navigation shortcuts.

---

## Interactive Controls & Scenario Planning Drawer

### Scenario Planner Drawer
Press **`P`** anywhere in the application or click **Edit Parameters** in the top navigation bar to open the slide-over parameter drawer, organized into four tabs:

- 👤 **Profiles**: Primary user and spouse birth dates, Social Security PIA estimates, target claiming ages (62-70), retirement ages, active salaries, longevity ages, Pre-Medicare & Medicare healthcare expense configurations, and Survivor view simulation mode toggle switch.
- 💰 **Accounts**: Starting account balances (Traditional Pre-Tax IRA, Roth IRA, Taxable Brokerage, Cost Basis, Cash Reserves) for both individuals, plus taxable dividend yields and non-qualified interest ratios.
- 📈 **Assumptions**: Valuation currency toggle (Nominal Future Dollars vs. Today's Real Purchasing Power Dollars), simulation start year, asset allocation (equity portions by account type), expected asset returns, inflation rates (CPI & healthcare), cash yields, minimum cash reserves, and Maryland (MD) to Florida (FL) relocation year.
- 🧾 **Expenses**: Calculation method selection (Simple Aggregate Budget vs. Detailed Itemized Expenses), base annual living budget, itemized expense management dialog, and Charitable QCD & Tithe configuration.

### Global Keyboard Shortcuts
- **`P`**: Toggle Scenario Planner side drawer open/closed.
- **`?`** (or **`Shift`** + **`/`**): Open interactive Documentation & User Guide modal.
- **`Esc`**: Close active drawer, modal dialog, or inspection view.

---

## Advanced Optimization & Analytics Engine

The simulation engine incorporates specialized financial logic:

1. **RMD Calculations**: Applies IRS Uniform Lifetime Tables (and Single Life Tables for survivors) to compute required minimum distributions starting at age 73/75.
2. **Drawdown Hierarchy**: Preserves tax efficiency by prioritizing withdrawals: Required Minimum Distributions -> Cash Reserves -> Taxable Brokerage -> Traditional Pre-Tax IRA -> Roth IRA.
3. **Medicare IRMAA Lookback**: Determines Part B and Part D surcharge tiers using MAGI from 2 years prior, with automatic Form SSA-44 income reduction adjustments for qualifying life-changing events (work reduction or retirement).
4. **Survivor Transition**: Models transition to Single Filer status upon the primary or spouse passing, adjusting tax brackets, standard deductions, and Social Security survivor benefits (stepping up to the higher of the two benefits).
5. **Charitable QCD Strategy**: Directs distributions from Pre-Tax IRAs to qualified charities starting at age 70½ to satisfy RMDs while avoiding inclusion in AGI.

---

## 🛠️ Development & Environment Setup

Follow these instructions to set up the Node.js toolchain, configure your local environment, install dependencies, and run the development server.

### System Requirements
* **Node.js**: `v18.x` or `v20.x` (LTS versions recommended)
* **NPM**: `v9.x` or `v10.x` (comes bundled with Node.js)

---

### 🐧 Linux & WSL Setup

For Linux (Ubuntu/Debian, Fedora, etc.) or Windows Subsystem for Linux (WSL), using **Node Version Manager (NVM)** is recommended:

#### 1. Install NVM & Node.js
```bash
# Download and install NVM script
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Refresh your current shell session environment variables
source ~/.bashrc

# Install Node.js LTS v20
nvm install 20

# Verify installations
node --version # Outputs v20.x.x
npm --version  # Outputs v10.x.x
```

#### 2. Clone Repository & Install Dependencies
```bash
# Create and navigate to your repos directory
mkdir -p ~/repos
cd ~/repos

# Clone the repository
git clone git@github.com:mpetronic/retirement-planner.git
cd retirement-planner

# Clean install packages
npm install
```

#### 3. Run Development Server
```bash
npm run dev
```
The application will launch locally at `http://localhost:5173`.

---

### 🍎 macOS Setup

#### 1. Install Node.js
Choose one of the following methods in Terminal:

* **Via Homebrew [Recommended]**:
  ```zsh
  brew install node@20
  brew link --overwrite --force node@20
  ```

* **Via NVM**:
  ```zsh
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  source ~/.zshrc
  nvm install 20
  nvm use 20
  ```

* **Via Official Installer**:
  Download and run the **macOS Installer (.pkg)** from the [Node.js Downloads Page](https://nodejs.org/en/download/).

#### 2. Clone Repository, Install & Run Dev Server
```zsh
mkdir -p ~/repos
cd ~/repos
git clone git@github.com:mpetronic/retirement-planner.git
cd retirement-planner
npm install
npm run dev
```
Navigate your browser to `http://localhost:5173`.

---

### 🪟 Windows Setup (Native PowerShell/CMD)

Choose the setup procedure that matches your Windows user permissions:
* **[Option A: With Administrator Access](#option-a-with-administrator-access)**: For personal PCs or developer workstations with local admin rights.
* **[Option B: Without Administrator Access (Non-Admin)](#option-b-without-administrator-access-non-admin)**: For restricted enterprise environments without admin privileges.

---

#### Option A: With Administrator Access

##### 1. Install Node.js LTS & Git
Open PowerShell:
```powershell
# Install Node.js LTS via winget
winget install OpenJS.NodeJS.LTS

# Install Git
winget install Git.Git
```

##### 2. Configure PowerShell Execution Policy
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

##### 3. Verify Toolchain
Restart PowerShell and verify:
```powershell
node -v   # Outputs v20.x.x
npm -v    # Outputs v10.x.x
git --version
```

##### 4. Clone Repository, Install & Run Dev Server
```powershell
mkdir "$HOME\repos" -Force
cd "$HOME\repos"
git clone git@github.com:mpetronic/retirement-planner.git
cd retirement-planner
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

#### Option B: Without Administrator Access (Non-Admin)

##### Step 1: Open PowerShell
Press the **Windows Key**, type `PowerShell`, and open Windows PowerShell.

##### Step 2: Create a Tools Folder
```powershell
mkdir "$HOME\tools" -Force
cd "$HOME\tools"
```

##### Step 3: Download & Extract Portable Node.js
```powershell
Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip" -OutFile "node.zip"
Expand-Archive -Path "node.zip" -DestinationPath "$HOME\tools" -Force
Rename-Item -Path "$HOME\tools\node-v20.18.0-win-x64" -NewName "nodejs"
```

##### Step 4: Configure User PATH & Enable Script Execution
```powershell
[Environment]::SetEnvironmentVariable("Path", "$HOME\tools\nodejs;" + [Environment]::GetEnvironmentVariable("Path", "User"), "User")
$env:Path = "$HOME\tools\nodejs;$env:Path"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

##### Step 5: Verify Toolchain
```powershell
node -v
npm -v
```

##### Step 6: Download & Extract Project Code
```powershell
mkdir "$HOME\repos" -Force
cd "$HOME\repos"
Invoke-WebRequest -Uri "https://github.com/mpetronic/retirement-planner/archive/refs/heads/main.zip" -OutFile "repo.zip"
Expand-Archive -Path "repo.zip" -DestinationPath "$HOME\repos" -Force
Rename-Item -Path "$HOME\repos\retirement-planner-main" -NewName "retirement-planner"
cd "$HOME\repos\retirement-planner"
```

##### Step 7: Install Dependencies & Launch
```powershell
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🛠️ Verification, Testing & Build Commands

Before committing or deploying code, run these commands to verify test coverage, type safety, and production builds.

### Unit Test Suite
Run the Vitest unit test suite to execute simulation engine, optimizer, and utility tests:
```bash
npm run test:run
```

### Type Check & Production Build
Compiles TypeScript strictly (`tsc -b`) and generates optimized static distribution files in `/dist`:
```bash
npm run build
```

### 🐳 Docker Container Deployment
Build and run the application as a containerized Nginx application:
```bash
# Build Docker image
npm run docker:build

# Run Docker container on port 8080
npm run docker:run
```

---

## 💻 Recommended Developer Tools

For local development and editing, recommended Visual Studio Code extensions:
* **ESLint** (`dbaeumer.vscode-eslint`): Identifies stylistic and syntax issues.
* **Prettier** (`esbenp.prettier-vscode`): Enforces consistent code formatting.
* **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`): Autocompletes Tailwind CSS classes.

---

## 📄 License & Disclaimer

### MIT License
This project is licensed under the terms of the **[MIT License](LICENSE)**.

```text
Copyright (c) 2026 Mark Petronic

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Legal & Financial Disclaimer
**This application is provided strictly for educational, informational, and personal modeling purposes only.**
- The outputs, projections, tax estimations, and Monte Carlo probabilities generated by this tool do not constitute professional financial, investment, tax, legal, or accounting advice.
- Financial tax rules (including IRS ordinary income brackets, capital gains thresholds, standard deductions, RMD calculations, and Medicare IRMAA surcharges) are subject to legislative changes and annual inflation adjustments.
- The author(s) and copyright holder(s) assume **no liability or responsibility** for any financial decisions, tax filings, investment strategies, losses, or damages resulting from the use of this software. Always consult a qualified Certified Financial Planner (CFP), CPA, or tax professional before making financial decisions.
