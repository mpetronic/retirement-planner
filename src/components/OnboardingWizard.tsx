import React, { useState } from 'react';
import { AppStateInputs, DEFAULT_DETAILED_EXPENSES, DEFAULT_EXPENSE_FREQUENCIES } from '../types';
import {
  User,
  Coins,
  MapPin,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Heart,
  Smile,
  Upload
} from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: (configuredInputs: AppStateInputs) => void;
}

const getBirthMonth = (dateStr: string | undefined): number => {
  if (!dateStr) return 1;
  const parts = dateStr.split('-');
  if (parts.length < 2) return 1;
  const m = parseInt(parts[1], 10);
  return isNaN(m) ? 1 : m;
};

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        const parsed = JSON.parse(text) as AppStateInputs;

        // Validation check
        if (
          parsed &&
          typeof parsed === 'object' &&
          parsed.you &&
          parsed.portfolio &&
          parsed.growthAssumptions
        ) {
          const cleaned = {
            ...parsed,
            isConfigured: true
          };
          onComplete(cleaned);
        } else {
          alert('Invalid plan configuration file. Please ensure the file is a valid JSON exported from this app.');
        }
      } catch (err) {
        console.error("Import plan failed:", err);
        alert('Failed to parse the file. Please ensure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };

  const [isSingleFiler, setIsSingleFiler] = useState(false);

  // Initial local state for the form inputs matching AppStateInputs structure
  const [youName, setYouName] = useState('You');
  const [youBirthDate, setYouBirthDate] = useState('1960-01-01');
  const [youRetireAge, setYouRetireAge] = useState<number>(67);
  const [youRetireMonth, setYouRetireMonth] = useState<number | null>(null);
  const [youSalary, setYouSalary] = useState<number | null>(0);
  const [youIsRetired, setYouIsRetired] = useState(false);
  const [youPIA, setYouPIA] = useState<number | null>(0);
  const [youClaimAge, setYouClaimAge] = useState<number>(67);

  const [wifeName, setWifeName] = useState('Spouse');
  const [wifeBirthDate, setWifeBirthDate] = useState('1960-01-01');
  const [wifeRetireAge, setWifeRetireAge] = useState<number>(65);
  const [wifeRetireMonth, setWifeRetireMonth] = useState<number | null>(null);
  const [wifeSalary, setWifeSalary] = useState<number | null>(0);
  // Default spouse not retired
  const [wifeIsRetired, setWifeIsRetired] = useState(false);
  const [wifePIA, setWifePIA] = useState<number | null>(0);
  const [wifeClaimAge, setWifeClaimAge] = useState<number>(67);

  const [yourPreTax, setYourPreTax] = useState<number | null>(0);
  const [yourRoth, setYourRoth] = useState<number | null>(0);
  const [yourTaxable, setYourTaxable] = useState<number | null>(0);
  const [yourBasis, setYourBasis] = useState<number | null>(0);
  const [yourCash, setYourCash] = useState<number | null>(0);

  const [wifePreTax, setWifePreTax] = useState<number | null>(0);
  const [wifeRoth, setWifeRoth] = useState<number | null>(0);
  const [wifeTaxable, setWifeTaxable] = useState<number | null>(0);
  const [wifeBasis, setWifeBasis] = useState<number | null>(0);
  const [wifeCash, setWifeCash] = useState<number | null>(0);

  const [livingExpenses, setLivingExpenses] = useState<number>(120000);
  const [currentState, setCurrentState] = useState<'MD' | 'FL'>('MD');
  const [targetState, setTargetState] = useState<'MD' | 'FL'>('FL');
  const [relocationYear, setRelocationYear] = useState<number | null>(2032);
  const [enableRelocation, setEnableRelocation] = useState(true);

  // Field validation helper
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!youName.trim()) {
        setError('Please enter your name.');
        return;
      }
      if (!youBirthDate) {
        setError('Please select your birth date.');
        return;
      }
      if (!youIsRetired && youSalary !== null && youSalary < 0) {
        setError('Please enter a valid salary amount or mark yourself as retired.');
        return;
      }
      if (youPIA !== null && youPIA < 0) {
        setError('Please enter a valid estimated Social Security Monthly PIA.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!isSingleFiler) {
        if (!wifeName.trim()) {
          setError("Please enter your spouse's name.");
          return;
        }
        if (!wifeBirthDate) {
          setError("Please select your spouse's birth date.");
          return;
        }
        if (!wifeIsRetired && wifeSalary !== null && wifeSalary < 0) {
          setError('Please enter a valid salary amount or mark your spouse as retired.');
          return;
        }
        if (wifePIA !== null && wifePIA < 0) {
          setError('Please enter a valid estimated Social Security Monthly PIA.');
          return;
        }
      }
      setStep(3);
    } else if (step === 3) {
      if (
        (yourPreTax !== null && yourPreTax < 0) ||
        (yourRoth !== null && yourRoth < 0) ||
        (yourTaxable !== null && yourTaxable < 0) ||
        (yourBasis !== null && yourBasis < 0) ||
        (yourCash !== null && yourCash < 0)
      ) {
        setError('Please enter valid, non-negative amounts for your starting balances.');
        return;
      }
      if (!isSingleFiler) {
        if (
          (wifePreTax !== null && wifePreTax < 0) ||
          (wifeRoth !== null && wifeRoth < 0) ||
          (wifeTaxable !== null && wifeTaxable < 0) ||
          (wifeBasis !== null && wifeBasis < 0) ||
          (wifeCash !== null && wifeCash < 0)
        ) {
          setError("Please enter valid, non-negative amounts for your spouse's starting balances.");
          return;
        }
      }
      setStep(4);
    }
  };

  const handlePrev = () => {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (livingExpenses === null || livingExpenses <= 0) {
      setError('Please enter a valid annual living expenses budget.');
      return;
    }

    const finalInputs: AppStateInputs = {
      you: {
        name: youName,
        birthDate: youBirthDate,
        estimatedPIA: youPIA,
        targetSSClaimingAge: youClaimAge,
        plannedRetirementAge: youIsRetired ? 65 : youRetireAge,
        plannedRetirementMonth: youIsRetired ? null : youRetireMonth,
        activeSalary: youIsRetired ? 0 : youSalary,
        preMedicareMonthlyPremium: null,
      },
      wife: {
        name: isSingleFiler ? 'Spouse' : wifeName,
        birthDate: isSingleFiler ? '' : wifeBirthDate,
        estimatedPIA: isSingleFiler ? 0 : wifePIA,
        targetSSClaimingAge: isSingleFiler ? 67 : wifeClaimAge,
        plannedRetirementAge: isSingleFiler ? 65 : (wifeIsRetired ? 61 : wifeRetireAge),
        plannedRetirementMonth: isSingleFiler ? null : (wifeIsRetired ? null : wifeRetireMonth),
        activeSalary: isSingleFiler ? 0 : (wifeIsRetired ? 0 : wifeSalary),
        preMedicareMonthlyPremium: null,
      },
      portfolio: {
        yourPreTaxIRA: yourPreTax,
        yourRothIRA: yourRoth,
        yourTaxableBrokerage: yourTaxable,
        yourTaxableBasis: yourBasis,
        yourCash: yourCash,
        wifePreTaxIRA: isSingleFiler ? 0 : wifePreTax,
        wifeRothIRA: isSingleFiler ? 0 : wifeRoth,
        wifeTaxableBrokerage: isSingleFiler ? 0 : wifeTaxable,
        wifeTaxableBasis: isSingleFiler ? 0 : wifeBasis,
        wifeCash: isSingleFiler ? 0 : wifeCash,
        taxableDividendYield: 0.02,
        taxableNonQualifiedPortion: 0.30,
      },
      jurisdiction: {
        currentState,
        targetState: enableRelocation ? targetState : currentState,
        relocationYear: enableRelocation ? relocationYear : null,
      },
      growthAssumptions: {
        equityReturnRate: 0.07,
        fixedIncomeReturnRate: 0.04,
        cpiInflationRate: 0.03, // Defaulting to realistic 3% CPI
        healthcareInflationRate: 0.05,
      },
      annualLivingExpenses: livingExpenses,
      annualRothConversion: 50000,
      rothConversionStartYear: 2027, // Default start year 2027
      rothConversionEndYear: 2034,   // Default end year 2034
      rothConversionStrategy: 'flat',
      rothConversionTargetValue: null,
      monteCarloSettings: {
        mode: 'monte-carlo',
        equityVolatility: 0.15,
        fixedIncomeVolatility: 0.05,
        correlation: 0.15,
        trials: 1000,
        seed: null,
      },
      isConfigured: true,
      isSingleFiler,
      useDetailedExpenses: false,
      detailedExpenses: {
        MD: { ...DEFAULT_DETAILED_EXPENSES },
        FL: { ...DEFAULT_DETAILED_EXPENSES },
        frequencies: { ...DEFAULT_EXPENSE_FREQUENCIES }
      }
    };

    onComplete(finalInputs);
  };

  const steps = [
    { num: 1, label: 'Your Profile', icon: User },
    { num: 2, label: 'Spouse Profile', icon: Heart },
    { num: 3, label: 'Asset Balances', icon: Coins },
    { num: 4, label: 'Plan Goals', icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-8">
        
        {/* Header Block */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-emerald-500 animate-pulse" />
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
                Configure Retirement Plan
              </h2>
              <p className="text-xs text-slate-400">Initialize your baseline scenario constraints</p>
            </div>
          </div>
          <div className="z-10">
            <label
              htmlFor="wizard-plan-input"
              className="cursor-pointer px-3.5 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Plan</span>
            </label>
            <input
              type="file"
              id="wizard-plan-input"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="px-6 pt-4 bg-slate-900/30">
          <div className="flex justify-between items-center mb-2">
            {steps.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.num;
              const isCompleted = step > s.num;
              return (
                <div key={s.num} className="flex flex-col items-center flex-1 relative">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 z-10 border ${
                      isActive
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]Scale-110'
                        : isCompleted
                        ? 'bg-slate-800 border-slate-700 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] mt-1 font-semibold hidden sm:inline ${isActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="relative h-1 bg-slate-950 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Form Area */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 flex flex-col justify-between space-y-6">
          
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-2xl text-red-400 text-xs flex items-center gap-2 animate-shake">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
              <p className="font-semibold">{error}</p>
            </div>
          )}

          <div className="flex-1">
            {/* STEP 1: Your Profile */}
            {step === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-2xl flex items-center gap-3">
                  <Smile className="w-8 h-8 text-emerald-400 shrink-0" />
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Welcome! Let's start by configuring your details. Enter your birthdate, planned retirement age, and starting active salary so we can calculate active contributions.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">Your Full Name</label>
                    <input
                      type="text"
                      value={youName}
                      onChange={(e) => setYouName(e.target.value)}
                      placeholder="e.g. John"
                      required
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">Your Birth Date</label>
                    <input
                      type="date"
                      value={youBirthDate}
                      onChange={(e) => setYouBirthDate(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <span>Are you already retired?</span>
                    </label>
                    <input
                      type="checkbox"
                      checked={youIsRetired}
                      onChange={(e) => {
                        setYouIsRetired(e.target.checked);
                        if (e.target.checked) setYouSalary(0);
                      }}
                      className="w-4 h-4 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 bg-slate-950 cursor-pointer"
                    />
                  </div>

                  {!youIsRetired && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/40">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">Current Salary ($ / Year)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-500 text-sm font-semibold">$</span>
                          <input
                            type="number"
                            value={youSalary === null ? '' : youSalary}
                            onChange={(e) => setYouSalary(e.target.value === '' ? null : Number(e.target.value))}
                            placeholder="e.g. 150000"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {(() => {
                          const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                          const age = youRetireAge;
                          const mon = youRetireMonth ?? getBirthMonth(youBirthDate);
                          const sliderVal = (age - 55) * 12 + (mon - 1);
                          return (
                            <>
                              <label className="text-xs font-bold text-slate-400 flex justify-between">
                                <span>Planned Retirement Age</span>
                                <span className="text-emerald-400 font-bold font-mono">
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
                                  setYouRetireAge(newAge);
                                  setYouRetireMonth(newMon);
                                }}
                                className="w-full h-1.5 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              />
                              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                <span>Age 55</span>
                                <span>Age 75</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400">SS Monthly PIA (at Age 67)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-500 text-sm font-semibold">$</span>
                      <input
                        type="number"
                        value={youPIA === null ? '' : youPIA}
                        onChange={(e) => setYouPIA(e.target.value === '' ? null : Number(e.target.value))}
                        placeholder="e.g. 3000"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 flex justify-between">
                      <span>Target SS Claiming Age</span>
                      <span className="text-emerald-400 font-mono font-bold">Age {youClaimAge}</span>
                    </label>
                    <input
                      type="range"
                      min="62"
                      max="70"
                      step="1"
                      value={youClaimAge}
                      onChange={(e) => setYouClaimAge(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>62 (Reduced)</span>
                      <span>67 (FRA)</span>
                      <span>70 (Max)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Spouse Profile */}
            {step === 2 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-slate-200 block">Single Filer Mode</label>
                    <span className="text-[10px] text-slate-500">Enable this if you have no spouse in the simulation</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSingleFiler}
                    onChange={(e) => setIsSingleFiler(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 bg-slate-950 cursor-pointer"
                  />
                </div>

                {isSingleFiler ? (
                  <div className="p-8 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
                    <Smile className="w-10 h-10 text-slate-600" />
                    <p className="text-sm text-slate-400 font-bold">Modeling as a Single Filer</p>
                    <p className="text-xs text-slate-500 leading-normal max-w-sm">
                      We will skip all spouse-related wages, Social Security claiming ages, and spousal IRA balances, and automatically switch tax calculations to Single Filer thresholds.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">Spouse's Name</label>
                        <input
                          type="text"
                          value={wifeName}
                          onChange={(e) => setWifeName(e.target.value)}
                          placeholder="e.g. Spouse"
                          required={!isSingleFiler}
                          className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">Spouse's Birth Date</label>
                        <input
                          type="date"
                          value={wifeBirthDate}
                          onChange={(e) => setWifeBirthDate(e.target.value)}
                          required={!isSingleFiler}
                          className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                          <span>Is your spouse already retired?</span>
                        </label>
                        <input
                          type="checkbox"
                          checked={wifeIsRetired}
                          onChange={(e) => {
                            setWifeIsRetired(e.target.checked);
                            if (e.target.checked) setWifeSalary(0);
                          }}
                          className="w-4 h-4 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 bg-slate-950 cursor-pointer"
                        />
                      </div>

                      {!wifeIsRetired && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/40">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400">Current Salary ($ / Year)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-2 text-slate-500 text-sm font-semibold">$</span>
                              <input
                                type="number"
                                value={wifeSalary === null ? '' : wifeSalary}
                                onChange={(e) => setWifeSalary(e.target.value === '' ? null : Number(e.target.value))}
                                placeholder="e.g. 100000"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {(() => {
                              const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                              const age = wifeRetireAge;
                              const mon = wifeRetireMonth ?? getBirthMonth(wifeBirthDate);
                              const sliderVal = (age - 55) * 12 + (mon - 1);
                              return (
                                <>
                                  <label className="text-xs font-bold text-slate-400 flex justify-between">
                                    <span>Planned Retirement Age</span>
                                    <span className="text-emerald-400 font-bold font-mono">
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
                                      setWifeRetireAge(newAge);
                                      setWifeRetireMonth(newMon);
                                    }}
                                    className="w-full h-1.5 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                  />
                                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                    <span>Age 55</span>
                                    <span>Age 75</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400">SS Monthly PIA (at Age 67)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-slate-500 text-sm font-semibold">$</span>
                          <input
                            type="number"
                            value={wifePIA === null ? '' : wifePIA}
                            onChange={(e) => setWifePIA(e.target.value === '' ? null : Number(e.target.value))}
                            placeholder="e.g. 2800"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 flex justify-between">
                          <span>Target SS Claiming Age</span>
                          <span className="text-emerald-400 font-mono font-bold">Age {wifeClaimAge}</span>
                        </label>
                        <input
                          type="range"
                          min="62"
                          max="70"
                          step="1"
                          value={wifeClaimAge}
                          onChange={(e) => setWifeClaimAge(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Initial Balances */}
            {step === 3 && (
              <div className="space-y-4 animate-fadeIn overflow-y-auto max-h-[360px] pr-2 custom-scrollbar">
                
                {/* Your Balances */}
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 pb-1 border-b border-slate-800/40">
                    <Smile className="w-3.5 h-3.5" />
                    <span>{youName}'s Portfolio Starting Balances</span>
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Traditional IRA</label>
                      <input
                        type="number"
                        value={yourPreTax === null ? '' : yourPreTax}
                        onChange={(e) => setYourPreTax(e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Tax-Free Roth IRA</label>
                      <input
                        type="number"
                        value={yourRoth === null ? '' : yourRoth}
                        onChange={(e) => setYourRoth(e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Brokerage Assets</label>
                      <input
                        type="number"
                        value={yourTaxable === null ? '' : yourTaxable}
                        onChange={(e) => setYourTaxable(e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Brokerage Cost Basis</label>
                      <input
                        type="number"
                        value={yourBasis === null ? '' : yourBasis}
                        onChange={(e) => setYourBasis(e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Cash Assets</label>
                      <input
                        type="number"
                        value={yourCash === null ? '' : yourCash}
                        onChange={(e) => setYourCash(e.target.value === '' ? null : Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Spouse Balances (Hidden if Single Filer) */}
                {!isSingleFiler && (
                  <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl space-y-3">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 pb-1 border-b border-slate-800/40">
                      <Heart className="w-3.5 h-3.5" />
                      <span>{wifeName}'s Portfolio Starting Balances</span>
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block uppercase">Traditional IRA</label>
                        <input
                          type="number"
                          value={wifePreTax === null ? '' : wifePreTax}
                          onChange={(e) => setWifePreTax(e.target.value === '' ? null : Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block uppercase">Tax-Free Roth IRA</label>
                        <input
                          type="number"
                          value={wifeRoth === null ? '' : wifeRoth}
                          onChange={(e) => setWifeRoth(e.target.value === '' ? null : Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block uppercase">Brokerage Assets</label>
                        <input
                          type="number"
                          value={wifeTaxable === null ? '' : wifeTaxable}
                          onChange={(e) => setWifeTaxable(e.target.value === '' ? null : Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block uppercase">Brokerage Cost Basis</label>
                        <input
                          type="number"
                          value={wifeBasis === null ? '' : wifeBasis}
                          onChange={(e) => setWifeBasis(e.target.value === '' ? null : Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block uppercase">Cash Assets</label>
                        <input
                          type="number"
                          value={wifeCash === null ? '' : wifeCash}
                          onChange={(e) => setWifeCash(e.target.value === '' ? null : Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: Goals, Expenses & Location */}
            {step === 4 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex justify-between">
                      <span>Annual Living Expenses budget (Today's Dollars)</span>
                      <span className="text-emerald-400 font-bold font-mono">${livingExpenses.toLocaleString()} / year</span>
                    </label>
                    <input
                      type="range"
                      min="40000"
                      max="300000"
                      step="5000"
                      value={livingExpenses}
                      onChange={(e) => setLivingExpenses(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
                      <span>$40k</span>
                      <span>$150k</span>
                      <span>$300k</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    This represents your baseline annual budget (inflating at 3% CPI). Drawdowns automatically liquidate from taxable assets first, then pre-tax traditional, then Roth to fund this after including SS and RMD cash.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 pb-1 border-b border-slate-800/40">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Jurisdiction State Taxes & Relocation Planning</span>
                  </span>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">Current Residence</label>
                      <select
                        value={currentState}
                        onChange={(e) => setCurrentState(e.target.value as 'MD' | 'FL')}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                      >
                        <option value="MD">Maryland (MD)</option>
                        <option value="FL">Florida (FL)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">Target Residence</label>
                      <select
                        value={targetState}
                        onChange={(e) => setTargetState(e.target.value as 'MD' | 'FL')}
                        disabled={!enableRelocation}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none disabled:opacity-40"
                      >
                        <option value="FL">Florida (FL)</option>
                        <option value="MD">Maryland (MD)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-850/40">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-300">Plan Relocation?</span>
                      <input
                        type="checkbox"
                        checked={enableRelocation}
                        onChange={(e) => setEnableRelocation(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 bg-slate-950 cursor-pointer"
                      />
                    </div>

                    {enableRelocation && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Relocation Year:</span>
                        <input
                          type="number"
                          min="2026"
                          max="2060"
                          value={relocationYear === null ? '' : relocationYear}
                          onChange={(e) => setRelocationYear(e.target.value === '' ? null : Number(e.target.value))}
                          className="w-20 bg-slate-950 border border-slate-850 focus:border-emerald-500 rounded-xl px-2 py-1 text-xs text-center text-slate-100 font-mono focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-800/40">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-800 rounded-xl text-xs text-slate-300 font-bold hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all hover:scale-102"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                className="flex items-center gap-1.5 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all hover:scale-102 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-slate-950 animate-spin" style={{ animationDuration: '3s' }} />
                <span>Generate Custom Plan & Solve 🚀</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
