import { useState, useEffect, useMemo } from 'react';
import { AppStateInputs } from './types';
import { runRetirementSimulation } from './engine/simulationEngine';
import { InputControlSidebar } from './components/InputControlSidebar';
import { DashboardLayout } from './components/DashboardLayout';
import { BracketMapChart } from './components/BracketMapChart';
import { LookbackLedgerTable } from './components/LookbackLedgerTable';
import { ClaimingMatrixGrid } from './components/ClaimingMatrixGrid';
import { MonteCarloWorkspace } from './components/MonteCarloWorkspace';
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
  lockedReturnSequence: null,
  monteCarloSettings: {
    mode: 'monte-carlo',
    equityVolatility: 0.15,
    fixedIncomeVolatility: 0.05,
    correlation: 0.15,
    trials: 1000,
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
        };
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
  const [simulateSurvivor, setSimulateSurvivor] = useLocalStorage<boolean>('retirement_planner_survivor', false);

  // Re-trigger the simulation loop dynamically whenever inputs or survivor view changes
  const ledger = useMemo(() => {
    return runRetirementSimulation(inputs, simulateSurvivor);
  }, [inputs, simulateSurvivor]);

  // Conversion updates are now handled directly by the left sidebar panel inputs

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

  // Handle updating the claiming ages directly from the Claiming Matrix Grid
  const handleUpdateClaimingAges = (yourAge: number, wifeAge: number) => {
    setInputs((prev) => ({
      ...prev,
      you: { ...prev.you, targetSSClaimingAge: yourAge },
      wife: { ...prev.wife, targetSSClaimingAge: wifeAge },
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
      <InputControlSidebar inputs={inputs} onChange={setInputs} onReset={() => setInputs(DEFAULT_INPUTS)} />

      {/* Main Orchestration Dashboard Layout */}
      <DashboardLayout
        ledger={ledger}
        inputs={inputs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      >
        {activeTab === 0 && (
          <BracketMapChart
            ledger={ledger}
            inputs={inputs}
            simulateSurvivor={simulateSurvivor}
            onApplyOptimization={handleApplyOptimization}
            onUpdateStrategy={handleUpdateStrategy}
            onUpdateTargetValue={handleUpdateTargetValue}
          />
        )}
        {activeTab === 1 && (
          <LookbackLedgerTable
            ledger={ledger}
            inputs={inputs}
            simulateSurvivor={simulateSurvivor}
          />
        )}
        {activeTab === 2 && (
          <ClaimingMatrixGrid
            inputs={inputs}
            ledger={ledger}
            simulateSurvivor={simulateSurvivor}
            onUpdateClaimingAges={handleUpdateClaimingAges}
            onToggleSurvivor={setSimulateSurvivor}
          />
        )}
        {activeTab === 3 && (
          <MonteCarloWorkspace
            inputs={inputs}
            onChangeInputs={setInputs}
            simulateSurvivor={simulateSurvivor}
          />
        )}
      </DashboardLayout>
    </div>
  );
}

export default App;
