import React from 'react';
import { HeartHandshake, Sparkles, ShieldCheck, DollarSign, Percent } from 'lucide-react';
import { CharitySettings, DEFAULT_CHARITY_SETTINGS } from '../types';

interface CharityControlPanelProps {
  settings?: CharitySettings;
  onChange: (settings: CharitySettings) => void;
  yourAge?: number;
  wifeAge?: number;
  isSingleFiler?: boolean;
}

export const CharityControlPanel: React.FC<CharityControlPanelProps> = ({
  settings = DEFAULT_CHARITY_SETTINGS,
  onChange,
  yourAge,
  wifeAge,
  isSingleFiler = false,
}) => {
  const currentSettings: CharitySettings = {
    enabled: settings?.enabled ?? false,
    growthPercentage: settings?.growthPercentage ?? 0.10,
    minAnnualTithe: settings?.minAnnualTithe ?? null,
    maxAnnualTithe: settings?.maxAnnualTithe ?? null,
    useQCD: settings?.useQCD ?? true,
  };

  const handleToggle = (enabled: boolean) => {
    onChange({
      ...currentSettings,
      enabled,
    });
  };

  const handleGrowthPctChange = (pct: number) => {
    onChange({
      ...currentSettings,
      growthPercentage: Math.max(0, Math.min(1, pct)),
    });
  };

  const handleMinChange = (val: string) => {
    const num = val === '' ? null : Math.max(0, parseFloat(val) || 0);
    onChange({
      ...currentSettings,
      minAnnualTithe: num,
    });
  };

  const handleMaxChange = (val: string) => {
    const num = val === '' ? null : Math.max(0, parseFloat(val) || 0);
    onChange({
      ...currentSettings,
      maxAnnualTithe: num,
    });
  };

  const handleQcdToggle = (useQCD: boolean) => {
    onChange({
      ...currentSettings,
      useQCD,
    });
  };

  const isEligibleNow = (yourAge != null && yourAge >= 70.5) || (!isSingleFiler && wifeAge != null && wifeAge >= 70.5);

  return (
    <div className="space-y-4">
      {/* Header & Toggle */}
      <div className="flex items-center justify-between p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/60 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              Charitable Tithe & QCD Engine
            </div>
            <div className="text-xs text-slate-400">
              Tithe from annual portfolio investment growth
            </div>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={currentSettings.enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
        </label>
      </div>

      {currentSettings.enabled && (
        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60 space-y-4 text-xs animate-in fade-in duration-200">
          {/* Growth Percentage Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="font-medium flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-rose-400" />
                Tithe Percentage of Portfolio Growth:
              </span>
              <span className="text-sm font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                {(currentSettings.growthPercentage * 100).toFixed(1)}%
              </span>
            </div>

            <input
              type="range"
              min="0.01"
              max="0.50"
              step="0.005"
              value={currentSettings.growthPercentage}
              onChange={(e) => handleGrowthPctChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>1%</span>
              <span>10% (Default)</span>
              <span>25%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Optional Floor & Ceiling Limits */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-700/50">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                Annual Floor (Min):
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="500"
                  placeholder="None ($0 in down yrs)"
                  value={currentSettings.minAnnualTithe ?? ''}
                  onChange={(e) => handleMinChange(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-500 text-xs focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Guaranteed minimum gift</p>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-amber-400" />
                Annual Cap (Max):
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="No ceiling"
                  value={currentSettings.maxAnnualTithe ?? ''}
                  onChange={(e) => handleMaxChange(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-500 text-xs focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Upper limit per year</p>
            </div>
          </div>

          {/* QCD Toggle & Info */}
          <div className="pt-2 border-t border-slate-700/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                <span className="font-semibold text-slate-200">
                  Qualified Charitable Distributions (QCD)
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentSettings.useQCD}
                  onChange={(e) => handleQcdToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>

            <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/40 text-slate-300 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 text-sky-300 font-medium text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span>Tax-Optimized Sourcing at Age 70.5+</span>
              </div>
              <p className="text-[10px] text-slate-300">
                Starting at age 70.5, QCDs transfer funds directly from Traditional IRAs to 501(c)(3) charities up to $105,000/yr per person. QCDs satisfy required minimum distributions (RMDs) dollar-for-dollar and bypass AGI entirely, shielding against ordinary income tax and Medicare IRMAA surcharges.
              </p>
              {isEligibleNow ? (
                <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
                  ✓ Currently eligible for QCDs based on age.
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 mt-1">
                  Prior to age 70.5, tithes are funded from Cash and Taxable Brokerage with automatic itemized deduction optimization.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
