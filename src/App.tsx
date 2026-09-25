import { useState, useEffect, useMemo, useDeferredValue } from 'react';
import {
  AppStateInputs,
  LockedReturnSequence,
  SavedPlan,
  SimulationResultRow,
  DEFAULT_DETAILED_EXPENSES_STATE,
  DEFAULT_CHARITY_SETTINGS,
  DEFAULT_GUARDRAIL_SETTINGS,
  DEFAULT_BUCKET_STRATEGY_SETTINGS,
  CustomRothScenario,
  normalizeDetailedExpenses,
  getSimulationStartYear,
} from './types';
import { runRetirementSimulation } from './engine/simulationEngine';
import {
  runMonteCarloSimulation,
  computeRepresentativeSequences,
  generateSyntheticSequence,
  generateHistoricalSequence,
  mulberry32,
  MonteCarloSummary,
} from './engine/monteCarloEngine';
import { DEFAULT_FILL_TO_TARGET_VALUE } from './engine/taxRates2026';
import { DashboardLayout } from './components/DashboardLayout';
import { ActiveViewType } from './components/SidebarNavigation';
import { ParametersWorkspace } from './components/ParametersWorkspace';
import { BracketMapChart } from './components/BracketMapChart';
import { TaxableIncomeWorkspace } from './components/TaxableIncomeWorkspace';
import { LookbackLedgerTable } from './components/LookbackLedgerTable';
import { MonteCarloWorkspace } from './components/MonteCarloWorkspace';
import { PlanComparisonWorkspace } from './components/PlanComparisonWorkspace';
import { ActualsWorkspace } from './components/ActualsWorkspace';
import { BucketManagementWorkspace } from './components/BucketManagementWorkspace';
import { DocumentationDialog } from './components/DocumentationDialog';
import { AboutDialog } from './components/AboutDialog';
import { OnboardingWizard } from './components/OnboardingWizard';
import { CloudAuthModal } from './components/CloudAuthModal';
import { AuthService } from './shared/auth/AuthService';
import { getStorageAdapter } from './shared/storage';
import { syncPlannerCatalogToCloudStorage } from './shared/utils/plannerCategories';

// Default initial state matching specifications
const DEFAULT_INPUTS: AppStateInputs = {
  you: {
    name: 'Primary',
    birthDate: '1960-01-01',
    plannedRetirementAge: 65,
    targetSSClaimingAge: 67,
    estimatedPIA: 3000,
    activeSalary: 0,
    preMedicareMonthlyPremium: null,
  },
  wife: {
    name: 'Spouse',
    birthDate: '1964-01-01',
    plannedRetirementAge: 67,
    targetSSClaimingAge: 67,
    estimatedPIA: 1500,
    activeSalary: 0,
    preMedicareMonthlyPremium: null,
  },
  portfolio: {
    yourPreTaxIRA: 1000000,
    yourRothIRA: 200000,
    yourTaxableBrokerage: 500000,
    yourTaxableBasis: 350000,
    yourCash: 50000,
    wifePreTaxIRA: 500000,
    wifeRothIRA: 100000,
    wifeTaxableBrokerage: 250000,
    wifeTaxableBasis: 175000,
    wifeCash: 50000,
    taxableDividendYield: 0.02,
    taxableNonQualifiedPortion: 0.15,
  },
  jurisdiction: {
    currentState: 'MD',
    targetState: 'FL',
    relocationYear: null,
  },
  growthAssumptions: {
    equityReturnRate: 0.07,
    fixedIncomeReturnRate: 0.04,
    cpiInflationRate: 0.025,
    healthcareInflationRate: 0.05,
    preTaxEquityPortion: 0.60,
    taxableEquityPortion: 0.80,
    rothEquityPortion: 1.00,
    cashYieldRate: 0.035,
    minCashReserveDollars: 100000,
  },
  annualLivingExpenses: 100000,
  annualRothConversion: 0,
  simulationStartYear: 2026,
  rothConversionStartYear: 2027,
  rothConversionEndYear: 2032,
  rothConversionStrategy: 'flat',
  rothConversionTargetValue: null,
  monteCarloSettings: {
    mode: 'monte-carlo',
    equityVolatility: 0.15,
    fixedIncomeVolatility: 0.05,
    correlation: 0.15,
    trials: 1000,
    seed: null,
    randomizeCPI: true,
    constantCPIRate: null,
    enableRegimeSwitching: true,
    historicalSamplingStrategy: 'hybrid',
    calibrateHistoricalMeans: true,
    stressTest: {
      enabled: false,
      mode: 'absolute',
      overrides: [],
    },
  },
  isConfigured: false,
  isSingleFiler: false,
  useDetailedExpenses: false,
  detailedExpenses: JSON.parse(JSON.stringify(DEFAULT_DETAILED_EXPENSES_STATE)),
  charitySettings: DEFAULT_CHARITY_SETTINGS,
  actualTracking: {},
  guardrailSettings: DEFAULT_GUARDRAIL_SETTINGS,
  bucketSettings: DEFAULT_BUCKET_STRATEGY_SETTINGS,
};

