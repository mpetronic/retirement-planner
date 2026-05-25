# Retirement Planner Dashboard

An interactive, premium, 35-year financial planning web application. This tool empowers users to model market trajectories (using Flat, stochastic Monte Carlo, or historical backfill conditions), spousal claiming scenarios, and tax optimization strategies (such as Roth conversions and state residency relocations) while calculating federal taxes, Maryland/Florida state taxes, capital gains, Medicare base premiums, and Modified Adjusted Gross Income (MAGI) lookback IRMAA surcharges.

---

## Workspace Structure

The planner is organized into four dedicated, highly interactive workspaces:
1. **Workspace 1: Bracket Map Chart**: Visual tax bracket planning and Roth conversion modeling with real-time expected return and scenario optimizations.
2. **Workspace 2: Lookback Ledger**: Detailed annual spousal cashflow tables tracking income sources, tax margins, standard deductions, deficits, accounts drawdowns, and Medicare IRMAA cliffs.
3. **Workspace 3: Monte Carlo Analysis**: Long-term market stress testing across 1,000 parallel randomized trials with seedable reproducibility.
4. **Workspace 4: Plan Comparison**: A dynamic scenario-management workspace to save active workspace parameters, load them, and run side-by-side lifetime delta comparisons.

---

## 🛠️ Development & Environment Setup

Follow these instructions to set up the Node.js toolchain, configure your local environment, install dependencies, and run the development server.

### System Requirements
* **Node.js**: `v18.x` or `v20.x` (LTS versions highly recommended)
* **NPM**: `v9.x` or `v10.x` (comes bundled with Node.js)

---

### 🐧 Linux & WSL Setup

For Linux (Ubuntu/Debian, Fedora, etc.) or Windows Subsystem for Linux (WSL), using **Node Version Manager (NVM)** is the industry best practice to prevent permissions conflicts.

#### 1. Install NVM & Node.js
Open your terminal and execute:
```bash
# Download and install NVM script
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Refresh your current shell session environment variables
source ~/.bashrc

# Install Node.js LTS v20
nvm install 20

# Verify installations
node --version # Should output v20.x.x
npm --version  # Should output v10.x.x
```

#### 2. Project Installation
```bash
# Clone the repository (if not already local)
git clone <repository-url>
cd retirement-planner

# Clean install packages
npm install
```

#### 3. Run Development Server
```bash
# Start Vite development server
npm run dev
```
The application will launch locally at `http://localhost:5173`.

---

### 🪟 Windows Setup (Native PowerShell/CMD)

For Windows developers not using WSL, you can install the toolchain using the official installer or **nvm-windows**.

#### 1. Install Node.js
* **Recommended (Via Installer)**: Download the official **Node.js LTS Installer (.msi)** from the [Node.js Downloads Page](https://nodejs.org/en/download/) and run it. Ensure that the **"Add to PATH"** checkbox is selected during setup.
* **Alternative (Via NVM-Windows)**: Download and run the latest installer from [nvm-windows releases](https://github.com/coreybutler/nvm-windows/releases), then open a fresh PowerShell and run:
  ```powershell
  nvm install 20.11.0
  nvm use 20.11.0
  ```

#### 2. Verify Path & Tools
Open a **new** PowerShell or Command Prompt terminal and verify paths are bound:
```powershell
node -v
npm -v
```

#### 3. Project Installation & Dev Server
Run these commands within your project folder:
```powershell
# Install node packages
npm install

# Launch Vite dev server
npm run dev
```
Navigate your browser to `http://localhost:5173` to explore.

---

## 🛠️ Verification & Build Commands

Before submitting code, run these commands to verify type safety, clean code patterns, and production bundle packaging.

### Type Check the Codebase
Ensures all TypeScript interfaces, component props, and calculations map correctly:
```bash
npx tsc --noEmit
```

### Production Bundle Packager
Builds optimized, compressed static assets in the `/dist` directory for static hosting:
```bash
npm run build
```

---

## 💻 Recommended Developer Tools

To get the most out of editing and pair programming in this repository, we recommend using **Visual Studio Code** along with these extension assets:
* **ESLint** (`dbaeumer.vscode-eslint`): Auto-detects stylistic and syntax violations.
* **Prettier** (`esbenp.prettier-vscode`): Enforces consistent formatting rules.
* **TypeScript Vue Plugin / Volar** (if modifying vue layouts) or standard TS tooling.
