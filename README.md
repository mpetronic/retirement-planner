# Retirement Planner Dashboard

An interactive, premium, 35-year financial planning web application. This tool empowers users to model market trajectories (using Flat, stochastic Monte Carlo with Capital Market Assumptions, or historical backfill conditions), spousal claiming scenarios, 3-bucket portfolio structures, and tax optimization strategies (such as Roth conversions and multi-state relocations) while calculating federal taxes, state and local taxes (supporting all 50 U.S. states and Washington D.C.), capital gains, Medicare base premiums, and Modified Adjusted Gross Income (MAGI) lookback IRMAA surcharges.

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
  - [7. Bucket Management](#7-bucket-management)
- [Interactive Controls & Navigation System](#interactive-controls--navigation-system)
  - [Sidebar Navigation & Parameter Workspaces](#sidebar-navigation--parameter-workspaces)
  - [Global Keyboard Shortcuts](#global-keyboard-shortcuts)
- [Advanced Optimization & Analytics Engine](#advanced-optimization--analytics-engine)
- [🚀 Quick Start (Standalone Local App / Non-Developers)](#-quick-start-standalone-local-app--non-developers)
  - [Download & Run the Standalone Binary](#download--run-the-standalone-binary)
  - [Command-Line Options & Port Configuration](#command-line-options--port-configuration)
  - [Building the Standalone Binary from Source](#building-the-standalone-binary-from-source)
- [🛠️ Development Installation & Environment Setup](#️-development-installation--environment-setup)
  - [System Requirements](#system-requirements)
  - [🐧 Linux & WSL Setup (Dev)](#-linux--wsl-setup-dev)
  - [🍎 macOS Setup (Dev)](#-macos-setup-dev)
  - [🪟 Windows Setup (PowerShell / Dev)](#-windows-setup-powershell--dev)
  - [⚡ Running the Vite Production Build (High Performance)](#-running-the-vite-production-build-high-performance)
- [🛠️ Verification, Testing & Build Commands](#️-verification-testing--build-commands)
  - [Unit Test Suite](#unit-test-suite)
  - [Code Quality & Linting](#code-quality--linting)
  - [Type Check & Production Build](#type-check--production-build)
  - [Preview Production Build](#preview-production-build)
  - [Compile Standalone Go Server](#compile-standalone-go-server)
  - [🐳 Docker Container Deployment](#-docker-container-deployment)
- [💻 Recommended Developer Tools](#-recommended-developer-tools)
- [📄 License & Disclaimer](#-license--disclaimer)

---

## Overview & Core Features

- **Interactive Onboarding Wizard**: Guided 4-step setup flow for first-time users to configure personal profiles, retirement timing, initial portfolio balances, and return assumptions.
- **35-Year Spousal Timeline Engine**: Tracks annual income, Social Security claiming ages (62-70), active employment salaries, 401(k) contributions, asset compounding, and priority-based drawdown waterfalls.
- **Federal & State Tax Engine**: Models Federal ordinary income brackets (10% to 37%), standard deductions with age 65+ senior bumps, preferential long-term capital gains rates (0%, 15%, 20%), and comprehensive state and local income tax profiles across all 50 U.S. states and Washington D.C. (graduated tax brackets, flat taxes, zero-income-tax states, statutory retirement/pension exemptions, and county/municipal piggyback surtaxes) with customizable relocation year modeling.
- **Medicare IRMAA & Form SSA-44 Modeling**: Simulates 2-year MAGI lookback Medicare IRMAA surcharge tiers (Part B & Part D) with Form SSA-44 life-changing event income adjustments upon retirement.
- **Multi-Strategy Roth Conversion Planner**: Models flat annual conversions or dynamic "Fill-to-Bracket / Fill-to-IRMAA" strategies with customizable conversion start and end year windows.
- **Automated Scenario Optimizer**: Algorithms to identify optimal Social Security claiming ages and Roth conversion schedules to maximize ending estate, minimize lifetime tax, or minimize IRMAA surcharges.
- **3-Bucket Wealth Preservation Strategy**: Models Cash, Income (Bond/CD Ladder), and Growth buckets with rule-based systematic refills from capital gains and market drawdowns protection.
- **Charitable QCD & Tithe Engine**: Models Qualified Charitable Distributions (QCDs) directly from Pre-Tax IRAs starting at age 70½ to satisfy Required Minimum Distributions (RMDs) tax-free, alongside annual cash tithe contributions.
- **Itemized vs. Simple Aggregate Expenses**: Supports both simple inflation-adjusted annual living budgets and granular itemized expense categories (housing, medical, lifestyle, discretionary, and future one-off expenses) with scheduled payment months and state-specific applicability.
- **Stochastic Monte Carlo & Institutional CMA Stress Testing**: Simulates 1,000+ parallel trials with seedable pseudo-random generation (Mulberry32 PRNG), sequence-of-returns risk analysis, regime switching, Student-t fat-tail distributions, institutional Capital Market Assumptions (Vanguard, BlackRock, J.P. Morgan, Institutional Consensus 2026), and market crash override stress tests.
- **Dual Valuation Mode**: Toggle instantly between Nominal Future Dollars and Real Today's Purchasing Power Dollars across all charts, ledgers, and summary metrics.
- **Sankey Flow Diagram**: Interactive visual cashflow diagrams illustrating the flow of gross income, tax liabilities, living expenses, and portfolio reinvestment/drawdown balances.
- **Plan Exporting & PDF Reports**: Save plans locally, export/import JSON configurations, generate Excel (.xlsx) workbooks, and create downloadable PDF executive summary reports.
- **Accessibility & Typography Scaling**: Global root font scaling (12px to 24px) for responsive sizing across all displays and full keyboard navigation shortcuts.

---

## Workspace Structure

The application is structured into seven dedicated, synchronized workspaces:

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
- **Full Cashflow Accounting**: Year-by-year columns tracking asset balances (Pre-tax, Roth, Taxable, Cash), Social Security benefits, RMDs, employee 401(k) contributions, standard deductions, tax brackets, effective tax rates, state and local taxes, Form SSA-44 lookback MAGI, Medicare base & IRMAA surcharges, charitable QCDs & tithes, and estate values.
- **Row Inspection Drilldown**: Click any year row to open a detailed inspection modal breaking down that specific year's tax calculations, MAGI adjustments, and account movements.
- **KPI Summary Banner**: Quick-toggle summary bar displaying ending estate, total lifetime taxes paid, Medicare surcharges, base premiums, and charitable contributions.

### 4. Monte Carlo Analysis
Long-term market stress testing and sequence-of-returns risk modeling.
- **Parallel Stochastic Engine**: Runs 1,000+ randomized simulations displaying percentile paths (P10 worst-case, P25, P50 median, P75, P90 best-case).
- **Institutional CMA & Custom Profiles**: Select from institutional return assumptions (Vanguard VCMM, BlackRock, J.P. Morgan, Institutional Consensus 2026) or configure custom return means, annual volatilities, asset correlations, and Student-t fat-tail scaling.
- **Stress Test Control Panel**: Apply custom multi-year market shock overrides (e.g., severe initial market drop, elevated inflation) to evaluate sequence risk.
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

### 7. Bucket Management
Structured 3-bucket strategy governance and bond/CD laddering.
- **Three-Bucket Framework**: Allocates portfolio assets across Cash Bucket (immediate 1-3 years of living liquidity), Income / Bond Ladder Bucket (3-7 year safe yields, CDs, and individual bond maturities), and Growth Bucket (long-term equity compounding).
- **Systematic Refill Rules**: Triggers periodic bucket replenishments from equity gains during bull markets while automatically pausing replenishments during sustained market drawdowns to avoid selling equities at troughs.
- **Bond & CD Ladder Management**: Interactive holdings table modeling instrument face values, coupon rates, maturity years, and yield-to-maturity cash inflows.
- **Action Item Ledger**: Year-by-year operational execution steps tracking rebalancing transfers, maturing bonds, and required cash disbursements.

---

## Interactive Controls & Navigation System

### Sidebar Navigation & Parameter Workspaces
The application features a responsive, collapsible sidebar navigation providing instant access to all core workspaces and dedicated parameter management screens:

- 👤 **Profiles & Family** (`params-profiles`): User and spouse birth dates, Social Security PIA estimates, target claiming ages (62-70), retirement ages, active salaries, longevity ages, and survivor analysis.
- ⚖️ **Tax Filing Status** (`params-filing-status`): Married Filing Jointly (MFJ) vs. Single Filer mode, with dynamic survivor transition modeling.
- 📍 **Tax Residency & States** (`params-residency`): Primary state of residence, county/municipal piggyback surtax rates, target relocation state & local rates, and customizable relocation timing.
- 🩺 **Healthcare & Medicare** (`params-healthcare`): Pre-65 ACA premiums, Medicare Part B & Part D baseline premiums, supplemental insurance, dental/vision/hearing out-of-pocket costs, and Form SSA-44 life-changing event income reductions.
- 💼 **Accounts & Balances** (`params-accounts`): Starting balances (Traditional Pre-Tax IRA, Roth IRA, Taxable Brokerage, Cost Basis, Cash Reserves), asset allocations, expected returns, dividend yields, and cash yields.
- 🏷️ **Living Expenses & Budget** (`params-expenses`): Toggle between a simple aggregate annual living budget or a granular 40+ itemized category catalog with scheduled payment months and state-specific tagging.
- 🤝 **Charitable Giving & QCD** (`params-charity`): Qualified Charitable Distributions (QCDs) from Pre-Tax IRAs starting at age 70½ to satisfy RMDs tax-free, plus annual cash tithe contributions.
- 💾 **Backup & Portability** (`params-data`): Plan scenario management, JSON import/export, Excel spreadsheet generation, and PDF executive reports.
- 🔄 **Reset Plan** (`params-reset`): Restart onboarding wizard or restore default plan configuration.

### Global Keyboard Shortcuts
- **`P`**: Toggle between Parameter Workspaces and primary workspaces.
- **`?`** (or **`Shift`** + **`/`**): Open interactive Documentation & User Guide modal.
- **`Esc`**: Close active drawer, modal dialog, or inspection view.

---

## Advanced Optimization & Analytics Engine

The simulation engine incorporates specialized financial logic:

1. **RMD Calculations**: Applies IRS Uniform Lifetime Tables (and Single Life Tables for survivors) to compute required minimum distributions starting at age 73/75.
2. **Drawdown Hierarchy**: Preserves tax efficiency by prioritizing withdrawals: Required Minimum Distributions -> Cash Reserves -> Taxable Brokerage -> Traditional Pre-Tax IRA -> Roth IRA.
3. **Medicare IRMAA Lookback**: Determines Part B and Part D surcharge tiers using MAGI from 2 years prior, with automatic Form SSA-44 income reduction adjustments for qualifying life-changing events (work reduction or retirement).
4. **50-State & Local Tax Architecture**: Computes statutory income taxes for all 50 U.S. states and D.C., incorporating local county/city surtaxes, pension and Social Security exclusions, and relocation transitions.
5. **Survivor Transition**: Models transition to Single Filer status upon the primary or spouse passing, adjusting tax brackets, standard deductions, and Social Security survivor benefits (stepping up to the higher of the two benefits).
6. **Charitable QCD Strategy**: Directs distributions from Pre-Tax IRAs to qualified charities starting at age 70½ to satisfy RMDs while avoiding inclusion in AGI.
7. **3-Bucket Wealth Preservation**: Governs multi-year asset tiering, balancing immediate cashflow safety needs with long-term purchasing power defense.

---

## 🚀 Quick Start (Standalone Local App / Non-Developers)

If you simply want to run and use the Retirement Planner locally on your personal machine, you **do not need Node.js, npm, or any development toolchains installed**. The application is distributed as a single standalone executable that embeds the entire pre-compiled web client and launches an instant local web server.

### Download & Run the Standalone Binary

1. Obtain the binary for your operating system from GitHub Releases or from the built project:
   - **Linux**: `retirement-planner` (or `dist-bin/retirement-planner-linux-amd64` / `arm64`)
   - **macOS**: `retirement-planner` (or `dist-bin/retirement-planner-darwin-arm64` for Apple Silicon / `amd64` for Intel)
   - **Windows**: `retirement-planner.exe` (or `dist-bin/retirement-planner-windows-amd64.exe`)

2. Run the application from your terminal or command prompt:

   **Linux / macOS**:
   ```bash
   chmod +x ./retirement-planner
   ./retirement-planner
   ```

   **Windows (PowerShell / Command Prompt)**:
   ```powershell
   .\retirement-planner.exe
   ```

3. Open your web browser and navigate to:
   ```text
   http://localhost:8999
   ```
   To access the integrated standalone Expense Categorizer utility directly:
   ```text
   http://localhost:8999/expenser
   ```

To stop the application at any time, press `Ctrl+C` in your terminal.

---

### Command-Line Options & Port Configuration

The server defaults to listening on port `8999` bound to `127.0.0.1` (localhost). You can override the port, host binding, or instruct it to automatically open your browser on start using command-line arguments:

| Flag | Default | Description |
|---|---|---|
| `--port <number>` | `8999` | Port to serve the application on |
| `--host <address>` | `127.0.0.1` | Local network interface address to bind |
| `--open` | `false` | Automatically launch default web browser on start |
| `-h`, `--help` | — | Display help menu and available options |

#### Examples:
```bash
# Run on a different port (e.g., 9000)
./retirement-planner --port 9000

# Automatically open the application in your default web browser
./retirement-planner --open

# Bind to all network interfaces on port 8080 (for LAN access)
./retirement-planner --host 0.0.0.0 --port 8080
```

---

### Building the Standalone Binary from Source

If you have cloned the source repository and have Node.js and Go installed, you can build the standalone single binary in one command:

```bash
# Compile updated /dist assets and build the Go binary
./build-go.sh

# Or build and immediately run on port 8999:
./build-go.sh --run

# Or compile cross-platform binaries for Linux, macOS, and Windows:
./build-go.sh --all
```

The resulting executable will be placed in the project root as `./retirement-planner`.

---

## 🛠️ Development Installation & Environment Setup

Follow these instructions if you want to inspect source code, modify components, or contribute to the planner. This setup runs the live Vite Node.js development server with Hot Module Replacement (HMR) and real-time state synchronization.

> [!NOTE]
> All Git instructions below assume you have GitHub SSH keys configured for read/write repository access (`git@github.com:...`).

### System Requirements
* **Node.js**: `v20.x` or `v22.x` (Active LTS versions recommended; `v18+` minimum supported)
* **NPM**: `v9.x` or `v10.x` (comes bundled with Node.js)
* **Git**: configured with SSH key access

---

### 🐧 Linux & WSL Setup (Dev)

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

#### 2. Clone Repository via SSH & Install Dependencies
```bash
# Create and navigate to your repos directory
mkdir -p ~/repos
cd ~/repos

# Clone repository via SSH
git clone git@github.com:mpetronic/retirement-planner.git
cd retirement-planner

# Clean install packages
npm install
```

#### 3. Run Development Server
```bash
npm run dev
```
The application will launch with hot reloads at `http://localhost:5173`.

---

### 🍎 macOS Setup (Dev)

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

#### 2. Clone Repository via SSH, Install & Run Dev Server
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

### 🪟 Windows Setup (PowerShell / Dev)

For Windows developers using native PowerShell or Windows Terminal with OpenSSH:

#### 1. Install Node.js LTS & Git (via winget or installer)
```powershell
# Install Node.js LTS and Git
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

#### 2. Configure PowerShell Execution Policy
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

#### 3. Verify Toolchain
Restart PowerShell and verify:
```powershell
node -v   # Outputs v20.x.x or v22.x.x
npm -v    # Outputs v10.x.x
git --version
```

#### 4. Clone Repository via SSH, Install & Run Dev Server
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

### ⚡ Running the Vite Production Build (High Performance)

While `npm run dev` provides hot-module reloading (HMR) and fast iteration during development, it executes unbundled code with React development mode validation and un-minified assets. For computationally heavy tasks—such as simulating **1,000+ Monte Carlo trials**, executing multi-variable **Roth conversion strategy optimizations**, or rendering extensive 35-year tabular ledgers—running the compiled production bundle locally delivers **significantly faster execution, silky-smooth 60+ FPS chart interactions, and optimal runtime performance**.

#### Step 1: Compile the Production Bundle
Compile TypeScript strictly (`tsc -b`), run dead-code elimination, and produce minified static assets in `/dist`:
```bash
npm run build
```

#### Step 2: Serve the Production Build via Vite Preview
Launch Vite's built-in static preview web server:
```bash
npm run preview
```
The optimized production application will be accessible at:
```text
http://localhost:4173
```

> [!TIP]
> **One-Liner Shortcut**: You can build and immediately launch the preview server with:
> ```bash
> npm run build && npm run preview
> ```

---

## 🛠️ Verification, Testing & Build Commands

Before committing or deploying code, run these commands to verify test coverage, code style, type safety, and production builds.

### Unit Test Suite
Run the Vitest unit test suite to execute simulation engine, optimizer, and utility tests:
```bash
# Run unit tests once
npm run test:run

# Run unit tests in interactive watch mode
npm test
```

### Code Quality & Linting
Run ESLint to check syntax, import consistency, and React hooks rules:
```bash
npm run lint
```

### Type Check & Production Build
Compiles TypeScript strictly (`tsc -b`) and generates optimized static distribution files in `/dist`:
```bash
npm run build
```

### Preview Production Build
Serve the local `/dist` production bundle to test production behavior:
```bash
npm run preview
```

### Compile Standalone Go Server
Builds the production bundle and compiles the self-contained Go server executable embedding all web assets:
```bash
# Compile native binary (./retirement-planner)
npm run build:go
# or
./build-go.sh

# Or compile cross-platform binaries into dist-bin/:
./build-go.sh --all
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
