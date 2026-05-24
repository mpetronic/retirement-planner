import React, { useMemo } from 'react';
import { SimulationResultRow, AppStateInputs } from '../types';
import { ShieldAlert, Info, AlertTriangle } from 'lucide-react';
import { IRMAA_TIERS_MFJ, IRMAA_TIERS_SINGLE } from '../engine/taxRates2026';

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
      
      const cpiFactor = r.standardDeduction / (r.yourAge >= 85 && simulateSurvivor ? 13850 : 27700);
      const isSingle = simulateSurvivor && year >= 2045;
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
          
          // Surcharges are inflated by healthcare factor
          const healthcareFactor = Math.pow(1 + inputs.growthAssumptions.healthcareInflationRate, idx);
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
  }, [ledger, simulateSurvivor, inputs]);

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-500 animate-pulse" />
          Workspace 2: Lookback Linkage Ledger Table
        </h3>
        <p className="text-xs text-slate-400">
          Under Medicare guidelines, your Modified Adjusted Gross Income (MAGI) in a tax year dictates your premium surcharges exactly 2 years later.
        </p>
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
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/20">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
              <th className="p-4">Year (t)</th>
              <th className="p-4">MAGI (Income)</th>
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
            {ledger.map((r) => {
              const affectedYear = r.year + 2;
              
              // Determine if this row is highlighted for crossing a cliff by < $5,000
              const isWarningRow = warnings.some((w) => w.year === r.year);

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
                  <td className="p-4 font-mono">{formatCurrency(r.magi)}</td>
                  <td className="p-4 font-mono text-rose-400/90">{formatCurrency(r.totalExpenses)}</td>
                  <td className="p-4 font-mono text-slate-300">{formatCurrency(r.endYourTaxableBrokerage + r.endWifeTaxableBrokerage)}</td>
                  <td className="p-4 font-mono text-slate-300">{formatCurrency(r.endYourPreTaxIRA + r.endWifePreTaxIRA)}</td>
                  <td className="p-4 font-mono text-emerald-400/90">{formatCurrency(r.endYourRothIRA + r.endWifeRothIRA)}</td>
                  <td className="p-4 font-mono font-bold text-slate-100">{formatCurrency(r.totalPortfolioValue)}</td>
                  <td className="p-4 whitespace-nowrap">
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
          MAGI is calculated as Federal Adjusted Gross Income (AGI) plus tax-exempt interest. Surcharges represent the combined Medicare Part B and Part D premium hikes applied directly to the spouses. In Survivor simulations, the surcharge calculation automatically switches to Single Filer thresholds starting in 2045 (after the projected passing of {inputs.you.name || 'You'}).
        </p>
      </div>
    </div>
  );
};