function parseStoredValue<T>(key: string, rawItem: string | null, initialValue: T): T {
  if (!rawItem) return initialValue;
  try {
    const parsed = JSON.parse(rawItem);

    // Robust deep merge to ensure new Monte Carlo fields are populated for users with old saved states
    if (key === 'retirement_planner_inputs') {
      const init = initialValue as unknown as AppStateInputs;
      const p = parsed as Partial<AppStateInputs>;
      return {
        ...init,
        ...p,
        simulationStartYear:
          p.simulationStartYear !== undefined
            ? p.simulationStartYear
            : p.rothConversionStartYear
            ? p.rothConversionStartYear - 1
            : 2026,
        growthAssumptions: {
          ...init.growthAssumptions,
          ...p.growthAssumptions,
        },
        you: {
          ...init.you,
          ...p.you,
        },
        wife: {
          ...init.wife,
          ...p.wife,
        },
        portfolio: {
          ...init.portfolio,
          ...p.portfolio,
        },
        jurisdiction: {
          ...init.jurisdiction,
          ...p.jurisdiction,
        },
        monteCarloSettings: {
          ...init.monteCarloSettings,
          ...p.monteCarloSettings,
        },
        useDetailedExpenses: p.useDetailedExpenses !== undefined ? p.useDetailedExpenses : false,
        detailedExpenses: normalizeDetailedExpenses(p.detailedExpenses),
        actualTracking: p.actualTracking || {},
        guardrailSettings: {
          ...DEFAULT_GUARDRAIL_SETTINGS,
          ...(p.guardrailSettings || {}),
        },
        bucketSettings: {
          ...DEFAULT_BUCKET_STRATEGY_SETTINGS,
          ...(p.bucketSettings || {}),
          cash: {
            ...DEFAULT_BUCKET_STRATEGY_SETTINGS.cash,
            ...(p.bucketSettings?.cash || {}),
          },
          income: {
            ...DEFAULT_BUCKET_STRATEGY_SETTINGS.income,
            ...(p.bucketSettings?.income || {}),
          },
          growth: {
            ...DEFAULT_BUCKET_STRATEGY_SETTINGS.growth,
            ...(p.bucketSettings?.growth || {}),
          },
          actionLedger: p.bucketSettings?.actionLedger || {},
        },
      } as unknown as T;
    }

    if (key === 'retirement_planner_saved_plans' && Array.isArray(parsed)) {
      return (parsed as SavedPlan[]).map((p) => ({
        ...p,
        inputs: {
          ...p.inputs,
          detailedExpenses: normalizeDetailedExpenses(p.inputs?.detailedExpenses),
          actualTracking: p.inputs?.actualTracking || {},
          guardrailSettings: {
            ...DEFAULT_GUARDRAIL_SETTINGS,
            ...(p.inputs?.guardrailSettings || {}),
          },
          bucketSettings: {
            ...DEFAULT_BUCKET_STRATEGY_SETTINGS,
            ...(p.inputs?.bucketSettings || {}),
            cash: {
              ...DEFAULT_BUCKET_STRATEGY_SETTINGS.cash,
              ...(p.inputs?.bucketSettings?.cash || {}),
            },
            income: {
              ...DEFAULT_BUCKET_STRATEGY_SETTINGS.income,
              ...(p.inputs?.bucketSettings?.income || {}),
            },
            growth: {
              ...DEFAULT_BUCKET_STRATEGY_SETTINGS.growth,
              ...(p.inputs?.bucketSettings?.growth || {}),
            },
            actionLedger: p.inputs?.bucketSettings?.actionLedger || {},
          },
        },
      })) as unknown as T;
    }

    return parsed;
  } catch (error) {
    console.warn(`LocalStorage read error for key "${key}":`, error);
    return initialValue;
  }
}

