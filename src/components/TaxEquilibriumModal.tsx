import React, { useMemo } from 'react';
import {
  Scale,
  Check,
  X,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  DollarSign,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { AppStateInputs, LockedReturnSequence } from '../types';
import { calculateTaxEquilibriumSchedule, TaxEquilibriumResult, TELimitingFactor } from '../engine/taxEquilibriumEngine';

interface TaxEquilibriumModalProps {
  isOpen: boolean;
  onClose: () => void;
  inputs: AppStateInputs;
  simulateSurvivor: boolean;
  activeScenarioSequence?: LockedReturnSequence | null;
  onApplySchedule: (schedule: Record<number, number>, scenarioName?: string) => void;
}

export const TaxEquilibriumModal: React.FC<TaxEquilibriumModalProps> = ({
  isOpen,
  onClose,
  inputs,
  simulateSurvivor,
  activeScenarioSequence,
  onApplySchedule,
}) => {
  const result: TaxEquilibriumResult = useMemo(() => {
    if (!isOpen) {
      return {
        schedule: {},
        yearlyDetails: [],
        averageBenchmarkRate: 0,
        lifetimeImpact: {
          baselineLifetimeTaxes: 0,
          optimizedLifetimeTaxes: 0,
          lifetimeTaxSavings: 0,
          baselineFirstRMD: 0,
          optimizedFirstRMD: 0,
          firstRMDDelta: 0,
          baselineEndingEstate: 0,
          optimizedEndingEstate: 0,
          endingEstateDelta: 0,
        },
      };
    }
    return calculateTaxEquilibriumSchedule(inputs, simulateSurvivor, activeScenarioSequence);
  }, [isOpen, inputs, simulateSurvivor, activeScenarioSequence]);

  if (!isOpen) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);

  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;

  const getLimitingFactorBadge = (factor: TELimitingFactor) => {
    switch (factor) {
      case 'Matched Future TE Benchmark':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <Check className="w-3 h-3" />
            Matched TE Hurdle
          </span>
        );
      case 'IRMAA Cliff Boundary':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <AlertCircle className="w-3 h-3" />
            IRMAA Cliff Floor
          </span>
        );
      case 'Capital Gains 0% Threshold':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/25">
            <DollarSign className="w-3 h-3" />
            0% LTCG Cap
          </span>
        );
      case 'Capped by Cash Reserves':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25">
            <ShieldCheck className="w-3 h-3" />
            Liquid Runway Cap
          </span>
        );
      case 'Pre-Tax IRA Depleted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/25">
            Pre-Tax Exhausted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {factor}
          </span>
        );
    }
  };

  const totalOptimalConversion = Object.values(result.schedule).reduce((sum, v) => sum + v, 0);

  const handleApply = () => {
    onApplySchedule(result.schedule, 'Tax Equilibrium Schedule (TE)');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden glass-panel backdrop-blur-xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 sticky top-0 z-10">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-teal-500/20 border border-indigo-500/30 rounded-2xl text-indigo-400">
              <Scale className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold text-slate-100">Tax Equilibrium (TE) Analysis</h3>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-teal-500/15 text-teal-400 border border-teal-500/30 rounded-full">
                  Kitces Equilibrium Model
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Balances current marginal conversion costs against future forced RMD tax drag.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200 custom-scrollbar">
          {/* Top Banner: Dynamic TE Hurdle Rate Explanation */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900/50 to-teal-950/40 border border-teal-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-wider font-mono">
                <Sparkles className="w-4 h-4" />
                <span>Dynamic Future RMD Hurdle Rate</span>
              </div>
              <p className="text-xs text-slate-300 max-w-xl">
                The weighted-average marginal tax cost of taking forced RMDs in future years (including Social Security tax torpedo phase-in and single-filer survivor brackets). Conversions are optimized to never exceed this rate.
              </p>
            </div>
            <div className="text-right flex md:flex-col items-baseline md:items-end justify-between">
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-emerald-400">
                {formatPercent(result.averageBenchmarkRate)}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Equilibrium Hurdle Rate</span>
            </div>
          </div>

          {/* Key KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Lifetime Tax Savings
              </span>
              <div className="text-xl font-bold text-emerald-400">
                {formatCurrency(result.lifetimeImpact.lifetimeTaxSavings)}
              </div>
              <p className="text-[11px] text-slate-400">
                Total lifetime tax and IRMAA relief vs $0 conversion baseline.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                First RMD Reduction
              </span>
              <div className="text-xl font-bold text-teal-400">
                -{formatCurrency(result.lifetimeImpact.firstRMDDelta)}
              </div>
              <p className="text-[11px] text-slate-400">
                First RMD shrinks from {formatCurrency(result.lifetimeImpact.baselineFirstRMD)} to{' '}
                {formatCurrency(result.lifetimeImpact.optimizedFirstRMD)}.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Total Optimized Conversions
              </span>
              <div className="text-xl font-bold text-indigo-400">
                {formatCurrency(totalOptimalConversion)}
              </div>
              <p className="text-[11px] text-slate-400">
                Spread across {result.yearlyDetails.length} active conversion years.
              </p>
            </div>
          </div>

          {/* Detailed Year-by-Year Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Year-by-Year Tax Equilibrium Schedule
                </h4>
                <div className="group relative cursor-pointer">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors" />
                  <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block w-72 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-[11px] text-slate-200 shadow-xl z-20 pointer-events-none">
                    Each year solves for the exact conversion limit using a 3-phase coarse-to-fine stepping algorithm, stopping when the marginal cost hits the hurdle rate or liquidity constraints.
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-slate-400">
                Window: {inputs.rothConversionStartYear} – {inputs.rothConversionEndYear}
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Year / Age</th>
                    <th className="py-2.5 px-3">Base Income</th>
                    <th className="py-2.5 px-3">Optimal Conversion</th>
                    <th className="py-2.5 px-3">Marginal Cost</th>
                    <th className="py-2.5 px-3">Future Hurdle</th>
                    <th className="py-2.5 px-3">Limiting Factor</th>
                    <th className="py-2.5 px-3 text-right">Projected Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {result.yearlyDetails.map((detail) => (
                    <tr key={detail.year} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-200">
                        {detail.year}{' '}
                        <span className="text-slate-500 font-normal">
                          ({detail.yourAge}{inputs.isSingleFiler ? '' : ` / ${detail.wifeAge}`})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {formatCurrency(detail.baseOrdinaryIncome)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-teal-300">
                        {formatCurrency(detail.optimalConversion)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-bold ${
                            detail.marginalRate <= detail.futureBenchmarkRate
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {formatPercent(detail.marginalRate)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {formatPercent(detail.futureBenchmarkRate)}
                      </td>
                      <td className="py-2.5 px-3">
                        {getLimitingFactorBadge(detail.limitingFactor)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-300">
                        {formatCurrency(detail.projectedAnnualTax)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between sticky bottom-0 z-10">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingDown className="w-4 h-4 text-teal-400" />
            <span>Applies conversion schedule directly to your plan inputs.</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-300 hover:to-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-teal-500/20 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Apply as Active Custom Scenario</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
