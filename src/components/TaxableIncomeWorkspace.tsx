import React, { useMemo, useState, useRef } from 'react';
import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import { SimulationResultRow, AppStateInputs, LockedReturnSequence } from '../types';
import {
  Calculator,
  Target,
  Sliders,
  TrendingUp,
  ShieldAlert,
  Check,
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { optimizeRetirementScenario, OptimizationResult } from '../engine/optimizer';

ChartJS.register(...registerables);

interface TaxableIncomeWorkspaceProps {
  ledger: SimulationResultRow[];
  inputs: AppStateInputs;
  simulateSurvivor: boolean;
  activeScenarioSequence: LockedReturnSequence | null;
  onApplyOptimization: (
    annualConversion: number,
    targetValue: number | null,
    yourAge: number,
    wifeAge: number,
    strategy?: 'flat' | 'fill-to-target'
  ) => void;
  onUpdateStrategy: (strategy: 'flat' | 'fill-to-target') => void;
  onUpdateTargetValue: (val: number | null) => void;
  selectedQuickFill: number | null;
  setSelectedQuickFill: (val: number | null) => void;
}

export const TaxableIncomeWorkspace: React.FC<TaxableIncomeWorkspaceProps> = ({
  ledger,
  inputs,
  simulateSurvivor,
  activeScenarioSequence,
  onApplyOptimization,
  onUpdateStrategy,
  onUpdateTargetValue,
  selectedQuickFill,
  setSelectedQuickFill,
}) => {
  const chartRef = useRef<any>(null);

  // Selected benchmark state (defaults to 12% Fed Tax Bracket if none set)
  const activeTarget = useMemo(() => {
    return selectedQuickFill || inputs.rothConversionTargetValue || 133000;
  }, [selectedQuickFill, inputs.rothConversionTargetValue]);

  // Optimizer modal visual state
  const [showOptimizerModal, setShowOptimizerModal] = useState(false);
  const [isOptimizingScan, setIsOptimizingScan] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const years = useMemo(() => ledger.map((r) => r.year), [ledger]);

  // Parse birth year for survivor status checks
  const yourBirthYear = useMemo(() => {
    const dateStr = inputs.you.birthDate;
    if (!dateStr) return 1960;
    const match = dateStr.match(/^(\d{4})/);
    return match ? parseInt(match[1], 10) : 1960;
  }, [inputs.you.birthDate]);

  const deathYear = yourBirthYear + (inputs.you.longevityAge ?? 85);

  // Compute non-conversion taxable income breakdown for each year
  // Net Taxable Base = max(0, Non-Conversion AGI - Standard Deduction)
  // Components scaled proportionally so total stacked base equals Net Non-Conversion Taxable Income
  const processedRows = useMemo(() => {
    return ledger.map((r) => {
      const isSingle = simulateSurvivor && r.year >= deathYear;
      const rothConv = r.intentionalRothConversion || 0;
      
      // Gross income components (before standard deduction)
      const taxableSS = r.taxableSS || 0;
      const grossSalary = (r.yourSalary || 0) + (r.wifeSalary || 0);
      const employee401k = r.employee401kContribution || 0;
      const taxableSalary = Math.max(0, grossSalary - employee401k);
      const rmdsAndTradDraws = (r.yourRMD || 0) + (r.wifeRMD || 0) + (r.drawdownPreTax || 0);
      const investmentIncome = (r.taxableDividends || 0) + (r.taxableInterest || 0) + (r.capitalGainsTriggered || 0);
      const otherIncome = r.otherTaxableIncome || 0;

      const grossNonConvAGI = Math.max(0, r.fedAGI - rothConv);
      const stdDeduction = r.standardDeduction || 0;
      const netNonConvTaxable = Math.max(0, grossNonConvAGI - stdDeduction);

      // Remaining deduction available after absorbing non-conversion AGI
      const remainingDeduction = Math.max(0, stdDeduction - grossNonConvAGI);
      // Taxable portion of Roth conversion (after any remaining deduction)
      const taxableRothConv = Math.max(0, rothConv - remainingDeduction);

      // Proportionally scale components to sum up to netNonConvTaxable
      const scale = grossNonConvAGI > 0 ? netNonConvTaxable / grossNonConvAGI : 0;
      const netSS = taxableSS * scale;
      const netSalary = taxableSalary * scale;
      const netRMDsDraws = rmdsAndTradDraws * scale;
      const netInvestment = investmentIncome * scale;
      const netOther = otherIncome * scale;

      const totalTaxableIncome = r.taxableIncome;

      return {
        year: r.year,
        yourAge: r.yourAge,
        wifeAge: r.wifeAge,
        isSingle,
        cpiFactor: r.cpiFactor,
        grossNonConvAGI,
        stdDeduction,
        netNonConvTaxable,
        rothConv,
        taxableRothConv,
        netSS,
        netSalary,
        netRMDsDraws,
        netInvestment,
        netOther,
        rawDividends: (r.taxableDividends || 0) + (r.taxableInterest || 0),
        rawCapGains: r.capitalGainsTriggered || 0,
        totalTaxableIncome,
      };
    });
  }, [ledger, simulateSurvivor, deathYear]);

  // Compute dynamic benchmark line data points (indexed to Taxable Income threshold)
  const benchmarkLineData = useMemo(() => {
    let jointBase = 0;
    let singleBase = 0;
    let label = '';
    let color = 'rgba(16, 185, 129, 0.9)'; // emerald
    let isMAGIBased = false;

    switch (activeTarget) {
      case 57000:
        // Top of 10% Fed Bracket: Taxable Income $23,200 MFJ / $11,600 Single (in 2026 dollars)
        jointBase = 23200; singleBase = 11600; label = 'Top of 10% Fed Tax Bracket ($23,200 Taxable Income)'; color = 'rgba(244, 63, 94, 0.9)';
        break;
      case 133000:
        // Top of 12% Fed Bracket: Taxable Income $94,300 MFJ / $47,150 Single
        jointBase = 94300; singleBase = 47150; label = 'Top of 12% Fed Tax Bracket ($94,300 Taxable Income)'; color = 'rgba(244, 63, 94, 0.9)';
        break;
      case 243600:
        // Top of 22% Fed Bracket: Taxable Income $201,050 MFJ / $100,525 Single
        jointBase = 201050; singleBase = 100525; label = 'Top of 22% Fed Tax Bracket ($201,050 Taxable Income)'; color = 'rgba(249, 115, 22, 0.9)';
        break;
      case 435750:
        // Top of 24% Fed Bracket: Taxable Income $383,900 MFJ / $191,950 Single
        jointBase = 383900; singleBase = 191950; label = 'Top of 24% Fed Tax Bracket ($383,900 Taxable Income)'; color = 'rgba(236, 72, 153, 0.9)';
        break;
      case 544650:
        // Top of 32% Fed Bracket: Taxable Income $487,450 MFJ / $243,725 Single
        jointBase = 487450; singleBase = 243725; label = 'Top of 32% Fed Tax Bracket ($487,450 Taxable Income)'; color = 'rgba(168, 85, 247, 0.9)';
        break;
      case 800900:
        // Top of 35% Fed Bracket: Taxable Income $731,200 MFJ / $365,600 Single
        jointBase = 731200; singleBase = 365600; label = 'Top of 35% Fed Tax Bracket ($731,200 Taxable Income)'; color = 'rgba(239, 68, 68, 0.9)';
        break;
      case 217999:
      case 218000:
        // IRMAA Tier 1: $218,000 MAGI
        jointBase = 218000; singleBase = 109000; label = 'IRMAA Tier 1 Cliff ($218,000 MAGI)'; color = 'rgba(16, 185, 129, 0.9)'; isMAGIBased = true;
        break;
      case 273999:
      case 274000:
        // IRMAA Tier 2: $274,000 MAGI
        jointBase = 274000; singleBase = 137000; label = 'IRMAA Tier 2 Cliff ($274,000 MAGI)'; color = 'rgba(245, 158, 11, 0.9)'; isMAGIBased = true;
        break;
      case 341999:
      case 342000:
        // IRMAA Tier 3: $342,000 MAGI
        jointBase = 342000; singleBase = 171000; label = 'IRMAA Tier 3 Cliff ($342,000 MAGI)'; color = 'rgba(59, 130, 246, 0.9)'; isMAGIBased = true;
        break;
      case 409999:
      case 410000:
        // IRMAA Tier 4: $410,000 MAGI
        jointBase = 410000; singleBase = 205000; label = 'IRMAA Tier 4 Cliff ($410,000 MAGI)'; color = 'rgba(236, 72, 153, 0.9)'; isMAGIBased = true;
        break;
      case 749999:
      case 750000:
        // IRMAA Tier 5: $750,000 MAGI
        jointBase = 750000; singleBase = 375000; label = 'IRMAA Tier 5 Cliff ($750,000 MAGI)'; color = 'rgba(239, 68, 68, 0.9)'; isMAGIBased = true;
        break;
      default:
        jointBase = activeTarget;
        singleBase = activeTarget / 2;
        label = `Target MAGI Limit ($${activeTarget.toLocaleString()} MAGI)`;
        color = 'rgba(14, 165, 233, 0.9)';
        isMAGIBased = true;
        break;
    }

    const dataPoints = processedRows.map((r) => {
      const baseVal = r.isSingle ? singleBase : jointBase;
      const inflatedBase = baseVal * r.cpiFactor;
      // If IRMAA MAGI based, translate MAGI threshold to equivalent Taxable Income ceiling:
      // Taxable Ceiling = MAGI Limit - Standard Deduction
      if (isMAGIBased) {
        return Math.max(0, inflatedBase - r.stdDeduction);
      }
      return inflatedBase;
    });

    return { label, color, data: dataPoints, isMAGIBased };
  }, [activeTarget, processedRows]);

  // Chart datasets configuration
  const chartData = useMemo(() => {
    return {
      labels: years,
      datasets: [
        {
          label: 'Taxable Social Security',
          data: processedRows.map((r) => r.netSS),
          backgroundColor: 'rgba(59, 130, 246, 0.75)', // blue-500
          stack: 'taxable',
          order: 2,
        },
        {
          label: 'Taxable Active Salaries',
          data: processedRows.map((r) => r.netSalary),
          backgroundColor: 'rgba(139, 92, 246, 0.75)', // violet-500
          stack: 'taxable',
          order: 3,
        },
        {
          label: 'Forced RMDs & Pre-Tax Draws',
          data: processedRows.map((r) => r.netRMDsDraws),
          backgroundColor: 'rgba(245, 158, 11, 0.75)', // amber-500
          stack: 'taxable',
          order: 4,
        },
        {
          label: 'Taxable Dividends & Capital Gains',
          data: processedRows.map((r) => r.netInvestment),
          backgroundColor: 'rgba(236, 72, 153, 0.75)', // pink-500
          stack: 'taxable',
          order: 5,
        },
        {
          label: 'Intentional Roth Conversions',
          data: processedRows.map((r) => r.taxableRothConv),
          backgroundColor: 'rgba(16, 185, 129, 0.9)', // emerald-500
          stack: 'taxable',
          order: 6,
        },
        {
          type: 'line' as const,
          label: benchmarkLineData.label,
          data: benchmarkLineData.data,
          borderColor: benchmarkLineData.color,
          borderWidth: 2.5,
          borderDash: [6, 4],
          fill: false,
          pointRadius: 2,
          pointHoverRadius: 5,
          order: 1,
        },
      ],
    };
  }, [years, processedRows, benchmarkLineData]);

  // Chart options
  const chartOptions: any = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#cbd5e1',
            font: { size: 11, weight: '600' },
            usePointStyle: true,
            boxWidth: 10,
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(51, 65, 85, 0.8)',
          borderWidth: 1,
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          callbacks: {
            title: (items: any[]) => {
              if (!items.length) return '';
              const idx = items[0].dataIndex;
              const r = processedRows[idx];
              return `Year ${r.year} (Ages: You ${r.yourAge} / Spouse ${r.wifeAge})`;
            },
            footer: (items: any[]) => {
              if (!items.length) return '';
              const idx = items[0].dataIndex;
              const r = processedRows[idx];
              const limit = benchmarkLineData.data[idx];
              const headroom = limit - r.totalTaxableIncome;

              return [
                '-----------------------------------',
                `Gross Federal AGI: ${formatCurrency(r.grossNonConvAGI + r.rothConv)}`,
                `Standard Deduction: -${formatCurrency(r.stdDeduction)}`,
                `Net Non-Conv Taxable: ${formatCurrency(r.netNonConvTaxable)}`,
                `Roth Conversion: +${formatCurrency(r.rothConv)}`,
                `TOTAL TAXABLE INCOME: ${formatCurrency(r.totalTaxableIncome)}`,
                `Target Upper Limit: ${formatCurrency(limit)}`,
                `Headroom Remaining: ${headroom >= 0 ? '+' : ''}${formatCurrency(headroom)}`,
                '-----------------------------------',
                `Dividends & Interest: ${formatCurrency(r.rawDividends)}`,
                `Net Realized Cap Gains: ${formatCurrency(r.rawCapGains)} (excl. basis)`,
              ].join('\n');
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(51, 65, 85, 0.3)' },
          ticks: { color: '#94a3b8', font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(51, 65, 85, 0.3)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 10 },
            callback: (val: number) => `$${(val / 1000).toFixed(0)}k`,
          },
          stacked: true,
        },
      },
    };
  }, [processedRows, benchmarkLineData]);

  // Key KPI summary statistics across conversion window years
  const kpiStats = useMemo(() => {
    const convStart = inputs.rothConversionStartYear || ledger[0]?.year || 2026;
    const convEnd = inputs.rothConversionEndYear || ledger[0]?.year + 5 || 2031;

    const convRows = processedRows.filter((r) => r.year >= convStart && r.year <= convEnd);
    const targetRows = convRows.length > 0 ? convRows : processedRows.slice(0, 5);

    const maxTaxable = Math.max(...targetRows.map((r) => r.totalTaxableIncome));
    const avgHeadroom = targetRows.reduce((sum, r) => {
      const rowIdx = ledger.findIndex((l) => l.year === r.year);
      const limit = benchmarkLineData.data[rowIdx >= 0 ? rowIdx : 0];
      return sum + (limit - r.totalTaxableIncome);
    }, 0) / (targetRows.length || 1);

    const totalConversions = targetRows.reduce((sum, r) => sum + r.rothConv, 0);
    const breachedYears = processedRows.filter((r, idx) => r.totalTaxableIncome > benchmarkLineData.data[idx]).length;

    return { convStart, convEnd, maxTaxable, avgHeadroom, totalConversions, breachedYears };
  }, [inputs, ledger, processedRows, benchmarkLineData]);

  // Quick Preset Selection Buttons handler
  const handleSelectPreset = (targetVal: number) => {
    setSelectedQuickFill(targetVal);
    onUpdateTargetValue(targetVal);
    if (inputs.rothConversionStrategy !== 'fill-to-target') {
      onUpdateStrategy('fill-to-target');
    }
  };

  // Run Optimizer Scan to Fill Headroom
  const handleRunOptimizer = async () => {
    setIsOptimizingScan(true);
    setShowOptimizerModal(true);

    setTimeout(() => {
      try {
        const result = optimizeRetirementScenario(
          inputs,
          simulateSurvivor,
          'max-estate',
          activeScenarioSequence
        );
        setOptimizationResult(result);
      } catch (err) {
        console.error('Optimization error:', err);
      } finally {
        setIsOptimizingScan(false);
      }
    }, 150);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Calculator className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-slate-100 tracking-tight">
                Taxable Income & Roth Conversions Planner
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Stack non-conversion taxable income (AGI after standard deduction) with Roth conversions to stay cleanly under Federal Tax Brackets or Medicare IRMAA limits.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <span className="text-slate-400 font-sans">Active Strategy:</span>
              <span className={`font-bold ${inputs.rothConversionStrategy === 'fill-to-target' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {inputs.rothConversionStrategy === 'fill-to-target' ? 'Fill-to-Target' : `Flat (${formatCurrency(inputs.annualRothConversion)}/yr)`}
              </span>
            </div>

            <button
              type="button"
              onClick={handleRunOptimizer}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-950/50 cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4 fill-slate-950" />
              <span>Auto-Fill Headroom to Target</span>
            </button>
          </div>
        </div>

        {/* Flat Strategy Warning Banner */}
        {inputs.rothConversionStrategy === 'flat' && (
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block">Flat Strategy Notice (Fixed Conversion Amount)</span>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Your strategy is set to a fixed annual conversion of {formatCurrency(inputs.annualRothConversion)}. Flat conversions stack on top of active salary (causing 2026 to exceed target limits) and leave unfilled headroom in retirement years. Switch to <strong>Fill-to-Target</strong> to dynamically adjust conversions each year.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onUpdateStrategy('fill-to-target')}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold text-[11px] shrink-0 self-start sm:self-center transition-all cursor-pointer"
            >
              Switch to Fill-to-Target
            </button>
          </div>
        )}

        {/* Benchmark Picklist Buttons Grid */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              Select Target Upper Limit Line:
            </span>
            {activeTarget && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                Active Benchmark: {benchmarkLineData.label}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Federal Tax Brackets Group */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 px-2 uppercase font-mono">Fed Brackets:</span>
              <button
                type="button"
                onClick={() => handleSelectPreset(57000)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  activeTarget === 57000
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 ring-1 ring-rose-500/30 font-black'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                10% ($23.2k)
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset(133000)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  activeTarget === 133000
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 ring-1 ring-rose-500/30 font-black'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                12% ($94.3k)
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset(243600)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  activeTarget === 243600
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 ring-1 ring-amber-500/30 font-black'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                22% ($201k)
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset(435750)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  activeTarget === 435750
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500/60 ring-1 ring-pink-500/30 font-black'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                24% ($383.9k)
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset(544650)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  activeTarget === 544650
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 ring-1 ring-purple-500/30 font-black'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                32% ($487.5k)
              </button>
            </div>

            {/* IRMAA Cliffs Group */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 px-2 uppercase font-mono">IRMAA Tiers:</span>
              <button
                type="button"
                onClick={() => handleSelectPreset(218000)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  activeTarget === 218000 || activeTarget === 217999
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 ring-1 ring-emerald-500/30 font-black'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                IRMAA Tier 1 ($218k MAGI)
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset(274000)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  activeTarget === 274000 || activeTarget === 273999
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 ring-1 ring-amber-500/30 font-black'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                Tier 2 ($274k)
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset(342000)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  activeTarget === 342000 || activeTarget === 341999
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/60 ring-1 ring-blue-500/30 font-black'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                Tier 3 ($342k)
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset(410000)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all border ${
                  activeTarget === 410000 || activeTarget === 409999
                    ? 'bg-pink-500/20 text-pink-300 border-pink-500/60 ring-1 ring-pink-500/30 font-black'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
              >
                Tier 4 ($410k)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Conversion Window */}
        <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Roth Conversion Window
            </span>
            <span className="text-xl font-black text-emerald-400 font-mono block">
              {kpiStats.convStart} – {kpiStats.convEnd}
            </span>
            <span className="text-[9px] text-slate-500 font-mono block">
              Total Converted: {formatCurrency(kpiStats.totalConversions)}
            </span>
          </div>
          <Sliders className="w-8 h-8 text-emerald-500/50" />
        </div>

        {/* Card 2: Peak Taxable Income */}
        <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-blue-500">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Peak Taxable Income
            </span>
            <span className="text-xl font-black text-blue-400 font-mono block">
              {formatCurrency(kpiStats.maxTaxable)}
            </span>
            <span className="text-[9px] text-slate-500 font-mono block">
              During conversion window
            </span>
          </div>
          <TrendingUp className="w-8 h-8 text-blue-500/50" />
        </div>

        {/* Card 3: Average Headroom */}
        <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-amber-500">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Avg Headroom to Limit
            </span>
            <span className={`text-xl font-black font-mono block ${kpiStats.avgHeadroom >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
              {formatCurrency(kpiStats.avgHeadroom)}
            </span>
            <span className="text-[9px] text-slate-500 font-mono block">
              Room under target benchmark
            </span>
          </div>
          <ShieldAlert className="w-8 h-8 text-amber-500/50" />
        </div>

        {/* Card 4: Limit Breaches */}
        <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-l-4 border-l-purple-500">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Limit Overages
            </span>
            <span className={`text-xl font-black font-mono block ${kpiStats.breachedYears === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {kpiStats.breachedYears} {kpiStats.breachedYears === 1 ? 'Year' : 'Years'}
            </span>
            <span className="text-[9px] text-slate-500 font-mono block">
              Years exceeding benchmark line
            </span>
          </div>
          <AlertCircle className="w-8 h-8 text-purple-500/50" />
        </div>
      </div>

      {/* Main Stacked Bar Chart */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            Taxable Income & Roth Conversion Stack
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              Roth Conversion
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
              Forced RMDs/Draws
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
              Taxable SS
            </span>
          </div>
        </div>

        <div className="h-[420px] w-full">
          <Chart ref={chartRef} type="bar" data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Detailed Audit Table */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/40 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400" />
            Year-by-Year Taxable Income & Headroom Ledger
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Showing {processedRows.length} simulation years
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Year</th>
                <th className="py-2.5 px-3">Ages</th>
                <th className="py-2.5 px-3">Gross Non-Conv AGI</th>
                <th className="py-2.5 px-3">Std Deduction</th>
                <th className="py-2.5 px-3">Net Non-Conv Taxable</th>
                <th className="py-2.5 px-3">Roth Conv</th>
                <th className="py-2.5 px-3">Total Taxable Income</th>
                <th className="py-2.5 px-3">Target Limit</th>
                <th className="py-2.5 px-3">Headroom</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {processedRows.map((r, idx) => {
                const limit = benchmarkLineData.data[idx];
                const headroom = limit - r.totalTaxableIncome;
                const isBreached = headroom < 0;
                const isConvYear = r.rothConv > 0;

                return (
                  <tr
                    key={r.year}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isConvYear ? 'bg-emerald-950/20' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-bold text-slate-100">{r.year}</td>
                    <td className="py-2 px-3 text-slate-400">
                      {r.yourAge} / {r.wifeAge}
                    </td>
                    <td className="py-2 px-3">{formatCurrency(r.grossNonConvAGI)}</td>
                    <td className="py-2 px-3 text-slate-400">-{formatCurrency(r.stdDeduction)}</td>
                    <td className="py-2 px-3 font-semibold text-slate-200">{formatCurrency(r.netNonConvTaxable)}</td>
                    <td className="py-2 px-3 font-bold text-emerald-400">
                      {r.rothConv > 0 ? formatCurrency(r.rothConv) : '—'}
                    </td>
                    <td className="py-2 px-3 font-black text-slate-100">{formatCurrency(r.totalTaxableIncome)}</td>
                    <td className="py-2 px-3 text-slate-400">{formatCurrency(limit)}</td>
                    <td className={`py-2 px-3 font-bold ${isBreached ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {headroom >= 0 ? `+${formatCurrency(headroom)}` : formatCurrency(headroom)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Optimizer Modal */}
      {showOptimizerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel max-w-xl w-full p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-slate-100">Auto-Fill Headroom Optimizer</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOptimizerModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold px-2 py-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {isOptimizingScan ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold text-slate-300">
                  Scanning tax brackets & IRMAA thresholds across 35-year horizon...
                </p>
              </div>
            ) : optimizationResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Optimal Strategy Found</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Calculated optimal annual Roth conversion of{' '}
                    <span className="font-mono font-bold text-emerald-400">
                      {formatCurrency(optimizationResult.optimalAnnualConversion)}
                    </span>{' '}
                    to fill headroom under {benchmarkLineData.label}.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-sans">Projected Net Estate:</span>
                    <span className="text-base font-bold text-emerald-400 block mt-1">
                      {formatCurrency(optimizationResult.projectedEstate)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-sans">Lifetime Taxes Paid:</span>
                    <span className="text-base font-bold text-rose-400 block mt-1">
                      {formatCurrency(optimizationResult.projectedTaxes)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowOptimizerModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyOptimization(
                        optimizationResult.optimalAnnualConversion,
                        activeTarget,
                        optimizationResult.optimalYourAge,
                        optimizationResult.optimalWifeAge,
                        'fill-to-target'
                      );
                      setShowOptimizerModal(false);
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg"
                  >
                    Apply Strategy to Plan
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
