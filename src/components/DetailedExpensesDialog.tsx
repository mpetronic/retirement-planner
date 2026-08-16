import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  Plus,
  Trash2,
  Edit2,
  Info,
  Layers,
  Settings,
  Copy,
  AlertCircle,
  FolderPlus,
  ArrowRightLeft,
  Search,
  Sparkles
} from 'lucide-react';
import {
  DetailedExpensesState,
  ExpenseCatalog,
  ExpenseItemDefinition,
  normalizeDetailedExpenses
} from '../types';

interface DetailedExpensesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentState?: string;
  targetState?: string;
  detailedExpenses: DetailedExpensesState | undefined;
  onSave: (expenses: DetailedExpensesState) => void;
}

export const DetailedExpensesDialog: React.FC<DetailedExpensesDialogProps> = ({
  isOpen,
  onClose,
  currentState = 'MD',
  targetState = 'FL',
  detailedExpenses,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'catalog'>('expenses');

  // Internal normalized state
  const [catalog, setCatalog] = useState<ExpenseCatalog>(() => {
    const norm = normalizeDetailedExpenses(detailedExpenses);
    return norm.catalog;
  });

  const [costs, setCosts] = useState<{ [stateCode: string]: Record<string, number> }>(() => {
    const norm = normalizeDetailedExpenses(detailedExpenses);
    return norm.costs;
  });

  const [frequencies, setFrequencies] = useState<Record<string, number>>(() => {
    const norm = normalizeDetailedExpenses(detailedExpenses);
    return norm.frequencies;
  });

  // Re-sync when dialog opens or props change
  useEffect(() => {
    if (isOpen) {
      const norm = normalizeDetailedExpenses(detailedExpenses);
      setCatalog(norm.catalog);
      setCosts(norm.costs);
      setFrequencies(norm.frequencies);
      setActiveTab('expenses');
    }
  }, [isOpen, detailedExpenses]);

  // Modals & UI helpers within dialog
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  
  // Item Add/Edit modal state
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItemDefinition | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Housing');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemFrequency, setItemFrequency] = useState<number>(12);
  const [itemIsOneTime, setItemIsOneTime] = useState<boolean>(false);
  const [itemError, setItemError] = useState<string | null>(null);

  // Category Add/Rename state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Category Delete / Reassign modal state
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<string | null>(null);
  const [reassignCategoryTarget, setReassignCategoryTarget] = useState<string>('');

  if (!isOpen) return null;

  const stateA = currentState || 'MD';
  const stateB = targetState || 'FL';

  // Helper currency formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Duplicate name checker
  const isDuplicateItemName = (name: string, excludeId?: string): boolean => {
    const trimmed = name.trim().toLowerCase();
    return catalog.items.some(
      (item) => item.name.trim().toLowerCase() === trimmed && item.id !== excludeId
    );
  };

  // Cost and frequency handlers
  const handleCostChange = (stateCode: string, itemId: string, value: number) => {
    setCosts((prev) => ({
      ...prev,
      [stateCode]: {
        ...(prev[stateCode] || {}),
        [itemId]: Math.max(0, value)
      }
    }));
  };

  const handleFrequencyChange = (itemId: string, freq: number) => {
    setFrequencies((prev) => ({
      ...prev,
      [itemId]: Math.max(1, freq)
    }));
  };

  // Copy state costs
  const handleCopyStateCosts = (fromState: string, toState: string) => {
    const sourceCosts = costs[fromState] || {};
    setCosts((prev) => ({
      ...prev,
      [toState]: { ...sourceCosts }
    }));
  };

  // Item Add/Edit open
  const handleOpenItemModal = (item?: ExpenseItemDefinition, defaultCat?: string) => {
    setItemError(null);
    if (item) {
      setEditingItem(item);
      setItemName(item.name);
      setItemCategory(item.category);
      setItemDescription(item.description || '');
      setItemFrequency(frequencies[item.id] ?? item.defaultFrequency ?? 12);
      setItemIsOneTime(!!item.isOneTime);
    } else {
      setEditingItem(null);
      setItemName('');
      setItemCategory(defaultCat || catalog.categories[0] || 'Living');
      setItemDescription('');
      setItemFrequency(12);
      setItemIsOneTime(defaultCat === 'One-Time Setup Costs');
    }
    setCustomCategoryInput('');
    setItemModalOpen(true);
  };

  // Save Item
  const handleSaveItem = () => {
    const trimmedName = itemName.trim();
    if (!trimmedName) {
      setItemError('Item name is required.');
      return;
    }

    if (isDuplicateItemName(trimmedName, editingItem?.id)) {
      setItemError(`An expense item named "${trimmedName}" already exists.`);
      return;
    }

    let finalCategory = itemCategory;
    if (itemCategory === '__NEW__') {
      const trimmedCat = customCategoryInput.trim();
      if (!trimmedCat) {
        setItemError('Please provide a name for the new category.');
        return;
      }
      finalCategory = trimmedCat;
      // Add category if not existing
      if (!catalog.categories.includes(finalCategory)) {
        setCatalog((prev) => ({
          ...prev,
          categories: [...prev.categories, finalCategory]
        }));
      }
    }

    if (editingItem) {
      // Edit existing
      setCatalog((prev) => ({
        ...prev,
        items: prev.items.map((it) =>
          it.id === editingItem.id
            ? {
                ...it,
                name: trimmedName,
                category: finalCategory,
                description: itemDescription.trim() || undefined,
                defaultFrequency: itemFrequency,
                isOneTime: itemIsOneTime
              }
            : it
        )
      }));
      setFrequencies((prev) => ({
        ...prev,
        [editingItem.id]: itemFrequency
      }));
    } else {
      // Create new
      const newId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newItem: ExpenseItemDefinition = {
        id: newId,
        name: trimmedName,
        category: finalCategory,
        description: itemDescription.trim() || undefined,
        defaultFrequency: itemFrequency,
        isOneTime: itemIsOneTime
      };

      setCatalog((prev) => ({
        ...prev,
        items: [...prev.items, newItem]
      }));

      setFrequencies((prev) => ({
        ...prev,
        [newId]: itemFrequency
      }));

      // Initialize costs with 0 for both states
      setCosts((prev) => ({
        ...prev,
        [stateA]: { ...(prev[stateA] || {}), [newId]: 0 },
        [stateB]: { ...(prev[stateB] || {}), [newId]: 0 }
      }));
    }

    setItemModalOpen(false);
  };

  // Delete Item
  const handleDeleteItem = (itemId: string) => {
    setCatalog((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== itemId)
    }));

    setCosts((prev) => {
      const updated = { ...prev };
      for (const st of Object.keys(updated)) {
        const copy = { ...updated[st] };
        delete copy[itemId];
        updated[st] = copy;
      }
      return updated;
    });

    setFrequencies((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  };

  // Category Add/Rename
  const handleOpenCategoryModal = (catName?: string) => {
    setCategoryError(null);
    if (catName) {
      setEditingCategoryName(catName);
      setNewCategoryName(catName);
    } else {
      setEditingCategoryName(null);
      setNewCategoryName('');
    }
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryError('Category name cannot be empty.');
      return;
    }

    if (
      catalog.categories.some(
        (c) => c.toLowerCase() === trimmed.toLowerCase() && c !== editingCategoryName
      )
    ) {
      setCategoryError(`Category "${trimmed}" already exists.`);
      return;
    }

    if (editingCategoryName) {
      // Rename category
      setCatalog((prev) => ({
        categories: prev.categories.map((c) => (c === editingCategoryName ? trimmed : c)),
        items: prev.items.map((i) => (i.category === editingCategoryName ? { ...i, category: trimmed } : i))
      }));
    } else {
      // Add new category
      setCatalog((prev) => ({
        ...prev,
        categories: [...prev.categories, trimmed]
      }));
    }

    setCategoryModalOpen(false);
  };

  // Category Delete prompt
  const handlePromptDeleteCategory = (catName: string) => {
    const itemsInCat = catalog.items.filter((i) => i.category === catName);
    if (itemsInCat.length === 0) {
      // Delete immediately if empty
      setCatalog((prev) => ({
        ...prev,
        categories: prev.categories.filter((c) => c !== catName)
      }));
      return;
    }

    // Has items, open safe reassignment modal
    const otherCategories = catalog.categories.filter((c) => c !== catName);
    setReassignCategoryTarget(otherCategories[0] || 'Living');
    setDeleteCategoryTarget(catName);
  };

  const handleConfirmCategoryDeletion = (action: 'reassign' | 'delete-all') => {
    if (!deleteCategoryTarget) return;

    if (action === 'reassign' && reassignCategoryTarget) {
      setCatalog((prev) => ({
        categories: prev.categories.filter((c) => c !== deleteCategoryTarget),
        items: prev.items.map((i) =>
          i.category === deleteCategoryTarget ? { ...i, category: reassignCategoryTarget } : i
        )
      }));
    } else {
      // Delete all items in category
      const itemIdsToRemove = new Set(
        catalog.items.filter((i) => i.category === deleteCategoryTarget).map((i) => i.id)
      );

      setCatalog((prev) => ({
        categories: prev.categories.filter((c) => c !== deleteCategoryTarget),
        items: prev.items.filter((i) => i.category !== deleteCategoryTarget)
      }));

      setCosts((prev) => {
        const updated = { ...prev };
        for (const st of Object.keys(updated)) {
          const copy = { ...updated[st] };
          itemIdsToRemove.forEach((id) => delete copy[id]);
          updated[st] = copy;
        }
        return updated;
      });

      setFrequencies((prev) => {
        const copy = { ...prev };
        itemIdsToRemove.forEach((id) => delete copy[id]);
        return copy;
      });
    }

    setDeleteCategoryTarget(null);
  };

  // Save changes and close dialog
  const handleSaveAll = () => {
    const updatedState: DetailedExpensesState = {
      catalog,
      costs,
      frequencies,
      MD: costs.MD || costs[stateA] || {},
      FL: costs.FL || costs[stateB] || {}
    };
    onSave(updatedState);
    onClose();
  };

  // Dynamic Totals Calculations
  const recurringItems = useMemo(() => catalog.items.filter((i) => !i.isOneTime), [catalog.items]);
  const oneTimeItems = useMemo(() => catalog.items.filter((i) => i.isOneTime), [catalog.items]);

  const stateATotals = useMemo(() => {
    const costMap = costs[stateA] || {};
    let recurringAnnual = 0;
    for (const item of recurringItems) {
      const cost = costMap[item.id] || 0;
      const freq = frequencies[item.id] ?? item.defaultFrequency ?? 12;
      recurringAnnual += cost * freq;
    }
    let oneTime = 0;
    for (const item of oneTimeItems) {
      oneTime += costMap[item.id] || 0;
    }
    return {
      recurringAnnual,
      recurringMonthly: recurringAnnual / 12,
      oneTime
    };
  }, [costs, stateA, recurringItems, oneTimeItems, frequencies]);

  const stateBTotals = useMemo(() => {
    const costMap = costs[stateB] || {};
    let recurringAnnual = 0;
    for (const item of recurringItems) {
      const cost = costMap[item.id] || 0;
      const freq = frequencies[item.id] ?? item.defaultFrequency ?? 12;
      recurringAnnual += cost * freq;
    }
    let oneTime = 0;
    for (const item of oneTimeItems) {
      oneTime += costMap[item.id] || 0;
    }
    return {
      recurringAnnual,
      recurringMonthly: recurringAnnual / 12,
      oneTime
    };
  }, [costs, stateB, recurringItems, oneTimeItems, frequencies]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all duration-300">
      <div className="w-full max-w-5xl bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden glass-panel backdrop-blur-xl transition-all duration-300 transform scale-100 flex flex-col max-h-[92vh]">
        
        {/* Header with Tabs */}
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-slate-900/80">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-black text-slate-100 tracking-tight flex items-center gap-2">
                Detailed Living Expenses Configuration <Settings className="w-4 h-4 text-emerald-400" />
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {catalog.items.length} Configured Items
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Customize categories, side-by-side costs for {stateA} and {stateB}, billing frequencies, and one-time capital outlays.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Top Level Tab Switcher */}
            <div className="flex bg-slate-950/70 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('expenses')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'expenses'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                State Expenses & Comparison
              </button>
              <button
                onClick={() => setActiveTab('catalog')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'catalog'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Catalog & Categories Manager
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 rounded-lg transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">

          {/* TAB 1: STATE EXPENSES & COMPARISON */}
          {activeTab === 'expenses' && (
            <div className="space-y-6">
              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    Comparing States:
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 font-bold">
                    {stateA}
                  </span>
                  <span className="text-slate-600">vs</span>
                  <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30 font-bold">
                    {stateB}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleCopyStateCosts(stateA, stateB)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    title={`Copy all ${stateA} dollar amounts into ${stateB}`}
                  >
                    <Copy className="w-3 h-3" />
                    Copy {stateA} → {stateB}
                  </button>

                  <button
                    onClick={() => handleCopyStateCosts(stateB, stateA)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    title={`Copy all ${stateB} dollar amounts into ${stateA}`}
                  >
                    <Copy className="w-3 h-3" />
                    Copy {stateB} → {stateA}
                  </button>

                  <div className="h-4 w-px bg-slate-800 mx-1" />

                  <button
                    onClick={() => handleOpenItemModal()}
                    className="px-3 py-1 text-[11px] font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Line Item
                  </button>
                </div>
              </div>

              {/* Recurring Categories Groups */}
              {catalog.categories.map((catName) => {
                const catItems = recurringItems.filter((i) => i.category === catName);
                if (catItems.length === 0) return null;

                const subtotalA = catItems.reduce((sum, item) => {
                  const cost = costs[stateA]?.[item.id] || 0;
                  const freq = frequencies[item.id] ?? item.defaultFrequency ?? 12;
                  return sum + cost * freq;
                }, 0);

                const subtotalB = catItems.reduce((sum, item) => {
                  const cost = costs[stateB]?.[item.id] || 0;
                  const freq = frequencies[item.id] ?? item.defaultFrequency ?? 12;
                  return sum + cost * freq;
                }, 0);

                return (
                  <div key={catName} className="space-y-2 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                          {catName} Expenses
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({catItems.length} {catItems.length === 1 ? 'item' : 'items'})
                        </span>
                      </div>
                      <button
                        onClick={() => handleOpenItemModal(undefined, catName)}
                        className="text-[10px] font-semibold text-slate-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        Add to {catName}
                      </button>
                    </div>

                    <div className="min-w-full overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800/50 text-[10px] text-slate-500 font-bold uppercase">
                            <th className="py-2 pr-4 w-5/12">Expense Name</th>
                            <th className="py-2 px-2 text-center w-28">Freq / Year</th>
                            <th className="py-2 px-2 text-right w-36">{stateA} Cost</th>
                            <th className="py-2 pl-4 text-right w-36">{stateB} Cost</th>
                            <th className="py-2 pl-2 text-right w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/20 text-xs">
                          {catItems.map((item) => {
                            const freq = frequencies[item.id] ?? item.defaultFrequency ?? 12;
                            const costA = costs[stateA]?.[item.id] || 0;
                            const costB = costs[stateB]?.[item.id] || 0;

                            return (
                              <tr key={item.id} className="hover:bg-slate-900/50 transition-colors group">
                                <td className="py-2 pr-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-200 font-medium">{item.name}</span>
                                    {item.description && (
                                      <div className="relative group/tip cursor-help">
                                        <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors" />
                                        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/tip:block z-50 w-56 p-2 bg-slate-950 text-[11px] text-slate-300 rounded-lg shadow-xl border border-slate-700 pointer-events-none">
                                          {item.description}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-1 px-2 text-center">
                                  <select
                                    value={
                                      [12, 1, 4, 2, 26].includes(freq) ? freq : -1
                                    }
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      if (val !== -1) handleFrequencyChange(item.id, val);
                                    }}
                                    className="w-28 bg-slate-950 border border-slate-800/80 rounded px-2 py-1 text-center text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                                  >
                                    <option value={12}>Monthly (12)</option>
                                    <option value={1}>Annual (1)</option>
                                    <option value={4}>Quarterly (4)</option>
                                    <option value={2}>Semi-Ann (2)</option>
                                    <option value={26}>Bi-Weekly (26)</option>
                                    {![12, 1, 4, 2, 26].includes(freq) && (
                                      <option value={freq}>Custom ({freq}x)</option>
                                    )}
                                  </select>
                                </td>
                                <td className="py-1 px-2 text-right">
                                  <div className="relative inline-block w-full max-w-[130px]">
                                    <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono text-xs">$</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={costA === 0 ? '' : costA}
                                      onChange={(e) => handleCostChange(stateA, item.id, Number(e.target.value))}
                                      placeholder="0"
                                      className="w-full bg-slate-950 border border-slate-800/80 rounded pl-5 pr-2 py-1 text-right text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                </td>
                                <td className="py-1 pl-4 text-right">
                                  <div className="relative inline-block w-full max-w-[130px]">
                                    <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono text-xs">$</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={costB === 0 ? '' : costB}
                                      onChange={(e) => handleCostChange(stateB, item.id, Number(e.target.value))}
                                      placeholder="0"
                                      className="w-full bg-slate-950 border border-slate-800/80 rounded pl-5 pr-2 py-1 text-right text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                </td>
                                <td className="py-1 pl-2 text-right">
                                  <button
                                    onClick={() => handleOpenItemModal(item)}
                                    className="p-1 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    title="Edit item details"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="border-t border-slate-800/80 bg-slate-950/40 text-xs font-bold text-slate-200">
                          <tr>
                            <td className="py-2 pr-4 text-emerald-400 font-semibold">
                              Subtotal ({catName})
                            </td>
                            <td className="py-2 px-2 text-center text-slate-500 font-mono text-[10px] font-normal">
                              Annualized
                            </td>
                            <td className="py-2 px-2 text-right text-emerald-400 font-mono font-bold">
                              {formatCurrency(subtotalA)}
                            </td>
                            <td className="py-2 pl-4 text-right text-emerald-400 font-mono font-bold">
                              {formatCurrency(subtotalB)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* One-Time Setup Costs Section */}
              <div className="space-y-2 bg-amber-950/20 p-4 rounded-xl border border-amber-500/30">
                <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                  <div>
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      One-Time Setup & Relocation Costs
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Assessed in Year 1 for {stateA} and Relocation Year for {stateB}. Excluded from ongoing monthly living expense burn rate.
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenItemModal(undefined, 'One-Time Setup Costs')}
                    className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30"
                  >
                    <Plus className="w-3 h-3" />
                    Add One-Time Cost
                  </button>
                </div>

                <div className="min-w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-amber-500/20 text-[10px] text-amber-300/60 font-bold uppercase">
                        <th className="py-2 pr-4 w-5/12">Expense Name</th>
                        <th className="py-2 px-2 text-center w-28">Timing</th>
                        <th className="py-2 px-2 text-right w-36">{stateA} Cost</th>
                        <th className="py-2 pl-4 text-right w-36">{stateB} Cost</th>
                        <th className="py-2 pl-2 text-right w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-500/10 text-xs">
                      {oneTimeItems.map((item) => {
                        const costA = costs[stateA]?.[item.id] || 0;
                        const costB = costs[stateB]?.[item.id] || 0;

                        return (
                          <tr key={item.id} className="hover:bg-amber-950/30 transition-colors group">
                            <td className="py-2 pr-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-200 font-medium">{item.name}</span>
                                {item.description && (
                                  <div className="relative group/tip cursor-help">
                                    <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors" />
                                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/tip:block z-50 w-56 p-2 bg-slate-950 text-[11px] text-slate-300 rounded-lg shadow-xl border border-slate-700 pointer-events-none">
                                      {item.description}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-1 px-2 text-center text-slate-400 font-mono text-[10px]">
                              1-Time Lump Sum
                            </td>
                            <td className="py-1 px-2 text-right">
                              <div className="relative inline-block w-full max-w-[130px]">
                                <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono text-xs">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={costA === 0 ? '' : costA}
                                  onChange={(e) => handleCostChange(stateA, item.id, Number(e.target.value))}
                                  placeholder="0"
                                  className="w-full bg-slate-950 border border-slate-800/80 rounded pl-5 pr-2 py-1 text-right text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            </td>
                            <td className="py-1 pl-4 text-right">
                              <div className="relative inline-block w-full max-w-[130px]">
                                <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono text-xs">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={costB === 0 ? '' : costB}
                                  onChange={(e) => handleCostChange(stateB, item.id, Number(e.target.value))}
                                  placeholder="0"
                                  className="w-full bg-slate-950 border border-slate-800/80 rounded pl-5 pr-2 py-1 text-right text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            </td>
                            <td className="py-1 pl-2 text-right">
                              <button
                                onClick={() => handleOpenItemModal(item)}
                                className="p-1 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                title="Edit item details"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-amber-500/30 bg-amber-950/40 text-xs font-bold text-slate-200">
                      <tr>
                        <td className="py-2 pr-4 text-amber-400 font-semibold">
                          Total One-Time Costs
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500 font-mono text-[10px] font-normal">
                          -
                        </td>
                        <td className="py-2 px-2 text-right text-amber-400 font-mono font-bold">
                          {formatCurrency(stateATotals.oneTime)}
                        </td>
                        <td className="py-2 pl-4 text-right text-amber-400 font-mono font-bold">
                          {formatCurrency(stateBTotals.oneTime)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CATALOG & CATEGORIES MANAGER */}
          {activeTab === 'catalog' && (
            <div className="space-y-6">
              
              {/* Category Management Bar */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      Expense Categories
                    </h4>
                    <p className="text-xs text-slate-400">
                      Add, rename, or remove categories. Populated categories will prompt for safe item reassignment.
                    </p>
                  </div>
                  <button
                    onClick={() => handleOpenCategoryModal()}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    New Category
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {catalog.categories.map((cat) => {
                    const count = catalog.items.filter((i) => i.category === cat).length;
                    return (
                      <div
                        key={cat}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs"
                      >
                        <span className="font-semibold text-slate-200">{cat}</span>
                        <span className="px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded text-[10px] font-mono">
                          {count}
                        </span>
                        <button
                          onClick={() => handleOpenCategoryModal(cat)}
                          className="text-slate-500 hover:text-slate-200 cursor-pointer"
                          title="Rename Category"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handlePromptDeleteCategory(cat)}
                          className="text-slate-500 hover:text-rose-400 cursor-pointer"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Items Table & Filter */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="Search items by name or description..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ALL">All Categories</option>
                      {catalog.categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="ONE_TIME">One-Time Setup Costs</option>
                    </select>
                  </div>

                  <button
                    onClick={() => handleOpenItemModal()}
                    className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Expense Item
                  </button>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] text-slate-500 font-bold uppercase">
                        <th className="py-2.5 px-4">Item Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">Default Cadence</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30 text-xs">
                      {catalog.items
                        .filter((item) => {
                          if (searchFilter) {
                            const q = searchFilter.toLowerCase();
                            const matchName = item.name.toLowerCase().includes(q);
                            const matchDesc = item.description?.toLowerCase().includes(q);
                            if (!matchName && !matchDesc) return false;
                          }
                          if (selectedCategoryFilter === 'ONE_TIME') return !!item.isOneTime;
                          if (selectedCategoryFilter !== 'ALL') return item.category === selectedCategoryFilter;
                          return true;
                        })
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-2.5 px-4">
                              <div className="font-semibold text-slate-200">{item.name}</div>
                              {item.description && (
                                <div className="text-[11px] text-slate-400 truncate max-w-md">
                                  {item.description}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                                {item.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                              {item.isOneTime ? '1x (Lump sum)' : `${item.defaultFrequency}x / year`}
                            </td>
                            <td className="py-2.5 px-3">
                              {item.isOneTime ? (
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase">
                                  One-Time
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">
                                  Recurring
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenItemModal(item)}
                                  className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/40 hover:bg-slate-800 rounded border border-slate-700/40 transition-colors cursor-pointer"
                                  title="Edit item"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800/40 hover:bg-slate-800 rounded border border-slate-700/40 transition-colors cursor-pointer"
                                  title="Delete item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Dynamic Totals Summary Footer */}
        <div className="px-6 py-4 bg-slate-950/90 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-xs">
            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">
                {stateA} Recurring Cost
              </span>
              <span className="text-slate-200 font-bold font-mono text-sm">
                {formatCurrency(stateATotals.recurringMonthly)}/mo
              </span>
              <span className="text-slate-500 font-mono text-[10px] block">
                ({formatCurrency(stateATotals.recurringAnnual)}/yr)
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">
                {stateB} Recurring Cost
              </span>
              <span className="text-slate-200 font-bold font-mono text-sm">
                {formatCurrency(stateBTotals.recurringMonthly)}/mo
              </span>
              <span className="text-slate-500 font-mono text-[10px] block">
                ({formatCurrency(stateBTotals.recurringAnnual)}/yr)
              </span>
            </div>

            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">
                {stateA} One-Time Costs
              </span>
              <span className="text-amber-400 font-bold font-mono text-sm">
                {formatCurrency(stateATotals.oneTime)}
              </span>
              <span className="text-slate-500 text-[10px] block">Year 1 outlay</span>
            </div>

            <div>
              <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">
                {stateB} One-Time Costs
              </span>
              <span className="text-amber-400 font-bold font-mono text-sm">
                {formatCurrency(stateBTotals.oneTime)}
              </span>
              <span className="text-slate-500 text-[10px] block">Relocation outlay</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT ITEM MODAL */}
      {/* ========================================================================= */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-slate-100">
                {editingItem ? 'Edit Expense Item' : 'Add New Expense Item'}
              </h4>
              <button
                onClick={() => setItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {itemError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{itemError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Expense Name *</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => {
                    setItemName(e.target.value);
                    if (itemError) setItemError(null);
                  }}
                  placeholder="e.g., Homeowners Insurance, Pool Care, Golf Dues"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Category</label>
                <select
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {catalog.categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="One-Time Setup Costs">One-Time Setup Costs</option>
                  <option value="__NEW__">+ Create New Category...</option>
                </select>
              </div>

              {itemCategory === '__NEW__' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">New Category Name</label>
                  <input
                    type="text"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    placeholder="Enter category name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description (Optional)</label>
                <textarea
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional notes or details shown on tooltip"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Default Cadence</label>
                  <select
                    value={itemFrequency}
                    disabled={itemIsOneTime}
                    onChange={(e) => setItemFrequency(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 disabled:opacity-50 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={12}>Monthly (12x/yr)</option>
                    <option value={1}>Annual (1x/yr)</option>
                    <option value={4}>Quarterly (4x/yr)</option>
                    <option value={2}>Semi-Annual (2x/yr)</option>
                    <option value={26}>Bi-Weekly (26x/yr)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Expense Type</label>
                  <label className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itemIsOneTime}
                      onChange={(e) => {
                        setItemIsOneTime(e.target.checked);
                        if (e.target.checked) setItemFrequency(1);
                      }}
                      className="rounded text-emerald-500 focus:ring-0 focus:outline-none"
                    />
                    <span className="text-slate-300 font-medium">One-Time Setup Cost</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setItemModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/60 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer shadow"
              >
                {editingItem ? 'Save Changes' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD / RENAME CATEGORY MODAL */}
      {/* ========================================================================= */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-slate-100">
                {editingCategoryName ? 'Rename Category' : 'Create New Category'}
              </h4>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {categoryError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{categoryError}</span>
              </div>
            )}

            <div className="text-xs">
              <label className="block text-slate-300 font-semibold mb-1">Category Name</label>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  if (categoryError) setCategoryError(null);
                }}
                placeholder="e.g. Leisure, Personal Care, Hobbies"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/60 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCategory}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer shadow"
              >
                {editingCategoryName ? 'Save Name' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SAFE CATEGORY DELETION / REASSIGNMENT MODAL */}
      {/* ========================================================================= */}
      {deleteCategoryTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 border-b border-slate-800 pb-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-slate-100">
                Delete Category: "{deleteCategoryTarget}"
              </h4>
            </div>

            <p className="text-xs text-slate-300">
              This category contains{' '}
              <strong className="text-amber-300">
                {catalog.items.filter((i) => i.category === deleteCategoryTarget).length} line items
              </strong>
              . What would you like to do with these items?
            </p>

            <div className="space-y-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Option 1: Reassign items to another category:
                </label>
                <select
                  value={reassignCategoryTarget}
                  onChange={(e) => setReassignCategoryTarget(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {catalog.categories
                    .filter((c) => c !== deleteCategoryTarget)
                    .map((c) => (
                      <option key={c} value={c}>
                        Move to "{c}"
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => handleConfirmCategoryDeletion('delete-all')}
                className="px-3 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg cursor-pointer"
              >
                Delete Category & All Items
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDeleteCategoryTarget(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/60 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmCategoryDeletion('reassign')}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg cursor-pointer shadow"
                >
                  Reassign & Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>,
    document.body
  );
};
