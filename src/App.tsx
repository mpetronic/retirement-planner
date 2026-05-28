import { useState, useEffect, useMemo } from 'react';
import { AppStateInputs, LockedReturnSequence, SavedPlan, SimulationResultRow } from './types';
import { runRetirementSimulation } from './engine/simulationEngine';
import {
  runMonteCarloSimulation,
  generateSyntheticSequence,
  generateHistoricalSequence,
  mulberry32
} from './engine/monteCarloEngine';
import { InputControlSidebar } from './components/InputControlSidebar';
import { DashboardLayout } from './components/DashboardLayout';
import { BracketMapChart } from './components/BracketMapChart';
import { LookbackLedgerTable } from './components/LookbackLedgerTable';
import { MonteCarloWorkspace } from './components/MonteCarloWorkspace';
import { PlanComparisonWorkspace } from './components/PlanComparisonWorkspace';
import { OnboardingWizard } from './components/OnboardingWizard';

// Default initial state matching specifications
const DEFAULT_INPUTS: AppStateInputs = {
  you: {
    name: '',
    birthDate: '',
    estimatedPIA: null,
    targetSSClaimingAge: null,
    plannedRetirementAge: null,
    activeSalary: null,
    preMedicareMonthlyPremium: null,
  },
  wife: {
    name: '',
    birthDate: '',
    estimatedPIA: null,
    targetSSClaimingAge: null,
    plannedRetirementAge: null,
    activeSalary: null,
    preMedicareMonthlyPremium: null,
  },
  portfolio: {
    yourPreTaxIRA: null,
    yourRothIRA: null,
    yourTaxableBrokerage: null,
    yourTaxableBasis: null,
    wifePreTaxIRA: null,
    wifeRothIRA: null,
    wifeTaxableBrokerage: null,
    wifeTaxableBasis: null,
  },
  jurisdiction: {
    currentState: 'MD',
    targetState: 'FL',
    relocationYear: null,
  },
  growthAssumptions: {
    equityReturnRate: 0.07,
    fixedIncomeReturnRate: 0.04,
    cpiInflationRate: 0.03, // 3% CPI default as requested
    healthcareInflationRate: 0.05,
  },
  annualLivingExpenses: null,
  annualRothConversion: 50000,
  rothConversionStartYear: 2027,
  rothConversionEndYear: 2034,
  rothConversionStrategy: 'flat',
  rothConversionTargetValue: null,
  monteCarloSettings: {
    mode: 'monte-carlo',
    equityVolatility: 0.15,
    fixedIncomeVolatility: 0.05,
    correlation: 0.15,
    trials: 1000,
    seed: null, // Default is standard random
  },
  isConfigured: false,
  isSingleFiler: false,
};

