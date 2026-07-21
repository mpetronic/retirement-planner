import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import {
  DetailedStateExpenses,
  DetailedExpenseFrequencies,
  RECURRING_EXPENSE_ITEMS,
  ONE_TIME_EXPENSE_ITEMS,
  DEFAULT_DETAILED_EXPENSES,
  DEFAULT_EXPENSE_FREQUENCIES
} from '../types';

interface DetailedExpensesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  detailedExpenses: {
    MD: DetailedStateExpenses;
    FL: DetailedStateExpenses;
    frequencies: DetailedExpenseFrequencies;
  } | undefined;
  onSave: (expenses: {
    MD: DetailedStateExpenses;
    FL: DetailedStateExpenses;
    frequencies: DetailedExpenseFrequencies;
  }) => void;
}

export const DetailedExpensesDialog: React.FC<DetailedExpensesDialogProps> = ({
  isOpen,
  onClose,
  detailedExpenses,
  onSave
}) => {
  // Local state initialized from props
  const [localMD, setLocalMD] = useState<DetailedStateExpenses>(() => {
    return detailedExpenses?.MD ? { ...detailedExpenses.MD } : { ...DEFAULT_DETAILED_EXPENSES };
  });
  const [localFL, setLocalFL] = useState<DetailedStateExpenses>(() => {
    return detailedExpenses?.FL ? { ...detailedExpenses.FL } : { ...DEFAULT_DETAILED_EXPENSES };
  });
  const [localFrequencies, setLocalFrequencies] = useState<DetailedExpenseFrequencies>(() => {
    return detailedExpenses?.frequencies ? { ...detailedExpenses.frequencies } : { ...DEFAULT_EXPENSE_FREQUENCIES };
  });

  if (!isOpen) return null;

  // Handle inputs
  const handleMDChange = (key: keyof DetailedStateExpenses, value: number) => {
    setLocalMD((prev) => ({ ...prev, [key]: value }));
  };

  const handleFLChange = (key: keyof DetailedStateExpenses, value: number) => {
    setLocalFL((prev) => ({ ...prev, [key]: value }));
  };

  const handleFrequencyChange = (key: keyof DetailedExpenseFrequencies, value: number) => {
    setLocalFrequencies((prev) => ({ ...prev, [key]: value }));
  };

  // Group recurring items by category
  const categories = ['Housing', 'Transportation', 'Charities', 'Health', 'Living', 'Insurance', 'Leisure'] as const;

  // Calculate dynamic totals
  const mdTotals = useMemo(() => {
    let recurringAnnual = 0;
    for (const item of RECURRING_EXPENSE_ITEMS) {
      const cost = localMD[item.key] || 0;
      const freq = localFrequencies[item.key] ?? item.defaultFrequency;
      recurringAnnual += cost * freq;
    }
    let oneTime = 0;
    for (const item of ONE_TIME_EXPENSE_ITEMS) {
      oneTime += localMD[item.key] || 0;
    }
    return {
      recurringAnnual,
      recurringMonthly: recurringAnnual / 12,
      oneTime
    };
  }, [localMD, localFrequencies]);

  const flTotals = useMemo(() => {
    let recurringAnnual = 0;
    for (const item of RECURRING_EXPENSE_ITEMS) {
      const cost = localFL[item.key] || 0;
      const freq = localFrequencies[item.key] ?? item.defaultFrequency;
      recurringAnnual += cost * freq;
    }
    let oneTime = 0;
    for (const item of ONE_TIME_EXPENSE_ITEMS) {
      oneTime += localFL[item.key] || 0;
    }
    return {
      recurringAnnual,
      recurringMonthly: recurringAnnual / 12,
      oneTime
    };
  }, [localFL, localFrequencies]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleSaveClick = () => {
    onSave({
      MD: localMD,
      FL: localFL,
      frequencies: localFrequencies
    });
    onClose();
  };


  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-all duration-300">
      <div className="w-full max-w-4xl bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel backdrop-blur-xl transition-all duration-300 transform scale-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-slate-900/50">
          <div>
            <h3 className="text-lg font-black text-slate-100 tracking-tight">
              Detailed Living Expenses Configuration ⚙
            </h3>
            <p className="text-xs text-slate-400">
              Customize frequencies and side-by-side costs for Maryland and Florida. All values are in today's dollars (inflated using CPI).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 rounded-lg transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1 custom-scrollbar">
          {categories.map((catName) => {
            const catItems = RECURRING_EXPENSE_ITEMS.filter((i) => i.category === catName);
            if (catItems.length === 0) return null;

            const subtotalMD = catItems.reduce((sum, item) => {
              const cost = localMD[item.key] || 0;
              const freq = localFrequencies[item.key] ?? item.defaultFrequency;
              return sum + cost * freq;
            }, 0);

            const subtotalFL = catItems.reduce((sum, item) => {
              const cost = localFL[item.key] || 0;
              const freq = localFrequencies[item.key] ?? item.defaultFrequency;
              return sum + cost * freq;
            }, 0);

            return (
              <div key={catName} className="space-y-3">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider border-b border-slate-800 pb-1">
                  {catName === 'Health'
                    ? 'Health Expenses (Per-person cost; multiplied by 2x once both spouses turn 65)'
                    : `${catName} Expenses`}
                </h4>
                <div className="min-w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/50 text-[10px] text-slate-500 font-bold uppercase">
                        <th className="py-2 pr-4 w-1/3">Expense Name</th>
                        <th className="py-2 px-2 text-center w-20">Freq/Yr</th>
                        <th className="py-2 px-2 text-right">Maryland (MD)</th>
                        <th className="py-2 pl-4 text-right">Florida (FL)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/20 text-xs">
                      {catItems.map((item) => {
                        const freq = localFrequencies[item.key] ?? item.defaultFrequency;
                        const costMD = localMD[item.key] || 0;
                        const costFL = localFL[item.key] || 0;

                        return (
                          <tr key={item.key} className="hover:bg-slate-950/20">
                            <td className="py-2.5 pr-4 text-slate-300 font-semibold">{item.label}</td>
                            <td className="py-1 px-2 text-center">
                              <input
                                type="number"
                                min="1"
                                max="365"
                                value={freq}
                                onChange={(e) => handleFrequencyChange(item.key, Math.max(1, Number(e.target.value)))}
                                className="w-16 bg-slate-950 border border-slate-800/60 rounded px-1.5 py-1 text-center text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="py-1 px-2 text-right">
                              <div className="relative inline-block w-full max-w-[120px]">
                                <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={costMD === 0 ? '' : costMD}
                                  onChange={(e) => handleMDChange(item.key, Number(e.target.value))}
                                  placeholder="0"
                                  className="w-full bg-slate-950 border border-slate-800/60 rounded pl-5 pr-2 py-1 text-right text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                            </td>
                            <td className="py-1 pl-4 text-right">
                              <div className="relative inline-block w-full max-w-[120px]">
                                <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={costFL === 0 ? '' : costFL}
                                  onChange={(e) => handleFLChange(item.key, Number(e.target.value))}
                                  placeholder="0"
                                  className="w-full bg-slate-950 border border-slate-800/60 rounded pl-5 pr-2 py-1 text-right text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-slate-800 bg-slate-950/20 text-xs font-bold text-slate-200">
                      <tr>
                        <td className="py-2.5 pr-4 text-emerald-400 font-bold">Subtotal (Annualized)</td>
                        <td className="py-2.5 px-2 text-center text-slate-500 font-mono font-normal">-</td>
                        <td className="py-2.5 px-2 text-right text-emerald-400 font-mono font-bold">
                          {formatCurrency(subtotalMD)}
                        </td>
                        <td className="py-2.5 pl-4 text-right text-emerald-400 font-mono font-bold">
                          {formatCurrency(subtotalFL)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}

          {/* One-Time Setup Costs Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider border-b border-slate-800 pb-1">
              One-Time Setup Costs
            </h4>
            <div className="min-w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/50 text-[10px] text-slate-500 font-bold uppercase">
                    <th className="py-2 pr-4 w-1/3">Expense Name</th>
                    <th className="py-2 px-2 text-center w-20">-</th>
                    <th className="py-2 px-2 text-right">Maryland (MD)</th>
                    <th className="py-2 pl-4 text-right">Florida (FL)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/20 text-xs">
                  {ONE_TIME_EXPENSE_ITEMS.map((item) => {
                    const costMD = localMD[item.key] || 0;
                    const costFL = localFL[item.key] || 0;

                    return (
                      <tr key={item.key} className="hover:bg-slate-950/20">
                        <td className="py-2.5 pr-4 text-slate-300 font-semibold">{item.label}</td>
                        <td className="py-1 px-2 text-center text-slate-500 font-mono">-</td>
                        <td className="py-1 px-2 text-right">
                          <div className="relative inline-block w-full max-w-[120px]">
                            <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono">$</span>
                            <input
                              type="number"
                              min="0"
                              value={costMD === 0 ? '' : costMD}
                              onChange={(e) => handleMDChange(item.key, Number(e.target.value))}
                              placeholder="0"
                              className="w-full bg-slate-950 border border-slate-800/60 rounded pl-5 pr-2 py-1 text-right text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </td>
                        <td className="py-1 pl-4 text-right">
                          <div className="relative inline-block w-full max-w-[120px]">
                            <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono">$</span>
                            <input
                              type="number"
                              min="0"
                              value={costFL === 0 ? '' : costFL}
                              onChange={(e) => handleFLChange(item.key, Number(e.target.value))}
                              placeholder="0"
                              className="w-full bg-slate-950 border border-slate-800/60 rounded pl-5 pr-2 py-1 text-right text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-slate-800 bg-slate-950/20 text-xs font-bold text-slate-200">
                  <tr>
                    <td className="py-2.5 pr-4 text-amber-400 font-bold">Subtotal</td>
                    <td className="py-2.5 px-2 text-center text-slate-500 font-mono font-normal">-</td>
                    <td className="py-2.5 px-2 text-right text-amber-400 font-mono font-bold">
                      {formatCurrency(
                        ONE_TIME_EXPENSE_ITEMS.reduce((sum, item) => sum + (localMD[item.key] || 0), 0)
                      )}
                    </td>
                    <td className="py-2.5 pl-4 text-right text-amber-400 font-mono font-bold">
                      {formatCurrency(
                        ONE_TIME_EXPENSE_ITEMS.reduce((sum, item) => sum + (localFL[item.key] || 0), 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Dynamic Totals Panel */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">MD Recurring Cost</span>
              <span className="text-slate-200 font-bold font-mono">
                {formatCurrency(mdTotals.recurringMonthly)}/mo
              </span>
              <span className="text-slate-400 font-mono text-[10px] block">
                ({formatCurrency(mdTotals.recurringAnnual)}/yr)
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">FL Recurring Cost</span>
              <span className="text-slate-200 font-bold font-mono">
                {formatCurrency(flTotals.recurringMonthly)}/mo
              </span>
              <span className="text-slate-400 font-mono text-[10px] block">
                ({formatCurrency(flTotals.recurringAnnual)}/yr)
              </span>
            </div>
            <div className="pt-1">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">MD One-Time Costs</span>
              <span className="text-amber-400 font-bold font-mono">
                {formatCurrency(mdTotals.oneTime)}
              </span>
            </div>
            <div className="pt-1">
              <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">FL One-Time Costs</span>
              <span className="text-amber-400 font-bold font-mono">
                {formatCurrency(flTotals.oneTime)}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveClick}
              className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
