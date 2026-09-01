import React, { useMemo } from 'react';
import { SimulationResultRow, AppStateInputs } from '../types';
import {
  DollarSign,
  TrendingUp,
  ShieldAlert,
  ArrowRightLeft,
  Coins,
  Sliders,
  AlertTriangle,
  BookOpen,
  Calculator,
  ClipboardCheck,
} from 'lucide-react';

interface DashboardLayoutProps {
  ledger: SimulationResultRow[];
  parallelLedgers: {
    flat: SimulationResultRow[];
    p10: SimulationResultRow[];
    p50: SimulationResultRow[];
    p90: SimulationResultRow[];
  };
  successRate: number;
  inputs: AppStateInputs;
  activeTab: number;
  setActiveTab: (tab: number) => void;
  globalScenario: 'flat' | 'p10' | 'p50' | 'p90';
  setGlobalScenario: (val: 'flat' | 'p10' | 'p50' | 'p90') => void;
  isSimulating?: boolean;
  onOpenDocumentation?: (sectionId?: string) => void;
  onOpenParamDrawer?: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  ledger,
  parallelLedgers,
  successRate,
  inputs,
  activeTab,
  setActiveTab,
  globalScenario,
  setGlobalScenario,
  isSimulating = false,
  onOpenDocumentation,
  onOpenParamDrawer,
  children,
}) => {
  const [showKpiSummary, setShowKpiSummary] = React.useState(false);
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const isStressTestActive = Boolean(
    inputs.monteCarloSettings?.stressTest?.enabled &&
    (inputs.monteCarloSettings?.stressTest?.overrides?.length ?? 0) > 0
  );
  const stressTestOverridesCount = inputs.monteCarloSettings?.stressTest?.overrides?.length ?? 0;

  // Compute key summary statistics for active ledger and all percentiles
  const stats = useMemo(() => {
    const computeForLedger = (l: SimulationResultRow[]) => {
      const finalRow = l[l.length - 1];
      const endingEstate = finalRow ? finalRow.totalPortfolioValue : 0;
      const totalTaxes = l.reduce((sum, r) => sum + r.totalIncomeTax, 0);
      const totalSurcharges = l.reduce((sum, r) => sum + r.combinedSurchargeAnnual, 0);
      const totalBasePremiums = l.reduce((sum, r) => sum + r.medicareBasePremiums, 0);
      const totalTithe = l.reduce((sum, r) => sum + (r.charitableTithe || 0), 0);
      const totalQCD = l.reduce((sum, r) => sum + (r.qcdAmount || 0), 0);
      const totalQcdTaxSaved = l.reduce((sum, r) => sum + (r.qcdTaxSavings || 0), 0);
      const endingAge = finalRow ? finalRow.yourAge : 90;
      return { endingEstate, totalTaxes, totalSurcharges, totalBasePremiums, totalTithe, totalQCD, totalQcdTaxSaved, endingAge };
    };

    return {
      active: computeForLedger(ledger),
      p10: computeForLedger(parallelLedgers.p10),
      p50: computeForLedger(parallelLedgers.p50),
      p90: computeForLedger(parallelLedgers.p90),
      flat: computeForLedger(parallelLedgers.flat),
    };
  }, [ledger, parallelLedgers]);



  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Streamlined Single-Row Top Navigation Bar (~48px height) */}
      <header className="px-4 py-2 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md z-10 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left Section: Branding & Tab Navigation */}
        <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-800/80 shrink-0">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h1 className="text-sm font-black text-slate-100 tracking-tight whitespace-nowrap">
              Retirement Planner
            </h1>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab(0)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 0
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab(1)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 1
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Taxable Income Planner
            </button>
            <button
              onClick={() => setActiveTab(2)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 2
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Lookback Ledger
            </button>
            <button
              onClick={() => setActiveTab(3)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 3
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Monte Carlo
            </button>
            <button
              onClick={() => setActiveTab(4)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 4
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Compare
            </button>
            <button
              onClick={() => setActiveTab(5)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 5
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Actuals & Guardrails
            </button>
          </nav>
        </div>

        {/* Right Section: Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Edit Parameters Drawer Trigger Button */}
          {onOpenParamDrawer && (
            <button
              type="button"
              onClick={onOpenParamDrawer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-98"
              title="Open Parameters & Scenario Assumptions Drawer (Press 'P')"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Edit Parameters</span>
              <kbd className="hidden sm:inline-block ml-0.5 px-1.5 py-0.2 bg-slate-900/60 border border-emerald-500/30 rounded text-[9px] font-mono text-emerald-400 font-normal">
                P
              </kbd>
            </button>
          )}

          {/* Summary KPIs Toggle Button */}
          <button
            type="button"
            onClick={() => setShowKpiSummary(!showKpiSummary)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              showKpiSummary
                ? 'bg-slate-800 text-slate-100 border-slate-700'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
            title="Toggle Plan KPI Summary Grid"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline font-bold">KPIs</span>
            <span className="font-mono text-[10px] text-emerald-400 font-bold">
              {formatCurrency(stats.active.endingEstate)}
            </span>
          </button>

          {/* Stress Test Warning Indicator if Active */}
          {isStressTestActive && (
            <button
              type="button"
              onClick={() => setActiveTab(3)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/60 transition-all cursor-pointer animate-pulse"
              title={`Stress testing active for ${stressTestOverridesCount} years. Click to customize in Monte Carlo Analysis.`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase hidden lg:inline">Stress Test</span>
            </button>
          )}

          {/* Global Scenario Switcher */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setGlobalScenario('flat')}
              className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                globalScenario === 'flat' ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Static baseline scenario"
            >
              Flat
            </button>
            <button
              type="button"
              onClick={() => setGlobalScenario('p10')}
              className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                globalScenario === 'p10' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="10th percentile worst market scenario"
            >
              P10
            </button>
            <button
              type="button"
              onClick={() => setGlobalScenario('p50')}
              className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                globalScenario === 'p50' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="50th percentile median market scenario"
            >
              P50
            </button>
            <button
              type="button"
              onClick={() => setGlobalScenario('p90')}
              className={`text-[10px] px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                globalScenario === 'p90' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="90th percentile best market scenario"
            >
              P90
            </button>
          </div>

          {/* User Guide Button */}
          <button
            type="button"
            onClick={() => {
              const sectionMap: Record<number, string> = {
                0: 'overview',
                1: 'taxable-income',
                2: 'workspace-2',
                3: 'workspace-3',
                4: 'workspace-4',
              };
              onOpenDocumentation?.(sectionMap[activeTab] || 'overview');
            }}
            className="p-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            title="User Guide & Documentation (?)"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          </button>
        </div>
      </header>

      {/* Collapsible KPI Summary Panel */}
      {showKpiSummary && (
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 animate-in slide-in-from-top-2 duration-200 shrink-0 z-10">
          <div className="glass-panel rounded-lg px-3 py-1.5 flex items-center justify-between border-l-4 border-l-emerald-500 bg-slate-900/60">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">
                Ending Net Estate (Age {stats.active.endingAge})
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-base font-black text-emerald-400 font-mono">
                  {formatCurrency(stats.active.endingEstate)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono truncate">
                  ({formatCurrency(stats.p10.endingEstate)}–{formatCurrency(stats.p90.endingEstate)})
                </span>
              </div>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-500/50 shrink-0 ml-2" />
          </div>

          <div className="glass-panel rounded-lg px-3 py-1.5 flex items-center justify-between border-l-4 border-l-rose-500 bg-slate-900/60">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Lifetime Income Taxes</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-base font-black text-rose-400 font-mono">
                  {formatCurrency(stats.active.totalTaxes)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono truncate">
                  ({formatCurrency(stats.p10.totalTaxes)}–{formatCurrency(stats.p90.totalTaxes)})
                </span>
              </div>
            </div>
            <DollarSign className="w-4 h-4 text-rose-500/50 shrink-0 ml-2" />
          </div>

          <div className="glass-panel rounded-lg px-3 py-1.5 flex items-center justify-between border-l-4 border-l-amber-500 bg-slate-900/60">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Lifetime IRMAA Surcharges</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-base font-black text-amber-400 font-mono">
                  {formatCurrency(stats.active.totalSurcharges)}
                </span>
                <span className="text-[9px] text-slate-500 font-mono truncate">
                  ({formatCurrency(stats.p10.totalSurcharges)}–{formatCurrency(stats.p90.totalSurcharges)})
                </span>
              </div>
            </div>
            <ShieldAlert className="w-4 h-4 text-amber-500/50 shrink-0 ml-2" />
          </div>

          <div className="glass-panel rounded-lg px-3 py-1.5 flex items-center justify-between border-l-4 border-l-blue-500 bg-slate-900/60">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Plan Success Rate</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-base font-black text-blue-400 font-mono">
                  {(successRate * 100).toFixed(1)}%
                </span>
                <span className="text-[9px] text-slate-500 font-mono truncate">
                  ({inputs.monteCarloSettings.trials} trials)
                </span>
              </div>
            </div>
            <ArrowRightLeft className="w-4 h-4 text-blue-500/50 shrink-0 ml-2" />
          </div>
        </div>
      )}

      {/* Main Tab Panels viewport scrollable */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-950">
        <div className={`w-full space-y-3 transition-opacity duration-150 ${isSimulating ? 'opacity-75' : 'opacity-100'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};
