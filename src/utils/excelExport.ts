import * as XLSX from 'xlsx';
import { AppStateInputs, SimulationResultRow, RECURRING_EXPENSE_ITEMS, ONE_TIME_EXPENSE_ITEMS, DetailedStateExpenses } from '../types';

export const exportToExcel = (ledger: SimulationResultRow[], inputs: AppStateInputs) => {
  const wb = XLSX.utils.book_new();

  // Helper to safely format healthcare values
  const getHCVal = (person: 'you' | 'wife', state: 'MD' | 'FL', key: string) => {
    const hc = person === 'you' ? inputs.you.healthcare : inputs.wife.healthcare;
    if (!hc) return "N/A";
    const stateObj = state === 'MD' ? hc.MD : hc.FL;
    return (stateObj as any)[key] ?? 0;
  };

  // Tab 1: Configuration Summary (AOA - Array of Arrays)
  const configData: any[][] = [
    ["Retirement Plan Configuration Summary"],
    [],
    ["Date Generated", new Date().toLocaleDateString('en-US')],
    [],
    ["PRIMARY USER SETTINGS"],
    ["Name", inputs.you.name || "Primary User"],
    ["Birth Date", inputs.you.birthDate || "N/A"],
    ["Planned Retirement Age", inputs.you.plannedRetirementAge ?? 67],
    ["Planned Retirement Month", inputs.you.plannedRetirementMonth ?? 1],
    ["Projected Longevity Age", inputs.you.longevityAge ?? 85],
    ["Active Work Salary", inputs.you.activeSalary ?? 0],
    ["Target SS Claiming Age", inputs.you.targetSSClaimingAge ?? 67],
    ["Estimated SS Benefit (PIA / monthly)", inputs.you.estimatedPIA ?? 0],
    ["Pre-Medicare Monthly Premium", inputs.you.healthcare ? "N/A (Detailed Active)" : (inputs.you.preMedicareMonthlyPremium ?? 0)],
    [],
    ["SPOUSE SETTINGS"],
    ["Filing Status Mode", inputs.isSingleFiler ? "Single Filer" : "Married Filing Jointly"],
  ];

  if (!inputs.isSingleFiler) {
    configData.push(
      ["Spouse Name", inputs.wife.name || "Spouse"],
      ["Birth Date", inputs.wife.birthDate || "N/A"],
      ["Planned Retirement Age", inputs.wife.plannedRetirementAge ?? 65],
      ["Planned Retirement Month", inputs.wife.plannedRetirementMonth ?? 1],
      ["Projected Longevity Age", inputs.wife.longevityAge ?? 95],
      ["Active Work Salary", inputs.wife.activeSalary ?? 0],
      ["Target SS Claiming Age", inputs.wife.targetSSClaimingAge ?? 67],
      ["Estimated SS Benefit (PIA / monthly)", inputs.wife.estimatedPIA ?? 0],
      ["Pre-Medicare Monthly Premium", inputs.wife.healthcare ? "N/A (Detailed Active)" : (inputs.wife.preMedicareMonthlyPremium ?? 0)]
    );
  }

  configData.push(
    [],
    ["STARTING ASSET BALANCES (2026)"],
    ["Your Taxable Brokerage Balance", inputs.portfolio.yourTaxableBrokerage ?? 0],
    ["Your Taxable Account Cost Basis", inputs.portfolio.yourTaxableBasis ?? 0],
    ["Spouse Taxable Brokerage Balance", inputs.isSingleFiler ? 0 : (inputs.portfolio.wifeTaxableBrokerage ?? 0)],
    ["Spouse Taxable Account Cost Basis", inputs.isSingleFiler ? 0 : (inputs.portfolio.wifeTaxableBasis ?? 0)],
    ["Your Traditional IRA (Pre-Tax)", inputs.portfolio.yourPreTaxIRA ?? 0],
    ["Spouse Traditional IRA (Pre-Tax)", inputs.isSingleFiler ? 0 : (inputs.portfolio.wifePreTaxIRA ?? 0)],
    ["Your Roth IRA (Tax-Free)", inputs.portfolio.yourRothIRA ?? 0],
    ["Spouse Roth IRA (Tax-Free)", inputs.isSingleFiler ? 0 : (inputs.portfolio.wifeRothIRA ?? 0)],
    ["Your Cash Savings", inputs.portfolio.yourCash ?? 0],
    ["Spouse Cash Savings", inputs.isSingleFiler ? 0 : (inputs.portfolio.wifeCash ?? 0)],
    ["Taxable Dividend Yield", inputs.portfolio.taxableDividendYield ?? 0.02],
    ["Non-Qualified Dividend Portion", inputs.portfolio.taxableNonQualifiedPortion ?? 0],
    [],
    ["GROWTH & CPI ASSUMPTIONS"],
    ["Equity / Stock Growth Rate", inputs.growthAssumptions.equityReturnRate ?? 0.07],
    ["Fixed Income / Cash Yield", inputs.growthAssumptions.fixedIncomeReturnRate ?? 0.04],
    ["CPI Inflation Rate", inputs.growthAssumptions.cpiInflationRate ?? 0.025],
    ["Healthcare Inflation Rate", inputs.growthAssumptions.healthcareInflationRate ?? 0.05],
    [],
    ["MONTE CARLO STOCHASTIC SETTINGS"],
    ["Simulation Mode", inputs.monteCarloSettings.mode],
    ["Number of Trials", inputs.monteCarloSettings.trials ?? 1000],
    ["Equity Volatility", inputs.monteCarloSettings.equityVolatility ?? 0.15],
    ["Fixed Income Volatility", inputs.monteCarloSettings.fixedIncomeVolatility ?? 0.05],
    ["Asset Class Correlation", inputs.monteCarloSettings.correlation ?? 0.15],
    ["Randomizer Seed", inputs.monteCarloSettings.seed ?? "N/A (Standard Random)"],
    [],
    ["STATE TAX RELOCATION"],
    ["Current Home State", inputs.jurisdiction.currentState],
    ["Relocating In Retirement", inputs.jurisdiction.relocationYear !== null ? "Yes" : "No"],
    ["Target Destination State", inputs.jurisdiction.targetState || "N/A"],
    ["Relocation Year Target", inputs.jurisdiction.relocationYear ?? "N/A"],
    [],
    ["ROTH CONVERSION STRATEGY"],
    ["Strategy Category", inputs.rothConversionStrategy],
    ["Annual Flat Conversion Amount", inputs.annualRothConversion ?? 0],
    ["Target MAGI Limit (Fill-To-Target)", inputs.rothConversionTargetValue ?? 0],
    ["Strategy Active Start Year", inputs.rothConversionStartYear ?? 2026],
    ["Strategy Active End Year", inputs.rothConversionEndYear ?? 2035]
  );

  // Add healthcare specifics if configured
  if (inputs.you.healthcare || (!inputs.isSingleFiler && inputs.wife.healthcare)) {
    configData.push(
      [],
      ["HEALTHCARE PREMIUM & OUT-OF-POCKET CONFIGURATIONS"]
    );
    if (inputs.you.healthcare) {
      configData.push(
        ["Primary - Custom Part B Base Premium", inputs.you.healthcare.medicarePartBPremium ?? "Default"],
        ["Primary - MD Pre-65 Medical Premium / OOP", `${getHCVal('you', 'MD', 'pre65MedicalPremium')} / ${getHCVal('you', 'MD', 'pre65MedicalOOP')}`],
        ["Primary - MD Post-65 Supplemental Premium / OOP", `${getHCVal('you', 'MD', 'supplementPremium')} / ${getHCVal('you', 'MD', 'supplementOOP')}`],
        ["Primary - FL Pre-65 Medical Premium / OOP", `${getHCVal('you', 'FL', 'pre65MedicalPremium')} / ${getHCVal('you', 'FL', 'pre65MedicalOOP')}`],
        ["Primary - FL Post-65 Supplemental Premium / OOP", `${getHCVal('you', 'FL', 'supplementPremium')} / ${getHCVal('you', 'FL', 'supplementOOP')}`]
      );
    }
    if (!inputs.isSingleFiler && inputs.wife.healthcare) {
      configData.push(
        ["Spouse - Custom Part B Base Premium", inputs.wife.healthcare.medicarePartBPremium ?? "Default"],
        ["Spouse - MD Pre-65 Medical Premium / OOP", `${getHCVal('wife', 'MD', 'pre65MedicalPremium')} / ${getHCVal('wife', 'MD', 'pre65MedicalOOP')}`],
        ["Spouse - MD Post-65 Supplemental Premium / OOP", `${getHCVal('wife', 'MD', 'supplementPremium')} / ${getHCVal('wife', 'MD', 'supplementOOP')}`],
        ["Spouse - FL Pre-65 Medical Premium / OOP", `${getHCVal('wife', 'FL', 'pre65MedicalPremium')} / ${getHCVal('wife', 'FL', 'pre65MedicalOOP')}`],
        ["Spouse - FL Post-65 Supplemental Premium / OOP", `${getHCVal('wife', 'FL', 'supplementPremium')} / ${getHCVal('wife', 'FL', 'supplementOOP')}`]
      );
    }
  }

  const wsConfig = XLSX.utils.aoa_to_sheet(configData);
  XLSX.utils.book_append_sheet(wb, wsConfig, "Configuration Summary");

  // Tab 2: Simulation Ledger
  const ledgerData = ledger.map(row => ({
    "Year": row.year,
    "Your Age": row.yourAge,
    "Spouse Age": inputs.isSingleFiler ? "-" : row.wifeAge,
    "Portfolio Value": Math.round(row.totalPortfolioValue),
    "Total MAGI": Math.round(row.magi),
    "Federal Taxable Income": Math.round(row.taxableIncome),
    "Federal Income Tax": Math.round(row.fedIncomeTax),
    "State Income Tax": Math.round(row.stateIncomeTax),
    "NIIT Tax": Math.round(row.niitTax),
    "Total Tax Bill": Math.round(row.fedIncomeTax + row.stateIncomeTax),
    "Ordinary Dividends": Math.round(row.taxableDividends),
    "Cash Interest": Math.round(row.taxableInterest),
    "Social Security Inflow": Math.round(row.yourSS + row.wifeSS),
    "Salary Inflow": Math.round((row.yourSalary ?? 0) + (row.wifeSalary ?? 0)),
    "RMD Distributed": Math.round(row.yourRMD + row.wifeRMD),
    "Roth Conversion Added": Math.round(row.intentionalRothConversion),
    "Capital Gains Triggered": Math.round(row.capitalGainsTriggered),
    "Base Living Expenses": Math.round(row.livingExpenses),
    "Pre-Medicare Premiums": Math.round(row.preMedicareHealthcareCost),
    "Medicare Base Premiums": Math.round(row.medicareBasePremiums),
    "Medicare Surcharges": Math.round(row.combinedSurchargeAnnual),
    "Your Brokerage Balance": Math.round(row.endYourTaxableBrokerage),
    "Spouse Brokerage Balance": inputs.isSingleFiler ? 0 : Math.round(row.endWifeTaxableBrokerage),
    "Your Pre-Tax IRA Balance": Math.round(row.endYourPreTaxIRA),
    "Spouse Pre-Tax IRA Balance": inputs.isSingleFiler ? 0 : Math.round(row.endWifePreTaxIRA),
    "Your Roth IRA Balance": Math.round(row.endYourRothIRA),
    "Spouse Roth IRA Balance": inputs.isSingleFiler ? 0 : Math.round(row.endWifeRothIRA),
    "Your Cash Balance": Math.round(row.endYourCash),
    "Spouse Cash Balance": inputs.isSingleFiler ? 0 : Math.round(row.endWifeCash),
    "IRMAA Surcharge Tier": row.surchargeTier,
    "MAGI Lookback Year (t-2)": Math.round(row.magiTwoYearsAgo)
  }));

  const wsLedger = XLSX.utils.json_to_sheet(ledgerData);
  XLSX.utils.book_append_sheet(wb, wsLedger, "Simulation Ledger");

  // Tab 3: Detailed Expenses (if enabled)
  if (inputs.useDetailedExpenses && inputs.detailedExpenses) {
    const expensesSheetData: any[] = [];
    
    // Recurring
    RECURRING_EXPENSE_ITEMS.forEach(item => {
      const mdVal = inputs.detailedExpenses?.MD[item.key] ?? 0;
      const flVal = inputs.detailedExpenses?.FL[item.key] ?? 0;
      const freq = inputs.detailedExpenses?.frequencies[item.key] ?? item.defaultFrequency;
      
      if (mdVal > 0 || flVal > 0) {
        expensesSheetData.push({
          "Description": item.label,
          "Category": item.category,
          "Type": "Recurring",
          "Frequency / Year": freq,
          "Monthly Cost (MD)": mdVal,
          "Monthly Cost (FL)": flVal,
          "Annualized Cost (MD)": mdVal * freq,
          "Annualized Cost (FL)": flVal * freq
        });
      }
    });

    // One-Time
    ONE_TIME_EXPENSE_ITEMS.forEach(item => {
      const mdVal = inputs.detailedExpenses?.MD[item.key as keyof DetailedStateExpenses] ?? 0;
      const flVal = inputs.detailedExpenses?.FL[item.key as keyof DetailedStateExpenses] ?? 0;
      
      if (mdVal > 0 || flVal > 0) {
        expensesSheetData.push({
          "Description": item.label,
          "Category": "One-Time",
          "Type": "One-Time",
          "Frequency / Year": 1,
          "Monthly Cost (MD)": mdVal,
          "Monthly Cost (FL)": flVal,
          "Annualized Cost (MD)": mdVal,
          "Annualized Cost (FL)": flVal
        });
      }
    });

    if (expensesSheetData.length > 0) {
      const wsExpenses = XLSX.utils.json_to_sheet(expensesSheetData);
      XLSX.utils.book_append_sheet(wb, wsExpenses, "Itemized Expenses");
    }
  }

  // Trigger browser download
  XLSX.writeFile(wb, "Retirement_Simulation_Ledger_Export.xlsx");
};
