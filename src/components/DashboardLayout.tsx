import React, { useMemo, useState } from 'react';
import { SimulationResultRow, AppStateInputs } from '../types';
import {
  DollarSign,
  TrendingUp,
  ShieldAlert,
  ArrowRightLeft,
  Coins,
  MapPin,
  Sliders,
  Settings,
  X
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
  globalFontSize: number;
  setGlobalFontSize: (val: number) => void;
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
  globalFontSize,
  setGlobalFontSize,
  children,
}) => {
  const [showSettings, setShowSettings] = useState(false);
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
      const endingAge = finalRow ? finalRow.yourAge : 90;
      return { endingEstate, totalTaxes, totalSurcharges, totalBasePremiums, endingAge };
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
          
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 font-mono">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              Claim Combo ({inputs.you.name || 'You'} / {inputs.wife.name || 'Spouse'}): {inputs.you.targetSSClaimingAge} / {inputs.wife.targetSSClaimingAge}
            </span>
            <span className="flex items-center gap-1 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 font-mono">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              {stateTaxContext}
            </span>

            {/* Global Scenario Switcher */}
            <div className="flex items-center gap-1 bg-slate-950/60 p-1 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2">Global Outlook:</span>
              <button
                type="button"
                onClick={() => setGlobalScenario('flat')}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  globalScenario === 'flat'
                    ? 'bg-slate-800 text-slate-100 border-slate-700/60 font-black'
                    : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
                }`}
              >
                Flat
              </button>
              <button
                type="button"
                onClick={() => setGlobalScenario('p10')}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  globalScenario === 'p10'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 font-black'
                    : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
                }`}
                title="Pessimistic: 10th Percentile Run"
              >
                Worst (P10)
              </button>
              <button
                type="button"
                onClick={() => setGlobalScenario('p50')}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  globalScenario === 'p50'
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-black'
                    : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
                }`}
                title="Median: 50th Percentile Run"
              >
                Median (P50)
              </button>
              <button
                type="button"
                onClick={() => setGlobalScenario('p90')}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  globalScenario === 'p90'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-black'
                    : 'bg-transparent text-slate-400 hover:text-slate-200 border-transparent'
                }`}
                title="Optimistic: 90th Percentile Run"
              >
                Best (P90)
              </button>
            </div>

            {/* Display Settings Gear Button */}
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="p-2 bg-slate-950/60 hover:bg-slate-800/80 text-slate-400 hover:text-slate-100 border border-slate-800 hover:border-slate-700/60 rounded-xl transition-all cursor-pointer flex items-center justify-center"
              title="Display & Font Size Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Ending Net Estate */}
          <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-emerald-500 hover:scale-102 transition-transform duration-300">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                Ending Net Estate (Age {stats.active.endingAge})
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
            Overview
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
            Lookback Ledger
          </button>
          <button
            onClick={() => setActiveTab(2)}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 2
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/40 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/10'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Monte Carlo Analysis
          </button>
          <button
            onClick={() => setActiveTab(3)}
            className={`py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 3
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/40 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/10'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Plan Comparison
          </button>
        </div>
      </header>

      {/* Main Tab Panels viewport scrollable */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-950">
        <div className="w-full space-y-6">
          {children}
        </div>
      </main>

      {/* Global Display & Typography Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-200">
          <div className="w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6 glass-panel backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                Display & Typography Settings
              </h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Global Font Size Scale</span>
                  <span className="text-slate-200 font-mono font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700/50">
                    {globalFontSize}px ({Math.round((globalFontSize / 16) * 100)}%)
                  </span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="24"
                  value={globalFontSize}
                  onChange={(e) => setGlobalFontSize(parseInt(e.target.value, 10))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>12px (Small)</span>
                  <span>16px (Default)</span>
                  <span>24px (Extra Large)</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Size Presets</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[12, 14, 16, 18, 20].map((size) => {
                    const label = size === 12 ? 'XS' : size === 14 ? 'SM' : size === 16 ? 'DF' : size === 18 ? 'LG' : 'XL';
                    const isSelected = globalFontSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setGlobalFontSize(size)}
                        className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                            : 'bg-slate-800/35 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {label} ({size}px)
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 text-[10px] text-slate-400 leading-relaxed">
                💡 <strong>Accessibility Note:</strong> Changing the root scale dynamically updates all relative text units (<code>rem</code>). This affects all parameters, sidebars, charts, menus, and details cards across the entire application interface.
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => setGlobalFontSize(16)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
