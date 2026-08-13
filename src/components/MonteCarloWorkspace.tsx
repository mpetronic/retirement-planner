import React, { useMemo } from 'react';
import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import { AppStateInputs } from '../types';
import { MonteCarloSummary } from '../engine/monteCarloEngine';
import { StressTestControlPanel } from './StressTestControlPanel';
import { 
  Sliders, 
  Info,
  Calendar,
  RefreshCw,
  TrendingUp,
  PieChart
} from 'lucide-react';

ChartJS.register(...registerables);

interface MonteCarloWorkspaceProps {
  inputs: AppStateInputs;
  onChangeInputs: (newInputs: AppStateInputs) => void;
  simulateSurvivor: boolean;
  summary: MonteCarloSummary;
  globalScenario: 'flat' | 'p10' | 'p50' | 'p90';
}

export const MonteCarloWorkspace: React.FC<MonteCarloWorkspaceProps> = ({
  inputs,
  onChangeInputs,
  summary,
  globalScenario,
}) => {
  const successRate = summary.successRate;

  const endingAges = useMemo(() => {
    const parseBirthYear = (dateStr: string | undefined, fallback: number): number => {
      if (!dateStr) return fallback;
      const match = dateStr.match(/^(\d{4})/);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed) && parsed > 1900 && parsed < 2100) {
          return parsed;
        }
      }
      return fallback;
    };

    const youBirthYear = parseBirthYear(inputs.you.birthDate, 1960);
    const wifeBirthYear = parseBirthYear(inputs.wife.birthDate, 1964);

    return {
      you: 2060 - youBirthYear,
      wife: 2060 - wifeBirthYear,
    };
  }, [inputs.you.birthDate, inputs.wife.birthDate]);

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

  const updateGrowthAssumptions = (field: keyof AppStateInputs['growthAssumptions'], value: number | null) => {
    onChangeInputs({
      ...inputs,
      growthAssumptions: {
        ...inputs.growthAssumptions,
        [field]: value,
      },
    });
  };

  const eqRate = inputs.growthAssumptions.equityReturnRate;
  const fiRate = inputs.growthAssumptions.fixedIncomeReturnRate;
  const preTaxEq = inputs.growthAssumptions.preTaxEquityPortion ?? 0.50;
  const taxableEq = inputs.growthAssumptions.taxableEquityPortion ?? 0.60;
  const rothEq = inputs.growthAssumptions.rothEquityPortion ?? 1.00;
  const cashYield = inputs.growthAssumptions.cashYieldRate ?? fiRate;

  const effectivePreTaxRate = preTaxEq * eqRate + (1 - preTaxEq) * fiRate;
  const effectiveTaxableRate = taxableEq * eqRate + (1 - taxableEq) * fiRate;
  const effectiveRothRate = rothEq * eqRate + (1 - rothEq) * fiRate;

  const handleRegenerate = () => {
    if (inputs.monteCarloSettings.seed !== null) {
      const newSeed = Math.floor(Math.random() * 1000000);
      updateSettings('seed', newSeed);
    } else {
      const currentNonce = inputs.monteCarloSettings.nonce || 0;
      updateSettings('nonce', currentNonce + 1);
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
  const activeEquityReturns = useMemo(() => {
    if (globalScenario === 'flat') {
      return Array(35).fill(inputs.growthAssumptions.equityReturnRate);
    }
    const seq = globalScenario === 'p10' ? summary.representativeSequences.worst
              : globalScenario === 'p90' ? summary.representativeSequences.best
              : summary.representativeSequences.median;
    return seq ? seq.equityReturns : Array(35).fill(inputs.growthAssumptions.equityReturnRate);
  }, [globalScenario, inputs.growthAssumptions.equityReturnRate, summary.representativeSequences]);

  const activeFixedIncomeReturns = useMemo(() => {
    if (globalScenario === 'flat') {
      return Array(35).fill(inputs.growthAssumptions.fixedIncomeReturnRate);
    }
    const seq = globalScenario === 'p10' ? summary.representativeSequences.worst
              : globalScenario === 'p90' ? summary.representativeSequences.best
              : summary.representativeSequences.median;
    return seq ? seq.fixedIncomeReturns : Array(35).fill(inputs.growthAssumptions.fixedIncomeReturnRate);
  }, [globalScenario, inputs.growthAssumptions.fixedIncomeReturnRate, summary.representativeSequences]);

  const stressedYearSet = useMemo(() => {
    const st = inputs.monteCarloSettings.stressTest;
    if (!st || !st.enabled || !st.overrides) return new Set<number>();
    return new Set(st.overrides.map(o => o.year));
  }, [inputs.monteCarloSettings.stressTest]);

  const barChartData = {
    labels: years.map(String),
    datasets: [
      {
        label: 'Equity (Stock) Return Rate',
        data: activeEquityReturns.map(r => Number((r * 100).toFixed(2))),
        backgroundColor: years.map(yr => stressedYearSet.has(yr) ? 'rgba(244, 63, 94, 0.85)' : 'rgba(6, 182, 212, 0.75)'),
        borderColor: years.map(yr => stressedYearSet.has(yr) ? '#f43f5e' : '#06b6d2'),
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Fixed Income (Bond) Return Rate',
        data: activeFixedIncomeReturns.map(r => Number((r * 100).toFixed(2))),
        backgroundColor: years.map(yr => stressedYearSet.has(yr) ? 'rgba(225, 29, 72, 0.85)' : 'rgba(245, 158, 11, 0.75)'),
        borderColor: years.map(yr => stressedYearSet.has(yr) ? '#e11d48' : '#f59e0b'),
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
      <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-800/60">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            Monte Carlo Analysis & Stress Testing
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
              Success rate represents the percent of simulations where the joint retirement estate remained solvent (&gt; $0) through year 2060 (Age {endingAges.you}{inputs.isSingleFiler ? '' : '/' + endingAges.wife}).
            </p>
          </div>
        </div>

        {/* Right Column: Dedicated Model Estimation Configuration Panel */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-slate-800 bg-slate-900/20 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Model Estimation Config Panel</h4>
            </div>

            <button
              id="regenerate-mc-panel-btn"
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95 group cursor-pointer"
              title="Regenerate stochastic market predictions with new random trials"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-180 transition-transform duration-500" />
              <span>Regenerate Predictions</span>
            </button>
          </div>

          {/* Section 1: Baseline Market Returns & Inflation (Expected Means) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>1. Baseline Market Returns & Inflation (Expected Means)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                Active Scenario: <strong className="text-emerald-400 uppercase">{globalScenario}</strong>
              </span>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-3">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                <span className="text-slate-200 font-semibold">How these values drive the simulation:</span> In <strong className="text-emerald-400">Flat Mode</strong>, these rates are applied as fixed, constant annual growth and inflation. In <strong className="text-emerald-400">Monte Carlo Mode</strong>, the Equity and Fixed Income rates form the <strong className="text-slate-200">expected distribution center (means)</strong> around which 1,000 randomized annual trials fluctuate based on your volatility settings. In <strong className="text-emerald-400">Historical Bootstrap Mode</strong>, market returns sample from 1970–2025 history.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* Equity Return Rate */}
                <div className="space-y-1.5 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Equity Return (Mean)</label>
                  <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-200">
                    <span>Rate:</span>
                    <span className="text-emerald-400">{formatPercent(inputs.growthAssumptions.equityReturnRate)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.00"
                    max="0.15"
                    step="0.005"
                    value={inputs.growthAssumptions.equityReturnRate}
                    onChange={(e) => updateGrowthAssumptions('equityReturnRate', Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Fixed Income Return Rate */}
                <div className="space-y-1.5 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Fixed Income (Mean)</label>
                  <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-200">
                    <span>Rate:</span>
                    <span className="text-emerald-400">{formatPercent(inputs.growthAssumptions.fixedIncomeReturnRate)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.00"
                    max="0.10"
                    step="0.005"
                    value={inputs.growthAssumptions.fixedIncomeReturnRate}
                    onChange={(e) => updateGrowthAssumptions('fixedIncomeReturnRate', Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* CPI Inflation Rate */}
                <div className="space-y-1.5 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">CPI Inflation</label>
                  <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-200">
                    <span>Rate:</span>
                    <span className="text-emerald-400">{formatPercent(inputs.growthAssumptions.cpiInflationRate)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.00"
                    max="0.08"
                    step="0.002"
                    value={inputs.growthAssumptions.cpiInflationRate}
                    onChange={(e) => updateGrowthAssumptions('cpiInflationRate', Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Healthcare Inflation Rate */}
                <div className="space-y-1.5 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Healthcare Inflation</label>
                  <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-200">
                    <span>Rate:</span>
                    <span className="text-emerald-400">{formatPercent(inputs.growthAssumptions.healthcareInflationRate)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.00"
                    max="0.10"
                    step="0.005"
                    value={inputs.growthAssumptions.healthcareInflationRate}
                    onChange={(e) => updateGrowthAssumptions('healthcareInflationRate', Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Account Asset Allocations & Live Effective Rates */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                <span>2. Account Asset Allocations & Effective Growth Rates</span>
              </label>
              <span className="text-[10px] text-slate-500">
                Adjust stock/bond mix per account
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Pre-Tax Traditional IRA */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-200">Pre-Tax IRA</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {formatPercent(effectivePreTaxRate)} mean
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>{Math.round(preTaxEq * 100)}% Stocks</span>
                  <span>{Math.round((1 - preTaxEq) * 100)}% Bonds</span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="1.00"
                  step="0.05"
                  value={preTaxEq}
                  onChange={(e) => updateGrowthAssumptions('preTaxEquityPortion', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Taxable Brokerage */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-200">Taxable Brokerage</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {formatPercent(effectiveTaxableRate)} mean
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>{Math.round(taxableEq * 100)}% Stocks</span>
                  <span>{Math.round((1 - taxableEq) * 100)}% Bonds</span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="1.00"
                  step="0.05"
                  value={taxableEq}
                  onChange={(e) => updateGrowthAssumptions('taxableEquityPortion', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Roth IRA */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-200">Roth IRA</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {formatPercent(effectiveRothRate)} mean
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>{Math.round(rothEq * 100)}% Stocks</span>
                  <span>{Math.round((1 - rothEq) * 100)}% Bonds</span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="1.00"
                  step="0.05"
                  value={rothEq}
                  onChange={(e) => updateGrowthAssumptions('rothEquityPortion', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Cash Savings Yield */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-200">Cash Savings</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {formatPercent(cashYield)} yield
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>{inputs.growthAssumptions.cashYieldRate !== null && inputs.growthAssumptions.cashYieldRate !== undefined ? 'Custom' : 'Matches Bonds'}</span>
                  <span>{formatPercent(cashYield)}</span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="0.08"
                  step="0.005"
                  value={cashYield}
                  onChange={(e) => updateGrowthAssumptions('cashYieldRate', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Volatility, Correlation & Simulation Parameters */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>3. Monte Carlo Volatility, Correlation & Sampling</span>
              </label>
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
                    max="10000"
                    step="100"
                    value={inputs.monteCarloSettings.trials}
                    onChange={(e) => updateSettings('trials', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>200 (Draft)</span>
                    <span>1000 (Recommended)</span>
                    <span>10000 (High Precision)</span>
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
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="number"
                          value={inputs.monteCarloSettings.seed}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 42 : Number(e.target.value);
                            updateSettings('seed', val);
                          }}
                          className="w-full text-xs font-mono font-bold px-2.5 py-1 bg-slate-950 text-slate-100 border border-slate-800 rounded-lg focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. 42"
                        />
                        <button
                          type="button"
                          onClick={handleRegenerate}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700 rounded-lg transition-colors cursor-pointer group"
                          title="Randomize seed value and regenerate"
                        >
                          <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                        </button>
                      </div>
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

          {/* Section 4: Inflation (CPI) Simulation Modeling */}
          <div className="pt-4 border-t border-slate-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <span>4. Inflation (CPI) Simulation Modeling</span>
              </label>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                inputs.monteCarloSettings.randomizeCPI !== false
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                {inputs.monteCarloSettings.randomizeCPI !== false ? 'Stochastic (Randomized)' : 'Constant (Advisor Alignment)'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="randomizeCpiCheckbox"
                checked={inputs.monteCarloSettings.randomizeCPI !== false}
                onChange={(e) => {
                  const randomize = e.target.checked;
                  onChangeInputs({
                    ...inputs,
                    monteCarloSettings: {
                      ...inputs.monteCarloSettings,
                      randomizeCPI: randomize,
                      constantCPIRate: randomize
                        ? inputs.monteCarloSettings.constantCPIRate
                        : (inputs.monteCarloSettings.constantCPIRate ?? inputs.growthAssumptions.cpiInflationRate),
                    },
                  });
                }}
                className="w-4 h-4 bg-slate-950 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
              />
              <label htmlFor="randomizeCpiCheckbox" className="text-xs text-slate-300 cursor-pointer select-none font-medium">
                Randomize Annual CPI Across Trials (Co-sample from 1970–2025 History)
              </label>
            </div>

            {inputs.monteCarloSettings.randomizeCPI !== false ? (
              <p className="text-[10px] text-slate-500 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40">
                <span className="text-slate-400 font-semibold">Stochastic Mode:</span> Annual inflation varies each trial by sampling historical year-over-year CPI changes centered around your configured baseline ({formatPercent(inputs.growthAssumptions.cpiInflationRate)}). This stresses retirement cashflows with historical inflation shocks.
              </p>
            ) : (
              <div className="p-3 bg-slate-950/60 rounded-xl border border-amber-500/30 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-semibold">Constant Annual Inflation Rate (CPI):</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {formatPercent(inputs.monteCarloSettings.constantCPIRate ?? inputs.growthAssumptions.cpiInflationRate)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.00"
                    max="0.08"
                    step="0.002"
                    value={inputs.monteCarloSettings.constantCPIRate ?? inputs.growthAssumptions.cpiInflationRate}
                    onChange={(e) => updateSettings('constantCPIRate', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="w-24">
                    <input
                      type="number"
                      min="0"
                      max="15"
                      step="0.1"
                      value={Number(((inputs.monteCarloSettings.constantCPIRate ?? inputs.growthAssumptions.cpiInflationRate) * 100).toFixed(2))}
                      onChange={(e) => updateSettings('constantCPIRate', Number(e.target.value) / 100)}
                      className="w-full text-xs font-mono font-bold px-2 py-1 bg-slate-900 text-amber-300 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-500 text-right"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-mono">%</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  <span className="text-amber-400 font-semibold">Deterministic Constant CPI:</span> Inflation is fixed at exactly {formatPercent(inputs.monteCarloSettings.constantCPIRate ?? inputs.growthAssumptions.cpiInflationRate)}/year across every trial and year. This matches the standard convention of financial advisor software (e.g. eMoney, RightCapital, MoneyGuidePro).
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Sequence of Returns Risk & Stress Testing Panel */}
      <StressTestControlPanel inputs={inputs} onChangeInputs={onChangeInputs} />

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

      {/* Annual Selected Return Rates Bar Chart */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 bg-slate-900/20 space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              {globalScenario === 'flat' ? 'Deterministic Flat Return Rates Baseline' : 'Stochastic Simulated Return Rates Sequence'}
            </h4>
            <p className="text-[10px] text-slate-400">
              {globalScenario === 'flat'
                ? 'Showing the baseline flat equity and fixed income return rates currently configured for the deterministic scenario.'
                : 'View the specific stock (Equity) and bond (Fixed Income) return rates simulated for each year of the selected path.'
              }
            </p>
          </div>
        </div>

        <div className="h-72 bg-slate-950/40 rounded-xl border border-slate-800/40 p-4">
          <Chart type="bar" data={barChartData as any} options={barChartOptions as any} />
        </div>
      </div>
    </div>
  );
};
