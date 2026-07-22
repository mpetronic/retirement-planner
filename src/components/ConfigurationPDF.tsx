import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { AppStateInputs, RECURRING_EXPENSE_ITEMS, ONE_TIME_EXPENSE_ITEMS, DetailedStateExpenses } from '../types';

// Create stylesheet for PDF formatting
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.4,
    padding: 35,
    color: '#1e293b', // slate-800
    backgroundColor: '#ffffff',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1', // slate-300
    paddingBottom: 10,
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a', // slate-900
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 7.5,
    color: '#64748b', // slate-500
    marginTop: 6,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0284c7', // sky-600
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0', // slate-200
    paddingBottom: 3,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  col2: {
    width: '50%',
    paddingHorizontal: 4,
  },
  col3: {
    width: '33.33%',
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#f8fafc', // slate-50
    borderWidth: 1,
    borderColor: '#e2e8f0', // slate-200
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#334155', // slate-700
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 3,
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  rowLabel: {
    color: '#475569', // slate-600
    maxWidth: '65%',
  },
  rowValue: {
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textAlign: 'right',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tableCellHeader: {
    color: '#334155',
    fontSize: 8,
  },
  tableCell: {
    color: '#0f172a',
    fontSize: 8,
  },
  colAsset: { width: '40%' },
  colOwner: { width: '30%', textAlign: 'right' },
  colSpouse: { width: '30%', textAlign: 'right' },
  
  colExpName: { width: '40%' },
  colExpCat: { width: '20%' },
  colExpFreq: { width: '15%', textAlign: 'center' },
  colExpMD: { width: '12.5%', textAlign: 'right' },
  colExpFL: { width: '12.5%', textAlign: 'right' },

  footer: {
    position: 'absolute',
    bottom: 20,
    left: 35,
    right: 35,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: '#94a3b8',
  }
});

interface PDFProps {
  inputs: AppStateInputs;
}

