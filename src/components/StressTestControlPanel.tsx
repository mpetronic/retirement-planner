import React, { useState } from 'react';
import { AppStateInputs, StressTestConfig, StressTestYearOverride } from '../types';
import { 
  Zap, 
  Plus, 
  Trash2, 
  RotateCcw, 
  TrendingDown, 
  ShieldAlert,
  Info,
  HelpCircle,
  X,
  BookOpen,
  Check
} from 'lucide-react';

interface StressTestControlPanelProps {
  inputs: AppStateInputs;
  onChangeInputs: (newInputs: AppStateInputs) => void;
}

type PresetKey = '3yr-shock' | '2008-gfc' | '2000-dotcom';

const PRESET_HELP_DATA: Record<PresetKey, {
  title: string;
  badge: string;
  color: 'rose' | 'amber' | 'purple';
  summary: string;
  context: string;
  intent: string;
  rates: { yearLabel: string; stock: string; bond: string }[];
}> = {
  '3yr-shock': {
    title: '3-Year Early Retirement Crash',
    badge: 'Sequence of Returns Risk Test',
    color: 'rose',
    summary: 'Simulates 3 consecutive negative market years immediately entering retirement.',
    context: 'Sequence of Returns Risk occurs when severe market declines happen right when portfolio withdrawals begin. Experiencing negative returns in early retirement forces you to sell equities at depressed prices, permanently impairing portfolio recovery potential.',
    intent: 'Tests whether your retirement plan can remain solvent through a prolonged 3-year early retirement bear market (-25%, -15%, -10%) without suffering portfolio ruin.',
    rates: [
      { yearLabel: 'Year 1 (2027)', stock: '-25.0%', bond: '-5.0%' },
      { yearLabel: 'Year 2 (2028)', stock: '-15.0%', bond: '+2.0%' },
      { yearLabel: 'Year 3 (2029)', stock: '-10.0%', bond: '+3.0%' },
    ]
  },
  '2008-gfc': {
    title: '2008 Great Financial Crisis (GFC)',
    badge: 'Systemic Financial Shock & V-Recovery',
    color: 'amber',
    summary: 'Modeled after the historical 2008 subprime mortgage crisis and 2009 market rebound.',
    context: 'In 2008, the S&P 500 crashed -37.0% due to global financial systemic failures, while US 10-Yr Treasuries rallied +5.0% as investors fled to safety. The market rebounded sharply in 2009 (+26.0% S&P 500).',
    intent: 'Evaluates your portfolio against a sudden, violent liquidity shock followed by a rapid V-shaped recovery. Verifies if cash & fixed income buffers prevent locking in equity losses during sharp crashes.',
    rates: [
      { yearLabel: 'Year 1 (2028)', stock: '-37.0%', bond: '+5.0%' },
      { yearLabel: 'Year 2 (2029)', stock: '+26.0%', bond: '+5.0%' },
    ]
  },
  '2000-dotcom': {
    title: '2000–2002 Dot-Com Bubble Collapse',
    badge: 'Secular Tech Bear Market',
    color: 'purple',
    summary: 'Modeled after the 3-year post-tech bubble market decline.',
    context: 'Following the 1990s tech boom, the S&P 500 fell for 3 consecutive years (2000: -9.1%, 2001: -11.9%, 2002: -22.1%) as technology valuations collapsed, while Treasury bonds posted positive returns (+8% to +10%/yr).',
    intent: 'Tests how your retirement strategy fares during an extended multi-year secular equity decline where stocks bleed out over several consecutive calendar years.',
    rates: [
      { yearLabel: 'Year 1 (2028)', stock: '-9.0%', bond: '+8.0%' },
      { yearLabel: 'Year 2 (2029)', stock: '-12.0%', bond: '+7.0%' },
      { yearLabel: 'Year 3 (2030)', stock: '-22.0%', bond: '+10.0%' },
    ]
  }
};

