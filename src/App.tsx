import { useState, useEffect, useMemo } from 'react';
import { AppStateInputs } from './types';
import { runRetirementSimulation } from './engine/simulationEngine';
import { InputControlSidebar } from './components/InputControlSidebar';
import { DashboardLayout } from './components/DashboardLayout';
import { BracketMapChart } from './components/BracketMapChart';
import { LookbackLedgerTable } from './components/LookbackLedgerTable';
import { ClaimingMatrixGrid } from './components/ClaimingMatrixGrid';

// Default initial state matching specifications
const DEFAULT_INPUTS: AppStateInputs = {
  you: {
    name: 'You',
    birthDate: '1960-06-27',
    estimatedPIA: 3000,
    targetSSClaimingAge: 67,
    plannedRetirementAge: 67,
    activeSalary: 150000,
    preMedicareMonthlyPremium: 1000,
  },
  wife: {
    name: 'Spouse',
    birthDate: '1964-03-11',
    estimatedPIA: 2800,
    targetSSClaimingAge: 67,
    plannedRetirementAge: 65,
    activeSalary: 100000,
    preMedicareMonthlyPremium: 1000,
  },
  portfolio: {
    yourPreTaxIRA: 1200000,
    yourRothIRA: 200000,
    yourTaxableBrokerage: 600000,
    yourTaxableBasis: 400000,
    wifePreTaxIRA: 800000,
    wifeRothIRA: 150000,
    wifeTaxableBrokerage: 400000,
    wifeTaxableBasis: 250005,
  },
  jurisdiction: {
    currentState: 'MD',
    targetState: 'FL',
    relocationYear: 2032,
  },
  growthAssumptions: {
    equityReturnRate: 0.07,
    fixedIncomeReturnRate: 0.04,
    cpiInflationRate: 0.025,
    healthcareInflationRate: 0.05,
  },
  annualLivingExpenses: 120000,
  annualRothConversion: 50000,
};

// Custom hook for LocalStorage persistence
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`LocalStorage read error for key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
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

  // Handle updating the Roth conversion slider target directly from Workspace 1
  const handleUpdateConversion = (val: number) => {
    setInputs({
      ...inputs,
      annualRothConversion: val,
    });
  };

  // Handle updating the claiming ages directly from the Claiming Matrix Grid
  const handleUpdateClaimingAges = (yourAge: number, wifeAge: number) => {
    setInputs({
      ...inputs,
      you: { ...inputs.you, targetSSClaimingAge: yourAge },
      wife: { ...inputs.wife, targetSSClaimingAge: wifeAge },
    });
  };

  // Sync title and head tags for SEO best practices
  useEffect(() => {
    document.title = 'Retirement Scenario Optimizer - Tax, Medicare & SS Planner';
  }, []);

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased font-sans">
      {/* Sidebar Parameter Controls */}
      <InputControlSidebar inputs={inputs} onChange={setInputs} />

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
            onUpdateConversion={handleUpdateConversion}
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
      </DashboardLayout>
    </div>
  );
}

export default App;
