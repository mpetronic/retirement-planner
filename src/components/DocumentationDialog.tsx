import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  BookOpen,
  Layers,
  Coins,
  ShieldAlert,
  Sliders,
  ArrowRightLeft,
  Flame,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Calculator,
  HeartPulse,
  Receipt,
  UserCheck,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  DollarSign
} from 'lucide-react';

interface DocumentationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tabIndex: number) => void;
  initialSectionId?: string;
}

interface DocSection {
  id: string;
  title: string;
  category: string;
  icon: React.ElementType;
  badge?: string;
  content: React.ReactNode;
  keywords: string[];
}

export const DocumentationDialog: React.FC<DocumentationDialogProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  initialSectionId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string>(initialSectionId || 'overview');

  // Synchronize active section when initialSectionId or modal open status changes
  useEffect(() => {
    if (initialSectionId && isOpen) {
      setActiveSectionId(initialSectionId);
    }
  }, [initialSectionId, isOpen]);

  // Handle Escape key to dismiss dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const sections: DocSection[] = useMemo(() => [
    {
      id: 'overview',
      title: 'Executive Summary & Mission',
      category: 'Getting Started',
      icon: Flame,
      badge: 'Core Concept',
      keywords: ['overview', 'mission', 'introduction', 'purpose', 'tax torpedo', 'irmaa', 'sequence of returns', 'architecture', 'start'],
      content: (
        <div className="space-y-6">
          <div className="p-5 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-100">Welcome to Retirement Planner 2.0</h3>
                <p className="text-xs text-emerald-400/90 font-medium">Interactive 35-Year Tax, Medicare IRMAA & Wealth Simulation Engine</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mt-3">
              Retirement Planner 2.0 is a specialized financial modeling platform designed to simulate multi-decade retirement scenarios with institutional fidelity. Unlike simplified online calculators that assume linear rates and static effective tax rates, this engine simulates the complex, non-linear interactions between Federal income tax brackets, state taxation, Social Security taxation, Medicare IRMAA cliffs, Required Minimum Distributions (RMDs), and stochastic sequence-of-returns market volatility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>The Flaws of Traditional Calculators</span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                <li><strong className="text-slate-200">Ignoring the "Tax Torpedo":</strong> Overlooking how each dollar of taxable income subjects up to 85% of Social Security benefits to federal taxation.</li>
                <li><strong className="text-slate-200">Missing 2-Year IRMAA Cliffs:</strong> Medicare Parts B & D surcharges feature sudden cliff thresholds that can add thousands in annual penalties.</li>
                <li><strong className="text-slate-200">The Survivor Penalty:</strong> Failing to model the abrupt shift from Married Filing Jointly to Single Filer tax rates upon the first spouse's death.</li>
                <li><strong className="text-slate-200">Deterministic Averages:</strong> Assuming a static 7% annual return hides catastrophic sequence-of-returns failure risks.</li>
              </ul>
            </div>

            <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>How Retirement Planner 2.0 Solves It</span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                <li><strong className="text-slate-200">35-Year Granular Ledger:</strong> Year-by-year cashflow accounting across Taxable, Pre-Tax IRA, and Roth accounts from Age 65 to 100.</li>
                <li><strong className="text-slate-200">Precise 2-Year IRMAA Tracking:</strong> Year T MAGI is accurately mapped to Year T+2 Medicare surcharge brackets.</li>
                <li><strong className="text-slate-200">Automated Roth Optimization:</strong> 2D sweep algorithms evaluate optimal Roth conversion amounts and SS claiming ages.</li>
                <li><strong className="text-slate-200">1,000+ Monte Carlo Trials:</strong> Both correlated synthetic regime-switching and 100+ year historical backtesting engines.</li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Quick Navigation to the 4 Core Workspaces
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onNavigateTab?.(0);
                  onClose();
                }}
                className="p-3 bg-slate-950/70 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    Workspace 1
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Overview & Bracket Map</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigateTab?.(1);
                  onClose();
                }}
                className="p-3 bg-slate-950/70 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                    Workspace 2
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">35-Year Lookback Ledger</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigateTab?.(2);
                  onClose();
                }}
                className="p-3 bg-slate-950/70 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    Workspace 3
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Monte Carlo & Stress Test</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigateTab?.(3);
                  onClose();
                }}
                className="p-3 bg-slate-950/70 hover:bg-emerald-950/30 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
                    Workspace 4
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-emerald-400" />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Plan Comparison Sandbox</div>
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'workspace-1',
      title: 'Workspace 1: Strategy & Bracket Map',
      category: 'Workspaces',
      icon: Coins,
      badge: 'Visual Strategy',
      keywords: ['workspace 1', 'bracket map', 'roth conversion', 'quick fill', 'optimizer', 'sankey', 'cash flow', 'tax bracket', 'social security claiming'],
      content: (
        <div className="space-y-6">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              Tax Bracket Visualizer & Roth Optimization
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Workspace 1 is the strategic cockpit for your retirement plan. It illustrates how your annual taxable income and Modified Adjusted Gross Income (MAGI) stack against federal tax brackets and Medicare IRMAA thresholds over your entire 35-year retirement horizon.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Key Features in Workspace 1</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Roth Conversion Planner (Flat vs Fill-to-Bracket)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Choose between a fixed annual dollar conversion or dynamic <strong>Fill-to-Target</strong> conversions. Fill-to-Target automatically calculates the exact conversion amount needed each year to fill up to the chosen tax bracket ceiling (e.g. 12%, 22%, 24%) or Medicare IRMAA threshold without spilling over.
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Interactive Quick-Fill Presets</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  One-click buttons instantly configure your plan to fill common tax target ceilings:
                  <span className="block mt-1 text-slate-400 font-mono text-[10px]">
                    &bull; 12% Bracket ($133,000) &bull; 22% Bracket ($243,600) &bull; 24% Bracket ($435,750)<br />
                    &bull; IRMAA Tier 0 ($206,000) &bull; IRMAA Tier 1 ($258,000) &bull; IRMAA Tier 2 ($322,000)
                  </span>
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>2D Automated Optimization Sweep</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  The built-in optimization engine tests hundreds of candidate combinations of Roth conversion amounts and Social Security claiming ages (from age 62 to 70 for both spouses) to identify configurations that maximize ending net estate or minimize lifetime tax liabilities.
                </p>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Interactive Sankey Cash Flow Diagram</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Inspect any single retirement year via an interactive Sankey flow diagram. See exactly how gross inflows (Salaries, Social Security, Dividends, IRA Withdrawals, Roth Withdrawals, Brokerage basis) flow into Federal/State Taxes, Healthcare, Living Expenses, Roth conversions, and reinvested surplus savings.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl flex items-center justify-between">
            <div className="text-xs text-slate-300">
              Ready to test tax bracket mapping and Roth conversion strategies?
            </div>
            <button
              type="button"
              onClick={() => {
                onNavigateTab?.(0);
                onClose();
              }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Open Workspace 1</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'workspace-2',
      title: 'Workspace 2: 35-Year Lookback Ledger',
      category: 'Workspaces',
      icon: ShieldAlert,
      badge: 'Audit & Ledger',
      keywords: ['workspace 2', 'lookback ledger', 'audit', 'table', 'rmd', 'irmaa 2-year lookback', 'row inspection', 'csv export', 'excel', 'single filer penalty'],
      content: (
        <div className="space-y-6">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-400" />
              Comprehensive 35-Year Cashflow & Tax Audit Table
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Workspace 2 provides a year-by-year financial accounting matrix spanning ages 65 through 100. It presents full transparency into how the simulation engine computes balances, returns, withdrawals, taxes, and healthcare surcharges every single year.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Key Capabilities of the Ledger</h4>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-xs font-bold text-slate-200 mb-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  Multi-Bucket Portfolio Accounting
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Separately tracks balances, contributions, growth, and withdrawals across Taxable Brokerage (tracking cost basis vs unrealized/realized gains and qualified dividend yields), Pre-Tax Traditional IRA / 401(k), Roth IRA, and Cash Reserves.
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-xs font-bold text-slate-200 mb-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  Exact 2-Year Medicare IRMAA Lookback
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  By law, Medicare Part B and Part D premiums are determined by the Modified Adjusted Gross Income reported on your tax return from two years prior. The ledger explicitly displays the <strong>Year T MAGI</strong> and lines up the corresponding <strong>Year T+2 IRMAA Tier & Surcharge</strong>, highlighting any unexpected surcharge triggers.
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-xs font-bold text-slate-200 mb-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  RMD Calculations (IRS Uniform Lifetime Table)
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Required Minimum Distributions (RMDs) are automatically enforced starting at age 73 (or age 75 for younger cohorts under SECURE 2.0). The engine projects how aggressive Roth conversions prior to RMD age can defuse forced tax spikes later in retirement.
                </p>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div className="text-xs font-bold text-slate-200 mb-1 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  Interactive Row Inspection Modal
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Click on any year row in the ledger table to open a full mathematical audit dialog. It reveals exact step-by-step calculations for adjusted gross income, standard deduction, bracket-by-bracket federal and state tax computations, Net Investment Income Tax (NIIT), capital gains tax rates, and cash allocation waterfalls.
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-950/20 border border-blue-900/30 rounded-xl flex items-center justify-between">
            <div className="text-xs text-slate-300">
              Inspect your year-by-year 35-year audit ledger now:
            </div>
            <button
              type="button"
              onClick={() => {
                onNavigateTab?.(1);
                onClose();
              }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Open Workspace 2</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'workspace-3',
      title: 'Workspace 3: Monte Carlo & Stress Testing',
      category: 'Workspaces',
      icon: Sliders,
      badge: 'Stochastic Engine',
      keywords: ['workspace 3', 'monte carlo', 'stress test', 'volatility', 'regime switching', 'historical backtesting', 'fan chart', 'percentiles', 'p10', 'p50', 'p90', 'bear market', 'gfc', 'stagflation'],
      content: (
        <div className="space-y-6">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              1,000+ Trial Stochastic Modeling & Crisis Stress Testing
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Workspace 3 tests your financial plan against market uncertainty and sequence-of-returns risk. It computes plan probability of success and displays percentile wealth cones (P10 Worst-Case, P25, P50 Median, P75, P90 Best-Case).
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Dual Simulation Engines</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <span className="text-xs font-bold text-indigo-400 block">1. Synthetic Monte Carlo Model</span>
                <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
                  <li>Correlated Geometric Brownian Motion across equities and fixed income.</li>
                  <li><strong>Markov 2-State Regime Switching:</strong> Models alternating bull and bear market volatility clusters.</li>
                  <li><strong>Ornstein-Uhlenbeck Mean Reversion:</strong> Reverts extended market deviations toward long-term trendlines.</li>
                  <li>Randomized annual CPI inflation per trial.</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <span className="text-xs font-bold text-emerald-400 block">2. Historical 100-Year Backtest</span>
                <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
                  <li>Draws return and inflation paths directly from historical US market data (1928–present).</li>
                  <li><strong>Hybrid Bootstrap Resampling:</strong> Blends 35% contiguous historical blocks with random sample draws to preserve historical drawdowns.</li>
                  <li>Optional mean-calibration to your baseline asset expectations.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Multi-Year Sequence of Returns Stress Testing
            </h4>
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl text-[11px] text-slate-300 leading-relaxed space-y-2">
              <p>
                Apply historical market crashes or custom multi-year drawdowns at critical junctures (e.g. right at retirement age 65):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[10px]">
                <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                  <strong className="text-amber-400 block">2008 Financial Crisis</strong>
                  Year 1: -37% Equities, +5% Bonds<br />
                  Year 2: +26% Equities, +6% Bonds
                </div>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                  <strong className="text-rose-400 block">1970s Stagflation</strong>
                  High CPI inflation (9-13%) paired with negative real bond/equity returns.
                </div>
                <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                  <strong className="text-blue-400 block">2000 Dot-Com Bust</strong>
                  3-year consecutive equity crash (-10%, -12%, -22%).
                </div>
              </div>
              <p className="text-slate-400 text-[10px] mt-1">
                When active, stress testing displays a prominent warning badge in the global header, and all workspaces reflect the stress-tested return trajectory.
              </p>
            </div>
          </div>

          <div className="p-4 bg-indigo-950/20 border border-indigo-900/30 rounded-xl flex items-center justify-between">
            <div className="text-xs text-slate-300">
              Run Monte Carlo trials and test historical market stress tests:
            </div>
            <button
              type="button"
              onClick={() => {
                onNavigateTab?.(2);
                onClose();
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Open Workspace 3</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'workspace-4',
      title: 'Workspace 4: Plan Comparison Sandbox',
      category: 'Workspaces',
      icon: ArrowRightLeft,
      badge: 'Scenario Sandbox',
      keywords: ['workspace 4', 'plan comparison', 'compare', 'saved plans', 'scenario', 'plan a vs plan b', 'delta', 'tax savings', 'export json', 'clone plan'],
      content: (
        <div className="space-y-6">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-400" />
              Side-by-Side Scenario Modeling (Plan A vs. Plan B)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Workspace 4 lets you save, clone, export, and directly contrast different retirement blueprints. Evaluate trade-offs with side-by-side metric deltas and dual-trajectory charts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <span className="text-xs font-bold text-purple-400 block">Popular Scenario Comparisons</span>
              <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                <li><strong>Roth Conversion vs. No Conversion:</strong> Measure the exact lifetime tax savings and final estate delta.</li>
                <li><strong>Claim SS at 62 vs. Delaying to 70:</strong> See how delayed claiming enhances survivor protection and reduces portfolio drawdown.</li>
                <li><strong>Maryland vs. Florida Residency:</strong> Quantify lifetime state tax savings against relocation timing.</li>
                <li><strong>Conservative vs. Growth Portfolios:</strong> Assess how different asset allocations impact Monte Carlo success probability.</li>
              </ul>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <span className="text-xs font-bold text-emerald-400 block">Variance & Delta Breakdown Cards</span>
              <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                <li><strong className="text-slate-200">Ending Estate Variance:</strong> Net difference in wealth left to heirs at age 100.</li>
                <li><strong className="text-slate-200">Cumulative Tax Differential:</strong> Direct comparison of total Federal and State income taxes paid.</li>
                <li><strong className="text-slate-200">Medicare IRMAA Delta:</strong> Surcharges avoided across retirement.</li>
                <li><strong className="text-slate-200">Success Rate Delta:</strong> Change in probability of never depleting portfolio reserves.</li>
              </ul>
            </div>
          </div>

          <div className="p-4 bg-purple-950/20 border border-purple-900/30 rounded-xl flex items-center justify-between">
            <div className="text-xs text-slate-300">
              Save your current inputs and compare against alternative strategies:
            </div>
            <button
              type="button"
              onClick={() => {
                onNavigateTab?.(3);
                onClose();
              }}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Open Workspace 4</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ),
    },
    {
      id: 'core-features',
      title: 'Tax Engine, Healthcare & Survivor Modeling',
      category: 'Deep Dives',
      icon: HeartPulse,
      badge: 'Engine Mechanics',
      keywords: ['tax engine', 'healthcare', 'survivor penalty', 'medicare', 'expenses', 'today dollars', 'nominal', 'inflation', 'relocation', 'state tax', 'florida', 'maryland'],
      content: (
        <div className="space-y-6">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-rose-400" />
              Advanced Simulation Engine Features
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Explore the specialized simulation subsystems that power Retirement Planner 2.0's calculations.
            </p>
          </div>

          <div className="space-y-4">
            {/* Survivor Modeling */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <UserCheck className="w-4 h-4" />
                <span>The Survivor Penalty & Bracket Compression</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                When one spouse passes away, the surviving spouse experiences a severe financial shock known as the <em>Survivor Penalty</em>. The application dynamically transitions the tax calculation from <strong>Married Filing Jointly (MFJ)</strong> to <strong>Single Filer</strong> at the specified longevity age:
              </p>
              <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                <li>Federal tax bracket thresholds are effectively cut in half, pushing the survivor into higher tax brackets on lower income.</li>
                <li>Medicare IRMAA cliff thresholds drop significantly (e.g. Tier 0 threshold drops from $206,000 to $103,000).</li>
                <li>The household drops the smaller of the two Social Security checks, retaining only the higher Primary Insurance Amount.</li>
              </ul>
            </div>

            {/* Healthcare Configurator */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                <HeartPulse className="w-4 h-4" />
                <span>Healthcare & Medicare Cost Engine</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Healthcare costs are modeled in two distinct phases with customizable healthcare-specific inflation:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-300 pt-1">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <strong className="text-rose-300 block mb-1">Pre-Medicare (Under Age 65)</strong>
                  Private ACA/COBRA medical, dental, and vision insurance premiums plus out-of-pocket maximums per spouse.
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                  <strong className="text-blue-300 block mb-1">Post-Medicare (Age 65+)</strong>
                  Medicare Part B base premiums, Part D drug coverage, Medigap Plan G/N supplements, plus dental/vision/hearing OOP.
                </div>
              </div>
            </div>

            {/* Detailed State Expenses */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Receipt className="w-4 h-4" />
                <span>Detailed Living Expenses & State Relocation</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Switch between a simple lump-sum annual living expense or a granular 40+ category expense worksheet. Easily model relocation from a high-tax state (e.g. Maryland) to a zero-income-tax state (e.g. Florida), including property tax adjustments, CDD bond fees, HOA/amenity dues, golf cart/auto upkeep, and one-time furnishing outlays.
              </p>
            </div>

            {/* Real vs Nominal Valuation */}
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                <DollarSign className="w-4 h-4" />
                <span>Today's Dollars vs Future Nominal Dollars</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Toggle between <strong>Future Nominal Dollars</strong> (inflated cash values in the future) and <strong>Today's Dollars (Real Purchasing Power)</strong>. When Real valuation is enabled, all future values across all charts and ledger columns are automatically discounted by cumulative CPI inflation back to baseline purchasing power.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'reports-export',
      title: 'Reporting, PDF & Data Exports',
      category: 'Deep Dives',
      icon: FileSpreadsheet,
      badge: 'Export & Share',
      keywords: ['export', 'pdf', 'csv', 'excel', 'reports', 'html report', 'print', 'json backup', 'restore', 'save'],
      content: (
        <div className="space-y-6">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Comprehensive Reporting & Data Export Tools
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Export your plans and simulation results for external analysis, estate planning meetings, or record keeping.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                <FileText className="w-4 h-4" />
                <span>Client-Ready PDF Report</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Generate a multi-page executive PDF summary containing household milestones, asset breakdown, Monte Carlo success percentiles, and lifetime tax & IRMAA savings.
              </p>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel & CSV 35-Year Ledger Export</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Download the complete 35-year tabular ledger into Microsoft Excel (.xlsx) or CSV format for spreadsheet verification and custom charting.
              </p>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                <ExternalLink className="w-4 h-4" />
                <span>Interactive HTML Report</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Export a standalone, self-contained HTML document with interactive tables and charts that can be opened in any web browser without server dependencies.
              </p>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                <Layers className="w-4 h-4" />
                <span>JSON Plan Backup & Restore</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Export and import complete parameter configurations in JSON format, allowing you to back up plans or transfer them between devices seamlessly.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'faq',
      title: 'Frequently Asked Questions & Tips',
      category: 'Reference',
      icon: HelpCircle,
      badge: 'Help & FAQ',
      keywords: ['faq', 'questions', 'tips', 'irmaa cliffs', 'roth conversion strategy', 'tax brackets', 'performance', 'troubleshooting'],
      content: (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              Frequently Asked Questions & Strategy Tips
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Common questions about tax rules, model mechanics, and best practices.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
              <h4 className="text-xs font-bold text-slate-200">
                Q: Why does my IRMAA surcharge spike two years after doing a large Roth conversion?
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Medicare Part B and Part D premiums use a statutory 2-year lookback on Modified Adjusted Gross Income (MAGI). A Roth conversion completed in year 2028 appears on your 2028 tax return, which Medicare uses to set your 2030 premiums. The Lookback Ledger in Workspace 2 explicitly pairs these years so you can plan around the lookback lag.
              </p>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
              <h4 className="text-xs font-bold text-slate-200">
                Q: What is the optimal Roth conversion window?
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                For most retirees, the "Golden Window" for Roth conversions occurs between retirement date (when earned income drops) and age 73/75 (before Required Minimum Distributions begin) or age 70 (before Social Security benefits start). During this window, taxable income is at its lowest, creating prime headroom to convert Pre-Tax IRA funds at 12% or 22% tax rates.
              </p>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
              <h4 className="text-xs font-bold text-slate-200">
                Q: How does the Global Outlook switcher affect calculations?
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                The Global Outlook switcher in the header (Flat, Worst P10, Median P50, Best P90) immediately swaps the market return sequence across all worksheets simultaneously. Switching to Worst (P10) allows you to audit the entire 35-year Lookback Ledger and Bracket Map under pessimistic market conditions.
              </p>
            </div>

            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
              <h4 className="text-xs font-bold text-slate-200">
                Q: Where is my data stored?
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                All inputs and saved plans are securely stored entirely on your local machine using browser LocalStorage. No financial data is ever transmitted to external servers or third parties.
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ], [onNavigateTab, onClose]);

  // Filter sections based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const query = searchQuery.toLowerCase().trim();
    return sections.filter((s) => {
      return (
        s.title.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query) ||
        s.keywords.some((k) => k.toLowerCase().includes(query))
      );
    });
  }, [sections, searchQuery]);

  const activeSection = useMemo(() => {
    const found = sections.find((s) => s.id === activeSectionId);
    return found || sections[0];
  }, [sections, activeSectionId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[90vh] max-h-[920px] bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden glass-panel backdrop-blur-2xl flex flex-col animate-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-slate-100 tracking-tight">
                  User Guide & Documentation
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  Retirement Planner 2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Complete overview of application architecture, workspaces, and tax optimization features
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 rounded-xl transition-all cursor-pointer"
              title="Close Documentation (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documentation, workspaces, IRMAA, Monte Carlo..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Sections:</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-mono font-bold">{sections.length}</span>
          </div>
        </div>

        {/* Main Content Area (Sidebar + Content Viewport) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Sidebar */}
          <aside className="w-64 md:w-72 border-r border-slate-800/80 bg-slate-950/40 p-3 overflow-y-auto custom-scrollbar flex flex-col gap-1 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1.5 block">
              Table of Contents
            </span>
            
            {filteredSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSectionId === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSectionId(section.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all group cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                    <span className="truncate">{section.title}</span>
                  </div>
                  {section.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ml-1 ${
                      isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {section.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {filteredSections.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500">
                No matching sections found for "{searchQuery}".
              </div>
            )}
          </aside>

          {/* Active Content Viewer */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar bg-slate-900/30">
            <div className="max-w-3xl space-y-6">
              {/* Section Header */}
              <div className="border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  <span>{activeSection.category}</span>
                </div>
                <h1 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight flex items-center gap-3">
                  {React.createElement(activeSection.icon, { className: 'w-6 h-6 text-emerald-400' })}
                  {activeSection.title}
                </h1>
              </div>

              {/* Section Body */}
              <div className="animate-in fade-in duration-150">
                {activeSection.content}
              </div>
            </div>
          </main>
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Retirement Planner 2.0 &bull; Interactive 35-Year Model</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-all cursor-pointer"
          >
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  );
};
