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
import { Award } from 'lucide-react';

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
  onUpdateConversion: (val: number) => void;
  onUpdateConversionStartYear: (year: number) => void;
  onUpdateConversionEndYear: (year: number) => void;
}

export const BracketMapChart: React.FC<BracketMapChartProps> = ({
  ledger,
  inputs,
  simulateSurvivor,
  onUpdateConversion,
  onUpdateConversionStartYear,
  onUpdateConversionEndYear,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedQuickFill, setSelectedQuickFill] = useState<number | null>(null);

  const years = useMemo(() => ledger.map((r) => r.year), [ledger]);

  // Extract stack components
  const ssIncomes = useMemo(() => ledger.map((r) => r.yourSS + r.wifeSS), [ledger]);
  const rmds = useMemo(() => ledger.map((r) => r.yourRMD + r.wifeRMD), [ledger]);
  const drawdowns = useMemo(() => ledger.map((r) => r.drawdownPreTax + r.drawdownTaxable), [ledger]);
  const rothConversions = useMemo(() => ledger.map((r) => r.intentionalRothConversion), [ledger]);
  const activeSalaries = useMemo(() => ledger.map((r) => (r.yourSalary || 0) + (r.wifeSalary || 0)), [ledger]);

  // Dynamic selected quick-fill guideline line calculator
  const quickFillLineData = useMemo(() => {
    if (!selectedQuickFill) return null;

    let jointBase = 0;
    let singleBase = 0;
    let label = '';
    let color = 'rgba(16, 185, 129, 0.9)'; // default emerald

    switch (selectedQuickFill) {
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
        jointBase = 218000; singleBase = 109000; label = "IRMAA Tier 1 Cliff"; color = 'rgba(16, 185, 129, 0.9)';
        break;
      case 273999:
        jointBase = 274000; singleBase = 137000; label = "IRMAA Tier 2 Cliff"; color = 'rgba(245, 158, 11, 0.9)';
        break;
      case 341999:
        jointBase = 342000; singleBase = 171000; label = "IRMAA Tier 3 Cliff"; color = 'rgba(59, 130, 246, 0.9)';
        break;
      case 409999:
        jointBase = 410000; singleBase = 205000; label = "IRMAA Tier 4 Cliff"; color = 'rgba(236, 72, 153, 0.9)';
        break;
      case 749999:
        jointBase = 750000; singleBase = 375000; label = "IRMAA Tier 5 Cliff"; color = 'rgba(239, 68, 68, 0.9)';
        break;
      default:
        return null;
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
        backgroundColor: '#8b5cf6', // violet-500
        stack: 'income',
        order: 5,
        pointStyle: 'rect',
      },
      {
        label: 'Social Security',
        data: ssIncomes,
        backgroundColor: '#3b82f6', // bright blue
        stack: 'income',
        order: 4,
        pointStyle: 'rect',
      },
      {
        label: 'Forced RMDs',
        data: rmds,
        backgroundColor: '#f59e0b', // amber
        stack: 'income',
        order: 3,
        pointStyle: 'rect',
      },
      {
        label: 'Taxable/Pre-Tax Draws',
        data: drawdowns,
        backgroundColor: '#ef4444', // rose/red
        stack: 'income',
        order: 2,
        pointStyle: 'rect',
      },
      {
        label: 'Roth Conversions',
        data: rothConversions,
        backgroundColor: '#10b981', // emerald-500 highlighting
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
  }, [years, activeSalaries, ssIncomes, rmds, drawdowns, rothConversions, ledger, quickFillLineData]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: !isDragging as any, // disable animations during slider drag
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
  }, [isDragging, ssIncomes, rmds, activeSalaries]);

  // Generic quick-fill conversion target handler
  const handleFillToTarget = (limitValue: number) => {
    const baseSS = ssIncomes[0] || 0;
    const baseRMD = rmds[0] || 0;
    const baseSalary = activeSalaries[0] || 0;
    const totalBase = baseSS + baseRMD + baseSalary;
    
    const gap = Math.max(0, limitValue - totalBase);
    onUpdateConversion(gap);
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
              const val = e.target.value === "" ? null : Number(e.target.value);
              setSelectedQuickFill(val);
              if (val !== null && val > 0) {
                handleFillToTarget(val);
              }
            }}
            className="text-xs font-semibold px-3 py-2 bg-slate-900 text-slate-100 border border-slate-800 rounded-xl hover:border-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer"
          >
            <option value="">No Active Target (Decluttered)</option>
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
      <div className="h-96 relative bg-slate-950/40 rounded-xl border border-slate-800/40 p-4">
        <Chart type="bar" data={chartData as any} options={chartOptions as any} />
      </div>

      {/* Slider Control */}
      <div className="p-5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Manual Roth Conversion Plan</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Start Year Slider */}
          <div className="space-y-3 bg-slate-900/20 p-3 rounded-lg border border-slate-800/40">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-300">Start Year</span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {inputs.rothConversionStartYear !== undefined ? inputs.rothConversionStartYear : 2026}
              </span>
            </div>

            <input
              type="range"
              min="2026"
              max="2050"
              step="1"
              value={inputs.rothConversionStartYear !== undefined ? inputs.rothConversionStartYear : 2026}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              onChange={(e) => onUpdateConversionStartYear(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>2026</span>
              <span>2038</span>
              <span>2050</span>
            </div>
          </div>

          {/* End Year Slider */}
          <div className="space-y-3 bg-slate-900/20 p-3 rounded-lg border border-slate-800/40">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-300">End Year</span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {inputs.rothConversionEndYear !== undefined ? inputs.rothConversionEndYear : 2035}
              </span>
            </div>

            <input
              type="range"
              min="2026"
              max="2060"
              step="1"
              value={inputs.rothConversionEndYear !== undefined ? inputs.rothConversionEndYear : 2035}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              onChange={(e) => onUpdateConversionEndYear(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>2026</span>
              <span>2043</span>
              <span>2060</span>
            </div>
          </div>

          {/* Annual Amount Slider */}
          <div className="space-y-3 bg-slate-900/20 p-3 rounded-lg border border-slate-800/40">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-300">Annual Target</span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  maximumFractionDigits: 0,
                }).format(inputs.annualRothConversion)}
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="500000"
              step="5000"
              value={inputs.annualRothConversion}
              onMouseDown={() => setIsDragging(true)}
              onMouseUp={() => setIsDragging(false)}
              onTouchStart={() => setIsDragging(true)}
              onTouchEnd={() => setIsDragging(false)}
              onChange={(e) => onUpdateConversion(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>$0</span>
              <span>$250k</span>
              <span>$500k</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
