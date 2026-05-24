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
  onUpdateConversion: (val: number) => void;
}

export const BracketMapChart: React.FC<BracketMapChartProps> = ({
  ledger,
  inputs,
  onUpdateConversion,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const years = useMemo(() => ledger.map((r) => r.year), [ledger]);

  // Extract stack components
  const ssIncomes = useMemo(() => ledger.map((r) => r.yourSS + r.wifeSS), [ledger]);
  const rmds = useMemo(() => ledger.map((r) => r.yourRMD + r.wifeRMD), [ledger]);
  const drawdowns = useMemo(() => ledger.map((r) => r.drawdownPreTax + r.drawdownTaxable + r.capitalGainsTriggered), [ledger]);
  const rothConversions = useMemo(() => ledger.map((r) => r.intentionalRothConversion), [ledger]);
  const activeSalaries = useMemo(() => ledger.map((r) => (r.yourSalary || 0) + (r.wifeSalary || 0)), [ledger]);

  // Guidelines lines (sloping upwards with inflation)
  const fed12PercentLine = useMemo(() => {
    return ledger.map((r) => {
      // 12% Bracket limit + standard deduction
      const isSingle = r.yourAge >= 85 && inputs.you.targetSSClaimingAge > 0; // Check survivor status from age
      const limit = isSingle ? 47150 : 94300;
      const stdDec = r.standardDeduction;
      return limit * (r.standardDeduction / (isSingle ? 13850 : 27700)) + stdDec;
    });
  }, [ledger, inputs]);

  const fed22PercentLine = useMemo(() => {
    return ledger.map((r) => {
      const isSingle = r.yourAge >= 85 && inputs.you.targetSSClaimingAge > 0;
      const limit = isSingle ? 100525 : 201050;
      const stdDec = r.standardDeduction;
      return limit * (r.standardDeduction / (isSingle ? 13850 : 27700)) + stdDec;
    });
  }, [ledger, inputs]);

  const fed24PercentLine = useMemo(() => {
    return ledger.map((r) => {
      const isSingle = r.yourAge >= 85 && inputs.you.targetSSClaimingAge > 0;
      const limit = isSingle ? 191950 : 383900;
      const stdDec = r.standardDeduction;
      return limit * (r.standardDeduction / (isSingle ? 13850 : 27700)) + stdDec;
    });
  }, [ledger, inputs]);

  const irmaaCliff1Line = useMemo(() => {
    return ledger.map((r) => {
      const isSingle = r.yourAge >= 85 && inputs.you.targetSSClaimingAge > 0;
      const baseCliff = isSingle ? 109000 : 218000;
      // Clinically indexed standard deduction factor represents CPI inflation
      const cpiFactor = r.standardDeduction / (isSingle ? 13850 : 27700);
      return baseCliff * cpiFactor;
    });
  }, [ledger, inputs]);

  const irmaaCliff2Line = useMemo(() => {
    return ledger.map((r) => {
      const isSingle = r.yourAge >= 85 && inputs.you.targetSSClaimingAge > 0;
      const baseCliff = isSingle ? 137000 : 274000;
      const cpiFactor = r.standardDeduction / (isSingle ? 13850 : 27700);
      return baseCliff * cpiFactor;
    });
  }, [ledger, inputs]);

  const chartData = useMemo(() => {
    return {
      labels: years.map(String),
      datasets: [
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
        // Line overlays for Brackets & Cliffs
        {
          label: 'Top of 12% Fed Bracket',
          data: fed12PercentLine,
          type: 'line' as const,
          borderColor: 'rgba(244, 63, 94, 0.7)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 0,
          pointStyle: 'line',
        },
        {
          label: 'Top of 22% Fed Bracket',
          data: fed22PercentLine,
          type: 'line' as const,
          borderColor: 'rgba(249, 115, 22, 0.7)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 0,
          pointStyle: 'line',
        },
        {
          label: 'Top of 24% Fed Bracket',
          data: fed24PercentLine,
          type: 'line' as const,
          borderColor: 'rgba(236, 72, 153, 0.7)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          order: 0,
          pointStyle: 'line',
        },
        {
          label: 'IRMAA Tier 1 Cliff',
          data: irmaaCliff1Line,
          type: 'line' as const,
          borderColor: 'rgba(16, 185, 129, 0.7)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: 0,
          pointStyle: 'line',
        },
        {
          label: 'IRMAA Tier 2 Cliff',
          data: irmaaCliff2Line,
          type: 'line' as const,
          borderColor: 'rgba(245, 158, 11, 0.7)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: 0,
          pointStyle: 'line',
        },
      ],
    };
  }, [years, activeSalaries, ssIncomes, rmds, drawdowns, rothConversions, fed12PercentLine, fed22PercentLine, fed24PercentLine, irmaaCliff1Line, irmaaCliff2Line]);

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
          backgroundColor: '#0f172a',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 10,
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
        },
      },
    };
  }, [isDragging]);

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
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val > 0) handleFillToTarget(val);
            }}
            defaultValue=""
            className="text-xs font-semibold px-3 py-2 bg-slate-900 text-slate-100 border border-slate-800 rounded-xl hover:border-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer"
          >
            <option value="" disabled>Select Optimization Target...</option>
            <optgroup label="Federal Tax Brackets (MFJ)">
              <option value={50900}>Fill to Top of 10% Bracket ($50,900)</option>
              <option value={122000}>Fill to Top of 12% Bracket ($122,000)</option>
              <option value={228750}>Fill to Top of 22% Bracket ($228,750)</option>
              <option value={411600}>Fill to Top of 24% Bracket ($411,600)</option>
              <option value={515150}>Fill to Top of 32% Bracket ($515,150)</option>
              <option value={758900}>Fill to Top of 35% Bracket ($758,900)</option>
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
      <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-200">Manual Annual Roth Conversion Target</span>
          <span className="text-xl font-black text-emerald-400 font-mono">
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
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />

        <div className="flex justify-between text-xs text-slate-500 font-mono">
          <span>$0 (No Conversions)</span>
          <span>$250,000</span>
          <span>$500,000 (Max)</span>
        </div>
      </div>
    </div>
  );
};
