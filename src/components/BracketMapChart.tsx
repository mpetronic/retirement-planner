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
import { DollarSign, ShieldAlert, Award } from 'lucide-react';

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
          label: 'Social Security',
          data: ssIncomes,
          backgroundColor: '#3b82f6', // bright blue
          stack: 'income',
          order: 4,
        },
        {
          label: 'Forced RMDs',
          data: rmds,
          backgroundColor: '#f59e0b', // amber
          stack: 'income',
          order: 3,
        },
        {
          label: 'Taxable/Pre-Tax Draws',
          data: drawdowns,
          backgroundColor: '#ef4444', // rose/red
          stack: 'income',
          order: 2,
        },
        {
          label: 'Roth Conversions',
          data: rothConversions,
          backgroundColor: '#10b981', // emerald-500 highlighting
          stack: 'income',
          order: 1,
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
        },
      ],
    };
  }, [years, ssIncomes, rmds, drawdowns, rothConversions, fed12PercentLine, irmaaCliff1Line, irmaaCliff2Line]);

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
            boxWidth: 12,
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

  // Macro 1: Fill to Top of 12% Federal Bracket
  const handleFill12Percent = () => {
    // Top of 12% bracket MFJ is $94,300 + Standard Deduction ($27,700) = $122,000 in 2026.
    // Let's compute base income (SS + RMD) in 2026
    const baseSS = ssIncomes[0];
    const baseRMD = rmds[0];
    const totalBase = baseSS + baseRMD;
    
    const limit = 122000;
    const gap = Math.max(0, limit - totalBase);
    onUpdateConversion(gap);
  };

  // Macro 2: Fill to $1 Below Nearest IRMAA Surcharge Cliff
  const handleFillIRMAA = () => {
    // 2026 IRMAA Tier 1 Cliff is $218,000
    const baseSS = ssIncomes[0];
    const baseRMD = rmds[0];
    const totalBase = baseSS + baseRMD;
    
    const limit = 218000;
    const gap = Math.max(0, limit - totalBase - 1);
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

        {/* Macro Toggles */}
        <div className="flex gap-2">
          <button
            onClick={handleFill12Percent}
            className="text-xs font-semibold px-3 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-600/30 transition-all flex items-center gap-1.5"
          >
            <DollarSign className="w-3.5 h-3.5" />
            Fill to Top of 12% Bracket
          </button>
          <button
            onClick={handleFillIRMAA}
            className="text-xs font-semibold px-3 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-600/30 transition-all flex items-center gap-1.5"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Fill to $1 Below IRMAA Cliff
          </button>
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
          max="250000"
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
          <span>$125,000</span>
          <span>$250,000 (Max)</span>
        </div>
      </div>
    </div>
  );
};