export const ConfigurationPDF: React.FC<PDFProps> = ({ inputs }) => {
  const mdRecurringAnnual = RECURRING_EXPENSE_ITEMS.reduce((sum, item) => {
    const cost = inputs.detailedExpenses?.MD[item.key] ?? 0;
    const freq = inputs.detailedExpenses?.frequencies[item.key] ?? item.defaultFrequency;
    return sum + cost * freq;
  }, 0);
  const flRecurringAnnual = RECURRING_EXPENSE_ITEMS.reduce((sum, item) => {
    const cost = inputs.detailedExpenses?.FL[item.key] ?? 0;
    const freq = inputs.detailedExpenses?.frequencies[item.key] ?? item.defaultFrequency;
    return sum + cost * freq;
  }, 0);

  const mdRecurringMonthly = mdRecurringAnnual / 12;
  const flRecurringMonthly = flRecurringAnnual / 12;

  const mdOneTime = ONE_TIME_EXPENSE_ITEMS.reduce((sum, item) => {
    return sum + (inputs.detailedExpenses?.MD[item.key as keyof DetailedStateExpenses] ?? 0);
  }, 0);
  const flOneTime = ONE_TIME_EXPENSE_ITEMS.reduce((sum, item) => {
    return sum + (inputs.detailedExpenses?.FL[item.key as keyof DetailedStateExpenses] ?? 0);
  }, 0);

  const formatCurrency = (val: number | null | undefined) => {
    if (val === undefined || val === null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatPercent = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '0.00%';
    return (val * 100).toFixed(2) + '%';
  };

  const formatMonth = (m: number | undefined | null) => {
    if (m === undefined || m === null) return 'Birth Month';
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${m} (${MONTH_NAMES[m - 1] ?? ''})`;
  };

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const hasDetailedHealthcare = !!(inputs.you.healthcare || (!inputs.isSingleFiler && inputs.wife.healthcare));

  return (
    <Document>
      {/* Page 1: Profiles & Portfolio Assets */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Retirement Planner - Plan Configuration Report</Text>
          <Text style={styles.subtitle}>Generated on {dateStr} | Comprehensive settings controlling simulation model</Text>
        </View>

        {/* Section 1: Spousal Profiles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Personal Profiles & SS Claiming Settings</Text>
          <View style={styles.grid}>
            {/* Primary User Card */}
            <View style={styles.col2}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{inputs.you.name || 'Primary User'} (You)</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Birth Date:</Text>
                  <Text style={styles.rowValue}>{inputs.you.birthDate || 'N/A'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Planned Retirement Age / Month:</Text>
                  <Text style={styles.rowValue}>{inputs.you.plannedRetirementAge ?? 67} / {formatMonth(inputs.you.plannedRetirementMonth)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Projected Longevity Age:</Text>
                  <Text style={styles.rowValue}>{inputs.you.longevityAge ?? 85} yrs</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Active Work Annual Salary:</Text>
                  <Text style={styles.rowValue}>{formatCurrency(inputs.you.activeSalary)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Target SS Claiming Age:</Text>
                  <Text style={styles.rowValue}>{inputs.you.targetSSClaimingAge ?? 67}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>SS PIA Benefit (Monthly at FRA):</Text>
                  <Text style={styles.rowValue}>{formatCurrency(inputs.you.estimatedPIA)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Pre-Medicare Premium/mo:</Text>
                  <Text style={styles.rowValue}>{inputs.you.healthcare ? 'N/A (Detailed Active)' : formatCurrency(inputs.you.preMedicareMonthlyPremium)}</Text>
                </View>
              </View>
            </View>

            {/* Spouse Card */}
            <View style={styles.col2}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{inputs.isSingleFiler ? 'Filing Status Mode' : (inputs.wife.name || 'Spouse')}</Text>
                {inputs.isSingleFiler ? (
                  <View style={{ padding: 10 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: '#b91c1c', fontSize: 10 }}>Single Filer Mode Active</Text>
                    <Text style={{ marginTop: 8, color: '#64748b', fontSize: 8.5, lineHeight: 1.4 }}>
                      No spouse details are modeled. Tax brackets, standard deductions, and lookbacks are evaluated under Single status.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Birth Date:</Text>
                      <Text style={styles.rowValue}>{inputs.wife.birthDate || 'N/A'}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Planned Retirement Age / Month:</Text>
                      <Text style={styles.rowValue}>{inputs.wife.plannedRetirementAge ?? 65} / {formatMonth(inputs.wife.plannedRetirementMonth)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Projected Longevity Age:</Text>
                      <Text style={styles.rowValue}>{inputs.wife.longevityAge ?? 95} yrs</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Active Work Annual Salary:</Text>
                      <Text style={styles.rowValue}>{formatCurrency(inputs.wife.activeSalary)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Target SS Claiming Age:</Text>
                      <Text style={styles.rowValue}>{inputs.wife.targetSSClaimingAge ?? 67}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>SS PIA Benefit (Monthly at FRA):</Text>
                      <Text style={styles.rowValue}>{formatCurrency(inputs.wife.estimatedPIA)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Pre-Medicare Premium/mo:</Text>
                      <Text style={styles.rowValue}>{inputs.wife.healthcare ? 'N/A (Detailed Active)' : formatCurrency(inputs.wife.preMedicareMonthlyPremium)}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Section 2: Asset Balances */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Starting Portfolio Asset Balances & Cost Basis (2026)</Text>
          <View style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
            <View style={styles.tableHeader}>
              <Text style={[styles.colAsset, styles.tableCellHeader]}>Account Category</Text>
              <Text style={[styles.colOwner, styles.tableCellHeader]}>{inputs.you.name || 'You'}</Text>
              <Text style={[styles.colSpouse, styles.tableCellHeader]}>{inputs.isSingleFiler ? 'N/A' : (inputs.wife.name || 'Spouse')}</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.colAsset, styles.tableCell]}>Taxable Brokerage Balance</Text>
              <Text style={[styles.colOwner, styles.tableCell]}>{formatCurrency(inputs.portfolio.yourTaxableBrokerage)}</Text>
              <Text style={[styles.colSpouse, styles.tableCell]}>{inputs.isSingleFiler ? '-' : formatCurrency(inputs.portfolio.wifeTaxableBrokerage)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.colAsset, styles.tableCell, { color: '#64748b', paddingLeft: 10 }]}>• Taxable Account Cost Basis</Text>
              <Text style={[styles.colOwner, styles.tableCell, { color: '#64748b' }]}>{formatCurrency(inputs.portfolio.yourTaxableBasis)}</Text>
              <Text style={[styles.colSpouse, styles.tableCell, { color: '#64748b' }]}>{inputs.isSingleFiler ? '-' : formatCurrency(inputs.portfolio.wifeTaxableBasis)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.colAsset, styles.tableCell]}>Traditional IRA (Pre-Tax)</Text>
              <Text style={[styles.colOwner, styles.tableCell]}>{formatCurrency(inputs.portfolio.yourPreTaxIRA)}</Text>
              <Text style={[styles.colSpouse, styles.tableCell]}>{inputs.isSingleFiler ? '-' : formatCurrency(inputs.portfolio.wifePreTaxIRA)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.colAsset, styles.tableCell]}>Roth IRA (Tax-Free)</Text>
              <Text style={[styles.colOwner, styles.tableCell]}>{formatCurrency(inputs.portfolio.yourRothIRA)}</Text>
              <Text style={[styles.colSpouse, styles.tableCell]}>{inputs.isSingleFiler ? '-' : formatCurrency(inputs.portfolio.wifeRothIRA)}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.colAsset, styles.tableCell]}>Cash Savings / Liquid Accounts</Text>
              <Text style={[styles.colOwner, styles.tableCell]}>{formatCurrency(inputs.portfolio.yourCash)}</Text>
              <Text style={[styles.colSpouse, styles.tableCell]}>{inputs.isSingleFiler ? '-' : formatCurrency(inputs.portfolio.wifeCash)}</Text>
            </View>

            <View style={[styles.tableRow, { backgroundColor: '#f8fafc', borderBottomWidth: 0 }]}>
              <Text style={[styles.colAsset, styles.tableCell, { fontFamily: 'Helvetica-Bold' }]}>Account Subtotals</Text>
              <Text style={[styles.colOwner, styles.tableCell, { fontFamily: 'Helvetica-Bold' }]}>
                {formatCurrency(
                  (inputs.portfolio.yourTaxableBrokerage ?? 0) +
                  (inputs.portfolio.yourPreTaxIRA ?? 0) +
                  (inputs.portfolio.yourRothIRA ?? 0) +
                  (inputs.portfolio.yourCash ?? 0)
                )}
              </Text>
              <Text style={[styles.colSpouse, styles.tableCell, { fontFamily: 'Helvetica-Bold' }]}>
                {inputs.isSingleFiler ? '-' : formatCurrency(
                  (inputs.portfolio.wifeTaxableBrokerage ?? 0) +
                  (inputs.portfolio.wifePreTaxIRA ?? 0) +
                  (inputs.portfolio.wifeRothIRA ?? 0) +
                  (inputs.portfolio.wifeCash ?? 0)
                )}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 8, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between', fontSize: 9.5, fontFamily: 'Helvetica-Bold' }}>
            <Text style={{ color: '#475569' }}>Total Portfolio Value:</Text>
            <Text style={{ color: '#0284c7' }}>
              {formatCurrency(
                (inputs.portfolio.yourTaxableBrokerage ?? 0) +
                (inputs.portfolio.yourPreTaxIRA ?? 0) +
                (inputs.portfolio.yourRothIRA ?? 0) +
                (inputs.portfolio.yourCash ?? 0) +
                (inputs.isSingleFiler ? 0 : (
                  (inputs.portfolio.wifeTaxableBrokerage ?? 0) +
                  (inputs.portfolio.wifePreTaxIRA ?? 0) +
                  (inputs.portfolio.wifeRothIRA ?? 0) +
                  (inputs.portfolio.wifeCash ?? 0)
                ))
              )}
            </Text>
          </View>
        </View>

        {/* Section 3: Assumptions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Growth, Inflation & Market Assumptions</Text>
          <View style={styles.grid}>
            <View style={styles.col2}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Deterministic Returns</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Equities (Stock) Return:</Text>
                  <Text style={styles.rowValue}>{formatPercent(inputs.growthAssumptions.equityReturnRate)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Fixed Income (Bonds/Cash) Yield:</Text>
                  <Text style={styles.rowValue}>{formatPercent(inputs.growthAssumptions.fixedIncomeReturnRate)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Compound Inflation Rate (CPI):</Text>
                  <Text style={styles.rowValue}>{formatPercent(inputs.growthAssumptions.cpiInflationRate)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Medical / Healthcare Inflation Rate:</Text>
                  <Text style={styles.rowValue}>{formatPercent(inputs.growthAssumptions.healthcareInflationRate)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.col2}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Dividend Settings & Volatility</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Taxable Dividend Yield:</Text>
                  <Text style={styles.rowValue}>{formatPercent(inputs.portfolio.taxableDividendYield)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Non-Qualified Dividend Portion:</Text>
                  <Text style={styles.rowValue}>{formatPercent(inputs.portfolio.taxableNonQualifiedPortion)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Equity Volatility (Stochastic):</Text>
                  <Text style={styles.rowValue}>{formatPercent(inputs.monteCarloSettings.equityVolatility)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Fixed Income Volatility (Stochastic):</Text>
                  <Text style={styles.rowValue}>{formatPercent(inputs.monteCarloSettings.fixedIncomeVolatility)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.footer} render={({ pageNumber }) => `Retirement Plan Configuration Summary  |  Page ${pageNumber}`} />
      </Page>

      {/* Page 2: Tax Relocation, Strategy, and Healthcare Details */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Retirement Planner - Plan Configuration Report</Text>
          <Text style={styles.subtitle}>Generated on {dateStr} | Comprehensive settings controlling simulation model</Text>
        </View>

        {/* Section 4: Relocation & Monte Carlo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Tax Jurisdiction, Relocation & Monte Carlo Parameters</Text>
          <View style={styles.grid}>
            <View style={styles.col2}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Jurisdiction Relocation</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Current Home State:</Text>
                  <Text style={styles.rowValue}>{inputs.jurisdiction.currentState}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Relocate In Retirement?:</Text>
                  <Text style={styles.rowValue}>{inputs.jurisdiction.relocationYear !== null ? 'Yes' : 'No'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Target Destination State:</Text>
                  <Text style={styles.rowValue}>{inputs.jurisdiction.targetState || 'N/A'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Relocation Target Year:</Text>
                  <Text style={styles.rowValue}>{inputs.jurisdiction.relocationYear !== null ? inputs.jurisdiction.relocationYear : 'N/A'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.col2}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Monte Carlo & Trial Settings</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Simulation Mode:</Text>
                  <Text style={styles.rowValue}>{inputs.monteCarloSettings.mode === 'historical' ? 'Historical Returns Block' : 'Synthetic Geometric Brownian'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Number of Trials:</Text>
                  <Text style={styles.rowValue}>{inputs.monteCarloSettings.trials} runs</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Asset Class Correlation:</Text>
                  <Text style={styles.rowValue}>{inputs.monteCarloSettings.correlation.toFixed(2)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Randomizer Seed:</Text>
                  <Text style={styles.rowValue}>{inputs.monteCarloSettings.seed !== null ? inputs.monteCarloSettings.seed : 'Standard Random'}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Section 5: Strategies & Base Living Expenses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Withdrawal & Roth Conversion Strategy</Text>
          <View style={styles.grid}>
            <View style={styles.col2}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Roth Conversion Settings</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Strategy Selected:</Text>
                  <Text style={styles.rowValue}>
                    {inputs.rothConversionStrategy === 'flat' ? 'Flat Annual Conversions' : 'Fill-To-Target Bracket'}
                  </Text>
                </View>
                {inputs.rothConversionStrategy === 'flat' ? (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Annual Conversion Value:</Text>
                    <Text style={styles.rowValue}>{formatCurrency(inputs.annualRothConversion)}/yr</Text>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Target Income Limit (MAGI):</Text>
                    <Text style={styles.rowValue}>{formatCurrency(inputs.rothConversionTargetValue)}</Text>
                  </View>
                )}
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Start Year / End Year:</Text>
                  <Text style={styles.rowValue}>{inputs.rothConversionStartYear ?? 2026} / {inputs.rothConversionEndYear ?? 2035}</Text>
                </View>
              </View>
            </View>

            <View style={styles.col2}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Living Expenses Summary</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Living Expenses Type:</Text>
                  <Text style={styles.rowValue}>{inputs.useDetailedExpenses ? 'Itemized Checklist' : 'Flat Annual Budget'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>
                    Annual Expense Target{inputs.useDetailedExpenses ? ' (Inactive)' : ''}:
                  </Text>
                  <Text style={[
                    styles.rowValue,
                    inputs.useDetailedExpenses ? { color: '#94a3b8', fontFamily: 'Helvetica' } : {}
                  ]}>
                    {inputs.useDetailedExpenses 
                      ? `${formatCurrency(inputs.annualLivingExpenses)}/yr (Ignored)` 
                      : `${formatCurrency(inputs.annualLivingExpenses)}/yr`
                    }
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Section 6: Healthcare details (conditional rendering for cleaner formatting) */}
        {hasDetailedHealthcare && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Detailed Healthcare Configurations (State-Level)</Text>
            <View style={styles.grid}>
              {inputs.you.healthcare && (
                <View style={styles.col2}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{inputs.you.name || 'Primary'}'s Detailed Healthcare</Text>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Medicare Part B Base Premium:</Text>
                      <Text style={styles.rowValue}>{inputs.you.healthcare.medicarePartBPremium !== null ? `${formatCurrency(inputs.you.healthcare.medicarePartBPremium)}/mo` : 'Default'}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>MD Pre-65 Med Premium / OOP:</Text>
                      <Text style={styles.rowValue}>{formatCurrency(inputs.you.healthcare.MD.pre65MedicalPremium)} / {formatCurrency(inputs.you.healthcare.MD.pre65MedicalOOP)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>MD Post-65 Supp Prem / OOP:</Text>
                      <Text style={styles.rowValue}>{formatCurrency(inputs.you.healthcare.MD.supplementPremium)} / {formatCurrency(inputs.you.healthcare.MD.supplementOOP)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>FL Pre-65 Med Premium / OOP:</Text>
                      <Text style={styles.rowValue}>{formatCurrency(inputs.you.healthcare.FL.pre65MedicalPremium)} / {formatCurrency(inputs.you.healthcare.FL.pre65MedicalOOP)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>FL Post-65 Supp Prem / OOP:</Text>
                      <Text style={styles.rowValue}>{formatCurrency(inputs.you.healthcare.FL.supplementPremium)} / {formatCurrency(inputs.you.healthcare.FL.supplementOOP)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {!inputs.isSingleFiler && inputs.wife.healthcare && (
                <View style={styles.col2}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{inputs.wife.name || 'Spouse'}'s Detailed Healthcare</Text>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Medicare Part B Base Premium:</Text>
                      <Text style={styles.rowValue}>{inputs.wife.healthcare.medicarePartBPremium !== null ? `${formatCurrency(inputs.wife.healthcare.medicarePartBPremium)}/mo` : 'Default'}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>MD Pre-65 Med Premium / OOP:</Text>
                      <Text style={styles.rowValue}>{formatCurrency(inputs.wife.healthcare.MD.pre65MedicalPremium)} / {formatCurrency(inputs.wife.healthcare.MD.pre65MedicalOOP)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>MD Post-65 Supp Prem / OOP:</Text>
                      <Text style={styles.rowValue}>{formatCurrency(inputs.wife.healthcare.MD.supplementPremium)} / {formatCurrency(inputs.wife.healthcare.MD.supplementOOP)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>FL Pre-65 Med Premium / OOP:</Text>
                      <Text style={styles.rowValue}>{formatCurrency(inputs.wife.healthcare.FL.pre65MedicalPremium)} / {formatCurrency(inputs.wife.healthcare.FL.pre65MedicalOOP)}</Text>
                    </View>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>FL Post-65 Supp Prem / OOP:</Text>
                      <Text style={styles.rowValue}>{formatCurrency(inputs.wife.healthcare.FL.supplementPremium)} / {formatCurrency(inputs.wife.healthcare.FL.supplementOOP)}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        <Text style={styles.footer} render={({ pageNumber }) => `Retirement Plan Configuration Summary  |  Page ${pageNumber}`} />
      </Page>

      {/* Page 3: Itemized detailed expenses (if active) */}
      {inputs.useDetailedExpenses && inputs.detailedExpenses && (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Retirement Planner - Plan Configuration Report</Text>
            <Text style={styles.subtitle}>Generated on {dateStr} | Itemized Detailed Monthly/Annual Expenses</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Detailed Expenses & Frequencies List</Text>
            
            <View style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 6, overflow: 'hidden' }}>
              <View style={styles.tableHeader}>
                <Text style={[styles.colExpName, styles.tableCellHeader]}>Expense Item Description</Text>
                <Text style={[styles.colExpCat, styles.tableCellHeader]}>Category</Text>
                <Text style={[styles.colExpFreq, styles.tableCellHeader]}>Freq/yr</Text>
                <Text style={[styles.colExpMD, styles.tableCellHeader]}>Cost (MD)</Text>
                <Text style={[styles.colExpFL, styles.tableCellHeader]}>Cost (FL)</Text>
              </View>

              {(() => {
                const categories = ['Housing', 'Transportation', 'Charities', 'Health', 'Living', 'Insurance', 'Leisure'] as const;
                
                return categories.map((catName) => {
                  const catItems = RECURRING_EXPENSE_ITEMS.filter((i) => i.category === catName);
                  const activeCatItems = catItems.filter((item) => {
                    const mdVal = inputs.detailedExpenses?.MD[item.key] ?? 0;
                    const flVal = inputs.detailedExpenses?.FL[item.key] ?? 0;
                    return mdVal !== 0 || flVal !== 0;
                  });

                  if (activeCatItems.length === 0) return null;

                  const subtotalMD = activeCatItems.reduce((sum, item) => {
                    const cost = inputs.detailedExpenses?.MD[item.key] ?? 0;
                    const freq = inputs.detailedExpenses?.frequencies[item.key] ?? item.defaultFrequency;
                    return sum + cost * freq;
                  }, 0);

                  const subtotalFL = activeCatItems.reduce((sum, item) => {
                    const cost = inputs.detailedExpenses?.FL[item.key] ?? 0;
                    const freq = inputs.detailedExpenses?.frequencies[item.key] ?? item.defaultFrequency;
                    return sum + cost * freq;
                  }, 0);

                  return (
                    <React.Fragment key={catName}>
                      {/* Category Header Row */}
                      <View style={[styles.tableRow, { backgroundColor: '#f8fafc', borderBottomColor: '#cbd5e1' }]}>
                        <Text style={[styles.colExpName, styles.tableCell, { fontFamily: 'Helvetica-Bold', color: '#0369a1' }]}>
                          {catName === 'Health' ? 'Health Expenses (2x at age 65+)' : `${catName} Expenses`}
                        </Text>
                        <Text style={styles.colExpCat} />
                        <Text style={styles.colExpFreq} />
                        <Text style={styles.colExpMD} />
                        <Text style={styles.colExpFL} />
                      </View>

                      {/* Expense Item Rows */}
                      {activeCatItems.map((item) => {
                        const mdVal = inputs.detailedExpenses?.MD[item.key] ?? 0;
                        const flVal = inputs.detailedExpenses?.FL[item.key] ?? 0;
                        const freq = inputs.detailedExpenses?.frequencies[item.key] ?? item.defaultFrequency;
                        return (
                          <View style={styles.tableRow} key={item.key}>
                            <Text style={[styles.colExpName, styles.tableCell]}>{item.label}</Text>
                            <Text style={[styles.colExpCat, styles.tableCell]}>{item.category}</Text>
                            <Text style={[styles.colExpFreq, styles.tableCell]}>{freq}x</Text>
                            <Text style={[styles.colExpMD, styles.tableCell]}>{formatCurrency(mdVal)}</Text>
                            <Text style={[styles.colExpFL, styles.tableCell]}>{formatCurrency(flVal)}</Text>
                          </View>
                        );
                      })}

                      {/* Category Subtotal Row */}
                      <View style={[styles.tableRow, { backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' }]}>
                        <Text style={[styles.colExpName, styles.tableCell, { fontFamily: 'Helvetica-Bold', color: '#0284c7' }]}>
                          Subtotal ({catName} - Annualized)
                        </Text>
                        <Text style={[styles.colExpCat, styles.tableCell, { color: '#64748b' }]}>-</Text>
                        <Text style={[styles.colExpFreq, styles.tableCell, { color: '#64748b', textAlign: 'center' }]}>-</Text>
                        <Text style={[styles.colExpMD, styles.tableCell, { fontFamily: 'Helvetica-Bold', color: '#0284c7' }]}>
                          {formatCurrency(subtotalMD)}
                        </Text>
                        <Text style={[styles.colExpFL, styles.tableCell, { fontFamily: 'Helvetica-Bold', color: '#0284c7' }]}>
                          {formatCurrency(subtotalFL)}
                        </Text>
                      </View>
                    </React.Fragment>
                  );
                });
              })()}

              {(() => {
                const activeOneTimeItems = ONE_TIME_EXPENSE_ITEMS.filter((item) => {
                  const mdVal = inputs.detailedExpenses?.MD[item.key as keyof DetailedStateExpenses] ?? 0;
                  const flVal = inputs.detailedExpenses?.FL[item.key as keyof DetailedStateExpenses] ?? 0;
                  return mdVal !== 0 || flVal !== 0;
                });

                if (activeOneTimeItems.length === 0) return null;

                const oneTimeMD = activeOneTimeItems.reduce((sum, item) => sum + (inputs.detailedExpenses?.MD[item.key as keyof DetailedStateExpenses] ?? 0), 0);
                const oneTimeFL = activeOneTimeItems.reduce((sum, item) => sum + (inputs.detailedExpenses?.FL[item.key as keyof DetailedStateExpenses] ?? 0), 0);

                return (
                  <React.Fragment>
                    {/* One-Time Header Row */}
                    <View style={[styles.tableRow, { backgroundColor: '#fffbeb', borderBottomColor: '#fde68a' }]}>
                      <Text style={[styles.colExpName, styles.tableCell, { fontFamily: 'Helvetica-Bold', color: '#b45309' }]}>
                        One-Time Setup Costs
                      </Text>
                      <Text style={styles.colExpCat} />
                      <Text style={styles.colExpFreq} />
                      <Text style={styles.colExpMD} />
                      <Text style={styles.colExpFL} />
                    </View>

                    {/* One-Time Item Rows */}
                    {activeOneTimeItems.map((item) => {
                      const mdVal = inputs.detailedExpenses?.MD[item.key as keyof DetailedStateExpenses] ?? 0;
                      const flVal = inputs.detailedExpenses?.FL[item.key as keyof DetailedStateExpenses] ?? 0;
                      return (
                        <View style={styles.tableRow} key={item.key}>
                          <Text style={[styles.colExpName, styles.tableCell, { fontFamily: 'Helvetica-Bold' }]}>{item.label}</Text>
                          <Text style={[styles.colExpCat, styles.tableCell]}>One-Time</Text>
                          <Text style={[styles.colExpFreq, styles.tableCell]}>1x</Text>
                          <Text style={[styles.colExpMD, styles.tableCell]}>{formatCurrency(mdVal)}</Text>
                          <Text style={[styles.colExpFL, styles.tableCell]}>{formatCurrency(flVal)}</Text>
                        </View>
                      );
                    })}

                    {/* One-Time Subtotal Row */}
                    <View style={[styles.tableRow, { backgroundColor: '#fffbeb', borderBottomWidth: 1, borderBottomColor: '#fde68a' }]}>
                      <Text style={[styles.colExpName, styles.tableCell, { fontFamily: 'Helvetica-Bold', color: '#b45309' }]}>
                        Subtotal (One-Time)
                      </Text>
                      <Text style={[styles.colExpCat, styles.tableCell, { color: '#64748b' }]}>-</Text>
                      <Text style={[styles.colExpFreq, styles.tableCell, { color: '#64748b', textAlign: 'center' }]}>-</Text>
                      <Text style={[styles.colExpMD, styles.tableCell, { fontFamily: 'Helvetica-Bold', color: '#b45309' }]}>
                        {formatCurrency(oneTimeMD)}
                      </Text>
                      <Text style={[styles.colExpFL, styles.tableCell, { fontFamily: 'Helvetica-Bold', color: '#b45309' }]}>
                        {formatCurrency(oneTimeFL)}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              })()}
            </View>
          </View>

          {/* Expense Grand Totals Card Section */}
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.sectionTitle, { fontSize: 10, borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingBottom: 2, marginBottom: 5 }]}>
              Expense Grand Totals
            </Text>
            <View style={styles.grid}>
              {/* MD Totals Card */}
              <View style={styles.col2}>
                <View style={[styles.card, { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }]}>
                  <Text style={[styles.cardTitle, { color: '#0f172a', borderBottomColor: '#cbd5e1' }]}>Maryland (MD) Totals</Text>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Recurring Monthly Cost:</Text>
                    <Text style={styles.rowValue}>{formatCurrency(mdRecurringMonthly)}/mo</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Recurring Annualized Cost:</Text>
                    <Text style={styles.rowValue}>{formatCurrency(mdRecurringAnnual)}/yr</Text>
                  </View>
                  <View style={[styles.row, { borderBottomWidth: 0 }]}>
                    <Text style={styles.rowLabel}>One-Time Setup Costs:</Text>
                    <Text style={[styles.rowValue, { color: '#b45309' }]}>{formatCurrency(mdOneTime)}</Text>
                  </View>
                </View>
              </View>

              {/* FL Totals Card */}
              <View style={styles.col2}>
                <View style={[styles.card, { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }]}>
                  <Text style={[styles.cardTitle, { color: '#0f172a', borderBottomColor: '#cbd5e1' }]}>Florida (FL) Totals</Text>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Recurring Monthly Cost:</Text>
                    <Text style={styles.rowValue}>{formatCurrency(flRecurringMonthly)}/mo</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Recurring Annualized Cost:</Text>
                    <Text style={styles.rowValue}>{formatCurrency(flRecurringAnnual)}/yr</Text>
                  </View>
                  <View style={[styles.row, { borderBottomWidth: 0 }]}>
                    <Text style={styles.rowLabel}>One-Time Setup Costs:</Text>
                    <Text style={[styles.rowValue, { color: '#b45309' }]}>{formatCurrency(flOneTime)}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.footer} render={({ pageNumber }) => `Retirement Plan Configuration Summary  |  Page ${pageNumber}`} />
        </Page>
      )}
    </Document>
  );
};
