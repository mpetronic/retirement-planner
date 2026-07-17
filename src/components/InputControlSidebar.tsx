import React, { useState, useRef, useMemo } from 'react';
import { AppStateInputs, RECURRING_EXPENSE_ITEMS } from '../types';
import {
  User,
  TrendingUp,
  Coins,
  MapPin,
  Flame,
  DollarSign,
  Pencil,
  Check,
  RefreshCw,
  Info,
  Settings,
  HelpCircle,
  Heart
} from 'lucide-react';
import { DetailedExpensesDialog } from './DetailedExpensesDialog';
import { HealthcareConfigDialog } from './HealthcareConfigDialog';

const getBirthMonth = (dateStr: string | undefined): number => {
  if (!dateStr) return 1;
  const parts = dateStr.split('-');
  if (parts.length < 2) return 1;
  const m = parseInt(parts[1], 10);
  return isNaN(m) ? 1 : m;
};

interface InputControlSidebarProps {
  inputs: AppStateInputs;
  onChange: (newInputs: AppStateInputs) => void;
  onReset: () => void;
  useTodayDollars: boolean;
  setUseTodayDollars: (val: boolean) => void;
  globalScenario: 'flat' | 'p10' | 'p50' | 'p90';
  simulateSurvivor: boolean;
  setSimulateSurvivor: (val: boolean) => void;
}

