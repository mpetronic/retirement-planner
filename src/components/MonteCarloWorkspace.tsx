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
}

export const MonteCarloWorkspace: React.FC<MonteCarloWorkspaceProps> = ({
  inputs,
  onChangeInputs,
  simulateSurvivor,
}) => {
  // Confirmation modal states
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [pendingSequence, setPendingSequence] = useState<LockedReturnSequence | null>(null);


  // Trigger reactive batch Monte Carlo simulation on parameter changes
  const summary: MonteCarloSummary = useMemo(() => {
    return runMonteCarloSimulation(inputs, simulateSurvivor);
  }, [inputs, simulateSurvivor]);

  const successRate = summary.successRate;
  const isLocked = inputs.lockedReturnSequence !== null;

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

  // Model actions
  const triggerGenerateSequence = () => {
    const mode = inputs.monteCarloSettings.mode;
    let sequence: Omit<LockedReturnSequence, 'id'>;
    
    if (mode === 'historical') {
      // Historical bootstrap path
      // Random year sampling with modern block segment inclusion
      const block = Math.random() < 0.40;
      sequence = generateHistoricalSequence(block);
    } else {
      // Bivariate normal path
      sequence = generateSyntheticSequence(
        inputs.growthAssumptions.equityReturnRate,
        inputs.monteCarloSettings.equityVolatility,
        inputs.growthAssumptions.fixedIncomeReturnRate,
        inputs.monteCarloSettings.fixedIncomeVolatility,
        inputs.monteCarloSettings.correlation
      );
    }


    const newSeq: LockedReturnSequence = {
      ...sequence,
      id: `${mode}_locked_${Date.now()}`,
    };

    if (isLocked) {
      setPendingSequence(newSeq);
      setShowRegenConfirm(true);
    } else {
      applyLockedSequence(newSeq);
    }
  };

  const applyLockedSequence = (seq: LockedReturnSequence) => {
    onChangeInputs({
      ...inputs,
      lockedReturnSequence: seq,
    });
  };

  const handleUnlock = () => {
    onChangeInputs({
      ...inputs,
      lockedReturnSequence: null,
    });
  };

  const requestLockPreset = (type: 'worst' | 'median' | 'best') => {
    const seq = type === 'worst' ? summary.representativeSequences.worst 
              : type === 'median' ? summary.representativeSequences.median 
              : summary.representativeSequences.best;
              
    const nextSeq: LockedReturnSequence = {
      ...seq,
      id: `${type}_preset_locked_${Date.now()}`,
    };

    if (isLocked) {
      setPendingSequence(nextSeq);
      setShowRegenConfirm(true);
    } else {
      applyLockedSequence(nextSeq);
    }
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
      // If sequence is active, draw it bold and high-contrast
      ...(isLocked && inputs.lockedReturnSequence ? [{
        label: `Active Locked Return Path (${inputs.lockedReturnSequence.mode === 'historical' ? 'Historical' : 'Synthetic'})`,
        data: runRetirementSimulation(inputs, simulateSurvivor).map(r => r.totalPortfolioValue),
        borderColor: '#f59e0b', // amber-500
        borderWidth: 3.5,
        borderDash: [],
        pointRadius: 2,
        pointBackgroundColor: '#f59e0b',
        fill: false,
      }] : []),
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

  // Return rates dataset preparation
  const activeEquityReturns = inputs.lockedReturnSequence 
    ? inputs.lockedReturnSequence.equityReturns 
    : Array(35).fill(inputs.growthAssumptions.equityReturnRate);
    
  const activeFixedIncomeReturns = inputs.lockedReturnSequence 
    ? inputs.lockedReturnSequence.fixedIncomeReturns 
    : Array(35).fill(inputs.growthAssumptions.fixedIncomeReturnRate);

  const barChartData = {
    labels: years.map(String),
    datasets: [
      {
        label: 'Equity (Stock) Return Rate',
        data: activeEquityReturns.map(r => Number((r * 100).toFixed(2))),
        backgroundColor: 'rgba(6, 182, 212, 0.75)', // cyan-500 matching workspace 1 draws
        borderColor: '#06b6d2',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Fixed Income (Bond) Return Rate',
        data: activeFixedIncomeReturns.map(r => Number((r * 100).toFixed(2))),
        backgroundColor: 'rgba(245, 158, 11, 0.75)', // amber-500 matching workspace 1 traditional draws
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 4,
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#cbd5e1',
          font: { size: 10, weight: 'bold' as const },
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              const sign = context.parsed.y >= 0 ? '+' : '';
              label += sign + context.parsed.y.toFixed(2) + '%';
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: '#94a3b8', font: { size: 9 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 9 },
          callback: (val: any) => {
            const sign = val >= 0 ? '+' : '';
            return sign + val + '%';
          }
        }
      }
    }
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
            Model stock/bond return variances, run batch trial stress tests, and lock in stochastic return paths.
          </p>
        </div>
        
        {/* Lock/Unlock Status Badge */}
        {isLocked ? (
          <div className="flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold animate-pulse">
            <Lock className="w-3.5 h-3.5" />
            Locked Stochastic Baseline Active
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold">
            <Unlock className="w-3.5 h-3.5" />
            Deterministic Baseline Active (Flat Returns)
          </div>
        )}
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

      {/* Baseline Locking & Stress Test Presets Panel */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 bg-slate-900/20 space-y-6">
        <div>
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Sequence Lock-in & Stress Test Action Deck
          </h4>
          <p className="text-[10px] text-slate-400">Generate a variable returns path and lock it in as the baseline, or import key percentile profiles to stress test sliders.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Action 1: Standard Generation */}
          <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Custom Path Generator</span>
              <p className="text-[10px] text-slate-500 leading-normal">
                Draws a new unique sequence of annual returns based on selected mode.
              </p>
            </div>
            <button
              onClick={triggerGenerateSequence}
              className="w-full text-[10px] py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {isLocked ? 'Regenerate Returns' : 'Generate & Lock Path'}
            </button>
          </div>

          {/* Action 2: Worst Case Stress Test */}
          <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl flex flex-col justify-between gap-4 border-l-4 border-l-rose-500/50">
            <div className="space-y-1">
              <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Stress Test: P10 Worst Case</span>
              <p className="text-[10px] text-slate-500 leading-normal">
                Imports the return sequence from the trial that landed exactly on the 10th percentile outcome.
              </p>
            </div>
            <button
              onClick={() => requestLockPreset('worst')}
              className="w-full text-[10px] py-2 bg-rose-950/50 hover:bg-rose-900 border border-rose-800/40 text-rose-200 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              Lock 10th Percentile Run
            </button>
          </div>

          {/* Action 3: Median Case Stress Test */}
          <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl flex flex-col justify-between gap-4 border-l-4 border-l-blue-500/50">
            <div className="space-y-1">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">Benchmark: P50 Median Case</span>
              <p className="text-[10px] text-slate-500 leading-normal">
                Imports the return sequence from the trial that landed on the 50th percentile (median) outcome.
              </p>
            </div>
            <button
              onClick={() => requestLockPreset('median')}
              className="w-full text-[10px] py-2 bg-blue-950/50 hover:bg-blue-900 border border-blue-800/40 text-blue-200 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              Lock Median 50th Run
            </button>
          </div>

          {/* Action 4: Unlock Return sequence */}
          <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl flex flex-col justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Reset Baseline</span>
              <p className="text-[10px] text-slate-500 leading-normal">
                Removes variables sequence paths and restores flat expected return percentages across all timelines.
              </p>
            </div>
            <button
              onClick={handleUnlock}
              disabled={!isLocked}
              className="w-full text-[10px] py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 font-bold rounded-lg border border-slate-700/60 transition-colors flex items-center justify-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              Reset Flat Returns
            </button>
          </div>

        </div>

        {/* Display Details of Active Locked Return sequence */}
        {isLocked && inputs.lockedReturnSequence && (
          <div className="bg-slate-950/60 border border-amber-500/20 p-4 rounded-xl space-y-3">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block font-mono flex items-center gap-1.5">
              <Info className="w-4 h-4" />
              Locked Return Path Detailed Analytics
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/60">
                <span className="text-[9px] text-slate-500 block">Generator Source</span>
                <span className="text-slate-200 font-bold uppercase">{inputs.lockedReturnSequence.mode}</span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/60">
                <span className="text-[9px] text-slate-500 block">Avg Locked Stock Return</span>
                <span className="text-emerald-400 font-bold">
                  {formatPercent(inputs.lockedReturnSequence.equityReturns.reduce((sum, r) => sum + r, 0) / 35)}
                </span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/60">
                <span className="text-[9px] text-slate-500 block">Avg Locked Bond Return</span>
                <span className="text-emerald-400 font-bold">
                  {formatPercent(inputs.lockedReturnSequence.fixedIncomeReturns.reduce((sum, r) => sum + r, 0) / 35)}
                </span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/60">
                <span className="text-[9px] text-slate-500 block">Min Stock Return</span>
                <span className="text-rose-400 font-bold">
                  {formatPercent(Math.min(...inputs.lockedReturnSequence.equityReturns))}
                </span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/60">
                <span className="text-[9px] text-slate-500 block">Max Stock Return</span>
                <span className="text-emerald-400 font-bold">
                  {formatPercent(Math.max(...inputs.lockedReturnSequence.equityReturns))}
                </span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/60 col-span-2 sm:col-span-1">
                <span className="text-[9px] text-slate-500 block">Deficit Years (Yields &lt; 0%)</span>
                <span className="text-amber-400 font-bold">
                  {inputs.lockedReturnSequence.equityReturns.filter(r => r < 0).length} of 35
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Annual Selected Return Rates Bar Chart */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 bg-slate-900/20 space-y-4">
        <div>
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            {isLocked ? 'Stochastic Locked Return Rates Sequence' : 'Deterministic Flat Return Rates Baseline'}
          </h4>
          <p className="text-[10px] text-slate-400">
            {isLocked 
              ? 'View the specific stock (Equity) and bond (Fixed Income) return rates selected for each year of this locked return path.'
              : 'Showing the baseline flat equity and fixed income return rates currently configured for the deterministic scenario.'
            }
          </p>
        </div>

        <div className="h-72 bg-slate-950/40 rounded-xl border border-slate-800/40 p-4">
          <Chart type="bar" data={barChartData as any} options={barChartOptions as any} />
        </div>
      </div>

      {/* Confirmation Modal: Regeneration / Lock Confirmation */}
      {showRegenConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel backdrop-blur-xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-100 tracking-tight">Regenerate Baseline Sequence?</h4>
                <p className="text-[10px] text-slate-400 font-mono">Warning: Destination rewrite request</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
              You are about to overwrite your active locked return sequence baseline. Overwriting this return schedule will immediately recalculate all taxes, Medicare premiums, RMD drawdowns, and net estate statistics on your dynamic workspaces.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowRegenConfirm(false);
                  setPendingSequence(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all"
              >
                Cancel Keep Current
              </button>
              <button
                onClick={() => {
                  if (pendingSequence) {
                    applyLockedSequence(pendingSequence);
                  }
                  setShowRegenConfirm(false);
                  setPendingSequence(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-lg transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Confirm Overwrite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
