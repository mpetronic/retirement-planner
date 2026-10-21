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
  Info,
} from 'lucide-react';
import { AppStateInputs, LockedReturnSequence } from '../types';
import { calculateTaxEquilibriumSchedule, TaxEquilibriumResult, YearlyTaxEquilibriumPoint } from '../engine/taxEquilibriumEngine';
import { STATUTORY_IRMAA_LOOKBACK_YEARS } from '../engine/taxRates2026';

interface ColumnHelpHeaderProps {
  label: string;
  tooltipTitle: string;
  tooltipText: string;
  align?: 'left' | 'right';
  className?: string;
}

const ColumnHelpHeader: React.FC<ColumnHelpHeaderProps> = ({
  label,
  tooltipTitle,
  tooltipText,
  align = 'left',
  className = '',
}) => {
  return (
    <th className={`py-2.5 px-3 select-none ${className}`}>
      <div className={`group relative inline-flex items-center gap-1.5 cursor-help ${align === 'right' ? 'w-full justify-end' : ''}`}>
        <span className="font-bold">{label}</span>
        <Info className="w-3 h-3 text-slate-500 group-hover:text-teal-400 transition-colors shrink-0" />

        {/* Hover Hint Popup */}
        <div
          className={`absolute top-full mt-1.5 ${
            align === 'right' ? 'right-0' : 'left-0'
          } hidden group-hover:block z-30 w-72 p-3 rounded-xl bg-slate-950 border border-slate-700 shadow-2xl text-xs text-slate-200 normal-case font-sans whitespace-normal break-words pointer-events-none space-y-1.5`}
        >
          <div className="font-bold text-teal-400 flex items-center gap-1.5 text-xs border-b border-slate-800/80 pb-1 whitespace-normal">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>{tooltipTitle}</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed font-normal whitespace-normal break-words">
            {tooltipText}
          </p>
        </div>
      </div>
    </th>
  );
};

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

  const getLimitingFactorBadge = (detail: YearlyTaxEquilibriumPoint, idx: number) => {
    const popupPositionClass = idx < 2 ? 'top-full mt-2' : 'bottom-full mb-2';

    switch (detail.limitingFactor) {
      case 'Matched Future TE Benchmark':
        return (
          <div className="group relative inline-flex items-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 cursor-help transition-colors group-hover:border-emerald-500/50">
              <Check className="w-3 h-3 shrink-0" />
              <span>Matched TE Hurdle</span>
            </span>
            <div className={`absolute right-0 ${popupPositionClass} hidden group-hover:block z-40 w-80 p-3 rounded-xl bg-slate-950 border border-emerald-500/40 shadow-2xl text-xs text-slate-200 normal-case font-sans whitespace-normal break-words pointer-events-none space-y-1.5`}>
              <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs border-b border-slate-800 pb-1">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Matched Future TE Hurdle</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed font-normal">
                {detail.limitingDetail || `Marginal conversion cost (${formatPercent(detail.marginalRate)}) reached your future projected RMD hurdle rate (${formatPercent(detail.futureBenchmarkRate)}). Converting more would pay higher taxes today than taking future RMDs.`}
              </p>
            </div>
          </div>
        );

      case 'IRMAA Cliff Boundary': {
        const tierNum = detail.limitingTier || 1;
        const tierLabel = `IRMAA Tier ${tierNum} Cliff`;
        return (
          <div className="group relative inline-flex items-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-help transition-all group-hover:border-amber-500/60 group-hover:bg-amber-500/20">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{tierLabel}</span>
            </span>
            <div className={`absolute right-0 ${popupPositionClass} hidden group-hover:block z-40 w-80 p-3.5 rounded-xl bg-slate-950 border border-amber-500/40 shadow-2xl text-xs text-slate-200 normal-case font-sans whitespace-normal break-words pointer-events-none space-y-2`}>
              <div className="font-bold text-amber-400 flex items-center gap-1.5 text-xs border-b border-slate-800 pb-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Medicare {tierLabel}</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed font-normal">
                {detail.limitingDetail || `Capped right below the Medicare IRMAA Tier ${tierNum} threshold. Converting an additional dollar triggers steep annual surcharges on Medicare Part B & Part D premiums 2 years later.`}
              </p>
              {detail.limitingThreshold && (
                <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">MAGI Tier Boundary:</span>
                  <span className="font-bold text-amber-300">{formatCurrency(detail.limitingThreshold)}</span>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'Capital Gains 0% Threshold':
        return (
          <div className="group relative inline-flex items-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/25 cursor-help transition-colors group-hover:border-blue-500/50">
              <DollarSign className="w-3 h-3 shrink-0" />
              <span>0% LTCG Cap</span>
            </span>
            <div className={`absolute right-0 ${popupPositionClass} hidden group-hover:block z-40 w-80 p-3 rounded-xl bg-slate-950 border border-blue-500/40 shadow-2xl text-xs text-slate-200 normal-case font-sans whitespace-normal break-words pointer-events-none space-y-1.5`}>
              <div className="font-bold text-blue-400 flex items-center gap-1.5 text-xs border-b border-slate-800 pb-1">
                <DollarSign className="w-3.5 h-3.5 shrink-0" />
                <span>0% Capital Gains Ceiling</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed font-normal">
                {detail.limitingDetail || 'Conversions are capped to avoid pushing long-term capital gains and qualified dividends out of the 0% federal bracket into the 15% bracket.'}
              </p>
            </div>
          </div>
        );

      case 'Capped by Cash Reserves':
        return (
          <div className="group relative inline-flex items-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25 cursor-help transition-colors group-hover:border-rose-500/50">
              <ShieldCheck className="w-3 h-3 shrink-0" />
              <span>Liquid Runway Cap</span>
            </span>
            <div className={`absolute right-0 ${popupPositionClass} hidden group-hover:block z-40 w-80 p-3 rounded-xl bg-slate-950 border border-rose-500/40 shadow-2xl text-xs text-slate-200 normal-case font-sans whitespace-normal break-words pointer-events-none space-y-1.5`}>
              <div className="font-bold text-rose-400 flex items-center gap-1.5 text-xs border-b border-slate-800 pb-1">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Liquid Cash Runway Ceiling</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed font-normal">
                {detail.limitingDetail || 'Paying additional conversion taxes would deplete liquid cash and brokerage below your safety runway target.'}
              </p>
            </div>
          </div>
        );

      case 'Pre-Tax IRA Depleted':
        return (
          <div className="group relative inline-flex items-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/25 cursor-help transition-colors group-hover:border-purple-500/50">
              <span>Pre-Tax Exhausted</span>
            </span>
            <div className={`absolute right-0 ${popupPositionClass} hidden group-hover:block z-40 w-80 p-3 rounded-xl bg-slate-950 border border-purple-500/40 shadow-2xl text-xs text-slate-200 normal-case font-sans whitespace-normal break-words pointer-events-none space-y-1.5`}>
              <div className="font-bold text-purple-400 flex items-center gap-1.5 text-xs border-b border-slate-800 pb-1">
                <span>Pre-Tax IRA Fully Converted</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed font-normal">
                {detail.limitingDetail || 'Traditional pre-tax IRA accounts have been fully converted to Roth. No remaining pre-tax assets available.'}
              </p>
            </div>
          </div>
        );

      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {detail.limitingFactor}
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
                    <ColumnHelpHeader
                      label="Year / Age"
                      tooltipTitle="Simulation Year & Client Ages"
                      tooltipText="The calendar tax year and the corresponding client (and spouse) ages during that tax filing period within your designated Roth conversion window."
                    />
                    <ColumnHelpHeader
                      label="Base Income"
                      tooltipTitle="Base Ordinary Non-Conversion Income"
                      tooltipText="Expected baseline ordinary income before any Roth conversions are added, including salaries, taxable dividends, interest, and taxable Social Security benefits."
                    />
                    <ColumnHelpHeader
                      label="Optimal Conversion"
                      tooltipTitle="Equilibrium Roth Conversion"
                      tooltipText="The mathematically optimal conversion amount for this year that maximizes long-term wealth without exceeding the dynamic future RMD hurdle rate or liquidity constraints."
                    />
                    <ColumnHelpHeader
                      label="Marginal Cost"
                      tooltipTitle="Marginal Conversion Tax Drag"
                      tooltipText="The all-in marginal tax rate paid on the last converted dollar, combining the federal tax bracket, state/local income taxes, NIIT (3.8%), and lookback Medicare IRMAA surcharges."
                    />
                    <ColumnHelpHeader
                      label="Future Hurdle"
                      tooltipTitle="Dynamic Future RMD Hurdle Rate"
                      tooltipText="The weighted-average effective tax drag on future forced RMDs across retirement (accounting for single-filer survivor brackets and the Social Security tax torpedo). Conversions halt when current marginal cost reaches this rate."
                    />
                    <ColumnHelpHeader
                      label="Limiting Factor"
                      tooltipTitle="Conversion Limiting Factor"
                      tooltipText="The specific tax, statutory, or liquidity threshold that capped conversions this year (e.g., reaching the future TE hurdle rate, stopping at an IRMAA cliff tier boundary, protecting 0% LTCG, or preserving cash reserves)."
                      align="right"
                    />
                    <ColumnHelpHeader
                      label="Projected Tax"
                      tooltipTitle="Projected Annual Tax & Lookback IRMAA"
                      tooltipText="Total upfront federal and state income tax liability generated in this conversion year. Any Medicare Part B & D IRMAA surcharges triggered 2 years later (via the 2-year lookback) are noted below."
                      align="right"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {result.yearlyDetails.map((detail, idx) => (
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
                        {getLimitingFactorBadge(detail, idx)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-medium text-slate-300">
                          {formatCurrency(detail.projectedAnnualTax)}
                        </div>
                        {detail.projectedAnnualIRMAA > 0 && (
                          <div className="text-[10px] text-amber-400 font-normal">
                            +{formatCurrency(detail.projectedAnnualIRMAA)} IRMAA (yr +{STATUTORY_IRMAA_LOOKBACK_YEARS})
                          </div>
                        )}
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