export const InputControlSidebar: React.FC<InputControlSidebarProps> = ({
  inputs,
  onChange,
  onReset,
  useTodayDollars,
  setUseTodayDollars,
  globalScenario,
  simulateSurvivor,
  setSimulateSurvivor,
}) => {
  const [isEditingYou, setIsEditingYou] = useState(false);
  const [isEditingWife, setIsEditingWife] = useState(false);
  const [showExpensesDialog, setShowExpensesDialog] = useState(false);
  const [editingHealthcarePerson, setEditingHealthcarePerson] = useState<'you' | 'wife' | null>(null);

  const mdMonthlySum = useMemo(() => {
    if (!inputs.detailedExpenses) return 0;
    let sum = 0;
    for (const item of RECURRING_EXPENSE_ITEMS) {
      const cost = inputs.detailedExpenses.MD[item.key] || 0;
      const freq = inputs.detailedExpenses.frequencies[item.key] ?? item.defaultFrequency;
      sum += cost * freq;
    }
    return sum / 12;
  }, [inputs.detailedExpenses]);

  const flMonthlySum = useMemo(() => {
    if (!inputs.detailedExpenses) return 0;
    let sum = 0;
    for (const item of RECURRING_EXPENSE_ITEMS) {
      const cost = inputs.detailedExpenses.FL[item.key] || 0;
      const freq = inputs.detailedExpenses.frequencies[item.key] ?? item.defaultFrequency;
      sum += cost * freq;
    }
    return sum / 12;
  }, [inputs.detailedExpenses]);

  const yourBirthYear = React.useMemo(() => {
    if (!inputs.you.birthDate) return 1960;
    const year = parseInt(inputs.you.birthDate.split('-')[0], 10);
    return isNaN(year) ? 1960 : year;
  }, [inputs.you.birthDate]);

  const wifeBirthYear = React.useMemo(() => {
    if (!inputs.wife.birthDate) return 1964;
    const year = parseInt(inputs.wife.birthDate.split('-')[0], 10);
    return isNaN(year) ? 1964 : year;
  }, [inputs.wife.birthDate]);
  // Remembers the last non-null relocation year so toggling off then back on restores it.
  const lastRelocationYear = useRef<number>(inputs.jurisdiction.relocationYear ?? 2032);
  const updateNestedState = (
    category: keyof AppStateInputs | 'you' | 'wife' | 'jurisdiction' | 'growthAssumptions' | 'portfolio',
    field: string,
    value: any
  ) => {
    const updated = { ...inputs };
    if (category === 'you' || category === 'wife') {
      updated[category] = { ...updated[category], [field]: value };
    } else if (category === 'jurisdiction') {
      updated.jurisdiction = { ...updated.jurisdiction, [field]: value };
    } else if (category === 'growthAssumptions') {
      updated.growthAssumptions = { ...updated.growthAssumptions, [field]: value };
    } else if (category === 'portfolio') {
      updated.portfolio = { ...updated.portfolio, [field]: value };
    } else {
      (updated as any)[category] = value;
    }
    onChange(updated);
  };

  const formatCurrency = (val: number | null | undefined) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatPercent = (val: number) => {
    return `${(val * 100).toFixed(1)}%`;
  };

  return (
    <aside className="w-full lg:w-96 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Sidebar Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/60 sticky top-0 backdrop-blur-md z-10 flex items-center gap-3">
        <Flame className="w-7 h-7 text-emerald-500 animate-pulse" />
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
            Scenario Planner
          </h1>
          <p className="text-xs text-slate-400">Configure parameters in real-time</p>
        </div>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* Global Valuation Toggle */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold border-b border-slate-800 pb-2">
            <DollarSign className="w-5 h-5" />
            <h2>Currency Valuation</h2>
          </div>
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
            <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setUseTodayDollars(false)}
                className={`flex-1 text-[10px] py-2 rounded-lg font-bold transition-all ${
                  !useTodayDollars
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Future Dollars (Nominal)
              </button>
              <button
                type="button"
                onClick={() => setUseTodayDollars(true)}
                className={`flex-1 text-[10px] py-2 rounded-lg font-bold transition-all ${
                  useTodayDollars
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Today's Dollars (Real)
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal flex items-start gap-1.5">
              <Info className="w-4 h-4 text-emerald-500/80 flex-shrink-0 mt-0.5" />
              <span>
                {!useTodayDollars
                  ? "Displaying actual nominal dollar amounts including standard CPI adjustments and compounding growth."
                  : "Discounting all future balances and expenses back by the CPI inflation factor to reflect today's real purchasing power."}
              </span>
            </p>
          </div>
        </div>

        {/* Section 1: Spouses Profiles */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold border-b border-slate-800 pb-2">
            <User className="w-5 h-5" />
            <h2>Spouse Profiles</h2>
          </div>

          {/* Primary User (You) */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
            {isEditingYou ? (
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-xs text-slate-400 font-bold uppercase whitespace-nowrap">Primary User:</span>
                  <input
                    type="text"
                    value={inputs.you.name || ''}
                    onChange={(e) => updateNestedState('you', 'name', e.target.value)}
                    onBlur={() => setIsEditingYou(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingYou(false); }}
                    placeholder="Enter name"
                    autoFocus
                    className="bg-slate-900 border border-emerald-500/50 rounded px-2 py-0.5 text-xs text-slate-100 font-semibold focus:outline-none w-full focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={() => setIsEditingYou(false)}
                  className="text-emerald-400 hover:text-emerald-300 p-0.5 hover:bg-slate-800 rounded transition-colors"
                  title="Save name"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingYou(true)}>
                  <span className="text-sm font-semibold text-slate-200 hover:text-emerald-400 transition-colors">
                    Primary User ({inputs.you.name || 'You'})
                  </span>
                  <Pencil className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer" />
                </div>
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono">{yourBirthYear}</span>
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Estimated SS Monthly PIA (at Age 67)</label>
              <div className="relative">
                <span className="absolute left-3 top-1 text-slate-500 text-xs font-semibold">$</span>
                <input
                  type="number"
                  value={inputs.you.estimatedPIA === null ? '' : inputs.you.estimatedPIA}
                  onChange={(e) => updateNestedState('you', 'estimatedPIA', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="e.g. 3000"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-6 pr-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Target Social Security Claiming Age</span>
                <span className="text-emerald-400 font-bold font-mono">Age {inputs.you.targetSSClaimingAge ?? 67}</span>
              </label>
              <input
                type="range"
                min="62"
                max="70"
                step="1"
                value={inputs.you.targetSSClaimingAge ?? 67}
                onChange={(e) => updateNestedState('you', 'targetSSClaimingAge', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
                <span>62 (Reduced)</span>
                <span>67 (FRA)</span>
                <span>70 (Max)</span>
              </div>
            </div>

            {/* Planned Retirement — single slider stepping by month */}
            <div className="space-y-2 pt-1 border-t border-slate-800/30">
              <div className="space-y-1">
                {(() => {
                  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                  const age = inputs.you.plannedRetirementAge ?? 67;
                  const mon = inputs.you.plannedRetirementMonth ?? getBirthMonth(inputs.you.birthDate);
                  const sliderVal = (age - 55) * 12 + (mon - 1);
                  return (
                    <>
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between">
                        <span>Retire Age</span>
                        <span className="text-emerald-400 font-mono font-semibold">
                          Age {age} · {MONTHS[mon - 1]}
                        </span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="239"
                        step="1"
                        value={sliderVal}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const newAge = 55 + Math.floor(v / 12);
                          const newMon = (v % 12) + 1;
                          const next = { ...inputs, you: { ...inputs.you, plannedRetirementAge: newAge, plannedRetirementMonth: newMon } };
                          onChange(next);
                        }}
                        className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono px-0.5">
                        <span>55</span>
                        <span>60</span>
                        <span>65</span>
                        <span>70</span>
                        <span>75</span>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Salary</label>
                <div className="relative">
                  <span className="absolute left-3 top-1 text-slate-500 text-xs font-semibold">$</span>
                  <input
                    type="number"
                    value={inputs.you.activeSalary === null ? '' : inputs.you.activeSalary}
                    onChange={(e) => updateNestedState('you', 'activeSalary', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="e.g. 150000"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-6 pr-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Healthcare Planning Dialog Trigger */}
            <div className="pt-2 border-t border-slate-800/30">
            <button
              type="button"
              onClick={() => setEditingHealthcarePerson('you')}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <Heart className="w-3.5 h-3.5 text-emerald-500" />
              <span>Configure Health Expenses</span>
            </button>
            </div>
          </div>

          {/* Wife Profile */}
          {!inputs.isSingleFiler && (
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
              {isEditingWife ? (
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-xs text-slate-400 font-bold uppercase whitespace-nowrap">Spouse:</span>
                    <input
                      type="text"
                      value={inputs.wife.name || ''}
                      onChange={(e) => updateNestedState('wife', 'name', e.target.value)}
                      onBlur={() => setIsEditingWife(false)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingWife(false); }}
                      placeholder="Enter name"
                      autoFocus
                      className="bg-slate-900 border border-emerald-500/50 rounded px-2 py-0.5 text-xs text-slate-100 font-semibold focus:outline-none w-full focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    onClick={() => setIsEditingWife(false)}
                    className="text-emerald-400 hover:text-emerald-300 p-0.5 hover:bg-slate-800 rounded transition-colors"
                    title="Save name"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingWife(true)}>
                    <span className="text-sm font-semibold text-slate-200 hover:text-emerald-400 transition-colors">
                      Spouse ({inputs.wife.name || 'Spouse'})
                    </span>
                    <Pencil className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer" />
                  </div>
                  <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono">{wifeBirthYear}</span>
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Estimated SS Monthly PIA (at Age 67)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1 text-slate-500 text-xs font-semibold">$</span>
                  <input
                    type="number"
                    value={inputs.wife.estimatedPIA === null ? '' : inputs.wife.estimatedPIA}
                    onChange={(e) => updateNestedState('wife', 'estimatedPIA', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="e.g. 2800"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-6 pr-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400 flex justify-between">
                  <span>Target Social Security Claiming Age</span>
                  <span className="text-emerald-400 font-bold font-mono">Age {inputs.wife.targetSSClaimingAge ?? 67}</span>
                </label>
                <input
                  type="range"
                  min="62"
                  max="70"
                  step="1"
                  value={inputs.wife.targetSSClaimingAge ?? 67}
                  onChange={(e) => updateNestedState('wife', 'targetSSClaimingAge', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
                  <span>62 (Reduced)</span>
                  <span>67 (FRA)</span>
                  <span>70 (Max)</span>
                </div>
              </div>

              {/* Planned Retirement — single slider stepping by month */}
              <div className="space-y-2 pt-1 border-t border-slate-800/30">
                <div className="space-y-1">
                  {(() => {
                    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    const age = inputs.wife.plannedRetirementAge ?? 65;
                    const mon = inputs.wife.plannedRetirementMonth ?? getBirthMonth(inputs.wife.birthDate);
                    const sliderVal = (age - 55) * 12 + (mon - 1);
                    return (
                      <>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between">
                          <span>Retire Age</span>
                          <span className="text-emerald-400 font-mono font-semibold">
                            Age {age} · {MONTHS[mon - 1]}
                          </span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="239"
                          step="1"
                          value={sliderVal}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            const newAge = 55 + Math.floor(v / 12);
                            const newMon = (v % 12) + 1;
                            const next = { ...inputs, wife: { ...inputs.wife, plannedRetirementAge: newAge, plannedRetirementMonth: newMon } };
                            onChange(next);
                          }}
                          className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono px-0.5">
                          <span>55</span>
                          <span>60</span>
                          <span>65</span>
                          <span>70</span>
                          <span>75</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Salary</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1 text-slate-500 text-xs font-semibold">$</span>
                    <input
                      type="number"
                      value={inputs.wife.activeSalary === null ? '' : inputs.wife.activeSalary}
                      onChange={(e) => updateNestedState('wife', 'activeSalary', e.target.value === '' ? null : Number(e.target.value))}
                      placeholder="e.g. 100000"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-6 pr-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Healthcare Planning Dialog Trigger */}
              <div className="pt-2 border-t border-slate-800/30">
                <button
                  type="button"
                  onClick={() => setEditingHealthcarePerson('wife')}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Configure Health Expenses</span>
                </button>
              </div>
            </div>
          )}

          {/* Survivor simulation mode toggle switch */}
          {!inputs.isSingleFiler && (
            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <label htmlFor="simulateSurvivorToggle" className="text-xs font-semibold text-slate-200 cursor-pointer block">
                  Simulate Survivor View
                </label>
                <span className="text-[10px] text-slate-500 block leading-normal font-sans">
                  Model compressed tax brackets and Medicare surcharges when one spouse passes away.
                </span>
              </div>
              <input
                type="checkbox"
                id="simulateSurvivorToggle"
                checked={simulateSurvivor}
                onChange={(e) => setSimulateSurvivor(e.target.checked)}
                className="w-4 h-4 bg-slate-900 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer flex-shrink-0"
              />
            </div>
          )}
        </div>

        {/* Section 2: Portfolio Initial Balances */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold border-b border-slate-800 pb-2">
            <Coins className="w-5 h-5" />
            <h2>Starting Balances</h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Your Balances */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-300 block border-b border-slate-800 pb-1">{(inputs.you.name || 'You')}'s Portfolio Assets</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Traditional IRA">Traditional IRA</label>
                  <input
                    type="number"
                    value={inputs.portfolio.yourPreTaxIRA ?? ''}
                    onChange={(e) => updateNestedState('portfolio', 'yourPreTaxIRA', e.target.value === '' ? null : Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Roth IRA Balance">Roth IRA</label>
                  <input
                    type="number"
                    value={inputs.portfolio.yourRothIRA ?? ''}
                    onChange={(e) => updateNestedState('portfolio', 'yourRothIRA', e.target.value === '' ? null : Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Brokerage Assets (Taxable)">Brokerage Assets</label>
                  <input
                    type="number"
                    value={inputs.portfolio.yourTaxableBrokerage ?? ''}
                    onChange={(e) => updateNestedState('portfolio', 'yourTaxableBrokerage', e.target.value === '' ? null : Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Brokerage Cost Basis">Cost Basis</label>
                  <input
                    type="number"
                    value={inputs.portfolio.yourTaxableBasis ?? ''}
                    onChange={(e) => updateNestedState('portfolio', 'yourTaxableBasis', e.target.value === '' ? null : Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Cash Assets Balance">Cash Assets</label>
                  <input
                    type="number"
                    value={inputs.portfolio.yourCash ?? ''}
                    onChange={(e) => updateNestedState('portfolio', 'yourCash', e.target.value === '' ? null : Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Wife Balances */}
            {!inputs.isSingleFiler && (
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-300 block border-b border-slate-800 pb-1">{(inputs.wife.name || 'Spouse')}'s Portfolio Assets</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block truncate" title="Traditional IRA">Traditional IRA</label>
                    <input
                      type="number"
                      value={inputs.portfolio.wifePreTaxIRA ?? ''}
                      onChange={(e) => updateNestedState('portfolio', 'wifePreTaxIRA', e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block truncate" title="Roth IRA Balance">Roth IRA</label>
                    <input
                      type="number"
                      value={inputs.portfolio.wifeRothIRA ?? ''}
                      onChange={(e) => updateNestedState('portfolio', 'wifeRothIRA', e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block truncate" title="Brokerage Assets (Taxable)">Brokerage Assets</label>
                    <input
                      type="number"
                      value={inputs.portfolio.wifeTaxableBrokerage ?? ''}
                      onChange={(e) => updateNestedState('portfolio', 'wifeTaxableBrokerage', e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block truncate" title="Brokerage Cost Basis">Cost Basis</label>
                    <input
                      type="number"
                      value={inputs.portfolio.wifeTaxableBasis ?? ''}
                      onChange={(e) => updateNestedState('portfolio', 'wifeTaxableBasis', e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 block truncate" title="Cash Assets Balance">Cash Assets</label>
                    <input
                      type="number"
                      value={inputs.portfolio.wifeCash ?? ''}
                      onChange={(e) => updateNestedState('portfolio', 'wifeCash', e.target.value === '' ? null : Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Taxable Brokerage Yield & Interest settings */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1">
                <span className="text-xs font-bold text-slate-300 block">Taxable Assets Dividend Yield & Type</span>
                <div className="relative group inline-block">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 bg-slate-950 text-slate-200 text-[10px] p-2.5 rounded-lg border border-slate-800 shadow-xl z-50 leading-normal pointer-events-none normal-case font-medium">
                    <strong>Annual Yield (%)</strong>: The annual percentage of taxable brokerage assets paid out as dividends or interest. Taxed in the year received.<br /><br />
                    <strong>Non-Qualified (%)</strong>: The portion of the yield taxed at ordinary income rates (e.g., bond interest/non-qualified dividends) vs. preferential capital gains rates.
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Annual Dividend/Interest Yield">Annual Yield (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={inputs.portfolio.taxableDividendYield !== null && inputs.portfolio.taxableDividendYield !== undefined ? inputs.portfolio.taxableDividendYield * 100 : ''}
                    onChange={(e) => updateNestedState('portfolio', 'taxableDividendYield', e.target.value === '' ? null : Number(e.target.value) / 100)}
                    placeholder="2.0"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Portion of yield taxed at ordinary income rate (e.g. interest, non-qualified dividends)">Non-Qualified (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={inputs.portfolio.taxableNonQualifiedPortion !== null && inputs.portfolio.taxableNonQualifiedPortion !== undefined ? inputs.portfolio.taxableNonQualifiedPortion * 100 : ''}
                    onChange={(e) => updateNestedState('portfolio', 'taxableNonQualifiedPortion', e.target.value === '' ? null : Number(e.target.value) / 100)}
                    placeholder="30"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Jurisdictional Tax Logic */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold border-b border-slate-800 pb-2">
            <MapPin className="w-5 h-5" />
            <h2>Jurisdiction & Relocation</h2>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Current State</label>
                <select
                  value={inputs.jurisdiction.currentState}
                  onChange={(e) => updateNestedState('jurisdiction', 'currentState', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="MD">Maryland (MD)</option>
                  <option value="FL">Florida (FL)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Target State</label>
                <select
                  value={inputs.jurisdiction.targetState}
                  onChange={(e) => updateNestedState('jurisdiction', 'targetState', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="FL">Florida (FL)</option>
                  <option value="MD">Maryland (MD)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Relocation Year</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {inputs.jurisdiction.relocationYear ? inputs.jurisdiction.relocationYear : 'Never Relocate'}
                </span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="2026"
                  max="2060"
                  step="1"
                  disabled={inputs.jurisdiction.relocationYear === null}
                  value={inputs.jurisdiction.relocationYear ?? lastRelocationYear.current}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    lastRelocationYear.current = val;
                    updateNestedState('jurisdiction', 'relocationYear', val);
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-30"
                />
                <button
                  onClick={() => {
                    const nextVal = inputs.jurisdiction.relocationYear === null
                      ? lastRelocationYear.current  // restore the last year the slider was on
                      : null;
                    if (inputs.jurisdiction.relocationYear !== null) {
                      // Remember current year before clearing it
                      lastRelocationYear.current = inputs.jurisdiction.relocationYear;
                    }
                    updateNestedState('jurisdiction', 'relocationYear', nextVal);
                  }}
                  className={`text-xs px-2 py-1 rounded transition-colors font-semibold ${
                    inputs.jurisdiction.relocationYear === null
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {inputs.jurisdiction.relocationYear === null ? 'Enable' : 'Disable'}
                </button>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/40 leading-relaxed">
              {inputs.jurisdiction.relocationYear 
                ? `Modeling relocation from ${inputs.jurisdiction.currentState} to ${inputs.jurisdiction.targetState} in calendar year ${inputs.jurisdiction.relocationYear}.`
                : `Active residency in ${inputs.jurisdiction.currentState} remains unchanged for the entire 35-year timeline.`}
            </p>
          </div>
        </div>

        {/* Section 4: Growth Assumptions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold border-b border-slate-800 pb-2">
            <TrendingUp className="w-5 h-5" />
            <h2>Growth & Inflation</h2>
          </div>

          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
            <div className={`relative ${globalScenario !== 'flat' ? 'group cursor-help' : ''}`}>
              <div className="grid grid-cols-2 gap-3">
                <div className={`space-y-1 transition-opacity duration-200 ${globalScenario !== 'flat' ? 'opacity-40' : ''}`}>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Equity Return</label>
                  <div className={`flex justify-between items-center text-xs font-mono font-bold ${globalScenario !== 'flat' ? 'text-slate-500' : 'text-slate-200'}`}>
                    <span>Rate:</span>
                    <span>{formatPercent(inputs.growthAssumptions.equityReturnRate)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.00"
                    max="0.15"
                    step="0.005"
                    value={inputs.growthAssumptions.equityReturnRate}
                    disabled={globalScenario !== 'flat'}
                    onChange={(e) => updateNestedState('growthAssumptions', 'equityReturnRate', Number(e.target.value))}
                    className={`w-full h-1 bg-slate-800 rounded-lg appearance-none accent-emerald-500 ${globalScenario !== 'flat' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  />
                </div>

                <div className={`space-y-1 transition-opacity duration-200 ${globalScenario !== 'flat' ? 'opacity-40' : ''}`}>
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Fixed Income</label>
                  <div className={`flex justify-between items-center text-xs font-mono font-bold ${globalScenario !== 'flat' ? 'text-slate-500' : 'text-slate-200'}`}>
                    <span>Rate:</span>
                    <span>{formatPercent(inputs.growthAssumptions.fixedIncomeReturnRate)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.00"
                    max="0.10"
                    step="0.005"
                    value={inputs.growthAssumptions.fixedIncomeReturnRate}
                    disabled={globalScenario !== 'flat'}
                    onChange={(e) => updateNestedState('growthAssumptions', 'fixedIncomeReturnRate', Number(e.target.value))}
                    className={`w-full h-1 bg-slate-800 rounded-lg appearance-none accent-emerald-500 ${globalScenario !== 'flat' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  />
                </div>
              </div>

              {globalScenario !== 'flat' && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-[10px] text-slate-300 normal-case pointer-events-none space-y-1 font-sans">
                  <div className="text-amber-400 font-bold flex items-center gap-1">
                    <span>🔒 Return Rates Overridden</span>
                  </div>
                  <p className="leading-relaxed">
                    Locked: Overridden by the active stochastic <strong>Global Outlook ({globalScenario === 'p10' ? 'Worst' : globalScenario === 'p50' ? 'Median' : 'Best'})</strong> sequence. Switch to <strong>Flat</strong> to manually set static rates.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">CPI Inflation</label>
                <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-200">
                  <span>Rate:</span>
                  <span>{formatPercent(inputs.growthAssumptions.cpiInflationRate)}</span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="0.08"
                  step="0.002"
                  value={inputs.growthAssumptions.cpiInflationRate}
                  onChange={(e) => updateNestedState('growthAssumptions', 'cpiInflationRate', Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Healthcare</label>
                <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-200">
                  <span>Inflation:</span>
                  <span>{formatPercent(inputs.growthAssumptions.healthcareInflationRate)}</span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="0.10"
                  step="0.005"
                  value={inputs.growthAssumptions.healthcareInflationRate}
                  onChange={(e) => updateNestedState('growthAssumptions', 'healthcareInflationRate', Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Expenses */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold border-b border-slate-800 pb-2">
            <DollarSign className="w-5 h-5" />
            <h2>Expenses Worksheet</h2>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-4">
            {/* Toggle choice */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Calculation Method</label>
              <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => updateNestedState('useDetailedExpenses', '', false)}
                  className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold transition-all ${
                     !inputs.useDetailedExpenses
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Simple Slider
                </button>
                <button
                  type="button"
                  onClick={() => updateNestedState('useDetailedExpenses', '', true)}
                  className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold transition-all ${
                    inputs.useDetailedExpenses
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Detailed Expenses
                </button>
              </div>
            </div>

            {inputs.useDetailedExpenses ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowExpensesDialog(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-bold transition-all"
                >
                  <Settings className="w-4 h-4 text-emerald-400" />
                  <span>Configure Detailed Expenses</span>
                </button>
                
                <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2 text-[10px] text-slate-400 leading-normal">
                  <div className="flex justify-between border-b border-slate-800 pb-1">
                    <span className="font-semibold">Maryland (MD) Cost:</span>
                    <span className="text-slate-200 font-mono font-bold">{formatCurrency(mdMonthlySum * 12)}/yr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Florida (FL) Cost:</span>
                    <span className="text-slate-200 font-mono font-bold">{formatCurrency(flMonthlySum * 12)}/yr</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Annual living expenses are calculated as the sum of all itemized recurring expenses for the active state in any simulated year, inflated using CPI.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 flex justify-between">
                    <span>Expenses (Today's Dollars)</span>
                    <span className="text-emerald-400 font-bold font-mono">{formatCurrency(inputs.annualLivingExpenses)}</span>
                  </label>
                  <input
                    type="range"
                    min="40000"
                    max="300000"
                    step="5000"
                    value={inputs.annualLivingExpenses ?? 120000}
                    onChange={(e) => updateNestedState('annualLivingExpenses', '', Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
                    <span>$40k</span>
                    <span>$150k</span>
                    <span>$300k</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  This represents your base annual living budget, which will inflate by CPI annually. Portfolio drawdowns dynamically scale to fund this amount.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 6: Roth Conversion Planning */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold border-b border-slate-800 pb-2">
            <RefreshCw className="w-5 h-5" />
            <h2>Roth Conversion Planning</h2>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-4">
            
            {/* Strategy Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Conversion Strategy</label>
              <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const updated = {
                      ...inputs,
                      rothConversionStrategy: 'flat' as const,
                      rothConversionTargetValue: null,
                    };
                    onChange(updated);
                  }}
                  className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold transition-all ${
                     inputs.rothConversionStrategy === 'flat'
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Flat Target
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updated = {
                      ...inputs,
                      rothConversionStrategy: 'fill-to-target' as const,
                      rothConversionTargetValue: inputs.rothConversionTargetValue || 133000,
                    };
                    onChange(updated);
                  }}
                  className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold transition-all ${
                    inputs.rothConversionStrategy === 'fill-to-target'
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Fill-to-Target
                </button>
              </div>
            </div>

            {/* Start Year Slider */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Start Year</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {inputs.rothConversionStartYear !== undefined ? inputs.rothConversionStartYear : 2027}
                </span>
              </label>
              <input
                type="range"
                min="2026"
                max="2050"
                step="1"
                value={inputs.rothConversionStartYear !== undefined ? inputs.rothConversionStartYear : 2027}
                onChange={(e) => updateNestedState('rothConversionStartYear', '', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* End Year Slider */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>End Year</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {inputs.rothConversionEndYear !== undefined ? inputs.rothConversionEndYear : 2034}
                </span>
              </label>
              <input
                type="range"
                min="2026"
                max="2060"
                step="1"
                value={inputs.rothConversionEndYear !== undefined ? inputs.rothConversionEndYear : 2034}
                onChange={(e) => updateNestedState('rothConversionEndYear', '', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Strategy Dependent slider */}
            {inputs.rothConversionStrategy === 'flat' ? (
              <div className="space-y-1">
                <label className="text-xs text-slate-400 flex justify-between">
                  <span>Annual Flat Amount</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {formatCurrency(inputs.annualRothConversion)}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="500000"
                  step="5000"
                  value={inputs.annualRothConversion}
                  onChange={(e) => updateNestedState('annualRothConversion', '', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono px-1">
                  <span>$0</span>
                  <span>$250k</span>
                  <span>$500k</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-slate-400 flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span>Target MAGI Ceiling</span>
                    <div className="relative group inline-block">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 bg-slate-950 text-slate-200 text-[10px] p-2.5 rounded-lg border border-slate-800 shadow-xl z-50 leading-normal pointer-events-none normal-case font-medium">
                        Sets the total annual MAGI ceiling for Roth conversions. This is synchronized with the <strong>Quick Fills</strong> dropdown presets in the Bracket Map chart, and can be adjusted here to override presets with custom ceilings.
                      </div>
                    </div>
                  </div>
                  <span className="text-emerald-400 font-bold font-mono">
                    {formatCurrency(inputs.rothConversionTargetValue || 0)}
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="500000"
                  step="5000"
                  value={inputs.rothConversionTargetValue || 0}
                  onChange={(e) => updateNestedState('rothConversionTargetValue', '', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono px-1">
                  <span>$0</span>
                  <span>$250k</span>
                  <span>$500k</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 7: Danger Zone / Reset */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-rose-500 font-semibold pb-1">
            <RefreshCw className="w-4 h-4 text-rose-500 animate-spin" style={{ animationDuration: '6s' }} />
            <h2 className="text-xs uppercase font-bold tracking-wider">Danger Zone</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Are you sure you want to clear your current retirement plan configuration? This will delete all customized inputs and restart the onboarding setup.")) {
                onReset();
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-900/50 text-red-400 rounded-xl text-xs font-bold transition-all hover:scale-102 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset Plan & Configuration</span>
          </button>
        </div>

      </div>
      {showExpensesDialog && (
        <DetailedExpensesDialog
          isOpen={showExpensesDialog}
          onClose={() => setShowExpensesDialog(false)}
          detailedExpenses={inputs.detailedExpenses}
          onSave={(expenses) => updateNestedState('detailedExpenses', '', expenses)}
        />
      )}
      {editingHealthcarePerson && (
        <HealthcareConfigDialog
          isOpen={editingHealthcarePerson !== null}
          onClose={() => setEditingHealthcarePerson(null)}
          personName={editingHealthcarePerson === 'you' ? (inputs.you.name || 'Primary') : (inputs.wife.name || 'Spouse')}
          birthDate={editingHealthcarePerson === 'you' ? inputs.you.birthDate : inputs.wife.birthDate}
          healthcareConfig={editingHealthcarePerson === 'you' ? inputs.you.healthcare : inputs.wife.healthcare}
          healthcareInflationRate={inputs.growthAssumptions.healthcareInflationRate}
          onSave={(config) => updateNestedState(editingHealthcarePerson, 'healthcare', config)}
        />
      )}
    </aside>
  );
};