export const StressTestControlPanel: React.FC<StressTestControlPanelProps> = ({
  inputs,
  onChangeInputs,
}) => {
  const [activeHelpModal, setActiveHelpModal] = useState<PresetKey | null>(null);

  const currentConfig: StressTestConfig = inputs.monteCarloSettings.stressTest || {
    enabled: false,
    mode: 'absolute',
    overrides: [],
  };

  const updateStressConfig = (updated: Partial<StressTestConfig>) => {
    const newConfig: StressTestConfig = {
      ...currentConfig,
      ...updated,
    };
    onChangeInputs({
      ...inputs,
      monteCarloSettings: {
        ...inputs.monteCarloSettings,
        stressTest: newConfig,
      },
    });
  };

  // Helper to format percentages
  const formatPct = (val: number) => `${(val * 100).toFixed(1)}%`;

  // Preset scenarios
  const applyPreset = (presetName: PresetKey) => {
    let overrides: StressTestYearOverride[] = [];
    
    if (presetName === '2008-gfc') {
      overrides = [
        { year: 2028, equityReturn: -0.37, fixedIncomeReturn: 0.05 },
        { year: 2029, equityReturn: 0.26, fixedIncomeReturn: 0.05 },
      ];
    } else if (presetName === '2000-dotcom') {
      overrides = [
        { year: 2028, equityReturn: -0.09, fixedIncomeReturn: 0.08 },
        { year: 2029, equityReturn: -0.12, fixedIncomeReturn: 0.07 },
        { year: 2030, equityReturn: -0.22, fixedIncomeReturn: 0.10 },
      ];
    } else if (presetName === '3yr-shock') {
      overrides = [
        { year: 2027, equityReturn: -0.25, fixedIncomeReturn: -0.05 },
        { year: 2028, equityReturn: -0.15, fixedIncomeReturn: 0.02 },
        { year: 2029, equityReturn: -0.10, fixedIncomeReturn: 0.03 },
      ];
    }

    updateStressConfig({
      enabled: true,
      mode: 'absolute',
      overrides,
    });
  };

  const addYearOverride = () => {
    const existingYears = new Set(currentConfig.overrides.map(o => o.year));
    let nextYear = 2027;
    while (nextYear <= 2060 && existingYears.has(nextYear)) {
      nextYear++;
    }
    if (nextYear > 2060) nextYear = 2026;

    const newOverrides = [
      ...currentConfig.overrides,
      { year: nextYear, equityReturn: -0.20, fixedIncomeReturn: 0.00 },
    ].sort((a, b) => a.year - b.year);

    updateStressConfig({ overrides: newOverrides });
  };

  const updateYearOverride = (index: number, field: keyof StressTestYearOverride, val: number) => {
    const newOverrides = [...currentConfig.overrides];
    newOverrides[index] = {
      ...newOverrides[index],
      [field]: val,
    };
    newOverrides.sort((a, b) => a.year - b.year);
    updateStressConfig({ overrides: newOverrides });
  };

  const removeYearOverride = (index: number) => {
    const newOverrides = currentConfig.overrides.filter((_, i) => i !== index);
    updateStressConfig({ overrides: newOverrides });
  };

  const clearAllOverrides = () => {
    updateStressConfig({ overrides: [] });
  };

  const activeModalData = activeHelpModal ? PRESET_HELP_DATA[activeHelpModal] : null;

  return (
    <div className={`glass-panel rounded-2xl p-6 border transition-all duration-300 ${
      currentConfig.enabled 
        ? 'border-rose-500/40 bg-slate-900/40 shadow-lg shadow-rose-950/20' 
        : 'border-slate-800 bg-slate-900/20'
    }`}>
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl border ${
            currentConfig.enabled ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'
          }`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Sequence of Returns Risk & Stress Testing
              </h4>
              {currentConfig.enabled && (
                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Force custom down-market decline and recovery shapes on specific retirement years.
            </p>
          </div>
        </div>

        {/* Master Toggle Switch */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 select-none">
            {currentConfig.enabled ? 'Stress Overlay Enabled' : 'Disabled (Baseline MC)'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={currentConfig.enabled}
            onClick={() => updateStressConfig({ enabled: !currentConfig.enabled })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              currentConfig.enabled ? 'bg-rose-500' : 'bg-slate-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                currentConfig.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Preset Buttons & Mode Selector */}
      <div className="mt-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Preset Buttons with Help Triggers */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Presets:
            </span>

            {/* Preset 1: 3-Yr Early Crash */}
            <div className="flex items-center bg-rose-500/10 border border-rose-500/30 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => applyPreset('3yr-shock')}
                className="px-2 py-1 text-xs font-semibold text-rose-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                title="Apply 3-Yr Early Crash Preset (-25%, -15%, -10%)"
              >
                <TrendingDown className="w-3 h-3 text-rose-400" />
                3-Yr Early Crash (-25%, -15%, -10%)
              </button>
              <button
                type="button"
                onClick={() => setActiveHelpModal('3yr-shock')}
                className="p-1 text-rose-400 hover:text-white hover:bg-rose-500/30 rounded transition-colors cursor-pointer"
                title="3-Year Early Retirement Crash (Sequence of Returns Risk)"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Preset 2: 2008 GFC */}
            <div className="flex items-center bg-amber-500/10 border border-amber-500/30 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => applyPreset('2008-gfc')}
                className="px-2 py-1 text-xs font-semibold text-amber-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                title="Apply 2008 GFC Preset (-37%, +26%)"
              >
                2008 GFC (-37%, +26%)
              </button>
              <button
                type="button"
                onClick={() => setActiveHelpModal('2008-gfc')}
                className="p-1 text-amber-400 hover:text-white hover:bg-amber-500/30 rounded transition-colors cursor-pointer"
                title="2008 Great Financial Crisis (-37% Stock Shock & +26% V-Recovery)"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Preset 3: 2000 Tech Bust */}
            <div className="flex items-center bg-purple-500/10 border border-purple-500/30 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => applyPreset('2000-dotcom')}
                className="px-2 py-1 text-xs font-semibold text-purple-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                title="Apply 2000 Tech Bust Preset (-9%, -12%, -22%)"
              >
                2000 Tech Bust (-9%, -12%, -22%)
              </button>
              <button
                type="button"
                onClick={() => setActiveHelpModal('2000-dotcom')}
                className="p-1 text-purple-400 hover:text-white hover:bg-purple-500/30 rounded transition-colors cursor-pointer"
                title="2000-2002 Dot-Com Bubble Collapse (3-Year Secular Tech Bear Market)"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>

            {currentConfig.overrides.length > 0 && (
              <button
                type="button"
                onClick={clearAllOverrides}
                className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                title="Clear all configured year overrides"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {/* Mode Selector */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => updateStressConfig({ mode: 'absolute' })}
              className={`px-2.5 py-1 text-[10px] rounded-md font-bold transition-all ${
                currentConfig.mode === 'absolute'
                  ? 'bg-rose-500 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Force absolute target return percentages for specified years"
            >
              Fixed Override Rate %
            </button>
            <button
              type="button"
              onClick={() => updateStressConfig({ mode: 'relative' })}
              className={`px-2.5 py-1 text-[10px] rounded-md font-bold transition-all ${
                currentConfig.mode === 'relative'
                  ? 'bg-rose-500 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Apply shock delta offset to each random trial draw"
            >
              Relative Shock Delta %
            </button>
          </div>
        </div>

        {/* Override Table / Form */}
        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Stressed Years Timeline ({currentConfig.overrides.length} years configured)
            </span>
            <button
              type="button"
              onClick={addYearOverride}
              className="px-3 py-1.5 text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Stressed Year
            </button>
          </div>

          {currentConfig.overrides.length === 0 ? (
            <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/40 text-center text-xs text-slate-400">
              No stress test years configured. Click <strong className="text-slate-200">"Add Stressed Year"</strong> or select a preset template above to simulate sequence of returns risk.
            </div>
          ) : (
            <div className="space-y-2.5">
              {currentConfig.overrides.map((ov, index) => (
                <div 
                  key={index}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors"
                >
                  {/* Year Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-400 font-mono w-6">#{index + 1}</span>
                    <select
                      value={ov.year}
                      onChange={(e) => updateYearOverride(index, 'year', Number(e.target.value))}
                      className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-900 text-slate-100 border border-slate-700 rounded-lg focus:outline-none focus:border-rose-500 cursor-pointer"
                    >
                      {Array.from({ length: 35 }, (_, i) => 2026 + i).map((yr) => (
                        <option key={yr} value={yr}>
                          Year {yr}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Equity Return Slider & Input */}
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Stock (Equity) Return:</span>
                      <span className={`font-mono font-bold ${ov.equityReturn < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {ov.equityReturn > 0 ? '+' : ''}{formatPct(ov.equityReturn)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-0.60"
                      max="0.50"
                      step="0.01"
                      value={ov.equityReturn}
                      onChange={(e) => updateYearOverride(index, 'equityReturn', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                    />
                  </div>

                  {/* Bond Return Slider & Input */}
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Bond (Fixed Income) Return:</span>
                      <span className={`font-mono font-bold ${ov.fixedIncomeReturn < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {ov.fixedIncomeReturn > 0 ? '+' : ''}{formatPct(ov.fixedIncomeReturn)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-0.30"
                      max="0.30"
                      step="0.01"
                      value={ov.fixedIncomeReturn}
                      onChange={(e) => updateYearOverride(index, 'fixedIncomeReturn', Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                    />
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeYearOverride(index)}
                    className="p-1.5 bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 rounded-lg transition-colors cursor-pointer self-end sm:self-center"
                    title="Remove this year override"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contextual Note */}
        <div className="pt-2">
          <p className="text-[10px] text-slate-400 leading-normal flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
            When stress testing is active, configured years override simulated market returns across all Monte Carlo trials. Toggle OFF at any time to restore original Monte Carlo predictions.
          </p>
        </div>
      </div>

      {/* Historical Context & Intent Explanation Modal */}
      {activeHelpModal && activeModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <h3 className="text-base font-bold text-slate-100">{activeModalData.title}</h3>
                </div>
                <span className={`mt-1 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  activeModalData.color === 'rose'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : activeModalData.color === 'amber'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                }`}>
                  {activeModalData.badge}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveHelpModal(null)}
                className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Historical Context */}
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Historical Background</h4>
                <p className="text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  {activeModalData.context}
                </p>
              </div>

              {/* Stress Test Intent */}
              <div className="space-y-1">
                <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Stress Testing Purpose & Intent</h4>
                <p className="text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  {activeModalData.intent}
                </p>
              </div>

              {/* Configured Return Rates Breakdown */}
              <div className="space-y-1">
                <h4 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Configured Return Overrides</h4>
                <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-hidden">
                  <div className="grid grid-cols-3 bg-slate-900 p-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <span>Period</span>
                    <span>Stock Return</span>
                    <span>Bond Return</span>
                  </div>
                  {activeModalData.rates.map((r, i) => (
                    <div key={i} className="grid grid-cols-3 p-2 border-b border-slate-800/40 last:border-0 font-mono">
                      <span className="text-slate-300 font-sans font-medium">{r.yearLabel}</span>
                      <span className={r.stock.startsWith('-') ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{r.stock}</span>
                      <span className={r.bond.startsWith('-') ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{r.bond}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end items-center gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setActiveHelpModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  applyPreset(activeHelpModal);
                  setActiveHelpModal(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                Apply Preset & Run Stress Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

