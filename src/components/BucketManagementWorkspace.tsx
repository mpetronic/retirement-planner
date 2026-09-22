import React, { useState, useMemo } from 'react';
import {
  SimulationResultRow,
  AppStateInputs,
  BucketStrategySettings,
  BucketActionItem,
  BondLadderHolding,
  BondLadderAssetType,
  getSimulationStartYear,
  DEFAULT_BUCKET_STRATEGY_SETTINGS,
} from '../types';
import {
  calculateBucketYearState,
  generateBucketMultiYearProjection,
} from '../engine/bucketEngine';
import {
  Layers,
  Shield,
  ArrowRight,
  TrendingUp,
  Wallet,
  Building2,
  Landmark,
  CheckCircle2,
  Circle,
  PauseCircle,
  PlayCircle,
  Calendar,
  Sliders,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Sparkles,
  BarChart3,
  ListOrdered,
} from 'lucide-react';

interface BucketManagementWorkspaceProps {
  ledger: SimulationResultRow[];
  inputs: AppStateInputs;
  onInputsChange: (newInputs: AppStateInputs) => void;
  simulateSurvivor?: boolean;
}

export const BucketManagementWorkspace: React.FC<BucketManagementWorkspaceProps> = ({
  ledger,
  inputs,
  onInputsChange,
}) => {
  const simStartYear = getSimulationStartYear(inputs);
  const availableYears = useMemo(() => {
    if (ledger && ledger.length > 0) {
      return ledger.map((r) => r.year);
    }
    return Array.from({ length: 35 }, (_, i) => simStartYear + i);
  }, [ledger, simStartYear]);

  // Selected year for scrubber
  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0] || simStartYear);
  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rules' | 'projections'>('dashboard');

  // Holding modal state
  const [showHoldingModal, setShowHoldingModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<BondLadderHolding | null>(null);
  const [holdingForm, setHoldingForm] = useState<{
    rungNumber: number;
    targetYear: number;
    cusipOrName: string;
    assetType: BondLadderAssetType;
    principal: number;
    couponRate: number;
    maturityDate: string;
    notes: string;
  }>({
    rungNumber: 1,
    targetYear: selectedYear,
    cusipOrName: '',
    assetType: 'treasury',
    principal: 100000,
    couponRate: 4.25,
    maturityDate: `${selectedYear}-10-15`,
    notes: '',
  });

  // Safe bucket settings resolution
  const bucketSettings: BucketStrategySettings = useMemo(() => {
    return inputs.bucketSettings || DEFAULT_BUCKET_STRATEGY_SETTINGS;
  }, [inputs.bucketSettings]);

  // Find active ledger row for selected year
  const activeLedgerRow = useMemo(() => {
    return ledger.find((r) => r.year === selectedYear);
  }, [ledger, selectedYear]);

  // Calculate bucket calculation for selected year
  const currentCalc = useMemo(() => {
    return calculateBucketYearState(selectedYear, activeLedgerRow, inputs, bucketSettings);
  }, [selectedYear, activeLedgerRow, inputs, bucketSettings]);

  // Multi-year projection
  const multiYearProjections = useMemo(() => {
    return generateBucketMultiYearProjection(ledger, inputs, bucketSettings);
  }, [ledger, inputs, bucketSettings]);

  // Helper to update bucket settings
  const handleUpdateBucketSettings = (updater: (prev: BucketStrategySettings) => BucketStrategySettings) => {
    const updated = updater(bucketSettings);
    onInputsChange({
      ...inputs,
      bucketSettings: updated,
    });
  };

  // Toggle ladder pause mode
  const handleTogglePause = () => {
    handleUpdateBucketSettings((prev) => ({
      ...prev,
      income: {
        ...prev.income,
        rebuildMode: prev.income.rebuildMode === 'active' ? 'paused' : 'active',
      },
    }));
  };

  // Toggle action completion status
  const handleToggleActionStatus = (action: BucketActionItem) => {
    const currentStatus = action.status;
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const nowStr = newStatus === 'completed' ? new Date().toISOString() : undefined;

    handleUpdateBucketSettings((prev) => {
      const yearActions = prev.actionLedger?.[selectedYear] || [];
      const existingIdx = yearActions.findIndex((a) => a.id === action.id);
      let updatedYearActions: BucketActionItem[];

      if (existingIdx >= 0) {
        updatedYearActions = [...yearActions];
        updatedYearActions[existingIdx] = {
          ...updatedYearActions[existingIdx],
          status: newStatus,
          completedDate: nowStr,
        };
      } else {
        updatedYearActions = [
          ...yearActions,
          {
            ...action,
            status: newStatus,
            completedDate: nowStr,
          },
        ];
      }

      return {
        ...prev,
        actionLedger: {
          ...prev.actionLedger,
          [selectedYear]: updatedYearActions,
        },
      };
    });
  };

  // Save holding modal
  const handleSaveHolding = () => {
    const rawPrincipal = Number(holdingForm.principal) || 0;
    const rawCoupon = Number(holdingForm.couponRate) || 0;
    const newHolding: BondLadderHolding = {
      id: editingHolding?.id || `holding-${Date.now()}`,
      rungNumber: holdingForm.rungNumber,
      targetYear: holdingForm.targetYear,
      cusipOrName: holdingForm.cusipOrName || undefined,
      assetType: holdingForm.assetType,
      principal: Math.round((rawPrincipal + Number.EPSILON) * 100) / 100,
      couponRate: Math.round((rawCoupon / 100 + Number.EPSILON) * 10000) / 10000,
      maturityDate: holdingForm.maturityDate || undefined,
      notes: holdingForm.notes || undefined,
      status: 'active',
    };

    handleUpdateBucketSettings((prev) => {
      const existing = prev.income.holdings || [];
      const filtered = editingHolding ? existing.filter((h) => h.id !== editingHolding.id) : existing;
      return {
        ...prev,
        income: {
          ...prev.income,
          holdings: [...filtered, newHolding],
        },
      };
    });

    setShowHoldingModal(false);
    setEditingHolding(null);
  };

  // Delete holding
  const handleDeleteHolding = (id: string) => {
    handleUpdateBucketSettings((prev) => ({
      ...prev,
      income: {
        ...prev.income,
        holdings: (prev.income.holdings || []).filter((h) => h.id !== id),
      },
    }));
  };

  // Open edit modal for holding
  const handleOpenEditHolding = (holding: BondLadderHolding) => {
    setEditingHolding(holding);
    setHoldingForm({
      rungNumber: holding.rungNumber,
      targetYear: holding.targetYear,
      cusipOrName: holding.cusipOrName || '',
      assetType: holding.assetType,
      principal: Math.round((holding.principal + Number.EPSILON) * 100) / 100,
      couponRate: Math.round((holding.couponRate * 100 + Number.EPSILON) * 100) / 100,
      maturityDate: holding.maturityDate || '',
      notes: holding.notes || '',
    });
    setShowHoldingModal(true);
  };

  // Open create modal for holding
  const handleOpenCreateHolding = (rungNum: number, yr: number) => {
    setEditingHolding(null);
    const defaultPrincipal = currentCalc.bucket2.rungs.find((r) => r.rungNumber === rungNum)?.principal || 100000;
    setHoldingForm({
      rungNumber: rungNum,
      targetYear: yr,
      cusipOrName: '',
      assetType: 'treasury',
      principal: Math.round((defaultPrincipal + Number.EPSILON) * 100) / 100,
      couponRate: 4.25,
      maturityDate: `${yr}-10-15`,
      notes: '',
    });
    setShowHoldingModal(true);
  };

  // Bear market resilience metrics
  const totalGuaranteedRunwayYears = useMemo(() => {
    const cashYears = currentCalc.bucket1.runwayMonths / 12;
    const ladderYears = currentCalc.bucket2.ladderRunwayYears;
    return Math.round((cashYears + ladderYears) * 10) / 10;
  }, [currentCalc]);

  return (
    <div className="space-y-6 pb-12">
      {/* Workspace Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">3-Bucket Strategy Workspace</h1>
                <p className="text-sm text-slate-400">
                  Manage temporal cashflow buffers, custodian bond ladder tracking, and market protection rules.
                </p>
              </div>
            </div>
          </div>

          {/* Health & Status Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                currentCalc.bucket1.status === 'healthy'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : currentCalc.bucket1.status === 'caution'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Cash Runway: {currentCalc.bucket1.runwayMonths} Mo</span>
            </div>

            <button
              onClick={handleTogglePause}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors ${
                bucketSettings.income.rebuildMode === 'active'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
              }`}
            >
              {bucketSettings.income.rebuildMode === 'active' ? (
                <>
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Ladder Rebuild: Active</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Ladder Rebuild: Paused</span>
                </>
              )}
            </button>

            <div className="px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Protected Runway: {totalGuaranteedRunwayYears} Yrs</span>
            </div>
          </div>
        </div>

        {/* Year Scrubber & Timeline Bar */}
        <div className="mt-5 pt-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              Inspecting Year:
            </span>
            <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800 rounded-xl p-1">
              {availableYears.slice(0, 8).map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    selectedYear === yr
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {yr}
                </button>
              ))}
              {availableYears.length > 8 && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent text-xs text-slate-300 font-medium px-2 py-1 outline-none cursor-pointer hover:text-white"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr} className="bg-slate-900 text-slate-200">
                      {yr}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Sub-Tab Navigation */}
          <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-800 rounded-xl p-1 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Dashboard & Flow
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
                activeTab === 'rules'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              Rules & Config
            </button>
            <button
              onClick={() => setActiveTab('projections')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ${
                activeTab === 'projections'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
              30-Yr Timeline
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: DASHBOARD & FLOW VISUALIZATION */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Transition / Launch Status Banner */}
          {currentCalc.isTransitionYear && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 flex items-start gap-3.5 shadow-md">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 mt-0.5">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Retirement Transition Year ({selectedYear})</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    3-Bucket Strategy Launches Jan 1, {currentCalc.strategyStartYear}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Year {selectedYear} is a transition year. Remaining living expenses after your retirement start date in {selectedYear} are funded from active work earnings and staged cash savings without liquidating bond ladder rungs. The 3-Bucket system begins on <strong>January 1, {currentCalc.strategyStartYear}</strong>: Year 1 ({currentCalc.strategyStartYear}) is pre-funded by your staged Bucket 1 cash reserve, and Ladder Rung 1 will mature on <strong>January 1, {currentCalc.strategyStartYear + 1}</strong> to start systematic refills.
                </p>
              </div>
            </div>
          )}

          {currentCalc.isInitialStrategyYear && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex items-start gap-3.5 shadow-md">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Strategy Launch Year ({selectedYear})</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Initial Reserve Staged from {currentCalc.initialFundingSource === 'cash-savings' ? 'Cash Savings / Work Buffer' : `Selling Equities (${currentCalc.initialEquitySourceAccount})`}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  The 3-Bucket management strategy is officially active as of January 1, {selectedYear}. All {selectedYear} living expenses and Roth conversion taxes are funded from your staged <strong>${Math.round(currentCalc.initialStagedAmount).toLocaleString()}</strong> Bucket 1 cash reserve. Your 5-year bond ladder in Bucket 2 will mature its first rung on <strong>January 1, {selectedYear + 1}</strong> to refill Bucket 1 for Year 2.
                </p>
              </div>
            </div>
          )}

          {/* Three Interactive Bucket Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* BUCKET 1: CASH (Taxable Brokerage) */}
            <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/30 transition-all rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Bucket 1: Cash</h3>
                      <p className="text-xs text-slate-400">Taxable Brokerage (Near-Term)</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-400 border border-emerald-500/20">
                    1–2 Yr Horizon
                  </span>
                </div>

                {/* Total Balance & Fill Gauge */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Total Taxable Balance</span>
                    <span className="text-xl font-bold text-white">
                      ${Math.round(currentCalc.bucket1.totalBalance).toLocaleString()}
                    </span>
                  </div>

                  {/* Visual Fluid Fill Progress Bar */}
                  <div className="mt-2.5 bg-slate-950 rounded-full h-3.5 p-0.5 border border-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 shadow-sm"
                      style={{ width: `${currentCalc.bucket1.fillPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-medium">
                    <span>Reserve: ${Math.round(currentCalc.bucket1.cashReserve).toLocaleString()}</span>
                    <span>Target: ${Math.round(currentCalc.bucket1.totalTargetReserve).toLocaleString()} ({currentCalc.bucket1.fillPercentage}%)</span>
                  </div>
                </div>

                {/* Sub-Reserves Breakdown */}
                <div className="mt-4 space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      Living Expense Reserve ({bucketSettings.cash.targetRunwayMonths} Mo):
                    </span>
                    <span className="font-semibold text-slate-200">
                      ${Math.round(currentCalc.bucket1.targetLivingReserve).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      Roth Conversion Tax Reserve:
                    </span>
                    <span className="font-semibold text-slate-200">
                      ${Math.round(currentCalc.bucket1.targetRothTaxReserve).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/60">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-slate-500" />
                      Invested Equities Buffer:
                    </span>
                    <span className="font-semibold text-slate-400">
                      ${Math.round(currentCalc.bucket1.coreEquities).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Outflow Note */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 text-slate-400">
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  Checking Outflow:
                </span>
                <span className="font-semibold text-emerald-400">
                  ${Math.round(currentCalc.bucket1.externalCheckingMonthlyAmount).toLocaleString()}/mo
                </span>
              </div>
            </div>

            {/* BUCKET 2: INCOME (Pre-Tax IRA & Bond Ladder) */}
            <div className="bg-slate-900 border border-slate-800 hover:border-blue-500/30 transition-all rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Bucket 2: Income</h3>
                      <p className="text-xs text-slate-400">Pre-Tax IRA (Intermediate)</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-blue-400 border border-blue-500/20">
                    3–7 Yr Horizon
                  </span>
                </div>

                {/* Balances & Asset Allocation */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Total Pre-Tax Balance</span>
                    <span className="text-xl font-bold text-white">
                      ${Math.round(currentCalc.bucket2.totalBalance).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Bond Ladder</span>
                      <span className="font-bold text-blue-400 text-sm">
                        ${Math.round(currentCalc.bucket2.bondLadderTotal).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Equities & Core</span>
                      <span className="font-bold text-slate-200 text-sm">
                        ${Math.round(currentCalc.bucket2.equitiesTotal).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bond Ladder Tiered Rung Visualizer */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <ListOrdered className="w-3.5 h-3.5 text-blue-400" />
                      5-Year Ladder Rungs
                    </span>
                    <span className="text-[11px] text-blue-400 font-medium">
                      {currentCalc.bucket2.ladderRunwayYears} Yrs Runway
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {currentCalc.bucket2.rungs.map((rung) => (
                      <div
                        key={rung.rungNumber}
                        className={`p-2 rounded-xl border text-xs flex items-center justify-between transition-all ${
                          rung.isMaturingThisYear
                            ? 'bg-blue-500/15 border-blue-500/40 text-white shadow-sm'
                            : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              rung.isMaturingThisYear ? 'bg-blue-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            R{rung.rungNumber}
                          </span>
                          <div>
                            <span className="font-semibold block">{rung.targetYear} Rung</span>
                            <span className="text-[10px] text-slate-400">
                              {rung.holdings.length > 0
                                ? `${rung.holdings.length} holding(s)`
                                : `${(rung.yieldRate * 100).toFixed(1)}% yield`}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-bold block">${Math.round(rung.principal).toLocaleString()}</span>
                          {rung.isMaturingThisYear ? (
                            <span className="text-[10px] text-emerald-400 font-medium">Matures This Year</span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              +${Math.round(rung.annualIncome).toLocaleString()}/yr
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ladder Rebuild Control Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Market Rebuild Mode:</span>
                <button
                  onClick={handleTogglePause}
                  className={`font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded-md ${
                    currentCalc.bucket2.rebuildMode === 'active'
                      ? 'text-blue-400 hover:text-blue-300'
                      : 'text-amber-400 hover:text-amber-300'
                  }`}
                >
                  {currentCalc.bucket2.rebuildMode === 'active' ? (
                    <>
                      <PlayCircle className="w-3.5 h-3.5" />
                      Active (Rebuild Rungs)
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3.5 h-3.5" />
                      Paused (Protect Equities)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* BUCKET 3: GROWTH (Roth IRA) */}
            <div className="bg-slate-900 border border-slate-800 hover:border-purple-500/30 transition-all rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Bucket 3: Growth</h3>
                      <p className="text-xs text-slate-400">Roth IRA (Long-Term)</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-purple-400 border border-purple-500/20">
                    8+ Yr Horizon
                  </span>
                </div>

                {/* Balances & Composition */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Total Roth Balance</span>
                    <span className="text-xl font-bold text-white">
                      ${Math.round(currentCalc.bucket3.totalBalance).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Asset Allocation:</span>
                      <span className="font-bold text-purple-400">100% Equities</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Unencumbered Horizon:</span>
                      <span className="font-semibold text-slate-200">
                        {currentCalc.bucket3.unencumberedHorizonYears}+ Years
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800/60">
                      <span className="text-slate-400">Roth Conversion Inflow:</span>
                      <span className="font-semibold text-emerald-400">
                        +${Math.round(currentCalc.bucket3.rothInflowThisYear).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Strategic Principle Callout */}
                <div className="mt-4 p-3 rounded-xl bg-purple-500/5 border border-purple-500/15 text-xs text-purple-300">
                  <p className="leading-relaxed">
                    <strong>Untouched Last Resort:</strong> High compounding growth with zero sequence-of-returns
                    liquidation pressure during market downturns.
                  </p>
                </div>
              </div>

              {/* Growth Status Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Tax-Free Compounding:</span>
                <span className="font-semibold text-purple-400">Maximum Equity Exposure</span>
              </div>
            </div>
          </div>

          {/* Interactive Flow Pipeline / Diagram */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              Annual Money Flow Pipeline ({selectedYear})
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Model of planned distributions, ladder refills, checking disbursements, and Roth conversions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
              {/* Flow Card 1: Ladder Rung Maturity */}
              <div className="bg-slate-950 p-4 rounded-xl border border-blue-500/20 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-blue-400">1. Ladder Maturity</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300">
                    {currentCalc.isInitialStrategyYear ? 'Staged Pre-Funded' : 'IRA Distribution'}
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-xl font-bold text-white block">
                    ${Math.round(currentCalc.bucket2.maturingPrincipalThisYear).toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400">
                    {currentCalc.isInitialStrategyYear
                      ? `Year 1 pre-funded; Rung 1 ($${Math.round(currentCalc.bucket2.rungs[0]?.principal || 100000).toLocaleString()}) matures in ${selectedYear + 1}`
                      : currentCalc.isTransitionYear
                      ? `Transition period; Rung 1 matures in ${currentCalc.strategyStartYear + 1}`
                      : 'Disperses from Pre-Tax IRA Rung 1'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-800">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {currentCalc.isInitialStrategyYear
                      ? `First ladder refill triggers Jan 1, ${selectedYear + 1}`
                      : 'Refills Bucket 1 (Taxable Cash)'}
                  </span>
                </div>
              </div>

              {/* Flow Card 2: Living Expense Outflow */}
              <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/20 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-emerald-400">2. External Living Spend</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                    {currentCalc.isTransitionYear ? 'Transition Outflow' : 'Checking Dump'}
                  </span>
                </div>
                <div className="my-2">
                  <span className="text-xl font-bold text-white block">
                    ${Math.round(currentCalc.isTransitionYear && currentCalc.transitionExpense !== undefined ? currentCalc.transitionExpense : currentCalc.bucket1.annualLivingExpense).toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-400">
                    {currentCalc.isTransitionYear && currentCalc.transitionPostRetirementMonths !== undefined && currentCalc.transitionPostRetirementMonths < 12
                      ? `${currentCalc.transitionPostRetirementMonths} post-retirement mo funded from work savings`
                      : `$${Math.round(currentCalc.bucket1.externalCheckingMonthlyAmount).toLocaleString()}/month`}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-800">
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    {currentCalc.isTransitionYear && currentCalc.transitionWorkingMonths !== undefined && currentCalc.transitionWorkingMonths > 0
                      ? `Prior ${currentCalc.transitionWorkingMonths} mo covered by active salary`
                      : 'Deposits to Personal Bank Account'}
                  </span>
                </div>
              </div>

              {/* Flow Card 3: Roth Conversion & Ladder Rebuild */}
              <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/20 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-purple-400">3. Growth & Rebuild</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      currentCalc.bucket2.rebuildMode === 'active'
                        ? 'bg-purple-500/10 text-purple-300'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {currentCalc.bucket2.rebuildMode === 'active' ? 'Active Rebuild' : 'Rebuild Paused'}
                  </span>
                </div>
                <div className="my-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Roth Conversion:</span>
                    <span className="font-bold text-white">
                      ${Math.round(currentCalc.bucket3.rothInflowThisYear).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Tax Reserve Used:</span>
                    <span className="font-bold text-amber-400">
                      ${Math.round(currentCalc.bucket1.targetRothTaxReserve).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-2 border-t border-slate-800">
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                  <span>Converts to Bucket 3 (Roth IRA)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Year Action Center & Ledger */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Action Center: {selectedYear} Recommended Actions
                </h3>
                <p className="text-xs text-slate-400">
                  Mirroring your custodian brokerage accounts: execute these actions in real life and mark them as done here.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                {currentCalc.actions.filter((a) => a.status === 'completed').length} of {currentCalc.actions.length} Completed
              </span>
            </div>

            <div className="space-y-3">
              {currentCalc.actions.map((action) => {
                const isDone = action.status === 'completed';
                return (
                  <div
                    key={action.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isDone
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-80'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleActionStatus(action)}
                        className={`mt-0.5 p-1 rounded-lg transition-colors ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>

                      <div>
                        <h4 className={`text-sm font-semibold ${isDone ? 'line-through text-slate-400' : 'text-white'}`}>
                          {action.title}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">{action.description}</p>
                        {action.completedDate && (
                          <span className="text-[10px] text-emerald-400 block mt-1">
                            Completed on {new Date(action.completedDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-auto">
                      <span className="text-sm font-bold text-slate-200">
                        ${Math.round(action.amount).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleToggleActionStatus(action)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isDone
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-md shadow-emerald-500/20'
                        }`}
                      >
                        {isDone ? 'Undo' : 'Mark as Done'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RULES & STRATEGY CONFIGURATION */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Strategy Timeline & Initial Funding Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-bold text-white text-base">Strategy Timeline & Initial Year 1 Staging</h3>
                <p className="text-xs text-slate-400">Configure when the 3-Bucket strategy commences and how Year 1 cash reserves are staged</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Bucket Strategy Start Year
                </label>
                <select
                  value={bucketSettings.strategyStartYear || simStartYear}
                  onChange={(e) =>
                    handleUpdateBucketSettings((prev) => ({
                      ...prev,
                      strategyStartYear: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer [color-scheme:dark]"
                >
                  {availableYears.slice(0, 10).map((yr) => (
                    <option key={yr} value={yr} className="bg-slate-900 text-slate-200">
                      {yr} {yr === simStartYear ? '(Simulation Start Year)' : yr === simStartYear + 1 ? '(First Full Retirement Year)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  If retiring mid-year (e.g. late {simStartYear}), set this to {simStartYear + 1} to run the 3-Bucket system over full calendar years starting January 1.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Initial Year 1 Funding Source
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      handleUpdateBucketSettings((prev) => ({
                        ...prev,
                        initialFundingSource: 'cash-savings',
                      }))
                    }
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-left transition-all ${
                      (bucketSettings.initialFundingSource || 'cash-savings') === 'cash-savings'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-bold block">Cash Savings</span>
                    <span className="text-[10px] text-slate-400">Work income / cash buffer</span>
                  </button>
                  <button
                    onClick={() =>
                      handleUpdateBucketSettings((prev) => ({
                        ...prev,
                        initialFundingSource: 'selling-equities',
                      }))
                    }
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border text-left transition-all ${
                      bucketSettings.initialFundingSource === 'selling-equities'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-bold block">Selling Equities</span>
                    <span className="text-[10px] text-slate-400">Liquidate starting funds</span>
                  </button>
                </div>

                {bucketSettings.initialFundingSource === 'selling-equities' && (
                  <div className="mt-3">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Source Account for Initial Equity Liquidation
                    </label>
                    <select
                      value={bucketSettings.initialEquitySourceAccount || 'taxable'}
                      onChange={(e) =>
                        handleUpdateBucketSettings((prev) => ({
                          ...prev,
                          initialEquitySourceAccount: e.target.value as 'taxable' | 'pre-tax' | 'roth',
                        }))
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer [color-scheme:dark]"
                    >
                      <option value="taxable">Taxable Brokerage Account</option>
                      <option value="pre-tax">Pre-Tax Traditional IRA</option>
                      <option value="roth">Roth IRA</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash Bucket Configuration */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-white text-base">Bucket 1 (Cash) Rules</h3>
                  <p className="text-xs text-slate-400">Configure target runway and reserve formulas</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Living Expense Runway (Months)
                  </label>
                  <div className="flex items-center gap-2">
                    {[12, 18, 24, 36].map((months) => (
                      <button
                        key={months}
                        onClick={() =>
                          handleUpdateBucketSettings((prev) => ({
                            ...prev,
                            cash: { ...prev.cash, targetRunwayMonths: months },
                          }))
                        }
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                          bucketSettings.cash.targetRunwayMonths === months
                            ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {months} Mo ({months / 12} Yr)
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Roth Conversion Tax Reserve Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        handleUpdateBucketSettings((prev) => ({
                          ...prev,
                          cash: { ...prev.cash, rothTaxReserveMode: 'auto' },
                        }))
                      }
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border text-left transition-all ${
                        bucketSettings.cash.rothTaxReserveMode === 'auto'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-bold block">Auto Calculate</span>
                      <span className="text-[10px] text-slate-400">Based on planned conversions</span>
                    </button>
                    <button
                      onClick={() =>
                        handleUpdateBucketSettings((prev) => ({
                          ...prev,
                          cash: { ...prev.cash, rothTaxReserveMode: 'manual' },
                        }))
                      }
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border text-left transition-all ${
                        bucketSettings.cash.rothTaxReserveMode === 'manual'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-bold block">Manual Target</span>
                      <span className="text-[10px] text-slate-400">Fixed dollar amount</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    External Checking Transfer Frequency
                  </label>
                  <select
                    value={bucketSettings.cash.externalCheckingTransferFrequency}
                    onChange={(e) =>
                      handleUpdateBucketSettings((prev) => ({
                        ...prev,
                        cash: {
                          ...prev.cash,
                          externalCheckingTransferFrequency: e.target.value as 'monthly' | 'quarterly' | 'annual',
                        },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="monthly">Monthly (1/12th annual budget)</option>
                    <option value="quarterly">Quarterly (1/4th annual budget)</option>
                    <option value="annual">Annual Lump Sum</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Income Bucket & Ladder Configuration */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
                <Landmark className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-white text-base">Bucket 2 (Income & Ladder) Rules</h3>
                  <p className="text-xs text-slate-400">Configure bond ladder rungs and pause triggers</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Number of Ladder Rungs</label>
                  <div className="flex items-center gap-2">
                    {[3, 4, 5, 6, 7].map((num) => (
                      <button
                        key={num}
                        onClick={() =>
                          handleUpdateBucketSettings((prev) => ({
                            ...prev,
                            income: { ...prev.income, rungsCount: num },
                          }))
                        }
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                          bucketSettings.income.rungsCount === num
                            ? 'bg-blue-500 text-slate-950 font-bold border-blue-400'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {num} Yrs
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Market Downturn Rebuild Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() =>
                        handleUpdateBucketSettings((prev) => ({
                          ...prev,
                          income: { ...prev.income, rebuildMode: 'active' },
                        }))
                      }
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border text-left transition-all ${
                        bucketSettings.income.rebuildMode === 'active'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-bold block">Active Rebuilding</span>
                      <span className="text-[10px] text-slate-400">Sell equities to buy Year 5 rung</span>
                    </button>
                    <button
                      onClick={() =>
                        handleUpdateBucketSettings((prev) => ({
                          ...prev,
                          income: { ...prev.income, rebuildMode: 'paused' },
                        }))
                      }
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border text-left transition-all ${
                        bucketSettings.income.rebuildMode === 'paused'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-bold block">Pause Rebuilding</span>
                      <span className="text-[10px] text-slate-400">Do not sell equities in down market</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Default Bond/CD Yield Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="15"
                    value={((bucketSettings.income.defaultYieldRate || 0.04) * 100).toFixed(1)}
                    onChange={(e) =>
                      handleUpdateBucketSettings((prev) => ({
                        ...prev,
                        income: {
                          ...prev.income,
                          defaultYieldRate: (Number(e.target.value) || 4) / 100,
                        },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Bond Ladder Holdings Manager */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-blue-400" />
                  Detailed Bond Ladder Holdings (Custodian Tracking)
                </h3>
                <p className="text-xs text-slate-400">
                  Input individual Treasuries, CDs, or Agency bonds to match your brokerage statement.
                </p>
              </div>

              <button
                onClick={() => handleOpenCreateHolding(1, selectedYear)}
                className="px-3 py-1.5 rounded-xl bg-blue-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 hover:bg-blue-400 transition-all shadow-md shadow-blue-500/20 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                Add Holding
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              {(bucketSettings.income.holdings || []).length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800/60 text-xs">
                  <p>No custom bond holdings entered yet.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    The engine is currently calculating rungs using your default annual living expenses ($
                    {Math.round(currentCalc.bucket1.annualLivingExpense).toLocaleString()}) and default yield.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2 font-medium">Rung #</th>
                      <th className="pb-2 font-medium">Target Year</th>
                      <th className="pb-2 font-medium">Security / CUSIP</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium text-right">Principal ($)</th>
                      <th className="pb-2 font-medium text-right">Yield (%)</th>
                      <th className="pb-2 font-medium">Maturity Date</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(bucketSettings.income.holdings || []).map((h) => (
                      <tr key={h.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 font-bold text-blue-400">Rung {h.rungNumber}</td>
                        <td className="py-2.5 text-white font-medium">{h.targetYear}</td>
                        <td className="py-2.5 text-slate-200">{h.cusipOrName || 'Treasury Note'}</td>
                        <td className="py-2.5 uppercase text-[10px] text-slate-400">{h.assetType}</td>
                        <td className="py-2.5 text-right font-bold text-white">
                          ${Math.round(h.principal).toLocaleString()}
                        </td>
                        <td className="py-2.5 text-right text-emerald-400">{(h.couponRate * 100).toFixed(2)}%</td>
                        <td className="py-2.5 text-slate-300">{h.maturityDate || '-'}</td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditHolding(h)}
                              className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteHolding(h.id)}
                              className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MULTI-YEAR TIMELINE & PROJECTIONS */}
      {activeTab === 'projections' && (
        <div className="space-y-6">
          {/* Bear Market Resilience Analyzer Card */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-indigo-500/20 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                  Downturn Protection Stress Test
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  Sequence of Returns Protection: {totalGuaranteedRunwayYears} Years
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  With your current Bucket 1 cash reserves ({currentCalc.bucket1.runwayMonths} months) and Bucket 2
                  bond ladder rungs ({currentCalc.bucket2.ladderRunwayYears} years), you can completely withstand a{' '}
                  <strong>{totalGuaranteedRunwayYears}-year prolonged bear market</strong> without selling a single
                  dollar of equities at depressed prices.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-950/80 p-4 rounded-xl border border-indigo-500/30">
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block uppercase">Guaranteed Runway</span>
                  <span className="text-2xl font-black text-indigo-400">{totalGuaranteedRunwayYears} Yrs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Year Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              30-Year 3-Bucket Waterfall Schedule
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Year-by-year projected balances across Taxable Brokerage, Pre-Tax IRA, and Roth IRA buckets.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Year</th>
                    <th className="pb-3 font-semibold text-right">Bucket 1 (Cash)</th>
                    <th className="pb-3 font-semibold text-right">Runway</th>
                    <th className="pb-3 font-semibold text-right">B2: Ladder</th>
                    <th className="pb-3 font-semibold text-right">B2: Equities</th>
                    <th className="pb-3 font-semibold text-right">B2: Total Pre-Tax</th>
                    <th className="pb-3 font-semibold text-right">Bucket 3 (Roth)</th>
                    <th className="pb-3 font-semibold text-right">Total Portfolio</th>
                    <th className="pb-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {multiYearProjections.map((p) => (
                    <tr
                      key={p.year}
                      onClick={() => {
                        setSelectedYear(p.year);
                        setActiveTab('dashboard');
                      }}
                      className={`cursor-pointer transition-colors ${
                        selectedYear === p.year ? 'bg-emerald-500/10 font-medium' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2.5 font-bold text-white flex items-center gap-1.5">
                        {p.year}
                        {p.isActual && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300">ACTUAL</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-emerald-400 font-medium">
                        ${Math.round(p.bucket1.totalBalance).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-slate-300">{p.bucket1.runwayMonths} Mo</td>
                      <td className="py-2.5 text-right text-blue-400 font-medium">
                        ${Math.round(p.bucket2.bondLadderTotal).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-slate-400">
                        ${Math.round(p.bucket2.equitiesTotal).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-slate-200 font-semibold">
                        ${Math.round(p.bucket2.totalBalance).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-purple-400 font-medium">
                        ${Math.round(p.bucket3.totalBalance).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-white font-bold">
                        ${Math.round(p.totalPortfolio).toLocaleString()}
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            p.bucket1.status === 'healthy'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : p.bucket1.status === 'caution'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {p.bucket1.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* HOLDING ADD/EDIT MODAL */}
      {showHoldingModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              {editingHolding ? 'Edit Bond Holding' : 'Add Bond Ladder Holding'}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Rung #</label>
                  <select
                    value={holdingForm.rungNumber}
                    onChange={(e) => setHoldingForm({ ...holdingForm, rungNumber: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((r) => (
                      <option key={r} value={r}>
                        Rung {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Target Maturity Year</label>
                  <input
                    type="number"
                    value={holdingForm.targetYear}
                    onChange={(e) => setHoldingForm({ ...holdingForm, targetYear: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Security Name / CUSIP</label>
                <input
                  type="text"
                  placeholder="e.g. US Treasury Note 4.25% 10/15/2026"
                  value={holdingForm.cusipOrName}
                  onChange={(e) => setHoldingForm({ ...holdingForm, cusipOrName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Asset Type</label>
                  <select
                    value={holdingForm.assetType}
                    onChange={(e) =>
                      setHoldingForm({ ...holdingForm, assetType: e.target.value as BondLadderAssetType })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="treasury">US Treasury</option>
                    <option value="cd">Certificate of Deposit (CD)</option>
                    <option value="corporate">Corporate Bond</option>
                    <option value="agency">Agency / Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Principal ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={holdingForm.principal}
                    onChange={(e) =>
                      setHoldingForm({
                        ...holdingForm,
                        principal: e.target.value === '' ? ('' as unknown as number) : Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Coupon / Yield (%)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={holdingForm.couponRate}
                    onChange={(e) => setHoldingForm({ ...holdingForm, couponRate: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Exact Maturity Date</label>
                  <input
                    type="date"
                    value={holdingForm.maturityDate}
                    onChange={(e) => setHoldingForm({ ...holdingForm, maturityDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white [color-scheme:dark] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowHoldingModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/60"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHolding}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-blue-500 hover:bg-blue-400 shadow-md shadow-blue-500/20"
              >
                Save Holding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
