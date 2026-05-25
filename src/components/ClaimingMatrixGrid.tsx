import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { SimulationResultRow, AppStateInputs, LockedReturnSequence } from '../types';
import { runRetirementSimulation } from '../engine/simulationEngine';
import { Eye, HeartPulse } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ClaimingMatrixGridProps {
  inputs: AppStateInputs;
  ledger: SimulationResultRow[];
  simulateSurvivor: boolean;
  wsScenario: 'flat' | 'p10' | 'p50' | 'p90';
  onChangeScenario: (val: 'flat' | 'p10' | 'p50' | 'p90') => void;
  activeScenarioSequence: LockedReturnSequence | null;
  onUpdateClaimingAges: (yourAge: number, wifeAge: number) => void;
  onToggleSurvivor: (val: boolean) => void;
}

export const ClaimingMatrixGrid: React.FC<ClaimingMatrixGridProps> = ({
  inputs,
  ledger,
  simulateSurvivor,
  wsScenario,
  onChangeScenario,
  activeScenarioSequence,
  onUpdateClaimingAges,
  onToggleSurvivor,
}) => {
  const ages = [62, 63, 64, 65, 66, 67, 68, 69, 70];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Pre-calculate the entire 9x9 matrix ending values for heatmap
  const matrixData = useMemo(() => {
    const grid: { [key: string]: number } = {};
    let maxVal = -Infinity;
    let minVal = Infinity;

    for (const yourSSAge of ages) {
      for (const wifeSSAge of ages) {
        // Clone inputs and modify claiming ages
        const scenarioInputs = {
          ...inputs,
          you: { ...inputs.you, targetSSClaimingAge: yourSSAge },
          wife: { ...inputs.wife, targetSSClaimingAge: wifeSSAge },
        };
        const res = runRetirementSimulation(scenarioInputs, simulateSurvivor, activeScenarioSequence);
        // Ending portfolio value at age 90 (year 2060, the last row)
        const endVal = res[res.length - 1]?.totalPortfolioValue || 0;
        const key = `${yourSSAge}-${wifeSSAge}`;
        grid[key] = endVal;

        if (endVal > maxVal) maxVal = endVal;
        if (endVal < minVal) minVal = endVal;
      }
    }

    return { grid, maxVal, minVal };
  }, [inputs, simulateSurvivor, activeScenarioSequence]);

  // Heatmap styling calculator
  const getCellColor = (yourAge: number, wifeAge: number) => {
    const key = `${yourAge}-${wifeAge}`;
    const val = matrixData.grid[key];
    const range = matrixData.maxVal - matrixData.minVal;
    
    // Avoid division by zero
    const pct = range > 0 ? (val - matrixData.minVal) / range : 0.5;

    // Green to Slate scale:
    // We want emerald highlight for high values, and slate/zinc for low values
    // HSL: Slate-900 (222, 47%, 11%) to Emerald-600 (162, 72%, 48%)
    // Let's interpolate
    const h = 140 + Math.floor(pct * 22); // interpolates between 140 and 162
    const s = 40 + Math.floor(pct * 30); // 40% to 70%
    const l = 15 + Math.floor(pct * 15); // 15% to 30%
    
    const isSelected = inputs.you.targetSSClaimingAge === yourAge && inputs.wife.targetSSClaimingAge === wifeAge;
    
    return {
      style: {
        backgroundColor: `hsl(${h}, ${s}%, ${l}%)`,
      },
      className: `transition-all duration-300 relative border flex flex-col justify-center items-center h-16 w-full text-center cursor-pointer select-none rounded-lg text-xs font-mono font-bold ${
        isSelected
          ? 'border-emerald-400 ring-2 ring-emerald-500/50 shadow-lg scale-105 z-10 text-emerald-300'
          : 'border-slate-800/40 text-slate-300 hover:border-slate-600 hover:scale-102 hover:text-slate-100'
      }`,
      value: val,
    };
  };

  // Find optimal combination
  const optimalClaiming = useMemo(() => {
    let bestKey = '';
    let bestVal = -Infinity;
    for (const k in matrixData.grid) {
      if (matrixData.grid[k] > bestVal) {
        bestVal = matrixData.grid[k];
        bestKey = k;
      }
    }
    const [yourAge, wifeAge] = bestKey.split('-').map(Number);
    return { yourAge, wifeAge, value: bestVal };
  }, [matrixData]);

  // Lifecycle Line Chart Data
  const lineChartData = useMemo(() => {
    const yearsLabels = ledger.map((r) => String(r.year));
    
    const totalVals = ledger.map((r) => r.totalPortfolioValue);
    const taxableVals = ledger.map((r) => r.endYourTaxableBrokerage + r.endWifeTaxableBrokerage);
    const preTaxVals = ledger.map((r) => r.endYourPreTaxIRA + r.endWifePreTaxIRA);
    const rothVals = ledger.map((r) => r.endYourRothIRA + r.endWifeRothIRA);

    return {
      labels: yearsLabels,
      datasets: [
        {
          label: 'Total Net Estate',
          data: totalVals,
          borderColor: '#10b981', // emerald-500
          borderWidth: 3,
          pointRadius: 0,
          fill: false,
          tension: 0.2,
        },
        {
          label: 'Pre-Tax Traditional Accounts',
          data: preTaxVals,
          borderColor: '#f59e0b', // amber
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.2,
        },
        {
          label: 'Roth Balances',
          data: rothVals,
          borderColor: '#a855f7', // purple
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.2,
        },
        {
          label: 'Taxable Brokerage Accounts',
          data: taxableVals,
          borderColor: '#3b82f6', // blue
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.2,
        },
      ],
    };
  }, [ledger]);

  const lineChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            color: '#cbd5e1',
            font: { size: 11 },
            boxWidth: 12,
          },
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          callbacks: {
            label: function (context: any) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) {
                label += formatCurrency(context.parsed.y);
              }
              return label;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#94a3b8', font: { size: 10 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: {
            color: '#94a3b8',
            font: { size: 10 },
            callback: (val: any) => '$' + (val / 1000) + 'k',
          },
        },
      },
    };
  }, []);

  return (
    <div className="glass-panel rounded-2xl p-6 space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-emerald-400" />
            Workspace 3: Social Security Claiming Matrix Grid
          </h3>
          <p className="text-xs text-slate-400">
            Interactive claiming age optimization. Click any cell to select. Colors represent final portfolio net estate value at Age 90.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Localized Outlook Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2">Outlook:</span>
            <div className="flex gap-1">
              <button
                onClick={() => onChangeScenario('flat')}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                  wsScenario === 'flat' ? 'bg-slate-800 text-slate-100 border border-slate-700/60 font-black' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Flat
              </button>
              <button
                onClick={() => onChangeScenario('p10')}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  wsScenario === 'p10' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-black' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Pessimistic: 10th Percentile Run"
              >
                Worst (P10)
              </button>
              <button
                onClick={() => onChangeScenario('p50')}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  wsScenario === 'p50' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 font-black' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Median: 50th Percentile Run"
              >
                Median (P50)
              </button>
              <button
                onClick={() => onChangeScenario('p90')}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  wsScenario === 'p90' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Optimistic: 90th Percentile Run"
              >
                Best (P90)
              </button>
            </div>
          </div>

          {/* Survivor Toggle Switch */}
          <div className="flex items-center gap-3 bg-slate-950/60 p-2 border border-slate-800 rounded-xl">
          <HeartPulse className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-slate-300 font-medium">Survivor Health View</span>
          <button
            onClick={() => onToggleSurvivor(!simulateSurvivor)}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center ${
              simulateSurvivor ? 'bg-emerald-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`w-4 h-4 bg-slate-900 rounded-full shadow absolute transition-transform ${
                simulateSurvivor ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>

      {/* Survivor Description */}
      {simulateSurvivor && (
        <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl leading-relaxed flex gap-2">
          <Eye className="w-4 h-4 mt-0.5 text-emerald-400 flex-shrink-0" />
          <p>
            <strong>Survivor Modeling Active:</strong> Primary user is projected to pass away in <strong>2045</strong> (at age 85). SS benefits are merged, and all subsequent tax math shifts to Single Filer thresholds to display the long-term tax protection value of early conversions.
          </p>
        </div>
      )}

      {/* 9x9 Claiming Grid */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-4xl bg-slate-950/40 border border-slate-800/60 p-6 rounded-2xl space-y-4">
          <div className="text-center font-bold text-xs text-slate-400 uppercase tracking-wider">
            {(inputs.you.name || 'You')}'s SS Claiming Age (Columns)
          </div>
          <div className="flex gap-4">
            {/* Y-axis title rotated */}
            <div className="flex items-center justify-center">
              <div className="rotate-270 whitespace-nowrap font-bold text-xs text-slate-400 uppercase tracking-wider -my-10" style={{ transform: 'rotate(-90deg)' }}>
                {(inputs.wife.name || 'Spouse')}'s Claiming Age (Rows)
              </div>
            </div>
            
            <div className="flex-1 space-y-1">
              {/* Columns Header (Your Age) */}
              <div className="grid grid-cols-[2.5rem_repeat(9,1fr)] gap-1 mb-2 text-center text-xs text-slate-400 font-mono font-bold items-center">
                <div className="text-slate-500 text-right pr-2"></div>
                {ages.map((a) => (
                  <div key={a}>{a}</div>
                ))}
              </div>

              {/* Grid Rows */}
              {ages.map((wifeAge) => (
                <div key={wifeAge} className="grid grid-cols-[2.5rem_repeat(9,1fr)] gap-1 items-center">
                  {/* Row Header (Wife Age) */}
                  <div className="text-xs text-slate-400 font-mono font-bold text-right pr-3 select-none">
                    {wifeAge}
                  </div>
                  
                  {ages.map((yourAge) => {
                    const cell = getCellColor(yourAge, wifeAge);
                    return (
                      <div
                        key={yourAge}
                        style={cell.style}
                        className={cell.className}
                        onClick={() => onUpdateClaimingAges(yourAge, wifeAge)}
                        title={`Your Age: ${yourAge}, Wife Age: ${wifeAge}\nEnding Estate: ${formatCurrency(cell.value)}`}
                      >
                        <span className="text-xs opacity-95 leading-tight">
                          {(cell.value / 1000000).toFixed(2)}M
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          
          {/* Legend and Optimization suggestion */}
          <div className="flex justify-between items-center text-xs border-t border-slate-800/60 pt-4 mt-2">
            <span className="text-slate-400">
              Optimal Claiming: {inputs.you.name || 'You'}'s Age <strong>{optimalClaiming.yourAge}</strong> / {inputs.wife.name || 'Spouse'}'s Age <strong>{optimalClaiming.wifeAge}</strong>
              <span className="text-emerald-400 ml-1">({formatCurrency(optimalClaiming.value)} Ending Value)</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">Less</span>
              <div className="w-16 h-2 rounded bg-gradient-to-r from-slate-900 to-emerald-600" />
              <span className="text-[10px] text-slate-500">More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Lifespan Line Chart */}
      <div className="space-y-4 pt-4 border-t border-slate-800/40">
        <div>
          <h4 className="text-sm font-bold text-slate-200">Portfolio Account Lifespan Breakdown</h4>
          <p className="text-xs text-slate-500">
            Current Scenario: {inputs.you.name || 'You'} claims at age {inputs.you.targetSSClaimingAge} and {inputs.wife.name || 'Spouse'} claims at age {inputs.wife.targetSSClaimingAge}.
          </p>
        </div>
        <div className="h-64 relative bg-slate-950/40 rounded-xl border border-slate-800/40 p-4">
          <Line data={lineChartData} options={lineChartOptions} />
        </div>
      </div>
    </div>
  );
};
