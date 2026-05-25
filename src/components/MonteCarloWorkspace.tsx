import React, { useMemo, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { AppStateInputs, LockedReturnSequence } from '../types';
import { runMonteCarloSimulation, MonteCarloSummary, generateSyntheticSequence, generateHistoricalSequence } from '../engine/monteCarloEngine';
import { runRetirementSimulation } from '../engine/simulationEngine';
import { 
  Sliders, 
  Lock, 
  Unlock, 
  RefreshCw, 
  AlertTriangle, 
  Check, 
  Info,
  ShieldCheck,
  Calendar
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MonteCarloWorkspaceProps {
  inputs: AppStateInputs;
  onChangeInputs: (newInputs: AppStateInputs) => void;
  simulateSurvivor: boolean;
  summary: MonteCarloSummary;
}

export const MonteCarloWorkspace: React.FC<MonteCarloWorkspaceProps> = ({
  inputs,
  onChangeInputs,
  simulateSurvivor,
  summary,
}) => {
  const successRate = summary.successRate;

  // Formatting helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatPercent = (val: number) => {
    return `${(val * 100).toFixed(1)}%`;
  };

  // State update helpers
  const updateSettings = (field: string, value: any) => {
    onChangeInputs({
      ...inputs,
      monteCarloSettings: {
        ...inputs.monteCarloSettings,
        [field]: value,
      },
    });
  };

  // SVG parameters for circular success rate gauge
  const radius = 70;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - successRate * circumference;

  // ChartJS Percentile setup
  const years = summary.percentiles.map(p => p.year);
  const chartData = {
    labels: years.map(String),
    datasets: [
      // 90th percentile (Best Case)
      {
        label: 'Best Case (90th Percentile)',
        data: summary.percentiles.map(p => p.p90),
        borderColor: 'rgba(16, 185, 129, 0.8)', // emerald-500
        backgroundColor: 'rgba(16, 185, 129, 0.03)',
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      },
      // 50th percentile (Median Case)
      {
        label: 'Median Case (50th Percentile)',
        data: summary.percentiles.map(p => p.p50),
        borderColor: 'rgba(59, 130, 246, 0.85)', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
      },
      // 10th percentile (Worst Case)
      {
        label: 'Worst Case (10th Percentile)',
        data: summary.percentiles.map(p => p.p10),
        borderColor: 'rgba(239, 68, 68, 0.8)', // red-500
        backgroundColor: 'rgba(239, 68, 68, 0.03)',
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#cbd5e1',
          font: { size: 10, weight: 'bold' as const },
          usePointStyle: true,
          boxWidth: 10,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: '#0f172a',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: function (context: any) {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#94a3b8', font: { size: 9 } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { 
          color: '#94a3b8', 
          font: { size: 9 },
          callback: (val: any) => `$${(val / 1000000).toFixed(1)}M`,
        },
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Top Title Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/30 p-5 rounded-2xl border border-slate-800/60">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            Workspace 4: Monte Carlo Analysis & Stress Testing
          </h3>
          <p className="text-xs text-slate-400">
            Model stock/bond return variances, run batch trial stress tests, and explore statistical probabilities of success.
          </p>
        </div>
      </div>

      {/* Main Grid: Statistics Gauge & Parameter Configuration Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Premium Circular Gauge and Stats */}
        <div className="lg:col-span-1 glass-panel rounded-2xl p-6 flex flex-col justify-between border border-slate-800 bg-slate-900/20 relative overflow-hidden">
          <div className="space-y-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Plan Health Summary</span>
            
            {/* SVG Circular Success Gauge */}
            <div className="relative flex items-center justify-center py-6">
              <svg viewBox="0 0 176 176" className="w-44 h-44 transform -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.03)"
                  strokeWidth={strokeWidth}
                />
                {/* Foreground Arc */}
                <circle
                  cx="88"
                  cy="88"
                  r={radius}
                  fill="transparent"
                  stroke={successRate > 0.75 ? '#10b981' : successRate > 0.50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              {/* Central Text */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-slate-100 font-mono tracking-tight">
                  {formatPercent(successRate)}
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                  Success Rate
                </span>
              </div>
            </div>

            {/* Micro Stats Ledger */}
            <div className="space-y-2.5 pt-4 border-t border-slate-800/40 text-xs">
              <div className="flex justify-between items-center bg-slate-950/20 p-2 rounded-lg border border-slate-800/30">
                <span className="text-slate-400">Total Trials Executed</span>
                <span className="font-mono text-slate-200 font-bold">{inputs.monteCarloSettings.trials}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/20 p-2 rounded-lg border border-slate-800/30">
                <span className="text-slate-400">Worst ending estate (P10)</span>
                <span className="font-mono text-rose-400 font-bold">{formatCurrency(summary.percentiles[summary.percentiles.length - 1].p10)}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/20 p-2 rounded-lg border border-slate-800/30">
                <span className="text-slate-400">Median ending estate (P50)</span>
                <span className="font-mono text-blue-400 font-bold">{formatCurrency(summary.percentiles[summary.percentiles.length - 1].p50)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[10px] text-slate-400 leading-normal flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              Success rate represents the percent of simulations where the joint retirement estate remained solvent (&gt; $0) through year 2060 (Age 90/86).
            </p>
          </div>
        </div>

        {/* Right Column: Dedicated Model Estimation Configuration Panel */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 bg-slate-900/20 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Model Estimation Config Panel</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mode selection and Trials */}
            <div className="space-y-4">
              {/* Simulation Mode Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Simulation Distribution Mode</span>
                  <span className="text-[10px] text-slate-500 font-mono">Select data source</span>
                </label>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => updateSettings('mode', 'monte-carlo')}
                    className={`flex-1 text-[10px] py-2 rounded-lg font-bold transition-all ${
                      inputs.monteCarloSettings.mode === 'monte-carlo'
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Bivariate Normal MC
                  </button>
                  <button
                    onClick={() => updateSettings('mode', 'historical')}
                    className={`flex-1 text-[10px] py-2 rounded-lg font-bold transition-all ${
                      inputs.monteCarloSettings.mode === 'historical'
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Historical Bootstrap
                  </button>
                </div>
              </div>

              {/* Number of Trials */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex justify-between">
                  <span>Simulated Sample Size</span>
                  <span className="text-emerald-400 font-mono font-bold">{inputs.monteCarloSettings.trials} trials</span>
                </label>
                <input
                  type="range"
                  min="200"
                  max="5000"
                  step="100"
                  value={inputs.monteCarloSettings.trials}
                  onChange={(e) => updateSettings('trials', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>200 (Draft)</span>
                  <span>1000 (Recommended)</span>
                  <span>5000 (Detailed)</span>
                </div>
              </div>

              {/* Seedable Reproducibility */}
              <div className="space-y-2 pt-3 border-t border-slate-800/40">
                <label className="text-xs font-semibold text-slate-300 flex justify-between items-center">
                  <span>Deterministic Random Seed</span>
                  <span className="text-[10px] text-slate-500 font-mono">Reproducibility</span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    id="useSeedCheckbox"
                    checked={inputs.monteCarloSettings.seed !== null}
                    onChange={(e) => {
                      const useSeed = e.target.checked;
                      updateSettings('seed', useSeed ? 42 : null);
                    }}
                    className="w-4 h-4 bg-slate-950 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="useSeedCheckbox" className="text-xs text-slate-400 cursor-pointer select-none">
                    Lock Seed Value
                  </label>
                  
                  {inputs.monteCarloSettings.seed !== null && (
                    <input
                      type="number"
                      value={inputs.monteCarloSettings.seed}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 42 : Number(e.target.value);
                        updateSettings('seed', val);
                      }}
                      className="flex-1 text-xs font-mono font-bold px-2.5 py-1 bg-slate-950 text-slate-100 border border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500"
                      placeholder="e.g. 42"
                    />
                  )}
                </div>
                <p className="text-[9px] text-slate-500 leading-normal">
                  Locking a seed value ensures simulation returns remain 100% identical on page reloads or slider edits for debugging and repeatable analysis.
                </p>
              </div>
            </div>

            {/* Volatilities and Correlations (Normal mode parameters) */}
            <div className="space-y-4">
              {inputs.monteCarloSettings.mode === 'monte-carlo' ? (
                <>
                  {/* Equity Volatility */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex justify-between">
                      <span>Equity Return Volatility (Std Dev)</span>
                      <span className="text-emerald-400 font-mono font-semibold">{formatPercent(inputs.monteCarloSettings.equityVolatility)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.05"
                      max="0.30"
                      step="0.01"
                      value={inputs.monteCarloSettings.equityVolatility}
                      onChange={(e) => updateSettings('equityVolatility', Number(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {/* Bond Volatility */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex justify-between">
                      <span>Bond Return Volatility (Std Dev)</span>
                      <span className="text-emerald-400 font-mono font-semibold">{formatPercent(inputs.monteCarloSettings.fixedIncomeVolatility)}</span>
                    </label>
                    <input
                      type="range"
                      min="0.01"
                      max="0.15"
                      step="0.01"
                      value={inputs.monteCarloSettings.fixedIncomeVolatility}
                      onChange={(e) => updateSettings('fixedIncomeVolatility', Number(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {/* Asset Correlation */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex justify-between">
                      <span>Asset Correlation Coefficient (ρ)</span>
                      <span className="text-emerald-400 font-mono font-semibold">{(inputs.monteCarloSettings.correlation).toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="-0.50"
                      max="0.80"
                      step="0.05"
                      value={inputs.monteCarloSettings.correlation}
                      onChange={(e) => updateSettings('correlation', Number(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                </>
              ) : (
                <div className="h-full bg-slate-950/40 p-4 rounded-xl border border-slate-800/40 flex flex-col justify-center text-center">
                  <Calendar className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-300">Historical Bootstrap Mode Active</span>
                  <p className="text-[10px] text-slate-400 leading-normal max-w-xs mx-auto mt-1">
                    In this mode, return parameters are bootstrap-sampled directly from actual S&P 500 and US Treasury historical data from 1970–2025. Volatilities are determined natively by history.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Percentile Trajectory Line Chart */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 bg-slate-900/20 space-y-4">
        <div>
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Ending Portfolio Estate Percentile Trajectories</h4>
          <p className="text-[10px] text-slate-400">View final estate value outcomes across the 35-year retirement horizon.</p>
        </div>

        <div className="h-96 bg-slate-950/40 rounded-xl border border-slate-800/40 p-4">
          <Chart type="line" data={chartData as any} options={chartOptions as any} />
        </div>
      </div>
    </div>
  );
};
