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

#### 2. Clone Repository & Install Dependencies
Create your local `~/repos` directory and clone the project:
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
# Start Vite development server
npm run dev
```
The application will launch locally at `http://localhost:5173`.

---

### 🍎 macOS Setup

macOS developers can configure Node.js using **Homebrew** (recommended), **Node Version Manager (NVM)**, or the official installer.

#### 1. Install Node.js
Choose one of the following methods in your macOS Terminal:

* **Via Homebrew [Recommended & Fastest]**:
  If you have [Homebrew](https://brew.sh/) installed:
  ```zsh
  # Install Node.js LTS v20
  brew install node@20

  # Link node@20 so it is globally accessible in your PATH
  brew link --overwrite --force node@20
  ```

* **Via NVM (Node Version Manager)**:
  Ideal if you work with multiple Node versions:
  ```zsh
  # 1. Download and install NVM
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

  # 2. Reload your zsh profile
  source ~/.zshrc

  # 3. Install and activate Node.js LTS v20
  nvm install 20
  nvm use 20
  ```

* **Via Official Installer (.pkg)**:
  Download and run the official **macOS Installer (.pkg)** from the [Node.js Downloads Page](https://nodejs.org/en/download/).

#### 2. Verify Toolchain
In your Terminal, verify that `node` and `npm` are available:
```zsh
node -v   # Should output v20.x.x
npm -v    # Should output v10.x.x
```

#### 3. Clone Repository, Install & Run Dev Server
Create your local `~/repos` directory, clone the project, and launch the application:
```zsh
# Create and navigate to your repos directory
mkdir -p ~/repos
cd ~/repos

# Clone the repository
git clone git@github.com:mpetronic/retirement-planner.git
cd retirement-planner

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Navigate your browser to `http://localhost:5173`.

---

### 🪟 Windows Setup (Native PowerShell/CMD)

Choose the setup procedure that matches your Windows user permissions:
* **[Option A: With Administrator Access](#option-a-with-administrator-access)**: For personal PCs or developer workstations with local admin rights.
* **[Option B: Without Administrator Access (Non-Admin)](#option-b-without-administrator-access-non-admin)**: For enterprise laptops or restricted corporate environments without admin privileges.

---

#### Option A: With Administrator Access

##### 1. Install Node.js LTS & Git
Open PowerShell and choose one of the following installation methods:
* **Via Windows Package Manager (`winget`) [Fastest]**:
  ```powershell
  # Install Node.js LTS
  winget install OpenJS.NodeJS.LTS

  # Install Git (if not already installed)
  winget install Git.Git
  ```
* **Via Official Installers**:
  - Download and run the **Node.js LTS Installer (.msi)** from the [Node.js Downloads Page](https://nodejs.org/en/download/). Ensure the **"Add to PATH"** checkbox is selected during setup.
  - Download and run the **Git for Windows Installer** from [git-scm.com/download/win](https://git-scm.com/download/win).
* **Alternative (Via NVM-Windows)**:
  ```powershell
  winget install CoreyButler.NVMforWindows
  ```
  *(Or download and run `nvm-setup.exe` from [nvm-windows releases](https://github.com/coreybutler/nvm-windows/releases)).*

##### 2. Configure PowerShell Execution Policy
By default, PowerShell restricts running scripts. Enable script execution for your user account:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

##### 3. Restart Terminal & Verify Toolchain
**Close all existing PowerShell windows and open a new PowerShell window** so the updated `PATH` environment variables take effect:
```powershell
node -v   # Should output v20.x.x
npm -v    # Should output v10.x.x
git --version
```
*(If using NVM-Windows, run `nvm install 20.11.0` followed by `nvm use 20.11.0` before verifying).*

##### 4. Clone Repository, Install & Run Dev Server
Create your local `$HOME\repos` directory, clone the project, and start the server:
```powershell
# Create and navigate to your repos directory
mkdir "$HOME\repos" -Force
cd "$HOME\repos"

# Clone the repository
git clone git@github.com:mpetronic/retirement-planner.git
cd retirement-planner

# Install node packages
npm install

# Launch Vite dev server
npm run dev
```
Navigate your browser to `http://localhost:5173`.

---

#### Option B: Without Administrator Access (Non-Admin)

Follow these step-by-step instructions to install and run the app entirely in your user folder without needing administrator privileges.

##### Step 1: Open PowerShell
1. Press the **Windows Key** on your keyboard (or click the Start Menu).
2. Type `PowerShell` and click **Windows PowerShell** to open a new terminal window.

##### Step 2: Create a Tools Folder and Move into It
Create a dedicated `tools` folder in your user account directory and change into it:
```powershell
# Create a "tools" folder inside your personal user profile
mkdir "$HOME\tools" -Force

# Navigate (change directory) into the newly created folder
cd "$HOME\tools"
```

##### Step 3: Download & Extract Portable Node.js
Run the following commands in PowerShell to download the official portable Node.js LTS archive and extract it:
```powershell
# 1. Download the portable Node.js v20 zip archive
Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip" -OutFile "node.zip"

# 2. Extract the archive into your tools folder
Expand-Archive -Path "node.zip" -DestinationPath "$HOME\tools" -Force

# 3. Rename the extracted folder to "nodejs" for easy access
Rename-Item -Path "$HOME\tools\node-v20.18.0-win-x64" -NewName "nodejs"
```
*(Alternative via Browser: If you prefer using your web browser, download the 64-bit `.zip` from the [Node.js Distributions Page](https://nodejs.org/dist/latest-v20.x/), right-click the downloaded file, select **Extract All...**, and choose `C:\Users\<YourUsername>\tools\nodejs` as the destination).*

##### Step 4: Configure User PATH & Enable Script Execution
Tell Windows where to find `node` and allow PowerShell to run local scripts in your current session (no admin rights needed):
```powershell
# 1. Permanently add Node to your User PATH (only needed once)
[Environment]::SetEnvironmentVariable("Path", "$HOME\tools\nodejs;" + [Environment]::GetEnvironmentVariable("Path", "User"), "User")

# 2. Load Node into your current PowerShell window immediately
$env:Path = "$HOME\tools\nodejs;$env:Path"

# 3. Allow PowerShell to run scripts in this session without admin permissions
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

##### Step 5: Verify Toolchain Installation
Confirm that `node` and `npm` are recognized:
```powershell
node -v   # Should print v20.x.x
npm -v    # Should print 10.x.x
```

##### Step 6: Download & Extract Project Code (No Git Required)
You do not need Git installed. Download and extract the repository source code directly:
```powershell
# 1. Create your repos directory and move into it
mkdir "$HOME\repos" -Force
cd "$HOME\repos"

# 2. Download the repository source code ZIP archive
Invoke-WebRequest -Uri "https://github.com/mpetronic/retirement-planner/archive/refs/heads/main.zip" -OutFile "repo.zip"

# 3. Extract the ZIP archive
Expand-Archive -Path "repo.zip" -DestinationPath "$HOME\repos" -Force

# 4. Rename the extracted folder to retirement-planner and move into it
Rename-Item -Path "$HOME\repos\retirement-planner-main" -NewName "retirement-planner"
cd "$HOME\repos\retirement-planner"
```
*(Alternative via Browser: Visit [github.com/mpetronic/retirement-planner](https://github.com/mpetronic/retirement-planner), click **Code** -> **Download ZIP**, and extract the contents to `C:\Users\<YourUsername>\repos\retirement-planner`).*

##### Step 7: Install Dependencies & Launch the App
Run these commands within that same PowerShell window:
```powershell
# 1. Install all project dependencies
npm install

# 2. Start the local development web server
npm run dev
```
Once started, open your web browser and go to `http://localhost:5173` to interact with the planner.

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
