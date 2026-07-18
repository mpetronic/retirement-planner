import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, Wallet, Activity, ShieldAlert, Award } from 'lucide-react';
import { SimulationResultRow, AppStateInputs } from '../types';
import { IRMAA_TIERS_SINGLE, IRMAA_TIERS_MFJ } from '../engine/taxRates2026';
import { SankeyFlowDiagram } from './SankeyFlowDiagram';

interface RowInspectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  row: SimulationResultRow | null;
  prevRow: SimulationResultRow | null;
  inputs: AppStateInputs;
  simulateSurvivor: boolean;
  deathYear: number;
}

export const RowInspectionDialog: React.FC<RowInspectionDialogProps> = ({
  isOpen,
  onClose,
  row,
  prevRow,
  inputs,
  simulateSurvivor,
  deathYear
}) => {
  const [activeTab, setActiveTab] = useState<'income' | 'expenses' | 'assets' | 'irmaa' | 'flow'>('flow'); // Default to 'flow' for beautiful high-level starting visual!

  if (!isOpen || !row) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Ages and Filer Status
  const isSingle = simulateSurvivor && row.year >= deathYear;
  const isSurvivorYear = simulateSurvivor && row.year >= deathYear;

  // 1. Income & MAGI Calculations
  const salary = (row.yourSalary || 0) + (row.wifeSalary || 0);
  const rmd = row.yourRMD + row.wifeRMD;
  const rothConv = row.intentionalRothConversion;
  const pretaxDrawdown = row.otherTaxableIncome;
  const capitalGains = row.capitalGainsTriggered;
  const totalSS = row.yourSS + row.wifeSS;
  const taxableSS = row.taxableSS;
  const ssTaxedPercent = totalSS > 0 ? Math.round((taxableSS / totalSS) * 100) : 0;

  // 2. Outflows & Expenses
  const medicareSurchargeAnnual = row.combinedSurchargeAnnual;
  const medicareBaseAnnual = row.medicareBasePremiums;
  const preMedicareAnnual = row.preMedicareHealthcareCost;

  // 3. Asset starting balances
  const startYourPreTax = prevRow ? prevRow.endYourPreTaxIRA : (inputs.portfolio.yourPreTaxIRA || 0);
  const startWifePreTax = prevRow ? prevRow.endWifePreTaxIRA : (inputs.isSingleFiler ? 0 : inputs.portfolio.wifePreTaxIRA || 0);
  const startPreTax = startYourPreTax + startWifePreTax;

  const startYourRoth = prevRow ? prevRow.endYourRothIRA : (inputs.portfolio.yourRothIRA || 0);
  const startWifeRoth = prevRow ? prevRow.endWifeRothIRA : (inputs.isSingleFiler ? 0 : inputs.portfolio.wifeRothIRA || 0);
  const startRoth = startYourRoth + startWifeRoth;

  const startYourTaxable = prevRow ? prevRow.endYourTaxableBrokerage : (inputs.portfolio.yourTaxableBrokerage || 0);
  const startWifeTaxable = prevRow ? prevRow.endWifeTaxableBrokerage : (inputs.isSingleFiler ? 0 : inputs.portfolio.wifeTaxableBrokerage || 0);
  const startTaxable = startYourTaxable + startWifeTaxable;

  const startYourCash = prevRow ? prevRow.endYourCash : (inputs.portfolio.yourCash || 0);
  const startWifeCash = prevRow ? prevRow.endWifeCash : (inputs.isSingleFiler ? 0 : inputs.portfolio.wifeCash || 0);
  const startCash = startYourCash + startWifeCash;

  // Ending balances
  const endPreTax = row.endYourPreTaxIRA + row.endWifePreTaxIRA;
  const endRoth = row.endYourRothIRA + row.endWifeRothIRA;
  const endTaxable = row.endYourTaxableBrokerage + row.endWifeTaxableBrokerage;
  const endCash = row.endYourCash + row.endWifeCash;
  const endBasis = row.endYourTaxableBasis + row.endWifeTaxableBasis;

  // Flows & Growth
  const totalRMD = row.yourRMD + row.wifeRMD;
  const extraDrawdownPreTax = row.drawdownPreTax;
  const preTaxGrowth = Math.max(0, endPreTax - startPreTax + totalRMD + extraDrawdownPreTax);

  const rothConversion = row.intentionalRothConversion;
  const rothDrawdown = row.drawdownRoth;
  const rothGrowth = Math.max(0, endRoth - startRoth - rothConversion + rothDrawdown);

  const surplus = Math.max(0, row.incomeInflow - row.totalExpenses);
  const netTaxableFlow = surplus - row.drawdownTaxable;
  const taxableGrowth = endTaxable - startTaxable - netTaxableFlow;

  const cashDrawdown = row.drawdownCash;
  const cashInterest = row.taxableInterest;

  // 4. Surcharge Cliffs & Limits
  const irmaaTiers = isSingle ? IRMAA_TIERS_SINGLE : IRMAA_TIERS_MFJ;
  const currentTier = irmaaTiers.find(t => t.tierNumber === row.surchargeTier) || irmaaTiers[0];
  const lookbackCpi = prevRow && prevRow.cpiFactor ? prevRow.cpiFactor : row.cpiFactor;
  
  // Find limits for this year's surcharge tier (based on t-2 MAGI)
  const tierMinLimit = (() => {
    if (row.surchargeTier === 0) return 0;
    const prevTier = irmaaTiers[row.surchargeTier - 1];
    return prevTier.limit === Infinity ? Infinity : prevTier.limit * lookbackCpi;
  })();
  const tierMaxLimit = currentTier.limit === Infinity ? Infinity : currentTier.limit * lookbackCpi;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
      <div className="w-full max-w-7xl bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel backdrop-blur-xl transition-all duration-300 transform scale-100 flex flex-col h-[650px] max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-slate-900/50">
          <div>
            <h3 className="text-lg font-black text-slate-100 tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Detailed Year {row.year} Financial Inspector
            </h3>
            <p className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-2 gap-y-1">
              <span>{inputs.isSingleFiler ? 'Single Filer' : isSurvivorYear ? `${inputs.wife.name || 'Spouse'} (Survivor, Age ${row.wifeAge})` : `${inputs.you.name || 'You'} (Age ${row.yourAge}) & ${inputs.wife.name || 'Spouse'} (Age ${row.wifeAge})`}</span>
              <span className="text-slate-600">|</span>
              <span>CPI Factor: <span className="font-mono">{row.cpiFactor.toFixed(3)}</span></span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-slate-800/50 bg-slate-900/20 px-6 py-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('flow')}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'flow' 
                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            Sankey Cash Flow
          </button>
          <button
            onClick={() => setActiveTab('income')}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'income' 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Income & MAGI
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'expenses' 
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            Expenses & Outflows
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'assets' 
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Asset flows
          </button>
          <button
            onClick={() => setActiveTab('irmaa')}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'irmaa' 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Medicare & IRMAA
          </button>
        </div>

        {/* Modal Body content (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {activeTab === 'flow' && (
            <SankeyFlowDiagram row={row} />
          )}

          {activeTab === 'income' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* MAGI components card */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 space-y-3.5">
                  <h4 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Income Components
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Salary (Active Work):</span>
                      <span className="font-mono text-slate-200">{formatCurrency(salary)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Required Minimum Distributions (RMD):</span>
                      <span className="font-mono text-slate-200">{formatCurrency(rmd)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Extra Pre-Tax Drawdowns:</span>
                      <span className="font-mono text-slate-200">{formatCurrency(pretaxDrawdown)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Roth Conversions:</span>
                      <span className="font-mono text-slate-200">{formatCurrency(rothConv)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Realized Capital Gains:</span>
                      <span className="font-mono text-slate-200">{formatCurrency(capitalGains)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Dividends Yield:</span>
                      <span className="font-mono text-slate-200">{formatCurrency(row.taxableDividends)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Cash Interest Income:</span>
                      <span className="font-mono text-slate-200">{formatCurrency(row.taxableInterest)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Taxable Social Security:</span>
                      <span className="font-mono text-slate-200">
                        {formatCurrency(taxableSS)}
                        {totalSS > 0 && <span className="text-xs text-slate-500 font-normal ml-1">({ssTaxedPercent}% of {formatCurrency(totalSS)})</span>}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-800 pt-3 mt-1.5 font-bold text-base">
                      <span className="text-slate-200">Total MAGI (Income):</span>
                      <span className="font-mono text-emerald-400">{formatCurrency(row.magi)}</span>
                    </div>
                  </div>
                </div>

                {/* Tax summary card */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 space-y-3.5 flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <h4 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                      <Award className="w-4 h-4 text-emerald-400" />
                      Taxable Income & Deductions
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Federal AGI:</span>
                        <span className="font-mono text-slate-200">{formatCurrency(row.fedAGI)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Standard Deduction ({isSingle ? 'Single' : 'MFJ'}):</span>
                        <span className="font-mono text-slate-200">-{formatCurrency(row.standardDeduction)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-800/50 pt-2 font-semibold">
                        <span className="text-slate-300">Taxable Income:</span>
                        <span className="font-mono text-slate-200">{formatCurrency(row.taxableIncome)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-905/20 border border-slate-800 rounded-lg p-3.5 space-y-1.5 text-sm mt-4">
                    <span className="text-slate-400 font-bold uppercase tracking-wide text-xs block">Annual Tax Liabilities</span>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Federal Income Tax:</span>
                      <span className="font-mono text-slate-300">{formatCurrency(row.fedIncomeTax)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">State Income Tax:</span>
                      <span className="font-mono text-slate-300">{formatCurrency(row.stateIncomeTax)}</span>
                    </div>
                    {row.niitTax > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Net Investment Income Tax (NIIT):</span>
                        <span className="font-mono text-slate-300">{formatCurrency(row.niitTax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-slate-800/80 pt-1.5 mt-1 font-bold text-xs">
                      <span className="text-slate-200">Total Tax:</span>
                      <span className="font-mono text-slate-100">{formatCurrency(row.totalIncomeTax + row.niitTax)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 space-y-4">
              <h4 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                Annual Expenses & Cash Outflows
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                  <span className="text-slate-400">Base Living Expenses:</span>
                  <span className="font-mono text-slate-200">{formatCurrency(row.livingExpenses)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                  <span className="text-slate-400">Pre-Medicare Health Insurance:</span>
                  <span className="font-mono text-slate-200">{formatCurrency(preMedicareAnnual)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                  <span className="text-slate-400">Medicare Base Premiums (Part B/D):</span>
                  <span className="font-mono text-slate-200">{formatCurrency(medicareBaseAnnual)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                  <span className="text-slate-400">Medicare IRMAA Surcharges:</span>
                  <span className="font-mono text-slate-200">{formatCurrency(medicareSurchargeAnnual)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                  <span className="text-slate-400">Federal Income Tax:</span>
                  <span className="font-mono text-slate-200">{formatCurrency(row.fedIncomeTax)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                  <span className="text-slate-400">State Income Tax:</span>
                  <span className="font-mono text-slate-200">{formatCurrency(row.stateIncomeTax)}</span>
                </div>
                {row.niitTax > 0 && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-800/30">
                    <span className="text-slate-400">Net Investment Income Tax (NIIT):</span>
                    <span className="font-mono text-slate-200">{formatCurrency(row.niitTax)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center border-t border-slate-800 pt-4 mt-2 font-bold text-sm bg-slate-900/30 p-3 rounded-lg">
                <span className="text-slate-200">Total Annual Outflow:</span>
                <span className="font-mono text-rose-400">{formatCurrency(row.totalExpenses + row.niitTax)}</span>
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="space-y-4">
              <span className="text-xs text-slate-500 font-bold block uppercase tracking-wide">Flow of Funds & Growth Detail (Couple Combined)</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Taxable Brokerage card */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 text-sm space-y-3">
                  <h5 className="font-bold text-slate-300 border-b border-slate-800 pb-1.5 flex justify-between text-sm">
                    <span>Taxable Brokerage</span>
                    <span className="font-mono text-slate-400">Cost Basis: {formatCurrency(endBasis)}</span>
                  </h5>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Starting Balance:</span>
                      <span className="font-mono">{formatCurrency(startTaxable)}</span>
                    </div>
                    {netTaxableFlow >= 0 ? (
                      <div className="flex justify-between text-emerald-400">
                        <span>Surplus Reinvested:</span>
                        <span className="font-mono">+{formatCurrency(netTaxableFlow)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-rose-400">
                        <span>Brokerage Drawdowns:</span>
                        <span className="font-mono">-{formatCurrency(Math.abs(netTaxableFlow))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-500">
                      <span>Investment Return / Growth:</span>
                      <span className="font-mono">+{formatCurrency(taxableGrowth)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-slate-800 pt-1.5 mt-1 text-slate-200">
                      <span>Ending Balance:</span>
                      <span className="font-mono">{formatCurrency(endTaxable)}</span>
                    </div>
                  </div>
                </div>

                {/* Cash Assets card */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 text-sm space-y-3">
                  <h5 className="font-bold text-slate-300 border-b border-slate-800 pb-1.5">Cash Assets</h5>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Starting Balance:</span>
                      <span className="font-mono">{formatCurrency(startCash)}</span>
                    </div>
                    {cashDrawdown > 0 && (
                      <div className="flex justify-between text-rose-400">
                        <span>Monthly Cash Drawdowns:</span>
                        <span className="font-mono">-{formatCurrency(cashDrawdown)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-500">
                      <span>Cash Interest Earned:</span>
                      <span className="font-mono">+{formatCurrency(cashInterest)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-slate-800 pt-1.5 mt-1 text-slate-200">
                      <span>Ending Balance:</span>
                      <span className="font-mono">{formatCurrency(endCash)}</span>
                    </div>
                  </div>
                </div>

                {/* Traditional IRA card */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 text-sm space-y-3">
                  <h5 className="font-bold text-slate-300 border-b border-slate-800 pb-1.5">Traditional IRA (Pre-Tax)</h5>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Starting Balance:</span>
                      <span className="font-mono">{formatCurrency(startPreTax)}</span>
                    </div>
                    {totalRMD > 0 && (
                      <div className="flex justify-between text-rose-400">
                        <span>RMDs Distributed:</span>
                        <span className="font-mono">-{formatCurrency(totalRMD)}</span>
                      </div>
                    )}
                    {extraDrawdownPreTax > 0 && (
                      <div className="flex justify-between text-rose-400">
                        <span>Extra Pre-Tax Drawdowns:</span>
                        <span className="font-mono">-{formatCurrency(extraDrawdownPreTax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-500">
                      <span>Investment Return / Growth:</span>
                      <span className="font-mono">+{formatCurrency(preTaxGrowth)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-slate-800 pt-1.5 mt-1 text-slate-200">
                      <span>Ending Balance:</span>
                      <span className="font-mono">{formatCurrency(endPreTax)}</span>
                    </div>
                  </div>
                </div>

                {/* Roth IRA card */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 text-sm space-y-3">
                  <h5 className="font-bold text-slate-300 border-b border-slate-800 pb-1.5 flex justify-between text-sm">
                    <span>Roth IRA (Tax-Free)</span>
                  </h5>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Starting Balance:</span>
                      <span className="font-mono">{formatCurrency(startRoth)}</span>
                    </div>
                    {rothConversion > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Roth Conversions (Inflow):</span>
                        <span className="font-mono">+{formatCurrency(rothConversion)}</span>
                      </div>
                    )}
                    {rothDrawdown > 0 && (
                      <div className="flex justify-between text-rose-400">
                        <span>Roth Drawdowns (Outflow):</span>
                        <span className="font-mono">-{formatCurrency(rothDrawdown)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-emerald-500">
                      <span>Investment Return / Growth:</span>
                      <span className="font-mono">+{formatCurrency(rothGrowth)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-slate-800 pt-1.5 mt-1 text-slate-200">
                      <span>Ending Balance:</span>
                      <span className="font-mono">{formatCurrency(endRoth)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'irmaa' && (
            <div className="space-y-4">
              {/* Lookback explanation card */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 space-y-4 text-sm">
                <h4 className="text-sm font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  IRMAA Medicare Surcharge Assessment (2-Year Lookback)
                </h4>
                <p className="text-slate-400 leading-relaxed text-sm">
                  Your Medicare premium surcharges in year <strong className="text-slate-200">{row.year}</strong> are determined by the Modified Adjusted Gross Income (MAGI) earned in year <strong className="text-slate-200">{row.year - 2}</strong>.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
                    <span className="text-slate-400 block font-bold text-xs uppercase tracking-wide">Income Base</span>
                    <div className="flex justify-between items-center text-sm">
                      <span>MAGI in {row.year - 2} (Two years ago):</span>
                      <span className="font-mono font-bold text-slate-200">{formatCurrency(row.magiTwoYearsAgo)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span>Resulting Surcharge Tier:</span>
                      <span className="font-bold text-amber-400 font-mono">Tier {row.surchargeTier}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 leading-normal">
                      Bracket limits for Tier {row.surchargeTier} (indexed by CPI factors up to {row.year - 2}):<br />
                      <span className="font-mono font-medium text-slate-400 text-xs">
                        {formatCurrency(tierMinLimit)} to {tierMaxLimit === Infinity ? 'Infinity' : formatCurrency(tierMaxLimit)}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl space-y-2">
                    <span className="text-slate-400 block font-bold text-xs uppercase tracking-wide">Monthly Surcharge Breakdown</span>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-slate-300 font-semibold border-b border-slate-800/40 pb-1 text-sm">
                        <span>Category</span>
                        <span>{inputs.you.name || 'You'} Surcharge</span>
                        <span>{inputs.wife.name || 'Spouse'} Surcharge</span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-sm">
                        <span>Part B (Medical):</span>
                        <span className="font-mono">{formatCurrency(row.yourPartBSurcharge)}/mo</span>
                        <span className="font-mono">{formatCurrency(row.wifePartBSurcharge)}/mo</span>
                      </div>
                      <div className="flex justify-between text-slate-400 text-sm">
                        <span>Part D (Drug):</span>
                        <span className="font-mono">{formatCurrency(row.yourPartDSurcharge)}/mo</span>
                        <span className="font-mono">{formatCurrency(row.wifePartDSurcharge)}/mo</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-slate-800/80 pt-1.5 text-slate-200 mt-1 text-sm">
                        <span>Combined Total:</span>
                        <span className="font-mono text-rose-400">
                          {formatCurrency(row.combinedSurchargeMonthly)}/mo
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-500 leading-normal border-t border-slate-800/50 pt-3">
                  💡 Surcharges are automatically pro-rated based on the exact number of months each spouse was enrolled in Medicare and not active in the workforce. {inputs.you.name || 'You'} was on Medicare for <span className="text-slate-300 font-bold">{row.yourAge >= 65 ? (row.yourAge === 65 ? 'part of' : '12') : '0'}</span> months. {inputs.wife.name || 'Spouse'} was on Medicare for <span className="text-slate-300 font-bold">{row.wifeAge >= 65 ? (row.wifeAge === 65 ? 'part of' : '12') : '0'}</span> months.
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex justify-end bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all cursor-pointer"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
