import React, { useMemo } from 'react';
import { SimulationResultRow, AppStateInputs } from '../types';
import {
  DollarSign,
  TrendingUp,
  ShieldAlert,
  ArrowRightLeft,
  Settings,
  Coins,
  MapPin,
  Sliders
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
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  ledger,
  parallelLedgers,
  successRate,
  inputs,
  activeTab,
  setActiveTab,
  children,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Compute key summary statistics for active ledger and all percentiles
  const stats = useMemo(() => {
    const computeForLedger = (l: SimulationResultRow[]) => {
      const finalRow = l[l.length - 1];
      const endingEstate = finalRow ? finalRow.totalPortfolioValue : 0;
      const totalTaxes = l.reduce((sum, r) => sum + r.totalIncomeTax, 0);
      const totalSurcharges = l.reduce((sum, r) => sum + r.combinedSurchargeAnnual, 0);
      const totalBasePremiums = l.reduce((sum, r) => sum + r.medicareBasePremiums, 0);
      return { endingEstate, totalTaxes, totalSurcharges, totalBasePremiums };
    };

    return {
      active: computeForLedger(ledger),
      p10: computeForLedger(parallelLedgers.p10),
      p50: computeForLedger(parallelLedgers.p50),
      p90: computeForLedger(parallelLedgers.p90),
      flat: computeForLedger(parallelLedgers.flat),
    };
  }, [ledger, parallelLedgers]);

  const stateTaxContext = useMemo(() => {
    const current = inputs.jurisdiction.currentState;
    const target = inputs.jurisdiction.targetState;
    const relocYear = inputs.jurisdiction.relocationYear;
    if (relocYear) {
      return `Move to ${target} in ${relocYear}`;
    }
    return `Residency in ${current}`;
  }, [inputs]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top Banner Stats Grid */}
      <header className="p-6 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md z-10 space-y-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">
              Retirement Planner
            </h2>
            <p className="text-xs text-slate-400">
              Interactive 35-year tax, Medicare IRMAA, and Social Security modeling
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 font-mono">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              Claim Combo ({inputs.you.name || 'You'} / {inputs.wife.name || 'Spouse'}): {inputs.you.targetSSClaimingAge} / {inputs.wife.targetSSClaimingAge}
            </span>
            <span className="flex items-center gap-1 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 font-mono">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              {stateTaxContext}
            </span>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Ending Net Estate */}
          <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-emerald-500 hover:scale-102 transition-transform duration-300">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                Ending Net Estate (Age 90)
              </span>
              <span className="text-xl font-black text-emerald-400 font-mono block">
                {formatCurrency(stats.active.endingEstate)}
              </span>
              <span className="text-[9px] text-slate-500 font-mono block">
                Range: {formatCurrency(stats.p10.endingEstate)} to {formatCurrency(stats.p90.endingEstate)}
              </span>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-500/50" />
          </div>

          {/* Card 2: Lifetime Taxes */}
          <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-rose-500 hover:scale-102 transition-transform duration-300">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lifetime Income Taxes</span>
              <span className="text-xl font-black text-rose-400 font-mono block">
                {formatCurrency(stats.active.totalTaxes)}
              </span>
              <span className="text-[9px] text-slate-500 font-mono block">
                Range: {formatCurrency(stats.p10.totalTaxes)} to {formatCurrency(stats.p90.totalTaxes)}
              </span>
            </div>
            <DollarSign className="w-8 h-8 text-rose-500/50" />
          </div>

          {/* Card 3: Medicare Surcharges */}
          <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-amber-500 hover:scale-102 transition-transform duration-300">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lifetime IRMAA Surcharges</span>
              <span className="text-xl font-black text-amber-400 font-mono block">
                {formatCurrency(stats.active.totalSurcharges)}
              </span>
              <span className="text-[9px] text-slate-500 font-mono block">
                Range: {formatCurrency(stats.p10.totalSurcharges)} to {formatCurrency(stats.p90.totalSurcharges)}
              </span>
            </div>
            <ShieldAlert className="w-8 h-8 text-amber-500/50" />
          </div>

          {/* Card 4: Plan Success Rate */}
          <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-blue-500 hover:scale-102 transition-transform duration-300">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Plan Success Rate</span>
              <span className="text-xl font-black text-blue-400 font-mono block">
                {(successRate * 100).toFixed(1)}%
              </span>
              <span className="text-[9px] text-slate-500 font-mono block">
                Across {inputs.monteCarloSettings.trials} stress test trials
              </span>
            </div>
            <ArrowRightLeft className="w-8 h-8 text-blue-500/50" />
          </div>
        </div>

        {/* Dashboard Tabs Selector */}
        <div className="flex border-b border-slate-800 overflow-x-auto custom-scrollbar whitespace-nowrap">
          <button
            onClick={() => setActiveTab(0)}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 0
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/40 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/10'
            }`}
          >
            <Coins className="w-4 h-4" />
            Workspace 1: Bracket Map Chart
          </button>
          <button
            onClick={() => setActiveTab(1)}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 1
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/40 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/10'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Workspace 2: Lookback Ledger
          </button>
          <button
            onClick={() => setActiveTab(2)}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 2
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/40 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/10'
            }`}
          >
            <Settings className="w-4 h-4" />
            Workspace 3: Claiming Matrix
          </button>
          <button
            onClick={() => setActiveTab(3)}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 3
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/40 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/10'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Workspace 4: Monte Carlo Analysis
          </button>
        </div>
      </header>

      {/* Main Tab Panels viewport scrollable */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-950">
        <div className="w-full space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
};