// Custom hook for LocalStorage persistence with defensive deep merge schema protection
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return parseStoredValue(key, item, initialValue);
    } catch (error) {
      console.warn(`LocalStorage read error for key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent | CustomEvent) => {
      if ('key' in e && e.key && e.key !== key) return;
      try {
        const item = window.localStorage.getItem(key);
        setStoredValue(parseStoredValue(key, item, initialValue));
      } catch (err) {
        console.warn(`LocalStorage sync error for key "${key}":`, err);
      }
    };

    window.addEventListener('storage', handleStorageChange as EventListener);
    window.addEventListener('retirement_planner_inputs_updated', handleStorageChange as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorageChange as EventListener);
      window.removeEventListener('retirement_planner_inputs_updated', handleStorageChange as EventListener);
    };
  }, [key, initialValue]);

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

const TAB_INDEX_TO_VIEW: Record<number, ActiveViewType> = {
  0: 'overview',
  1: 'taxable-income',
  2: 'lookback-ledger',
  3: 'monte-carlo',
  4: 'compare',
  5: 'actuals',
};

function App() {
  const [inputs, setInputs] = useLocalStorage<AppStateInputs>('retirement_planner_inputs', DEFAULT_INPUTS);
  const [activeView, setActiveView] = useLocalStorage<ActiveViewType>('retirement_planner_active_view', 'overview');
  const [simulateSurvivor, setSimulateSurvivor] = useLocalStorage<boolean>('retirement_planner_survivor', false);
  const [savedPlans, setSavedPlans] = useLocalStorage<SavedPlan[]>('retirement_planner_saved_plans', []);
  const [useTodayDollars, setUseTodayDollars] = useLocalStorage<boolean>('retirement_planner_use_today_dollars', false);
  const [showDocumentation, setShowDocumentation] = useState<boolean>(false);
  const [showAboutDialog, setShowAboutDialog] = useState<boolean>(false);
  const [showCloudModal, setShowCloudModal] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => AuthService.isAuthenticated());
  const [documentationSectionId, setDocumentationSectionId] = useState<string>('overview');

  // Listen to Cognito auth state changes
  useEffect(() => {
    return AuthService.subscribe((session) => {
      setIsAuthenticated(Boolean(session));
    });
  }, []);

  // Automatically sync planner line items & profile names to cloud DynamoDB when authenticated or when inputs change
  useEffect(() => {
    if (inputs.detailedExpenses && inputs.detailedExpenses.catalog) {
      const adapter = getStorageAdapter();
      const profileNames = {
        primaryName: inputs.you?.name || 'Primary',
        spouseName: inputs.wife?.name || 'Spouse',
        isSingleFiler: Boolean(inputs.isSingleFiler),
      };
      syncPlannerCatalogToCloudStorage(inputs.detailedExpenses, adapter, profileNames).catch((err) => {
        console.warn('Failed to background sync catalog to storage:', err);
      });
    }
  }, [inputs.detailedExpenses, inputs.you?.name, inputs.wife?.name, inputs.isSingleFiler, isAuthenticated]);

  const handleOpenDocumentation = (sectionId?: string) => {
    setDocumentationSectionId(sectionId || 'overview');
    setShowDocumentation(true);
  };

  const handleNavigate = (viewOrTab: ActiveViewType | number) => {
    if (typeof viewOrTab === 'number') {
      setActiveView(TAB_INDEX_TO_VIEW[viewOrTab] || 'overview');
    } else {
      setActiveView(viewOrTab);
    }
  };

  // Synchronize inputs while seamlessly restoring simulateSurvivor if present in imported/loaded plan
  const handleInputsChange = (newInputs: AppStateInputs | ((prev: AppStateInputs) => AppStateInputs)) => {
    if (typeof newInputs === 'function') {
      setInputs((prev) => {
        const next = newInputs(prev);
        if (typeof next.simulateSurvivor === 'boolean') {
          setSimulateSurvivor(next.simulateSurvivor);
        }
        return next;
      });
    } else {
      if (typeof newInputs.simulateSurvivor === 'boolean') {
        setSimulateSurvivor(newInputs.simulateSurvivor);
      }
      setInputs(newInputs);
    }
  };

  // Global focus auto-select: automatically select text on number/text inputs so typing replaces default/0 values immediately
  useEffect(() => {
    const handleGlobalFocus = (e: FocusEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement &&
        (target.type === 'number' ||
          target.type === 'text' ||
          target.inputMode === 'numeric' ||
          target.inputMode === 'decimal')
      ) {
        // Defer selection slightly to ensure cursor/focus settlement across all browsers
        setTimeout(() => {
          if (document.activeElement === target) {
            target.select();
          }
        }, 10);
      }
    };
    window.addEventListener('focusin', handleGlobalFocus);
    return () => window.removeEventListener('focusin', handleGlobalFocus);
  }, []);

  // Global keyboard shortcuts:
  // - '?' or 'Shift + /' to summon Documentation & User Guide
  // - 'P' or 'p' to toggle between Parameters and Overview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isInput) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowDocumentation((prev) => !prev);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setActiveView((prev) => (prev.startsWith('params-') ? 'overview' : 'params-profiles'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveView]);

  // Defer heavy mathematical calculations to maintain 60+ FPS UI responsiveness during slider drag/typing
  const deferredInputs = useDeferredValue(inputs);
  const deferredSimulateSurvivor = useDeferredValue(simulateSurvivor);
  const [isSimulatingMC, setIsSimulatingMC] = useState(false);
  const isSimulating = inputs !== deferredInputs || simulateSurvivor !== deferredSimulateSurvivor || isSimulatingMC;

  // Global persisted scenario for all worksheets
  const [globalScenario, setGlobalScenario] = useLocalStorage<'flat' | 'p10' | 'p50' | 'p90'>(
    'retirement_planner_global_scenario',
    'p50'
  );

  // Persisted plan selections for Workspace 4 comparison
  const [selectedPlanAId, setSelectedPlanAId] = useLocalStorage<string>('retirement_planner_selected_plan_a', '');
  const [selectedPlanBId, setSelectedPlanBId] = useLocalStorage<string>('retirement_planner_selected_plan_b', '');

  // Persisted Quick Fill selection for Workspace 2 Roth optimization
  const [selectedQuickFill, setSelectedQuickFill] = useLocalStorage<number | null>(
    'retirement_planner_selected_quick_fill',
    null
  );

  // Dedicated persisted Guideline Overlay selection for Workspace 1 Bracket Map
  const [chartGuidelineOverlay, setChartGuidelineOverlay] = useLocalStorage<number | null>(
    'retirement_planner_chart_guideline_overlay',
    null
  );

  // Global root font size setting (affects all panels via root rem unit scaling)
  const [globalFontSize, setGlobalFontSize] = useLocalStorage<number>('retirement_planner_font_size', 16);

  useEffect(() => {
    document.documentElement.style.fontSize = `${globalFontSize}px`;
  }, [globalFontSize]);

  // 1. Generate 1,000 return sequences once, keyed ONLY on deferred volatility/correlation/seed/cpi.
  const returnSequences = useMemo(() => {
    const trials = deferredInputs.monteCarloSettings?.trials || 1000;
    const mode = deferredInputs.monteCarloSettings?.mode || 'monte-carlo';

    const equityMean = deferredInputs.growthAssumptions.equityReturnRate;
    const bondMean = deferredInputs.growthAssumptions.fixedIncomeReturnRate;
    const equityVol = deferredInputs.monteCarloSettings?.equityVolatility ?? 0.15;
    const bondVol = deferredInputs.monteCarloSettings?.fixedIncomeVolatility ?? 0.05;
    const correlation = deferredInputs.monteCarloSettings?.correlation ?? 0.15;
    const seed = deferredInputs.monteCarloSettings?.seed;
    const nonce = deferredInputs.monteCarloSettings?.nonce ?? 0;

    const isCpiRandomized = deferredInputs.monteCarloSettings?.randomizeCPI !== false;
    const constantCpi =
      deferredInputs.monteCarloSettings?.randomizeCPI === false &&
      deferredInputs.monteCarloSettings?.constantCPIRate != null
        ? deferredInputs.monteCarloSettings.constantCPIRate
        : deferredInputs.growthAssumptions.cpiInflationRate;
    const enableRegimeSwitching = deferredInputs.monteCarloSettings?.enableRegimeSwitching !== false;
    const historicalStrategy = deferredInputs.monteCarloSettings?.historicalSamplingStrategy ?? 'hybrid';
    const calibrateHistoricalMeans = deferredInputs.monteCarloSettings?.calibrateHistoricalMeans !== false;

    const baseSeed = seed !== null && seed !== undefined ? seed : 12345;
    const rand = mulberry32(baseSeed + nonce);

    const list: Omit<LockedReturnSequence, 'id'>[] = [];
    for (let t = 0; t < trials; t++) {
      if (mode === 'historical') {
        const isBlock = historicalStrategy === 'block' ? true : historicalStrategy === 'random' ? false : rand() < 0.35;
        list.push(
          generateHistoricalSequence(
            isBlock,
            undefined,
            rand,
            isCpiRandomized,
            constantCpi,
            calibrateHistoricalMeans,
            equityMean,
            bondMean
          )
        );
      } else {
        list.push(
          generateSyntheticSequence(
            equityMean,
            equityVol,
            bondMean,
            bondVol,
            correlation,
            rand,
            isCpiRandomized,
            constantCpi,
            enableRegimeSwitching
          )
        );
      }
    }
    return list;
  }, [
    deferredInputs.growthAssumptions.equityReturnRate,
    deferredInputs.growthAssumptions.fixedIncomeReturnRate,
    deferredInputs.growthAssumptions.cpiInflationRate,
    deferredInputs.monteCarloSettings.mode,
    deferredInputs.monteCarloSettings.trials,
    deferredInputs.monteCarloSettings.equityVolatility,
    deferredInputs.monteCarloSettings.fixedIncomeVolatility,
    deferredInputs.monteCarloSettings.correlation,
    deferredInputs.monteCarloSettings.seed,
    deferredInputs.monteCarloSettings.nonce,
    deferredInputs.monteCarloSettings.randomizeCPI,
    deferredInputs.monteCarloSettings.constantCPIRate,
    deferredInputs.monteCarloSettings.enableRegimeSwitching,
    deferredInputs.monteCarloSettings.historicalSamplingStrategy,
    deferredInputs.monteCarloSettings.calibrateHistoricalMeans,
  ]);

  // 2. Compute representative market return sequences (P10, P50, P90) instantaneously (<0.1ms).
  const representativeSequences = useMemo(() => {
    return computeRepresentativeSequences(deferredInputs, returnSequences);
  }, [deferredInputs, returnSequences]);

  // 3. Compute parallel ledgers for flat expected returns and the representative percentiles (~2ms total).
  const parallelLedgers = useMemo(() => {
    return {
      flat: runRetirementSimulation(deferredInputs, deferredSimulateSurvivor, null),
      p10: runRetirementSimulation(deferredInputs, deferredSimulateSurvivor, representativeSequences.worst),
      p50: runRetirementSimulation(deferredInputs, deferredSimulateSurvivor, representativeSequences.median),
      p90: runRetirementSimulation(deferredInputs, deferredSimulateSurvivor, representativeSequences.best),
    };
  }, [deferredInputs, deferredSimulateSurvivor, representativeSequences]);

  // 4. Asynchronously compute the 1,000-trial Monte Carlo batch simulation with debounce to keep UI interactions 100% fluid.
  const [monteCarloSummary, setMonteCarloSummary] = useState<MonteCarloSummary>(() => {
    return runMonteCarloSimulation(inputs, simulateSurvivor, returnSequences);
  });

  useEffect(() => {
    setIsSimulatingMC(true);
    const timer = setTimeout(() => {
      const summary = runMonteCarloSimulation(deferredInputs, deferredSimulateSurvivor, returnSequences);
      setMonteCarloSummary(summary);
      setIsSimulatingMC(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [deferredInputs, deferredSimulateSurvivor, returnSequences]);

  // Active return sequence for optimizer/matrix sweeps depending on global scenario
  const activeSequence = useMemo(() => {
    if (globalScenario === 'p10') return representativeSequences.worst;
    if (globalScenario === 'p50') return representativeSequences.median;
    if (globalScenario === 'p90') return representativeSequences.best;
    return null;
  }, [globalScenario, representativeSequences]);

  // Compute active ledger depending on the global switcher state
  const activeLedger = useMemo(() => {
    return parallelLedgers[globalScenario] || parallelLedgers.flat;
  }, [parallelLedgers, globalScenario]);

  // Helper to discount a row's nominal values back to today's purchasing power (real value)
  const discountRow = (row: SimulationResultRow): SimulationResultRow => {
    const factor = row.cpiFactor;
    if (factor <= 1) return row;

    const discounted = { ...row };
    const nonCurrencyKeys = new Set(['year', 'yourAge', 'wifeAge', 'surchargeTier', 'cpiFactor']);

    for (const key of Object.keys(discounted) as Array<keyof SimulationResultRow>) {
      const val = discounted[key];
      if (!nonCurrencyKeys.has(key as string) && typeof val === 'number') {
        (discounted as Record<string, unknown>)[key] = val / factor;
      }
    }
    return discounted;
  };

  // Conditionally apply inflation discounting for real-dollar displays
  const displayParallelLedgers = useMemo(() => {
    if (!useTodayDollars) return parallelLedgers;
    return {
      flat: parallelLedgers.flat.map((r) => discountRow(r)),
      p10: parallelLedgers.p10.map((r) => discountRow(r)),
      p50: parallelLedgers.p50.map((r) => discountRow(r)),
      p90: parallelLedgers.p90.map((r) => discountRow(r)),
    };
  }, [parallelLedgers, useTodayDollars]);

  const displayActiveLedger = useMemo(() => {
    if (!useTodayDollars) return activeLedger;
    return activeLedger.map((r) => discountRow(r));
  }, [activeLedger, useTodayDollars]);

  const displayMonteCarloSummary = useMemo(() => {
    if (!useTodayDollars) return monteCarloSummary;
    const cpi =
      deferredInputs.monteCarloSettings?.randomizeCPI === false &&
      deferredInputs.monteCarloSettings?.constantCPIRate != null
        ? deferredInputs.monteCarloSettings.constantCPIRate
        : deferredInputs.growthAssumptions.cpiInflationRate;

    const simStartYear = getSimulationStartYear(deferredInputs);
    const discountedPercentiles = monteCarloSummary.percentiles.map((p) => {
      const yearsElapsed = p.year - simStartYear;
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
  }, [monteCarloSummary, useTodayDollars, deferredInputs]);

  // Handle applying a fully optimized retirement configuration at once
  const handleApplyOptimization = (
    annualConversion: number,
    targetValue: number | null,
    yourAge: number,
    wifeAge: number,
    strategy?: 'flat' | 'fill-to-target'
  ) => {
    const finalStrategy = strategy || inputs.rothConversionStrategy;
    const finalTargetValue = targetValue !== null ? targetValue : inputs.rothConversionTargetValue;

    setInputs((prev) => ({
      ...prev,
      rothConversionStrategy: finalStrategy,
      annualRothConversion: annualConversion,
      rothConversionTargetValue: finalTargetValue,
      you: { ...prev.you, targetSSClaimingAge: yourAge },
      wife: { ...prev.wife, targetSSClaimingAge: wifeAge },
    }));
    if (finalStrategy === 'fill-to-target' && finalTargetValue !== null) {
      setSelectedQuickFill(finalTargetValue);
    }
  };

  // Handle changing conversion strategy while preserving last selected target values and active scenario IDs
  const handleUpdateStrategy = (strategy: 'flat' | 'fill-to-target' | 'custom') => {
    setInputs((prev) => {
      let targetValue = prev.rothConversionTargetValue;
      if (strategy === 'fill-to-target' && !targetValue) {
        targetValue = selectedQuickFill || DEFAULT_FILL_TO_TARGET_VALUE;
      }
      let activeCustomId = prev.activeCustomScenarioId;
      if (strategy === 'custom' && !activeCustomId && prev.customRothScenarios && prev.customRothScenarios.length > 0) {
        activeCustomId = prev.customRothScenarios[0].id;
      }
      return {
        ...prev,
        rothConversionStrategy: strategy,
        rothConversionTargetValue: targetValue,
        activeCustomScenarioId: activeCustomId,
      };
    });
  };

  // Handle saving a custom Roth scenario
  const handleSaveCustomRothScenario = (scenario: CustomRothScenario, applyImmediately: boolean = true) => {
    setInputs((prev) => {
      const existing = prev.customRothScenarios || [];
      const index = existing.findIndex((s) => s.id === scenario.id);
      let updated: CustomRothScenario[];
      if (index >= 0) {
        updated = [...existing];
        updated[index] = scenario;
      } else {
        updated = [...existing, scenario];
      }

      return {
        ...prev,
        customRothScenarios: updated,
        activeCustomScenarioId: applyImmediately ? scenario.id : prev.activeCustomScenarioId,
        rothConversionStrategy: applyImmediately ? 'custom' : prev.rothConversionStrategy,
      };
    });
  };

  // Handle deleting a custom Roth scenario
  const handleDeleteCustomRothScenario = (scenarioId: string) => {
    setInputs((prev) => {
      const existing = prev.customRothScenarios || [];
      const updated = existing.filter((s) => s.id !== scenarioId);
      const isDeletingActive = prev.activeCustomScenarioId === scenarioId;
      const nextActiveId = updated[0]?.id || null;

      return {
        ...prev,
        customRothScenarios: updated,
        activeCustomScenarioId: isDeletingActive ? nextActiveId : prev.activeCustomScenarioId,
        rothConversionStrategy: isDeletingActive && !nextActiveId ? 'fill-to-target' : prev.rothConversionStrategy,
      };
    });
  };

  // Handle selecting active custom Roth scenario
  const handleSelectCustomRothScenario = (scenarioId: string) => {
    setInputs((prev) => ({
      ...prev,
      rothConversionStrategy: 'custom',
      activeCustomScenarioId: scenarioId,
    }));
  };

  // Handle changing target MAGI threshold limit
  const handleUpdateTargetValue = (val: number | null) => {
    setInputs((prev) => ({
      ...prev,
      rothConversionTargetValue: val,
    }));
    if (val !== null) {
      setSelectedQuickFill(val);
    }
  };

  // Keep selectedQuickFill synchronized with rothConversionStrategy & rothConversionTargetValue
  useEffect(() => {
    if (inputs.rothConversionStrategy === 'fill-to-target' && inputs.rothConversionTargetValue !== null) {
      setSelectedQuickFill(inputs.rothConversionTargetValue);
    }
  }, [inputs.rothConversionStrategy, inputs.rothConversionTargetValue, setSelectedQuickFill]);

  // Sync title and head tags for SEO best practices
  useEffect(() => {
    document.title = 'Retirement Planner - Tax, Medicare & SS Planner';
  }, []);

  const isParamView = activeView.startsWith('params-');

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased font-sans">
      {!inputs.isConfigured && <OnboardingWizard onComplete={handleInputsChange} />}

      {/* Main Orchestration Dashboard Layout with Collapsible Sidebar */}
      <DashboardLayout
        ledger={displayActiveLedger}
        parallelLedgers={displayParallelLedgers}
        successRate={monteCarloSummary.successRate}
        inputs={inputs}
        activeView={activeView}
        onNavigate={handleNavigate}
        globalScenario={globalScenario}
        setGlobalScenario={setGlobalScenario}
        isSimulating={isSimulating}
        onOpenDocumentation={handleOpenDocumentation}
        onOpenAbout={() => setShowAboutDialog(true)}
        onOpenCloudModal={() => setShowCloudModal(true)}
        isAuthenticated={isAuthenticated}
        globalFontSize={globalFontSize}
        setGlobalFontSize={setGlobalFontSize}
      >
        {/* Render Parameters Workspace when activeView is a parameter section */}
        {isParamView && (
          <ParametersWorkspace
            activeSection={activeView}
            onNavigateSection={handleNavigate}
            inputs={inputs}
            onChange={handleInputsChange}
            onReset={() => handleInputsChange(DEFAULT_INPUTS)}
            simulateSurvivor={simulateSurvivor}
            setSimulateSurvivor={setSimulateSurvivor}
            ledger={displayActiveLedger}
            globalScenario={globalScenario}
          />
        )}

        {/* Workspace 1: Overview & Bracket Map */}
        {activeView === 'overview' && (
          <BracketMapChart
            ledger={displayActiveLedger}
            inputs={inputs}
            simulateSurvivor={simulateSurvivor}
            guidelineOverlay={chartGuidelineOverlay}
            setGuidelineOverlay={setChartGuidelineOverlay}
          />
        )}

        {/* Workspace 2: Taxable Income Planner */}
        {activeView === 'taxable-income' && (
          <TaxableIncomeWorkspace
            ledger={displayActiveLedger}
            inputs={inputs}
            simulateSurvivor={simulateSurvivor}
            activeScenarioSequence={activeSequence}
            onApplyOptimization={handleApplyOptimization}
            onUpdateStrategy={handleUpdateStrategy}
            onUpdateTargetValue={handleUpdateTargetValue}
            onSaveCustomScenario={handleSaveCustomRothScenario}
            onDeleteCustomScenario={handleDeleteCustomRothScenario}
            onSelectCustomScenario={handleSelectCustomRothScenario}
            onInputsChange={handleInputsChange}
            selectedQuickFill={selectedQuickFill}
            setSelectedQuickFill={setSelectedQuickFill}
          />
        )}

        {/* Workspace 3: Lookback Ledger */}
        {activeView === 'lookback-ledger' && (
          <LookbackLedgerTable
            ledger={displayActiveLedger}
            inputs={inputs}
            simulateSurvivor={simulateSurvivor}
            onNavigateToActuals={() => {
              setActiveView('actuals');
            }}
          />
        )}

        {/* Workspace 4: Monte Carlo Analysis */}
        {activeView === 'monte-carlo' && (
          <MonteCarloWorkspace
            inputs={inputs}
            onChangeInputs={handleInputsChange}
            simulateSurvivor={simulateSurvivor}
            summary={displayMonteCarloSummary}
            globalScenario={globalScenario}
            useTodayDollars={useTodayDollars}
            setUseTodayDollars={setUseTodayDollars}
          />
        )}

        {/* Workspace 5: Plan Comparison */}
        {activeView === 'compare' && (
          <PlanComparisonWorkspace
            inputs={inputs}
            onLoadPlan={handleInputsChange}
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

        {/* Workspace 6: Actuals & Guardrails */}
        {activeView === 'actuals' && (
          <ActualsWorkspace
            ledger={displayActiveLedger}
            inputs={inputs}
            onUpdateActuals={(actuals) => {
              setInputs((prev) => ({
                ...prev,
                actualTracking: actuals,
              }));
            }}
            onUpdateGuardrailSettings={(guardrails) => {
              setInputs((prev) => ({
                ...prev,
                guardrailSettings: guardrails,
              }));
            }}
            onApplySpendingBonusToBudget={(newBudget) => {
              setInputs((prev) => ({
                ...prev,
                annualLivingExpenses: newBudget,
              }));
            }}
            onNavigateToTab={(tabIdx) => handleNavigate(tabIdx)}
          />
        )}

        {/* Workspace 7: 3-Bucket Strategy Management */}
        {activeView === 'bucket-management' && (
          <BucketManagementWorkspace
            ledger={displayActiveLedger}
            inputs={inputs}
            onInputsChange={handleInputsChange}
            simulateSurvivor={simulateSurvivor}
          />
        )}
      </DashboardLayout>

      {/* Global Application Documentation & User Guide Modal */}
      {showDocumentation && (
        <DocumentationDialog
          isOpen={showDocumentation}
          onClose={() => setShowDocumentation(false)}
          initialSectionId={documentationSectionId}
          onNavigateTab={(tabIdx) => handleNavigate(tabIdx)}
        />
      )}

      {/* About Application Modal */}
      {showAboutDialog && (
        <AboutDialog
          isOpen={showAboutDialog}
          onClose={() => setShowAboutDialog(false)}
          onOpenDocumentation={() => {
            setShowAboutDialog(false);
            handleOpenDocumentation('overview');
          }}
        />
      )}

      {/* Household Cloud Authentication & Sync Modal */}
      <CloudAuthModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
      />
    </div>
  );
}

export default App;
