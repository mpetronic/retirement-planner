import React, { useState } from 'react';
import { AppStateInputs } from '../types';
import {
  User,
  TrendingUp,
  Coins,
  MapPin,
  Flame,
  DollarSign,
  Pencil,
  Check,
  RefreshCw
} from 'lucide-react';

interface InputControlSidebarProps {
  inputs: AppStateInputs;
  onChange: (newInputs: AppStateInputs) => void;
}

export const InputControlSidebar: React.FC<InputControlSidebarProps> = ({
  inputs,
  onChange,
}) => {
  const [isEditingYou, setIsEditingYou] = useState(false);
  const [isEditingWife, setIsEditingWife] = useState(false);
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
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
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono">1960</span>
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Estimated SS Monthly PIA (at Age 67)</span>
                <span className="text-slate-200 font-semibold font-mono">{formatCurrency(inputs.you.estimatedPIA)}</span>
              </label>
              <input
                type="range"
                min="1000"
                max="4500"
                step="50"
                value={inputs.you.estimatedPIA}
                onChange={(e) => updateNestedState('you', 'estimatedPIA', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Target Social Security Claiming Age</span>
                <span className="text-emerald-400 font-bold font-mono">Age {inputs.you.targetSSClaimingAge}</span>
              </label>
              <input
                type="range"
                min="62"
                max="70"
                step="1"
                value={inputs.you.targetSSClaimingAge}
                onChange={(e) => updateNestedState('you', 'targetSSClaimingAge', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
                <span>62 (Reduced)</span>
                <span>67 (FRA)</span>
                <span>70 (Max)</span>
              </div>
            </div>

            {/* Planned Retirement & Active Salary side-by-side */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/30">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between block truncate">
                  <span>Retire Age</span>
                  <span className="text-emerald-400 font-mono font-semibold">Age {inputs.you.plannedRetirementAge || 67}</span>
                </label>
                <input
                  type="range"
                  min="55"
                  max="75"
                  step="1"
                  value={inputs.you.plannedRetirementAge || 67}
                  onChange={(e) => updateNestedState('you', 'plannedRetirementAge', Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between block truncate">
                  <span>Active Salary</span>
                  <span className="text-slate-200 font-mono font-semibold">{formatCurrency(inputs.you.activeSalary || 0)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="300000"
                  step="5000"
                  value={inputs.you.activeSalary || 0}
                  onChange={(e) => updateNestedState('you', 'activeSalary', Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>

            {/* Pre-Medicare monthly premium slider */}
            <div className="space-y-1 pt-2 border-t border-slate-800/30">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Pre-Medicare Premium / Mo</span>
                <span className="text-emerald-400 font-bold font-mono">{formatCurrency(inputs.you.preMedicareMonthlyPremium !== undefined ? inputs.you.preMedicareMonthlyPremium : 1000)}/mo</span>
              </label>
              <input
                type="range"
                min="0"
                max="2500"
                step="50"
                value={inputs.you.preMedicareMonthlyPremium !== undefined ? inputs.you.preMedicareMonthlyPremium : 1000}
                onChange={(e) => updateNestedState('you', 'preMedicareMonthlyPremium', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Wife Profile */}
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
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono">1964</span>
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Estimated SS Monthly PIA (at Age 67)</span>
                <span className="text-slate-200 font-semibold font-mono">{formatCurrency(inputs.wife.estimatedPIA)}</span>
              </label>
              <input
                type="range"
                min="1000"
                max="4500"
                step="50"
                value={inputs.wife.estimatedPIA}
                onChange={(e) => updateNestedState('wife', 'estimatedPIA', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Target Social Security Claiming Age</span>
                <span className="text-emerald-400 font-bold font-mono">Age {inputs.wife.targetSSClaimingAge}</span>
              </label>
              <input
                type="range"
                min="62"
                max="70"
                step="1"
                value={inputs.wife.targetSSClaimingAge}
                onChange={(e) => updateNestedState('wife', 'targetSSClaimingAge', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
                <span>62 (Reduced)</span>
                <span>67 (FRA)</span>
                <span>70 (Max)</span>
              </div>
            </div>

            {/* Planned Retirement & Active Salary side-by-side */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/30">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between block truncate">
                  <span>Retire Age</span>
                  <span className="text-emerald-400 font-mono font-semibold">Age {inputs.wife.plannedRetirementAge || 65}</span>
                </label>
                <input
                  type="range"
                  min="55"
                  max="75"
                  step="1"
                  value={inputs.wife.plannedRetirementAge || 65}
                  onChange={(e) => updateNestedState('wife', 'plannedRetirementAge', Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between block truncate">
                  <span>Active Salary</span>
                  <span className="text-slate-200 font-mono font-semibold">{formatCurrency(inputs.wife.activeSalary || 0)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="300000"
                  step="5000"
                  value={inputs.wife.activeSalary || 0}
                  onChange={(e) => updateNestedState('wife', 'activeSalary', Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>

            {/* Pre-Medicare monthly premium slider */}
            <div className="space-y-1 pt-2 border-t border-slate-800/30">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>Pre-Medicare Premium / Mo</span>
                <span className="text-emerald-400 font-bold font-mono">{formatCurrency(inputs.wife.preMedicareMonthlyPremium !== undefined ? inputs.wife.preMedicareMonthlyPremium : 1000)}/mo</span>
              </label>
              <input
                type="range"
                min="0"
                max="2500"
                step="50"
                value={inputs.wife.preMedicareMonthlyPremium !== undefined ? inputs.wife.preMedicareMonthlyPremium : 1000}
                onChange={(e) => updateNestedState('wife', 'preMedicareMonthlyPremium', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>
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
                  <label className="text-[10px] text-slate-400 block truncate" title="Traditional Pre-Tax IRA">Pre-Tax IRA</label>
                  <input
                    type="number"
                    value={inputs.portfolio.yourPreTaxIRA}
                    onChange={(e) => updateNestedState('portfolio', 'yourPreTaxIRA', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Roth IRA Balance">Roth IRA</label>
                  <input
                    type="number"
                    value={inputs.portfolio.yourRothIRA}
                    onChange={(e) => updateNestedState('portfolio', 'yourRothIRA', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Taxable Brokerage">Taxable Assets</label>
                  <input
                    type="number"
                    value={inputs.portfolio.yourTaxableBrokerage}
                    onChange={(e) => updateNestedState('portfolio', 'yourTaxableBrokerage', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Taxable Cost Basis">Cost Basis</label>
                  <input
                    type="number"
                    value={inputs.portfolio.yourTaxableBasis}
                    onChange={(e) => updateNestedState('portfolio', 'yourTaxableBasis', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Wife Balances */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-300 block border-b border-slate-800 pb-1">{(inputs.wife.name || 'Spouse')}'s Portfolio Assets</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Traditional Pre-Tax IRA">Pre-Tax IRA</label>
                  <input
                    type="number"
                    value={inputs.portfolio.wifePreTaxIRA}
                    onChange={(e) => updateNestedState('portfolio', 'wifePreTaxIRA', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Roth IRA Balance">Roth IRA</label>
                  <input
                    type="number"
                    value={inputs.portfolio.wifeRothIRA}
                    onChange={(e) => updateNestedState('portfolio', 'wifeRothIRA', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Taxable Brokerage">Taxable Assets</label>
                  <input
                    type="number"
                    value={inputs.portfolio.wifeTaxableBrokerage}
                    onChange={(e) => updateNestedState('portfolio', 'wifeTaxableBrokerage', Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 block truncate" title="Taxable Cost Basis">Cost Basis</label>
                  <input
                    type="number"
                    value={inputs.portfolio.wifeTaxableBasis}
                    onChange={(e) => updateNestedState('portfolio', 'wifeTaxableBasis', Number(e.target.value))}
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
                  value={inputs.jurisdiction.relocationYear || 2032}
                  onChange={(e) => updateNestedState('jurisdiction', 'relocationYear', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-30"
                />
                <button
                  onClick={() => {
                    const nextVal = inputs.jurisdiction.relocationYear === null ? 2032 : null;
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Equity Return</label>
                <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-200">
                  <span>Rate:</span>
                  <span>{formatPercent(inputs.growthAssumptions.equityReturnRate)}</span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="0.15"
                  step="0.005"
                  value={inputs.growthAssumptions.equityReturnRate}
                  onChange={(e) => updateNestedState('growthAssumptions', 'equityReturnRate', Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">Fixed Income</label>
                <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-200">
                  <span>Rate:</span>
                  <span>{formatPercent(inputs.growthAssumptions.fixedIncomeReturnRate)}</span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="0.10"
                  step="0.005"
                  value={inputs.growthAssumptions.fixedIncomeReturnRate}
                  onChange={(e) => updateNestedState('growthAssumptions', 'fixedIncomeReturnRate', Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
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
            <h2>Annual Living Expenses</h2>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
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
                value={inputs.annualLivingExpenses}
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
              This represents your base annual living budget, which will inflate by CPI annually. Portfolio drawdowns dynamically scale to fund this amount after taxing SS, RMD, and conversions.
            </p>
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
                  {inputs.rothConversionStartYear !== undefined ? inputs.rothConversionStartYear : 2026}
                </span>
              </label>
              <input
                type="range"
                min="2026"
                max="2050"
                step="1"
                value={inputs.rothConversionStartYear !== undefined ? inputs.rothConversionStartYear : 2026}
                onChange={(e) => updateNestedState('rothConversionStartYear', '', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* End Year Slider */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 flex justify-between">
                <span>End Year</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {inputs.rothConversionEndYear !== undefined ? inputs.rothConversionEndYear : 2035}
                </span>
              </label>
              <input
                type="range"
                min="2026"
                max="2060"
                step="1"
                value={inputs.rothConversionEndYear !== undefined ? inputs.rothConversionEndYear : 2035}
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
                <label className="text-xs text-slate-400 flex justify-between">
                  <span>Target MAGI Ceiling</span>
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

      </div>
    </aside>
  );
};
