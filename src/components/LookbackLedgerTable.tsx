import React, { useMemo } from 'react';
import { SimulationResultRow, AppStateInputs } from '../types';
import { ShieldAlert, Info, AlertTriangle } from 'lucide-react';
import { IRMAA_TIERS_MFJ, IRMAA_TIERS_SINGLE } from '../engine/taxRates2026';
import { calculateFedTax, calculateMDStateTax } from '../engine/simulationEngine';

interface LookbackLedgerTableProps {
  ledger: SimulationResultRow[];
  inputs: AppStateInputs;
  simulateSurvivor: boolean;
}

export const LookbackLedgerTable: React.FC<LookbackLedgerTableProps> = ({
  ledger,
  inputs,
  simulateSurvivor,
}) => {
  const deathYear = useMemo(() => {
    if (!inputs.you.birthDate) return 2045;
    const year = parseInt(inputs.you.birthDate.split('-')[0], 10);
    return isNaN(year) ? 2045 : (year + 85);
  }, [inputs.you.birthDate]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Find rows with a "Near-Cliff" violation (MAGI within $5,000 above any IRMAA cliff limit)
  const warnings = useMemo(() => {
    const activeWarnings: {
      year: number;
      magi: number;
      cliff: number;
      excess: number;
      penalty: number;
      affectedYear: number;
    }[] = [];

    ledger.forEach((r, idx) => {
      const year = r.year;
      const magi = r.magi;
      
      const cpiFactor = Math.pow(1 + inputs.growthAssumptions.cpiInflationRate, year - 2026);
      const isSingle = simulateSurvivor && year >= deathYear;
      const tiers = isSingle ? IRMAA_TIERS_SINGLE : IRMAA_TIERS_MFJ;

      // Check each tier's lower limit (which is the previous tier's upper limit)
      // If we are in Tier T (T >= 1), the cliff we crossed is Cliff[T-1]
      if (r.surchargeTier > 0) {
        const tierIdx = r.surchargeTier;
        const crossedTier = tiers[tierIdx - 1];
        
        // Inflate the cliff limit if it is < Tier 4
        let cliffLimit = crossedTier.limit;
        if (crossedTier.tierNumber < 4) {
          cliffLimit = crossedTier.limit * cpiFactor;
        }

        const excess = magi - cliffLimit;
        
        // If we are within $5,000 over the cliff limit
        if (excess > 0 && excess <= 5000) {
          // Penalty is the premium surcharge difference
          const currentTier = tiers[tierIdx];
          const prevTier = tiers[tierIdx - 1];
          
          const numOnMedicare = (r.yourAge >= 65 ? 1 : 0) + (r.wifeAge >= 65 ? 1 : 0);
          const monthlyDiff = (currentTier.partBSurcharge + currentTier.partDSurcharge) - 
                              (prevTier.partBSurcharge + prevTier.partDSurcharge);
          
          // Surcharges are inflated by healthcare factor (use year offset, not array index, to match engine convention)
          const healthcareFactor = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, year - 2026);
          const penalty = monthlyDiff * 12 * numOnMedicare * healthcareFactor;

          if (penalty > 0) {
            activeWarnings.push({
              year,
              magi,
              cliff: cliffLimit,
              excess,
              penalty,
              affectedYear: year + 2,
            });
          }
        }
      }
    });

    return activeWarnings;
  }, [ledger, simulateSurvivor, inputs, deathYear]);

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500 animate-pulse" />
            Lookback Linkage Ledger Table
          </h3>
          <p className="text-xs text-slate-400">
            Under Medicare guidelines, your Modified Adjusted Gross Income (MAGI) in a tax year dictates your premium surcharges exactly 2 years later.
          </p>
        </div>


      </div>

      {/* Safety Alerts Box */}
      {warnings.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5" />
            <h4>IRMAA Surcharge Safety Warnings</h4>
          </div>
          <div className="space-y-2 text-xs text-amber-200">
            {warnings.map((w, idx) => (
              <p key={idx} className="leading-relaxed bg-amber-900/10 p-2 rounded border border-amber-500/10">
                🚨 <strong>Year {w.year} Alert:</strong> Your computed MAGI of <strong className="font-mono">{formatCurrency(w.magi)}</strong> is only <strong className="font-mono">{formatCurrency(w.excess)}</strong> above the <strong className="font-mono">{formatCurrency(w.cliff)}</strong> IRMAA Cliff. This triggers an extra <strong className="font-mono text-red-400">{formatCurrency(w.penalty)}</strong> in premium surcharges for the couple in calendar year <strong>{w.affectedYear}</strong>! Consider reducing conversions or liquidations by <strong className="font-mono">{formatCurrency(w.excess + 1)}</strong> to stay under the cliff.
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="overflow-auto max-h-[600px] rounded-xl border border-slate-800 bg-slate-950/20 custom-scrollbar">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-900">
             <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
              <th className="p-4">Year (t)</th>
              <th className="p-4">MAGI (Income)</th>
              <th className="p-4">Roth Conv. Amt</th>
              <th className="p-4">Roth Conv. Tax</th>
              <th className="p-4">Total Expenses</th>
              <th className="p-4">Brokerage (Taxable)</th>
              <th className="p-4">Tax-Deferred (Pre-Tax)</th>
              <th className="p-4">Roth (Tax-Free)</th>
              <th className="p-4">Total Net Worth</th>
              <th className="p-4">IRMAA Tier (T+2)</th>
              <th className="p-4 text-right">Medicare Surcharge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {ledger.map((r, idx) => {
              const affectedYear = r.year + 2;
              
              // Determine if this row is highlighted for crossing a cliff by < $5,000
              const isWarningRow = warnings.some((w) => w.year === r.year);

              const salary = (r.yourSalary || 0) + (r.wifeSalary || 0);
              const rmd = r.yourRMD + r.wifeRMD;
              const rothConv = r.intentionalRothConversion;
              const capitalGains = r.capitalGainsTriggered;
              const pretaxDrawdown = r.otherTaxableIncome;

              const otherAGI = salary + rmd + rothConv + capitalGains + pretaxDrawdown;
              const taxableSS = Math.max(0, r.magi - otherAGI);
              const totalSS = r.yourSS + r.wifeSS;
              const ssTaxedPercent = totalSS > 0 && taxableSS > 0
                ? Math.round((taxableSS / totalSS) * 100)
                : 0;

              // Marginal-rate conversion tax: difference in federal tax with vs. without the conversion.
              // This is more accurate than the blended effective rate because conversions are stacked
              // on top of all other income and are taxed at the marginal bracket rate.
              const conversionTax = (() => {
                if (r.intentionalRothConversion <= 0) return 0;
                const cpiFactor = Math.pow(1 + inputs.growthAssumptions.cpiInflationRate, r.year - 2026);
                const isSingle = simulateSurvivor && r.year >= deathYear;
                const agiWithout = Math.max(0, r.fedAGI - r.intentionalRothConversion);
                const taxableWithout = Math.max(0, agiWithout - r.standardDeduction);
                const taxableWith = Math.max(0, r.fedAGI - r.standardDeduction);
                return calculateFedTax(taxableWith, isSingle, cpiFactor) - calculateFedTax(taxableWithout, isSingle, cpiFactor);
              })();
 
              // Marginal state tax attributable to the Roth conversion.
              // Uses the same with/without AGI approach. Gated on stateIncomeTax > 0
              // so FL residents (who pay $0 state tax) always see $0 here.
              const conversionStateTax = (() => {
                if (r.intentionalRothConversion <= 0 || r.stateIncomeTax <= 0) return 0;
                const isSingle = simulateSurvivor && r.year >= deathYear;
                const agiWithout = Math.max(0, r.fedAGI - r.intentionalRothConversion);
                const stateTaxWith = calculateMDStateTax(r.fedAGI, taxableSS, isSingle);
                const stateTaxWithout = calculateMDStateTax(agiWithout, taxableSS, isSingle);
                return Math.max(0, stateTaxWith - stateTaxWithout);
              })();

              const isTopRow = idx < 4;

              return (
                <tr
                  key={r.year}
                  className={`transition-colors hover:bg-slate-900/40 ${
                    isWarningRow 
                      ? 'bg-amber-950/20 text-amber-200 border-l-4 border-l-amber-500 font-medium' 
                      : 'text-slate-300'
                  }`}
                >
                  <td className="p-4 font-mono font-semibold">{r.year}</td>
                  <td className="p-4 font-mono relative group cursor-help text-slate-300">
                    <span>{formatCurrency(r.magi)}</span>
                    <div className={`absolute left-1/2 -translate-x-1/2 w-72 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-xs text-slate-300 pointer-events-none space-y-2 font-sans normal-case ${
                      isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'
                    }`}>
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-1">
                        <span className="font-bold text-slate-200 uppercase tracking-wider text-[9px]">Income / MAGI Component</span>
                        <span className="font-bold text-emerald-400 uppercase tracking-wider text-[9px]">Amount</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Active Salary (Earned):</span>
                        <span className="font-mono text-slate-200 font-medium">{formatCurrency(salary)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Required Minimum Dist. (RMD):</span>
                        <span className="font-mono text-slate-200 font-medium">{formatCurrency(rmd)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Extra Pre-Tax Drawdowns:</span>
                        <span className="font-mono text-slate-200 font-medium">{formatCurrency(pretaxDrawdown)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Roth Conversions:</span>
                        <span className="font-mono text-slate-200 font-medium">{formatCurrency(rothConv)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Realized Capital Gains:</span>
                        <span className="font-mono text-slate-200 font-medium">{formatCurrency(capitalGains)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Taxable Social Security:</span>
                        <span className="font-mono text-slate-200 font-medium">
                          {formatCurrency(taxableSS)}{' '}
                          {totalSS > 0 && (
                            <span className="text-[10px] text-slate-500 font-normal">
                              {ssTaxedPercent > 0
                                ? `(${ssTaxedPercent}% of ${formatCurrency(totalSS)} taxable)`
                                : '(0% taxable — below provisional income threshold)'}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-800/80 pt-2 mt-1 text-[11px] font-bold">
                        <span className="text-slate-200">Total MAGI (Income):</span>
                        <span className="font-mono text-emerald-400">{formatCurrency(r.magi)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-slate-300">
                    {r.intentionalRothConversion > 0 ? (
                      <span className="text-slate-300 font-mono">
                        {formatCurrency(r.intentionalRothConversion)}
                      </span>
                    ) : (
                      <span className="text-slate-600 font-mono">$0</span>
                    )}
                  </td>
                  <td className="p-4 font-mono relative group cursor-help">
                    {r.intentionalRothConversion > 0 ? (
                      <>
                        <span className="text-amber-400/90 font-semibold font-mono">
                          {formatCurrency(conversionTax + conversionStateTax)}
                        </span>
                        <div className={`absolute left-1/2 -translate-x-1/2 w-64 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-xs text-slate-300 pointer-events-none space-y-2 font-sans normal-case ${
                          isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'
                        }`}>
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-1">
                            <span className="font-bold text-slate-200 uppercase tracking-wider text-[9px]">Conversion Tax Breakdown</span>
                            <span className="font-bold text-amber-400 uppercase tracking-wider text-[9px]">Amount</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">Conversion Amount:</span>
                            <span className="font-mono text-slate-200 font-medium">{formatCurrency(r.intentionalRothConversion)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">Federal Marginal Tax:</span>
                            <span className="font-mono text-slate-200 font-medium">{formatCurrency(conversionTax)}</span>
                          </div>
                          {conversionStateTax > 0 && (
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-400">State Marginal Tax:</span>
                              <span className="font-mono text-slate-200 font-medium">{formatCurrency(conversionStateTax)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center border-t border-slate-800/80 pt-2 mt-1 text-[11px] font-bold">
                            <span className="text-slate-200">Total Tax Cost:</span>
                            <span className="font-mono text-amber-400">{formatCurrency(conversionTax + conversionStateTax)}</span>
                          </div>
                          <p className="text-[9px] text-slate-500 leading-relaxed border-t border-slate-800/40 pt-1.5">
                            Marginal bracket-accurate estimate. Hover Total Expenses for full tax breakdown.
                          </p>
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-600 font-mono">$0</span>
                    )}
                  </td>
                  <td className="p-4 font-mono text-rose-400/90 relative group cursor-help">
                    <span>{formatCurrency(r.totalExpenses)}</span>
                    <div className={`absolute left-1/2 -translate-x-1/2 w-64 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-xs text-slate-300 pointer-events-none space-y-2 font-sans normal-case ${
                      isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'
                    }`}>
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-1">
                        <span className="font-bold text-slate-200 uppercase tracking-wider text-[9px]">Expense Component</span>
                        <span className="font-bold text-rose-400 uppercase tracking-wider text-[9px]">Amount</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Living Expenses:</span>
                        <span className="font-mono text-slate-200 font-medium">{formatCurrency(r.livingExpenses)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Federal Income Tax:</span>
                        <span className="font-mono text-slate-200 font-medium">{formatCurrency(r.fedIncomeTax)}</span>
                      </div>
                      {r.intentionalRothConversion > 0 && (
                        <>
                          <div className="flex justify-between items-center text-[10px] pl-3">
                            <span className="text-slate-500">↳ Other Income:</span>
                            <span className="font-mono text-slate-400">{formatCurrency(r.fedIncomeTax - conversionTax)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] pl-3">
                            <span className="text-amber-500/80">↳ Roth Conversion:</span>
                            <span className="font-mono text-amber-400/90">{formatCurrency(conversionTax)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">State Income Tax:</span>
                        <span className="font-mono text-slate-200 font-medium">{formatCurrency(r.stateIncomeTax)}</span>
                      </div>
                      {r.intentionalRothConversion > 0 && r.stateIncomeTax > 0 && (
                        <>
                          <div className="flex justify-between items-center text-[10px] pl-3">
                            <span className="text-slate-500">↳ Other Income:</span>
                            <span className="font-mono text-slate-400">{formatCurrency(r.stateIncomeTax - conversionStateTax)}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] pl-3">
                            <span className="text-amber-500/80">↳ Roth Conversion:</span>
                            <span className="font-mono text-amber-400/90">{formatCurrency(conversionStateTax)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Medicare Base:</span>
                        <span className="font-mono text-slate-200 font-medium">{formatCurrency(r.medicareBasePremiums)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400">Medicare IRMAA Hikes:</span>
                        <span className="font-mono text-slate-200 font-medium">{formatCurrency(r.combinedSurchargeAnnual)}</span>
                      </div>
                      {r.preMedicareHealthcareCost > 0 && (
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Pre-Medicare Premium:</span>
                          <span className="font-mono text-slate-200 font-medium">{formatCurrency(r.preMedicareHealthcareCost)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center border-t border-slate-800/80 pt-2 mt-1 text-[11px] font-bold">
                        <span className="text-slate-200">Total Outflow:</span>
                        <span className="font-mono text-rose-400">{formatCurrency(r.totalExpenses)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-slate-300">{formatCurrency(r.endYourTaxableBrokerage + r.endWifeTaxableBrokerage)}</td>
                  <td className="p-4 font-mono text-slate-300">{formatCurrency(r.endYourPreTaxIRA + r.endWifePreTaxIRA)}</td>
                  <td className="p-4 font-mono text-emerald-400/90">{formatCurrency(r.endYourRothIRA + r.endWifeRothIRA)}</td>
                  <td className="p-4 font-mono font-bold text-slate-100">{formatCurrency(r.totalPortfolioValue)}</td>
                  <td className="p-4 whitespace-nowrap relative group cursor-help">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        r.surchargeTier > 0
                          ? 'bg-amber-600/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Tier {r.surchargeTier}
                    </span>
                    <span className="ml-2 font-mono text-xs text-slate-400">({affectedYear})</span>

                    {/* IRMAA Tier Reference Popup */}
                    {(() => {
                      const isSingle = simulateSurvivor && r.year >= deathYear;
                      const tiers = isSingle ? IRMAA_TIERS_SINGLE : IRMAA_TIERS_MFJ;
                      const cpiFactor = Math.pow(1 + inputs.growthAssumptions.cpiInflationRate, r.year - 2026);
                      const healthcareFactor = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, r.year - 2026);
                      return (
                        <div className={`absolute right-0 w-80 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-xs text-slate-300 pointer-events-none font-sans normal-case ${
                          isTopRow ? 'top-full mt-2' : 'bottom-full mb-2'
                        }`}>
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-2">
                            <span className="font-bold text-slate-200 uppercase tracking-wider text-[9px]">IRMAA Tier Reference — {r.year}</span>
                            <span className="font-bold text-amber-400 uppercase tracking-wider text-[9px]">{isSingle ? 'Single' : 'MFJ'}</span>
                          </div>
                          {/* Column headers */}
                          <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider px-1 mb-1">
                            <span>Tier</span>
                            <span className="text-right">MAGI Limit</span>
                            <span className="text-right">Mo. Surcharge/person</span>
                          </div>
                          <div className="space-y-0.5">
                            {tiers.map((tier) => {
                              const isActive = tier.tierNumber === r.surchargeTier;
                              const inflatedLimit = tier.limit === Infinity
                                ? null
                                : (tier.tierNumber < 4 ? tier.limit * cpiFactor : tier.limit);
                              const monthlySurcharge = (tier.partBSurcharge + tier.partDSurcharge) * healthcareFactor;
                              return (
                                <div
                                  key={tier.tierNumber}
                                  className={`grid grid-cols-3 gap-1 px-2 py-1 rounded-lg text-[10px] ${
                                    isActive
                                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-200'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  <span className={`font-semibold ${isActive ? 'text-amber-300' : 'text-slate-300'}`}>
                                    Tier {tier.tierNumber} {isActive ? '◀' : ''}
                                  </span>
                                  <span className="text-right font-mono">
                                    {inflatedLimit ? `≤ ${formatCurrency(inflatedLimit)}` : 'No limit'}
                                  </span>
                                  <span className={`text-right font-mono ${monthlySurcharge > 0 ? (isActive ? 'text-amber-300' : 'text-rose-400/70') : 'text-slate-600'}`}>
                                    {monthlySurcharge > 0 ? `+${formatCurrency(monthlySurcharge)}/mo` : 'No surcharge'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[9px] text-slate-500 leading-relaxed border-t border-slate-800/40 pt-1.5 mt-2">
                            MAGI limits inflated by CPI. Surcharges inflated by healthcare rate. Applied in {affectedYear} based on {r.year} MAGI.
                          </p>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-4 text-right font-mono whitespace-nowrap">
                    {r.combinedSurchargeMonthly > 0 ? (
                      <span className="text-red-400 font-semibold">
                        {formatCurrency(r.combinedSurchargeMonthly)}/mo ({formatCurrency(r.combinedSurchargeAnnual)}/yr)
                      </span>
                    ) : (
                      <span className="text-slate-500">$0/mo ($0/yr)</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info Footnote */}
      <div className="flex gap-2 items-start text-xs text-slate-500 leading-relaxed">
        <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <p>
          MAGI is calculated as Federal Adjusted Gross Income (AGI) plus tax-exempt interest. Surcharges represent the combined Medicare Part B and Part D premium hikes applied directly to the spouses. In Survivor simulations, the surcharge calculation automatically switches to Single Filer thresholds starting in {deathYear} (after the projected passing of {inputs.you.name || 'You'}).
        </p>
      </div>
    </div>
  );
};
