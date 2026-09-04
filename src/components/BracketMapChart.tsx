import React, { useMemo, useState, useRef } from 'react';
import { Chart } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import { SimulationResultRow, AppStateInputs } from '../types';
import { Award, Check } from 'lucide-react';
import { getTargetPresetInfo } from '../engine/taxRates2026';

ChartJS.register(...registerables);

interface BracketMapChartProps {
  ledger: SimulationResultRow[];
  inputs: AppStateInputs;
  simulateSurvivor: boolean;
  selectedQuickFill: number | null;
  setSelectedQuickFill: (val: number | null) => void;
}

export const BracketMapChart: React.FC<BracketMapChartProps> = ({
  ledger,
  inputs,
  simulateSurvivor,
  selectedQuickFill,
  setSelectedQuickFill,
}) => {
  const chartRef = useRef<any>(null);
  const [hasHiddenDatasets, setHasHiddenDatasets] = useState(false);

  const years = useMemo(() => ledger.map((r) => r.year), [ledger]);

  // Extract stack components
  const ssIncomes = useMemo(() => ledger.map((r) => r.yourSS + r.wifeSS), [ledger]);
  const rmds = useMemo(() => ledger.map((r) => r.yourRMD + r.wifeRMD), [ledger]);
  const rothConversions = useMemo(() => ledger.map((r) => r.intentionalRothConversion), [ledger]);
  const activeSalaries = useMemo(() => ledger.map((r) => (r.yourSalary || 0) + (r.wifeSalary || 0)), [ledger]);

  // Dynamic selected quick-fill guideline line calculator
  const quickFillLineData = useMemo(() => {
    const activeTarget = selectedQuickFill !== null
      ? selectedQuickFill
      : (inputs.rothConversionStrategy === 'fill-to-target' ? inputs.rothConversionTargetValue : null);
    if (!activeTarget) return null;

    const preset = getTargetPresetInfo(activeTarget);
    const isBracketTarget = preset?.type === 'bracket';
    const label = preset ? preset.description : `Target Limit ($${activeTarget.toLocaleString()})`;
    const color = preset ? preset.color : 'rgba(14, 165, 233, 0.9)';
    const jointBase = preset ? preset.jointBase : activeTarget;
    const singleBase = preset ? preset.singleBase : activeTarget / 2;

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
    const yourBirthYear = parseBirthYear(inputs.you.birthDate, 1960);
    const deathYear = yourBirthYear + (inputs.you.longevityAge ?? 85);

    const dataPoints = ledger.map((r) => {
      const isSingle = simulateSurvivor && r.year >= deathYear;
      const baseVal = isSingle ? singleBase : jointBase;
      const cpiFactor = r.cpiFactor;
      if (isBracketTarget) {
        // Federal Bracket: plots Gross AGI equivalent = (Bracket Limit * CPI) + Standard Deduction
        return (baseVal * cpiFactor) + (r.standardDeduction || 0);
      }
      return baseVal * cpiFactor;
    });

    return { label, color, data: dataPoints };
  }, [selectedQuickFill, ledger, simulateSurvivor, inputs]);

  const chartData = useMemo(() => {
    const isDataPresent = (data: number[]) => data.some((v) => Math.abs(v) > 0.01);

    const taxableDraws = ledger.map((r) => r.drawdownTaxable);
    const preTaxDraws = ledger.map((r) => r.drawdownPreTax);
    const rothDraws = ledger.map((r) => r.drawdownRoth);
    const cashDraws = ledger.map((r) => r.drawdownCash);

    const rawDatasets = [
      isDataPresent(rothConversions) && {
        label: 'Roth Conversions',
        data: rothConversions,
        backgroundColor: 'rgba(6, 95, 70, 0.95)', // deeper dark emerald green (emerald-800)
        stack: 'income',
        order: 1,
        pointStyle: 'rect',
      },
      isDataPresent(ssIncomes) && {
        label: 'Social Security',
        data: ssIncomes,
        backgroundColor: 'rgba(59, 130, 246, 0.65)', // blue-500 @ 65% opacity
        stack: 'income',
        order: 2,
        pointStyle: 'rect',
      },
      isDataPresent(activeSalaries) && {
        label: 'Active Salaries',
        data: activeSalaries,
        backgroundColor: 'rgba(139, 92, 246, 0.65)', // violet-500 @ 65% opacity
        stack: 'income',
        order: 3,
        pointStyle: 'rect',
      },
      isDataPresent(rmds) && {
        label: 'Forced RMDs',
        data: rmds,
        backgroundColor: 'rgba(245, 158, 11, 0.65)', // amber-500 @ 65% opacity
        stack: 'income',
        order: 4,
        pointStyle: 'rect',
      },
      isDataPresent(taxableDraws) && {
        label: 'Taxable Draws',
        data: taxableDraws,
        backgroundColor: 'rgba(185, 28, 28, 0.95)', // deeper dark red (red-700 @ 95% opacity)
        stack: 'income',
        order: 5,
        pointStyle: 'rect',
      },
      isDataPresent(preTaxDraws) && {
        label: 'Pre-Tax Draws',
        data: preTaxDraws,
        backgroundColor: 'rgba(217, 70, 239, 0.7)', // fuchsia-500 representing IRA ordinary income liquidations
        stack: 'income',
        order: 6,
        pointStyle: 'rect',
      },
      isDataPresent(rothDraws) && {
        label: 'Roth Draws (Tax-Free)',
        data: rothDraws,
        backgroundColor: 'rgba(52, 211, 153, 0.75)', // emerald-400 representing tax-free Roth draws
        stack: 'income', // stacked with all other cash flows in a single bar
        order: 7,
        pointStyle: 'rect',
      },
      isDataPresent(cashDraws) && {
        label: 'Cash Draws',
        data: cashDraws,
        backgroundColor: 'rgba(194, 65, 12, 0.85)', // dark orange (orange-700)
        stack: 'income',
        order: 8,
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

    const datasets: any[] = rawDatasets.filter(Boolean) as any[];

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
          onClick: (e: any, legendItem: any, legend: any) => {
            const index = legendItem.datasetIndex;
            const ci = legend.chart;
            const hasModifier = e.native.ctrlKey || e.native.altKey || e.native.shiftKey || e.native.metaKey;
            
            if (hasModifier) {
              // Modifier + Click: Solo / Isolate (or reset if already soloed)
              let visibleCount = 0;
              let isClickedVisible = false;
              ci.data.datasets.forEach((_: any, i: number) => {
                if (ci.isDatasetVisible(i)) {
                  visibleCount++;
                  if (i === index) {
                    isClickedVisible = true;
                  }
                }
              });
              
              if (visibleCount === 1 && isClickedVisible) {
                // Already soloed: Show all
                ci.data.datasets.forEach((_: any, i: number) => {
                  ci.setDatasetVisibility(i, true);
                });
              } else {
                // Solo this dataset
                ci.data.datasets.forEach((_: any, i: number) => {
                  ci.setDatasetVisibility(i, i === index);
                });
              }
            } else {
              // Standard Click: Toggle individually
              const isVisible = ci.isDatasetVisible(index);
              ci.setDatasetVisibility(index, !isVisible);
            }
            
            ci.update();
            
            // Update hasHiddenDatasets state to conditionally render Reset Legend UI
            let anyHidden = false;
            ci.data.datasets.forEach((_: any, i: number) => {
              if (!ci.isDatasetVisible(i)) {
                anyHidden = true;
              }
            });
            setHasHiddenDatasets(anyHidden);
          },
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
              const row = ledger[context.dataIndex];
              
              if (row) {
                const youName = inputs.you.name || 'You';
                const wifeName = inputs.wife.name || 'Spouse';
                const fmt = (v: number) => new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(v);

                if (context.dataset.label === 'Active Salaries') {
                  const yourSal = row.yourSalary || 0;
                  const wifeSal = row.wifeSalary || 0;
                  if (yourSal > 0 && wifeSal > 0) {
                    label = `Active Salaries (${youName}: ${fmt(yourSal)}, ${wifeName}: ${fmt(wifeSal)})`;
                  } else if (yourSal > 0) {
                    label = `Active Salaries (${youName})`;
                  } else if (wifeSal > 0) {
                    label = `Active Salaries (${wifeName})`;
                  }
                } else if (context.dataset.label === 'Social Security') {
                  const yourSS = row.yourSS || 0;
                  const wifeSS = row.wifeSS || 0;
                  if (yourSS > 0 && wifeSS > 0) {
                    label = `Social Security (${youName}: ${fmt(yourSS)}, ${wifeName}: ${fmt(wifeSS)})`;
                  } else if (yourSS > 0) {
                    label = `Social Security (${youName})`;
                  } else if (wifeSS > 0) {
                    label = `Social Security (${wifeName})`;
                  }
                } else if (context.dataset.label === 'Forced RMDs') {
                  const yourRMD = row.yourRMD || 0;
                  const wifeRMD = row.wifeRMD || 0;
                  if (yourRMD > 0 && wifeRMD > 0) {
                    label = `Forced RMDs (${youName}: ${fmt(yourRMD)}, ${wifeName}: ${fmt(wifeRMD)})`;
                  } else if (yourRMD > 0) {
                    label = `Forced RMDs (${youName})`;
                  } else if (wifeRMD > 0) {
                    label = `Forced RMDs (${wifeName})`;
                  }
                }
              }
              
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
                return '\nTotal Inflows & Draws: ' + new Intl.NumberFormat('en-US', {
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
            text: 'Annual Cash Flow / Tax Brackets',
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
  }, [ledger, inputs]);

  return (
    <div className="glass-panel rounded-2xl p-3.5 space-y-3">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" />
            Interactive Tax and IRMAA Bracket Map
          </h3>
          <p className="text-xs text-slate-400">
            Compare annual gross income streams against Federal brackets and Medicare IRMAA surcharge cliffs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Visual Guideline Overlay Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Guideline Overlay:</span>
            <select
              value={selectedQuickFill !== null ? selectedQuickFill : ""}
              onChange={(e) => {
                const val = e.target.value;
                const valNum = val === "" ? null : Number(val);
                setSelectedQuickFill(valNum);
              }}
              className="text-xs font-semibold px-3 py-2 bg-slate-900 text-slate-100 border border-slate-800 rounded-xl hover:border-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer"
            >
              <option value="">No Active Guideline</option>
              <optgroup label="Federal Tax Brackets (MFJ)">
                <option value={24800}>10% Federal Bracket ($24,800 Taxable)</option>
                <option value={100800}>12% Federal Bracket ($100,800 Taxable)</option>
                <option value={211400}>22% Federal Bracket ($211,400 Taxable)</option>
                <option value={403550}>24% Federal Bracket ($403,550 Taxable)</option>
                <option value={512450}>32% Federal Bracket ($512,450 Taxable)</option>
                <option value={768700}>35% Federal Bracket ($768,700 Taxable)</option>
              </optgroup>
              <optgroup label="Medicare IRMAA Cliffs">
                <option value={217999}>IRMAA Tier 1 Cliff ($218k MAGI)</option>
                <option value={273999}>IRMAA Tier 2 Cliff ($274k MAGI)</option>
                <option value={341999}>IRMAA Tier 3 Cliff ($342k MAGI)</option>
                <option value={409999}>IRMAA Tier 4 Cliff ($410k MAGI)</option>
                <option value={749999}>IRMAA Tier 5 Cliff ($750k MAGI)</option>
              </optgroup>
            </select>
            {hasHiddenDatasets && (
              <button
                onClick={() => {
                  if (chartRef.current) {
                    const chart = chartRef.current?.chart || chartRef.current;
                    chart.data.datasets.forEach((_: any, i: number) => {
                      chart.setDatasetVisibility(i, true);
                    });
                    chart.update();
                    setHasHiddenDatasets(false);
                  }
                }}
                className="text-xs font-semibold px-3 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Show All Categories</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[580px] relative bg-slate-950/40 rounded-xl border border-slate-800/40 p-4">
        <Chart ref={chartRef} type="bar" data={chartData as any} options={chartOptions as any} />
      </div>
    </div>
  );
};
