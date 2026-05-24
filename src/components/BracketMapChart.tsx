import React, { useMemo, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { SimulationResultRow, AppStateInputs } from '../types';
import { Award, Zap, Check, X, AlertCircle } from 'lucide-react';
import { optimizeRetirementScenario, OptimizationResult, OptimizationGoal } from '../engine/optimizer';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface BracketMapChartProps {
  ledger: SimulationResultRow[];
  inputs: AppStateInputs;
  simulateSurvivor: boolean;
  onApplyOptimization: (annualConversion: number, targetValue: number | null, yourAge: number, wifeAge: number) => void;
  onUpdateStrategy: (strategy: 'flat' | 'fill-to-target') => void;
  onUpdateTargetValue: (val: number | null) => void;
}

export const BracketMapChart: React.FC<BracketMapChartProps> = ({
  ledger,
  inputs,
  simulateSurvivor,
  onApplyOptimization,
  onUpdateStrategy,
  onUpdateTargetValue,
}) => {
  const [selectedQuickFill, setSelectedQuickFill] = useState<number | null>(null);
  
  // Optimizer visual state hooks
  const [optimizingGoal, setOptimizingGoal] = useState<OptimizationGoal | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [showOptimizerModal, setShowOptimizerModal] = useState(false);
  const [isOptimizingScan, setIsOptimizingScan] = useState(false);

  const years = useMemo(() => ledger.map((r) => r.year), [ledger]);

  // Extract stack components
  const ssIncomes = useMemo(() => ledger.map((r) => r.yourSS + r.wifeSS), [ledger]);
  const rmds = useMemo(() => ledger.map((r) => r.yourRMD + r.wifeRMD), [ledger]);
  const rothConversions = useMemo(() => ledger.map((r) => r.intentionalRothConversion), [ledger]);
  const activeSalaries = useMemo(() => ledger.map((r) => (r.yourSalary || 0) + (r.wifeSalary || 0)), [ledger]);

  // Dynamic selected quick-fill guideline line calculator
  const quickFillLineData = useMemo(() => {
    const activeTarget = selectedQuickFill || (inputs.rothConversionStrategy === 'fill-to-target' ? inputs.rothConversionTargetValue : null);
    if (!activeTarget) return null;

    let jointBase = 0;
    let singleBase = 0;
    let label = '';
    let color = 'rgba(16, 185, 129, 0.9)'; // default emerald

    switch (activeTarget) {
      case 57000:
        jointBase = 57000; singleBase = 28500; label = "Top of 10% Fed Bracket"; color = 'rgba(244, 63, 94, 0.9)';
        break;
      case 133000:
        jointBase = 133000; singleBase = 66500; label = "Top of 12% Fed Bracket"; color = 'rgba(244, 63, 94, 0.9)';
        break;
      case 243600:
        jointBase = 243600; singleBase = 121800; label = "Top of 22% Fed Bracket"; color = 'rgba(249, 115, 22, 0.9)';
        break;
      case 435750:
        jointBase = 435750; singleBase = 217875; label = "Top of 24% Fed Bracket"; color = 'rgba(236, 72, 153, 0.9)';
        break;
      case 544650:
        jointBase = 544650; singleBase = 272325; label = "Top of 32% Fed Bracket"; color = 'rgba(168, 85, 247, 0.9)';
        break;
      case 800900:
        jointBase = 800900; singleBase = 656700; label = "Top of 35% Fed Bracket"; color = 'rgba(239, 68, 68, 0.9)';
        break;
      case 217999:
      case 218000:
        jointBase = 218000; singleBase = 109000; label = "IRMAA Tier 1 Cliff"; color = 'rgba(16, 185, 129, 0.9)';
        break;
      case 273999:
      case 274000:
        jointBase = 274000; singleBase = 137000; label = "IRMAA Tier 2 Cliff"; color = 'rgba(245, 158, 11, 0.9)';
        break;
      case 341999:
      case 342000:
        jointBase = 342000; singleBase = 171000; label = "IRMAA Tier 3 Cliff"; color = 'rgba(59, 130, 246, 0.9)';
        break;
      case 409999:
      case 410000:
        jointBase = 410000; singleBase = 205000; label = "IRMAA Tier 4 Cliff"; color = 'rgba(236, 72, 153, 0.9)';
        break;
      case 749999:
      case 750000:
        jointBase = 750000; singleBase = 375000; label = "IRMAA Tier 5 Cliff"; color = 'rgba(239, 68, 68, 0.9)';
        break;
      default:
        // Draw custom guideline
        jointBase = activeTarget;
        singleBase = activeTarget / 2;
        label = `Target MAGI Limit ($${activeTarget.toLocaleString()})`;
        color = 'rgba(14, 165, 233, 0.9)'; // sky-500
        break;
    }

    const dataPoints = ledger.map((r) => {
      const isSingle = simulateSurvivor && r.year >= 2045;
      const baseVal = isSingle ? singleBase : jointBase;
      const cpiFactor = r.standardDeduction / (isSingle ? 16100 : 32200);
      return baseVal * cpiFactor;
    });

    return { label, color, data: dataPoints };
  }, [selectedQuickFill, ledger, simulateSurvivor]);

  const chartData = useMemo(() => {
    const datasets: any[] = [
      {
        label: 'Active Salaries',
        data: activeSalaries,
        backgroundColor: 'rgba(139, 92, 246, 0.65)', // violet-500 @ 65% opacity
        stack: 'income',
        order: 6,
        pointStyle: 'rect',
      },
      {
        label: 'Social Security',
        data: ssIncomes,
        backgroundColor: 'rgba(59, 130, 246, 0.65)', // blue-500 @ 65% opacity
        stack: 'income',
        order: 5,
        pointStyle: 'rect',
      },
      {
        label: 'Forced RMDs',
        data: rmds,
        backgroundColor: 'rgba(245, 158, 11, 0.65)', // amber-500 @ 65% opacity
        stack: 'income',
        order: 4,
        pointStyle: 'rect',
      },
      {
        label: 'Taxable Draws',
        data: ledger.map((r) => r.drawdownTaxable),
        backgroundColor: 'rgba(239, 68, 68, 0.7)', // red-500 representing taxable brokerage liquidations
        stack: 'income',
        order: 3.5,
        pointStyle: 'rect',
      },
      {
        label: 'Pre-Tax Draws',
        data: ledger.map((r) => r.drawdownPreTax),
        backgroundColor: 'rgba(217, 70, 239, 0.7)', // fuchsia-500 representing IRA ordinary income liquidations
        stack: 'income',
        order: 3,
        pointStyle: 'rect',
      },
      {
        label: 'Roth Draws',
        data: ledger.map((r) => r.drawdownRoth),
        backgroundColor: 'rgba(52, 211, 153, 0.75)', // emerald-400 representing tax-free Roth draws
        stack: 'income',
        order: 2,
        pointStyle: 'rect',
      },
      {
        label: 'Roth Conversions',
        data: rothConversions,
        backgroundColor: 'rgba(16, 185, 129, 0.65)', // emerald-500 @ 65% opacity
        stack: 'income',
        order: 1,
        pointStyle: 'rect',
      },
      // BOLD Line for Portfolio Value at all times on secondary Y-axis
      {
        label: 'Total Net Estate (Portfolio)',
        data: ledger.map((r) => r.totalPortfolioValue),
        type: 'line' as const,
        borderColor: '#10b981', // emerald-500
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
        fill: false,
        yAxisID: 'yPortfolio',
        order: -1,
        pointStyle: 'circle',
        stack: 'line-portfolio',
      },
      // BOLD Line for Base Living Expenses on primary Y-axis
      {
        label: 'Base Living Expenses',
        data: ledger.map((r) => r.livingExpenses),
        type: 'line' as const,
        borderColor: '#f43f5e', // rose-500 representing expenses/outflows
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 4,
        fill: false,
        yAxisID: 'y',
        order: -2,
        pointStyle: 'triangle',
        stack: 'line-expenses',
      }
    ];

    // If a quick-fill is selected, show only the line related to it
    if (quickFillLineData) {
      datasets.push({
        label: quickFillLineData.label,
        data: quickFillLineData.data,
        type: 'line' as const,
        borderColor: quickFillLineData.color,
        borderWidth: 2.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        order: 0,
        pointStyle: 'line',
        stack: 'line-quickfill',
      });
    }

    return {
      labels: years.map(String),
      datasets,
    };
  }, [years, activeSalaries, ssIncomes, rmds, rothConversions, ledger, quickFillLineData]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: true,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            color: '#cbd5e1', // slate-300
            font: {
              size: 11,
            },
            boxWidth: 15,
            usePointStyle: true,
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: '#0f172a',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function (context: any) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(context.parsed.y);
              }
              return label;
            },
            footer: function (tooltipItems: any[]) {
              let sum = 0;
              tooltipItems.forEach((item) => {
                if (item.dataset.stack === 'income') {
                  sum += item.parsed.y || 0;
                }
              });
              if (sum > 0) {
                return '\nTotal Stacked Income: ' + new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(sum);
              }
              return '';
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: {
            color: 'rgba(255,255,255,0.04)',
          },
          ticks: {
            color: '#94a3b8',
            font: {
              size: 10,
            },
          },
        },
        y: {
          stacked: true,
          grid: {
            color: 'rgba(255,255,255,0.04)',
          },
          ticks: {
            color: '#94a3b8',
            font: {
              size: 10,
            },
            callback: function (value: any) {
              return '$' + (value / 1000) + 'k';
            },
          },
          title: {
            display: true,
            text: 'Annual Inflows / Brackets',
            color: '#94a3b8',
            font: { size: 10, weight: 'bold' }
          }
        },
        yPortfolio: {
          type: 'linear' as const,
          position: 'right' as const,
          grid: {
            drawOnChartArea: false, // don't draw gridlines from this scale on main area
          },
          ticks: {
            color: '#10b981',
            font: {
              size: 10,
            },
            callback: function (value: any) {
              return '$' + (value / 1000000).toFixed(1) + 'M';
            },
          },
          title: {
            display: true,
            text: 'Portfolio Net Estate',
            color: '#10b981',
            font: { size: 10, weight: 'bold' }
          }
        }
      },
    };
  }, [ssIncomes, rmds, activeSalaries]);

  // Optimizer metrics and helper functions
  const currentEndingEstate = ledger[ledger.length - 1]?.totalPortfolioValue || 0;
  const currentLifetimeTaxes = ledger.reduce((sum, r) => sum + r.totalIncomeTax, 0);
  const currentLifetimeIRMAA = ledger.reduce((sum, r) => sum + r.combinedSurchargeAnnual, 0);
  const currentEndingRoth = (ledger[ledger.length - 1]?.endYourRothIRA || 0) + (ledger[ledger.length - 1]?.endWifeRothIRA || 0);

  const getGoalTitle = (goal: OptimizationGoal) => {
    switch (goal) {
      case 'min_taxes':
        return 'Optimize for Minimum Taxes 🎯';
      case 'max_portfolio':
        return 'Optimize for Maximum Portfolio 🎯';
      case 'min_surcharges':
        return 'Optimize for Minimum Surcharges 🎯';
      case 'max_roth':
        return 'Optimize for Maximum Roth Value 🎯';
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const renderVarianceBadge = (current: number, optimal: number, type: 'higher-is-better' | 'lower-is-better') => {
    const diff = optimal - current;
    if (Math.abs(diff) < 1) {
      return <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-mono font-semibold">No Change</span>;
    }
    
    const isGood = type === 'higher-is-better' ? diff > 0 : diff < 0;
    const formattedDiff = formatCurrency(Math.abs(diff));
    const sign = diff > 0 ? '+' : '-';
    const label = type === 'higher-is-better' ? (diff > 0 ? 'Gained' : 'Reduced') : (diff < 0 ? 'Saved' : 'Increased');
    
    return (
      <span className={`text-xs px-2.5 py-1 rounded-full font-mono font-semibold flex items-center gap-1 ${
        isGood 
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
      }`}>
        {isGood ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
        {sign}{formattedDiff} {label}
      </span>
    );
  };

  const renderOptimizerModal = () => {
    if (!showOptimizerModal || !optimizingGoal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
        <div className="w-full max-w-2xl bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel backdrop-blur-xl transition-all duration-300 transform scale-100 flex flex-col max-h-[90vh]">
          
          {/* Modal Header */}
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Zap className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-100 tracking-tight">
                  {getGoalTitle(optimizingGoal)}
                </h3>
                <p className="text-xs text-slate-400">
                  Multidimensional pure-function scenario engine projection
                </p>
              </div>
            </div>
            {!isOptimizingScan && (
              <button 
                onClick={() => setShowOptimizerModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            {isOptimizingScan ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                  <Zap className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-black text-slate-100 tracking-tight animate-pulse">Running Simulation Sweeps...</p>
                  <p className="text-xs text-slate-400 font-mono">Sweeping 4,941 discrete scenario parameters...</p>
                </div>
              </div>
            ) : optimizationResult ? (
              <div className="space-y-6">
                
                {/* Configuration Comparisons */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Optimal Parameter Set</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Roth Conversion */}
                    <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Annual Roth Conversion</span>
                      <div className="flex justify-between items-baseline font-mono">
                        <span className="text-xs text-slate-400 line-through">{formatCurrency(inputs.annualRothConversion)}</span>
                        <span className="text-base font-black text-emerald-400">{formatCurrency(optimizationResult.bestAnnualRothConversion)}</span>
                      </div>
                    </div>
                    {/* Your Claiming Age */}
                    <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Your Claiming Age</span>
                      <div className="flex justify-between items-baseline font-mono font-black text-emerald-400">
                        <span className="text-xs text-slate-400 line-through font-normal">Age {inputs.you.targetSSClaimingAge}</span>
                        <span className="text-base">Age {optimizationResult.bestYourSSAge}</span>
                      </div>
                    </div>
                    {/* Spouse Claiming Age */}
                    <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-xl space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Spouse Claiming Age</span>
                      <div className="flex justify-between items-baseline font-mono font-black text-emerald-400">
                        <span className="text-xs text-slate-400 line-through font-normal">Age {inputs.wife.targetSSClaimingAge}</span>
                        <span className="text-base">Age {optimizationResult.bestWifeSSAge}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Outcome Metrics Grid */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comparative Projections</h4>
                  <div className="space-y-3">
                    
                    {/* Metric 1: Ending Net Estate */}
                    <div className="bg-slate-950/20 border border-slate-800/40 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200">Ending Net Estate (Age 90)</span>
                        <span className="text-[10px] text-slate-500 block">Total wealth remaining in portfolio at simulation end</span>
                      </div>
                      <div className="flex items-center gap-4 justify-between sm:justify-end">
                        <div className="flex items-baseline gap-2 font-mono">
                          <span className="text-xs text-slate-500">{formatCurrency(currentEndingEstate)}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-sm font-black text-emerald-400">{formatCurrency(optimizationResult.details.endingEstate)}</span>
                        </div>
                        {renderVarianceBadge(currentEndingEstate, optimizationResult.details.endingEstate, 'higher-is-better')}
                      </div>
                    </div>

                    {/* Metric 2: Lifetime Taxes */}
                    <div className="bg-slate-950/20 border border-slate-800/40 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200">Lifetime Income Taxes Paid</span>
                        <span className="text-[10px] text-slate-500 block">Total federal + state income taxes paid across 35 years</span>
                      </div>
                      <div className="flex items-center gap-4 justify-between sm:justify-end">
                        <div className="flex items-baseline gap-2 font-mono">
                          <span className="text-xs text-slate-500">{formatCurrency(currentLifetimeTaxes)}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-sm font-black text-rose-400">{formatCurrency(optimizationResult.details.lifetimeTaxes)}</span>
                        </div>
                        {renderVarianceBadge(currentLifetimeTaxes, optimizationResult.details.lifetimeTaxes, 'lower-is-better')}
                      </div>
                    </div>

                    {/* Metric 3: Medicare Surcharges */}
                    <div className="bg-slate-950/20 border border-slate-800/40 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200">Lifetime Medicare IRMAA Surcharges</span>
                        <span className="text-[10px] text-slate-500 block">Total IRMAA premium surcharges based on lookback MAGI</span>
                      </div>
                      <div className="flex items-center gap-4 justify-between sm:justify-end">
                        <div className="flex items-baseline gap-2 font-mono">
                          <span className="text-xs text-slate-500">{formatCurrency(currentLifetimeIRMAA)}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-sm font-black text-amber-400">{formatCurrency(optimizationResult.details.lifetimeIRMAA)}</span>
                        </div>
                        {renderVarianceBadge(currentLifetimeIRMAA, optimizationResult.details.lifetimeIRMAA, 'lower-is-better')}
                      </div>
                    </div>

                    {/* Metric 4: Ending Roth Value */}
                    <div className="bg-slate-950/20 border border-slate-800/40 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-200">Ending Roth Balances</span>
                        <span className="text-[10px] text-slate-500 block">Total tax-free Roth wealth at simulation end</span>
                      </div>
                      <div className="flex items-center gap-4 justify-between sm:justify-end">
                        <div className="flex items-baseline gap-2 font-mono">
                          <span className="text-xs text-slate-500">{formatCurrency(currentEndingRoth)}</span>
                          <span className="text-slate-400">→</span>
                          <span className="text-sm font-black text-emerald-400">{formatCurrency(optimizationResult.details.endingRoth)}</span>
                        </div>
                        {renderVarianceBadge(currentEndingRoth, optimizationResult.details.endingRoth, 'higher-is-better')}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            ) : null}
          </div>

          {/* Modal Footer */}
          {!isOptimizingScan && optimizationResult && (
            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3 z-10">
              <button
                onClick={() => setShowOptimizerModal(false)}
                className="px-5 py-2.5 text-xs font-bold text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all"
              >
                Dismiss / Keep Current
              </button>
              <button
                onClick={() => {
                  onApplyOptimization(
                    optimizationResult.bestAnnualRothConversion,
                    optimizationResult.bestTargetValue,
                    optimizationResult.bestYourSSAge,
                    optimizationResult.bestWifeSSAge
                  );
                  setShowOptimizerModal(false);
                }}
                className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-98 transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Apply Optimal Plan
              </button>
            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" />
            Workspace 1: Interactive Tax and IRMAA Bracket Map
          </h3>
          <p className="text-xs text-slate-400">
            Compare annual income streams against Federal brackets and Medicare IRMAA surcharge cliffs.
          </p>
        </div>

        {/* Unified Quick-Fill Optimization Targets Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Quick Fills:</span>
          <select
            value={selectedQuickFill !== null ? selectedQuickFill : ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val.startsWith('opt-')) {
                setSelectedQuickFill(null);
                const goal = val.replace('opt-', '') as OptimizationGoal;
                setOptimizingGoal(goal);
                setShowOptimizerModal(true);
                setIsOptimizingScan(true);
                
                // Sweep grid in small timeout to allow scanning UI to mount
                setTimeout(() => {
                  const res = optimizeRetirementScenario(inputs, goal, simulateSurvivor);
                  setOptimizationResult(res);
                  setIsOptimizingScan(false);
                }, 600);
              } else {
                const valNum = val === "" ? null : Number(val);
                setSelectedQuickFill(valNum);
                if (valNum !== null && valNum > 0) {
                  onUpdateStrategy('fill-to-target');
                  onUpdateTargetValue(valNum);
                } else {
                  onUpdateStrategy('flat');
                  onUpdateTargetValue(null);
                }
              }
            }}
            className="text-xs font-semibold px-3 py-2 bg-slate-900 text-slate-100 border border-slate-800 rounded-xl hover:border-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer"
          >
            <option value="">No Active Target (Decluttered)</option>
            <optgroup label="Retirement Goal Optimizers">
              <option value="opt-min-taxes">Optimize for Minimum Taxes 🎯</option>
              <option value="opt-max-portfolio">Optimize for Maximum Portfolio 🎯</option>
              <option value="opt-min-surcharges">Optimize for Minimum Surcharges 🎯</option>
              <option value="opt-max-roth">Optimize for Maximum Roth Value 🎯</option>
            </optgroup>
            <optgroup label="Federal Tax Brackets (MFJ)">
              <option value={57000}>Fill to Top of 10% Bracket ($57,000)</option>
              <option value={133000}>Fill to Top of 12% Bracket ($133,000)</option>
              <option value={243600}>Fill to Top of 22% Bracket ($243,600)</option>
              <option value={435750}>Fill to Top of 24% Bracket ($435,750)</option>
              <option value={544650}>Fill to Top of 32% Bracket ($544,650)</option>
              <option value={800900}>Fill to Top of 35% Bracket ($800,900)</option>
            </optgroup>
            <optgroup label="Medicare IRMAA Cliffs ($1 Below Cliff)">
              <option value={217999}>Fill to $1 Below Tier 1 Cliff ($217,999)</option>
              <option value={273999}>Fill to $1 Below Tier 2 Cliff ($273,999)</option>
              <option value={341999}>Fill to $1 Below Tier 3 Cliff ($341,999)</option>
              <option value={409999}>Fill to $1 Below Tier 4 Cliff ($409,999)</option>
              <option value={749999}>Fill to $1 Below Tier 5 Cliff ($749,999)</option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[580px] relative bg-slate-950/40 rounded-xl border border-slate-800/40 p-4">
        <Chart type="bar" data={chartData as any} options={chartOptions as any} />
      </div>
      {renderOptimizerModal()}
    </div>
  );
};