// Custom hook for LocalStorage persistence with defensive deep merge schema protection
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        
        // Robust deep merge to ensure new Monte Carlo fields are populated for users with old saved states
        if (key === 'retirement_planner_inputs') {
          return {
            ...initialValue,
            ...parsed,
            growthAssumptions: {
              ...(initialValue as any).growthAssumptions,
              ...parsed.growthAssumptions,
            },
            you: {
              ...(initialValue as any).you,
              ...parsed.you,
            },
            wife: {
              ...(initialValue as any).wife,
              ...parsed.wife,
            },
            portfolio: {
              ...(initialValue as any).portfolio,
              ...parsed.portfolio,
            },
            jurisdiction: {
              ...(initialValue as any).jurisdiction,
              ...parsed.jurisdiction,
            },
            monteCarloSettings: {
              ...(initialValue as any).monteCarloSettings,
              ...parsed.monteCarloSettings,
            },
          } as any;
        }
        
        return parsed;
      }
      return initialValue;
    } catch (error) {
      console.warn(`LocalStorage read error for key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    } catch (error) {
      console.warn(`LocalStorage write error for key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}

function App() {
  const [inputs, setInputs] = useLocalStorage<AppStateInputs>('retirement_planner_inputs', DEFAULT_INPUTS);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [simulateSurvivor] = useLocalStorage<boolean>('retirement_planner_survivor', false);
  const [savedPlans, setSavedPlans] = useLocalStorage<SavedPlan[]>('retirement_planner_saved_plans', []);
  const [useTodayDollars, setUseTodayDollars] = useLocalStorage<boolean>('retirement_planner_use_today_dollars', false);

  // Localized persisted scenarios for Workspace 1 and 2
  const [ws1Scenario, setWs1Scenario] = useLocalStorage<'flat' | 'p10' | 'p50' | 'p90'>('retirement_planner_ws1_scenario', 'flat');
  const [ws2Scenario, setWs2Scenario] = useLocalStorage<'flat' | 'p10' | 'p50' | 'p90'>('retirement_planner_ws2_scenario', 'flat');

  // Persisted plan selections for Workspace 4 comparison
  const [selectedPlanAId, setSelectedPlanAId] = useLocalStorage<string>('retirement_planner_selected_plan_a', '');
  const [selectedPlanBId, setSelectedPlanBId] = useLocalStorage<string>('retirement_planner_selected_plan_b', '');


  // 1. Generate 1,000 return sequences once, keyed ONLY on volatility/correlation/seed.
  // This preserves stable market return percentages while strategy slider variables are tweaked.
  const returnSequences = useMemo(() => {
    const trials = inputs.monteCarloSettings?.trials || 1000;
    const mode = inputs.monteCarloSettings?.mode || 'monte-carlo';
    
    const equityMean = inputs.growthAssumptions.equityReturnRate;
    const bondMean = inputs.growthAssumptions.fixedIncomeReturnRate;
    const equityVol = inputs.monteCarloSettings?.equityVolatility ?? 0.15;
    const bondVol = inputs.monteCarloSettings?.fixedIncomeVolatility ?? 0.05;
    const correlation = inputs.monteCarloSettings?.correlation ?? 0.15;
    const seed = inputs.monteCarloSettings?.seed;
    
    const rand = seed !== null && seed !== undefined ? mulberry32(seed) : Math.random;
    
    const list: Omit<LockedReturnSequence, 'id'>[] = [];
    for (let t = 0; t < trials; t++) {
      if (mode === 'historical') {
        const block = rand() < 0.35;
        list.push(generateHistoricalSequence(block, undefined, rand));
      } else {
        list.push(generateSyntheticSequence(equityMean, equityVol, bondMean, bondVol, correlation, rand));
      }
    }
    return list;
  }, [
    inputs.growthAssumptions.equityReturnRate,
    inputs.growthAssumptions.fixedIncomeReturnRate,
    inputs.monteCarloSettings.mode,
    inputs.monteCarloSettings.trials,
    inputs.monteCarloSettings.equityVolatility,
    inputs.monteCarloSettings.fixedIncomeVolatility,
    inputs.monteCarloSettings.correlation,
    inputs.monteCarloSettings.seed,
  ]);

  // 2. Reactively compute the Monte Carlo simulation. Takes ~25ms since returns are pre-generated.
  const monteCarloSummary = useMemo(() => {
    return runMonteCarloSimulation(inputs, simulateSurvivor, returnSequences);
  }, [inputs, simulateSurvivor, returnSequences]);

  // 3. Compute parallel ledgers for flat expected returns and the representative percentiles.
  const parallelLedgers = useMemo(() => {
    return {
      flat: runRetirementSimulation(inputs, simulateSurvivor, null),
      p10: runRetirementSimulation(inputs, simulateSurvivor, monteCarloSummary.representativeSequences.worst),
      p50: runRetirementSimulation(inputs, simulateSurvivor, monteCarloSummary.representativeSequences.median),
      p90: runRetirementSimulation(inputs, simulateSurvivor, monteCarloSummary.representativeSequences.best),
    };
  }, [inputs, simulateSurvivor, monteCarloSummary]);

  // Compute active ledger for each worksheet depending on its localized switcher state
  const wsLedgers = useMemo(() => {
    return {
      ws1: parallelLedgers[ws1Scenario] || parallelLedgers.flat,
      ws2: parallelLedgers[ws2Scenario] || parallelLedgers.flat,
    };
  }, [parallelLedgers, ws1Scenario, ws2Scenario]);

  // Active return sequence for optimizer/matrix sweeps
  const activeWs1Sequence = useMemo(() => {
    if (ws1Scenario === 'p10') return monteCarloSummary.representativeSequences.worst;
    if (ws1Scenario === 'p50') return monteCarloSummary.representativeSequences.median;
    if (ws1Scenario === 'p90') return monteCarloSummary.representativeSequences.best;
    return null;
  }, [ws1Scenario, monteCarloSummary]);

  // Helper to discount a row's nominal values back to today's purchasing power (real value)
  const discountRow = (row: SimulationResultRow, cpiRate: number): SimulationResultRow => {
    const yearsElapsed = row.year - 2026;
    const factor = Math.pow(1 + cpiRate, yearsElapsed);
    if (factor <= 1) return row;

    const discounted = { ...row };
    const nonCurrencyKeys = new Set(['year', 'yourAge', 'wifeAge', 'surchargeTier']);
    
    for (const key of Object.keys(discounted) as Array<keyof SimulationResultRow>) {
      if (!nonCurrencyKeys.has(key as string) && typeof discounted[key] === 'number') {
        (discounted as any)[key] = (discounted[key] as number) / factor;
      }
    }
    return discounted;
  };

  // Conditionally apply inflation discounting for real-dollar displays
  const displayParallelLedgers = useMemo(() => {
    if (!useTodayDollars) return parallelLedgers;
    const cpi = inputs.growthAssumptions.cpiInflationRate;
    return {
      flat: parallelLedgers.flat.map((r) => discountRow(r, cpi)),
      p10: parallelLedgers.p10.map((r) => discountRow(r, cpi)),
      p50: parallelLedgers.p50.map((r) => discountRow(r, cpi)),
      p90: parallelLedgers.p90.map((r) => discountRow(r, cpi)),
    };
  }, [parallelLedgers, useTodayDollars, inputs.growthAssumptions.cpiInflationRate]);

  const displayWsLedgers = useMemo(() => {
    if (!useTodayDollars) return wsLedgers;
    const cpi = inputs.growthAssumptions.cpiInflationRate;
    return {
      ws1: wsLedgers.ws1.map((r) => discountRow(r, cpi)),
      ws2: wsLedgers.ws2.map((r) => discountRow(r, cpi)),
    };
  }, [wsLedgers, useTodayDollars, inputs.growthAssumptions.cpiInflationRate]);

  const displayActiveLedger = useMemo(() => {
    if (activeTab === 0) return displayWsLedgers.ws1;
    if (activeTab === 1) return displayWsLedgers.ws2;
    if (activeTab === 2) return displayParallelLedgers.p50;
    return displayWsLedgers.ws1;
  }, [activeTab, displayWsLedgers, displayParallelLedgers]);

  const displayMonteCarloSummary = useMemo(() => {
    if (!useTodayDollars) return monteCarloSummary;
    const cpi = inputs.growthAssumptions.cpiInflationRate;
    
    const discountedPercentiles = monteCarloSummary.percentiles.map((p) => {
      const yearsElapsed = p.year - 2026;
      const factor = Math.pow(1 + cpi, yearsElapsed);
      return {
        year: p.year,
        p10: p.p10 / factor,
        p25: p.p25 / factor,
        p50: p.p50 / factor,
        p75: p.p75 / factor,
        p90: p.p90 / factor,
      };
    });

    return {
      ...monteCarloSummary,
      percentiles: discountedPercentiles,
    };
  }, [monteCarloSummary, useTodayDollars, inputs.growthAssumptions.cpiInflationRate]);

  // Handle applying a fully optimized retirement configuration at once
  const handleApplyOptimization = (annualConversion: number, targetValue: number | null, yourAge: number, wifeAge: number) => {
    setInputs((prev) => ({
      ...prev,
      annualRothConversion: annualConversion,
      rothConversionTargetValue: targetValue,
      you: { ...prev.you, targetSSClaimingAge: yourAge },
      wife: { ...prev.wife, targetSSClaimingAge: wifeAge },
    }));
  };

  // Handle changing conversion strategy
  const handleUpdateStrategy = (strategy: 'flat' | 'fill-to-target') => {
    setInputs((prev) => ({
      ...prev,
      rothConversionStrategy: strategy,
    }));
  };

  // Handle changing target MAGI threshold limit
  const handleUpdateTargetValue = (val: number | null) => {
    setInputs((prev) => ({
      ...prev,
      rothConversionTargetValue: val,
    }));
  };



  // Sync title and head tags for SEO best practices
  useEffect(() => {
    document.title = 'Retirement Planner - Tax, Medicare & SS Planner';
  }, []);

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased font-sans">
      {!inputs.isConfigured && (
        <OnboardingWizard onComplete={setInputs} />
      )}

      {/* Sidebar Parameter Controls */}
      <InputControlSidebar 
        inputs={inputs} 
        onChange={setInputs} 
        onReset={() => setInputs(DEFAULT_INPUTS)} 
        useTodayDollars={useTodayDollars}
        setUseTodayDollars={setUseTodayDollars}
      />

      {/* Main Orchestration Dashboard Layout */}
      <DashboardLayout
        ledger={displayActiveLedger}
        parallelLedgers={displayParallelLedgers}
        successRate={monteCarloSummary.successRate}
        inputs={inputs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      >
        {activeTab === 0 && (
          <BracketMapChart
            ledger={displayWsLedgers.ws1}
            inputs={inputs}
            simulateSurvivor={simulateSurvivor}
            wsScenario={ws1Scenario}
            onChangeScenario={setWs1Scenario}
            activeScenarioSequence={activeWs1Sequence}
            onApplyOptimization={handleApplyOptimization}
            onUpdateStrategy={handleUpdateStrategy}
            onUpdateTargetValue={handleUpdateTargetValue}
          />
        )}
        {activeTab === 1 && (
          <LookbackLedgerTable
            ledger={displayWsLedgers.ws2}
            inputs={inputs}
            simulateSurvivor={simulateSurvivor}
            wsScenario={ws2Scenario}
            onChangeScenario={setWs2Scenario}
          />
        )}
        {activeTab === 2 && (
          <MonteCarloWorkspace
            inputs={inputs}
            onChangeInputs={setInputs}
            simulateSurvivor={simulateSurvivor}
            summary={displayMonteCarloSummary}
          />
        )}
        {activeTab === 3 && (
          <PlanComparisonWorkspace
            inputs={inputs}
            onLoadPlan={setInputs}
            savedPlans={savedPlans}
            onSavePlans={setSavedPlans}
            simulateSurvivor={simulateSurvivor}
            useTodayDollars={useTodayDollars}
            selectedPlanAId={selectedPlanAId}
            setSelectedPlanAId={setSelectedPlanAId}
            selectedPlanBId={selectedPlanBId}
            setSelectedPlanBId={setSelectedPlanBId}
          />
        )}
      </DashboardLayout>
    </div>
  );
}

export default App;
