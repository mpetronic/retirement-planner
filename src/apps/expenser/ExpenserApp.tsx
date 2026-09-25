import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Calendar,
  FileText,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
  History,
  X,
  Sparkles,
  Utensils,
  ShoppingCart,
  Zap,
  HeartPulse,
  Plane,
  Home,
  Car,
  Film,
  Gift,
  Tag,
  Search,
  ChevronDown,
  Delete,
  Cloud,
} from 'lucide-react';
import { getStorageAdapter } from '../../shared/storage';
import { ActualExpense, ExpenseCategory } from '../../shared/types/expenses';
import { getPlannerProfileNames } from '../../shared/utils/profileNames';
import { AuthService } from '../../shared/auth/AuthService';
import { CloudAuthModal } from '../../components/CloudAuthModal';
import {
  getPlannerExpenseCatalog,
  mergeWithCustomCategories,
  savePlannerExpenseLineItem,
  syncCustomCategoriesToPlanner,
  PlannerExpenseLineItem,
} from '../../shared/utils/plannerCategories';

const ICON_MAP: Record<string, React.ReactNode> = {
  Utensils: <Utensils className="w-4 h-4" />,
  ShoppingCart: <ShoppingCart className="w-4 h-4" />,
  Zap: <Zap className="w-4 h-4" />,
  HeartPulse: <HeartPulse className="w-4 h-4" />,
  Plane: <Plane className="w-4 h-4" />,
  Home: <Home className="w-4 h-4" />,
  Car: <Car className="w-4 h-4" />,
  Film: <Film className="w-4 h-4" />,
  Gift: <Gift className="w-4 h-4" />,
  Tag: <Tag className="w-4 h-4" />,
};

const COLOR_PRESETS = [
  '#f97316', // orange
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#ef4444', // red
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6b7280', // gray
];

export const ExpenserApp: React.FC = () => {
  const adapter = useMemo(() => getStorageAdapter(), []);
  const profileNames = useMemo(() => getPlannerProfileNames(), []);

  // State
  const [amountStr, setAmountStr] = useState<string>('0');
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');
  const [isCategorySearchOpen, setIsCategorySearchOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [enteredBy, setEnteredBy] = useState<string>(() => profileNames.primaryName);
  const [customPayer, setCustomPayer] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [recentExpenses, setRecentExpenses] = useState<ActualExpense[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccessBadge, setShowSuccessBadge] = useState<boolean>(false);
  const [showRecentModal, setShowRecentModal] = useState<boolean>(false);
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showDateModal, setShowDateModal] = useState<boolean>(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(false);
  const [showCloudModal, setShowCloudModal] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => AuthService.isAuthenticated());

  // New Category Modal form
  const [newCatGroup, setNewCatGroup] = useState<string>('Living');
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatBudget, setNewCatBudget] = useState<string>('0');
  const [newCatColor, setNewCatColor] = useState<string>(COLOR_PRESETS[0]);
  const [newCatIcon, setNewCatIcon] = useState<string>('Tag');

  // Unified Catalog Items (Planner detailed line items + custom categories)
  const allCatalogItems: PlannerExpenseLineItem[] = useMemo(() => {
    const plannerItems = getPlannerExpenseCatalog();
    return mergeWithCustomCategories(plannerItems, categories);
  }, [categories]);

  // Filtered Catalog Items by Search Query
  const filteredCatalogItems: PlannerExpenseLineItem[] = useMemo(() => {
    const query = categorySearchQuery.trim().toLowerCase();
    if (!query) return allCatalogItems;
    return allCatalogItems.filter(item => {
      const full = `${item.groupCategory} ${item.name} ${item.displayName}`.toLowerCase();
      return full.includes(query);
    });
  }, [allCatalogItems, categorySearchQuery]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredCatalogItems]);

  // Keyboard Navigation for Category Search
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isCategorySearchOpen) {
        setIsCategorySearchOpen(true);
        setHighlightedIndex(0);
      } else if (filteredCatalogItems.length > 0) {
        setHighlightedIndex(prev => (prev + 1) % filteredCatalogItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isCategorySearchOpen) {
        setIsCategorySearchOpen(true);
        setHighlightedIndex(Math.max(0, filteredCatalogItems.length - 1));
      } else if (filteredCatalogItems.length > 0) {
        setHighlightedIndex(prev => (prev <= 0 ? filteredCatalogItems.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isCategorySearchOpen && filteredCatalogItems.length > 0) {
        const targetItem = filteredCatalogItems[highlightedIndex] || filteredCatalogItems[0];
        if (targetItem) {
          triggerHaptic(10);
          setSelectedCategoryId(targetItem.id);
          setCategorySearchQuery('');
          setIsCategorySearchOpen(false);
        }
      } else if (categorySearchQuery.trim()) {
        setNewCatName(categorySearchQuery.trim());
        setShowCategoryModal(true);
        setIsCategorySearchOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsCategorySearchOpen(false);
    }
  };

  // Frequently Logged Line Items (Smart Recents based on actual usage)
  const frequentShortcutItems: PlannerExpenseLineItem[] = useMemo(() => {
    if (!recentExpenses || recentExpenses.length === 0) {
      return [];
    }

    const counts: Record<string, number> = {};
    const firstSeenIndex: Record<string, number> = {};

    recentExpenses.forEach((exp, idx) => {
      counts[exp.categoryId] = (counts[exp.categoryId] || 0) + 1;
      if (firstSeenIndex[exp.categoryId] === undefined) {
        firstSeenIndex[exp.categoryId] = idx;
      }
    });

    const itemsMap = new Map<string, PlannerExpenseLineItem>();
    allCatalogItems.forEach(item => itemsMap.set(item.id, item));

    const sortedIds = Object.keys(counts).sort((a, b) => {
      if (counts[b] !== counts[a]) {
        return counts[b] - counts[a]; // Highest frequency first
      }
      return firstSeenIndex[a] - firstSeenIndex[b]; // Most recent first
    });

    return sortedIds
      .map(id => itemsMap.get(id))
      .filter((item): item is PlannerExpenseLineItem => Boolean(item))
      .slice(0, 8);
  }, [recentExpenses, allCatalogItems]);

  // Load Categories & Expenses
  const loadData = useCallback(async () => {
    try {
      const cats = await adapter.getCategories();
      setCategories(cats);

      // Ensure any custom line items are synced into Planner SSOT
      syncCustomCategoriesToPlanner(cats);

      const plannerItems = getPlannerExpenseCatalog();
      const merged = mergeWithCustomCategories(plannerItems, cats);
      if (merged.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(merged[0].id);
      }

      const recents = await adapter.getRecentExpenses(30);
      setRecentExpenses(recents);

      const pending = await adapter.getPendingSyncExpenses();
      setPendingCount(pending.length);
    } catch (err) {
      console.error('Failed to load storage data:', err);
    }
  }, [adapter, selectedCategoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Online / Offline & Cloud Sync Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleCloudSync = () => {
      loadData();
    };
    const unsubscribeAuth = AuthService.subscribe(s => {
      setIsAuthenticated(Boolean(s));
      loadData();
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('cloud_categories_synced', handleCloudSync);
    window.addEventListener('cloud_expenses_synced', handleCloudSync);
    window.addEventListener('cloud_sync_completed', handleCloudSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('cloud_categories_synced', handleCloudSync);
      window.removeEventListener('cloud_expenses_synced', handleCloudSync);
      window.removeEventListener('cloud_sync_completed', handleCloudSync);
      unsubscribeAuth();
    };
  }, [loadData]);

  // Haptic feedback helper
  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        /* ignore */
      }
    }
  };

  // Keypad Handlers
  const handleKeypadPress = useCallback((key: string) => {
    triggerHaptic(10);
    if (key === 'CLEAR') {
      setAmountStr('0');
      return;
    }
    if (key === 'BACKSPACE') {
      setAmountStr(prev => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }
    if (key === '.') {
      setAmountStr(prev => (prev.includes('.') ? prev : prev + '.'));
      return;
    }

    // Number key
    setAmountStr(prev => {
      // Prevent more than 2 decimal places
      if (prev.includes('.')) {
        const parts = prev.split('.');
        if (parts[1].length >= 2) return prev;
      }
      // Prevent leading zero accumulation
      if (prev === '0') {
        return key;
      }
      // Max amount reasonable check ($999,999.99)
      if (prev.replace('.', '').length >= 8) return prev;
      return prev + key;
    });
  }, []);

  // Physical Keyboard Support for Desktop Users
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // If user is typing inside an input or textarea or modal, don't intercept keypad keys
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      // If any modal is open, don't intercept keypad
      if (showCategoryModal || showDateModal || showRecentModal) {
        return;
      }

      const key = e.key;

      if (key >= '0' && key <= '9') {
        e.preventDefault();
        handleKeypadPress(key);
      } else if (key === '.' || key === ',') {
        e.preventDefault();
        handleKeypadPress('.');
      } else if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        handleKeypadPress('BACKSPACE');
      } else if (key.toLowerCase() === 'c') {
        e.preventDefault();
        handleKeypadPress('CLEAR');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showCategoryModal, showDateModal, showRecentModal, handleKeypadPress]);

  const parsedAmount = parseFloat(amountStr) || 0;

  // Save Expense
  const handleSaveExpense = async () => {
    if (parsedAmount <= 0) return;
    if (!selectedCategoryId) return;

    triggerHaptic(25);
    setIsSubmitting(true);

    try {
      const selectedItem = allCatalogItems.find(c => c.id === selectedCategoryId);
      const payerName = customPayer.trim() || enteredBy;

      await adapter.saveExpense({
        date: expenseDate,
        amount: parsedAmount,
        categoryId: selectedCategoryId,
        categoryName: selectedItem ? selectedItem.displayName : 'Uncategorized',
        enteredBy: payerName,
        notes: notes.trim() || undefined,
      });

      // Show success indicator
      setShowSuccessBadge(true);
      setTimeout(() => setShowSuccessBadge(false), 1800);

      // Reset entry inputs
      setAmountStr('0');
      setNotes('');
      setShowNotesDrawer(false);
      setCategorySearchQuery('');
      setIsCategorySearchOpen(false);

      // Refresh list
      await loadData();
    } catch (err) {
      console.error('Failed to save expense:', err);
      alert('Error saving expense to local storage.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Category on the Fly
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const group = newCatGroup.trim() || 'Living';
    const itemName = newCatName.trim();
    const formattedDisplayName = `${group} - ${itemName}`;
    const newId = `item_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const budgetVal = parseFloat(newCatBudget) || 0;

    // 1. Permanently register in Planner SSOT detailedExpenses catalog in localStorage
    savePlannerExpenseLineItem({
      id: newId,
      name: itemName,
      groupCategory: group,
      plannedMonthlyDefault: budgetVal,
    });

    // 2. Persist to Expenser Storage Adapter
    const created = await adapter.saveCategory({
      id: newId,
      name: formattedDisplayName,
      plannedMonthlyDefault: budgetVal,
      color: newCatColor,
      icon: newCatIcon,
      isCustom: true,
    });

    setCategories(prev => [...prev, created]);
    setSelectedCategoryId(created.id);
    setNewCatName('');
    setNewCatBudget('0');
    setCategorySearchQuery('');
    setShowCategoryModal(false);
    setIsCategorySearchOpen(false);
  };

  // Delete Expense
  const handleDeleteExpense = async (id: string) => {
    if (window.confirm('Delete this expense?')) {
      await adapter.deleteExpense(id);
      await loadData();
    }
  };

  // Calculate Today's Total
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTotal = recentExpenses
    .filter(e => e.date === todayStr)
    .reduce((sum, e) => sum + e.amount, 0);

  const selectedCategoryObj = allCatalogItems.find(c => c.id === selectedCategoryId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between select-none font-sans antialiased max-w-md mx-auto shadow-2xl relative border-x border-slate-800/60 pb-safe">
      {/* Top App Header */}
      <header className="px-4 py-3 bg-slate-900/90 backdrop-blur border-b border-slate-800/80 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              Expenser <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PWA</span>
            </h1>
            <p className="text-[11px] text-slate-400">Retirement Actuals Tracker</p>
          </div>
        </div>

        {/* Status & Feed Actions */}
        <div className="flex items-center space-x-1.5">
          {/* Cloud Auth / Sync Button */}
          <button
            type="button"
            onClick={() => setShowCloudModal(true)}
            className={`p-1.5 rounded-xl border flex items-center gap-1 transition-all ${
              isAuthenticated
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title={isAuthenticated ? 'Household Cloud Connected' : 'Sign in to Household Cloud'}
          >
            <Cloud className="w-3.5 h-3.5" />
            {isAuthenticated ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            ) : (
              <span className="text-[10px] font-semibold">Sign in</span>
            )}
          </button>

          {/* Sync / Offline Pill */}
          <div
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isOnline
                ? pendingCount > 0
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3" />
                <span>{pendingCount > 0 ? `${pendingCount} Queue` : 'Synced'}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* History Drawer Trigger */}
          <button
            onClick={() => setShowRecentModal(true)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors relative"
            title="Recent Expenses"
          >
            <History className="w-4 h-4" />
            {recentExpenses.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-between p-4 space-y-3">
        {/* Amount Display with Today's Stat */}
        <div className="bg-gradient-to-b from-slate-900/90 to-slate-900/50 rounded-2xl p-4 border border-slate-800/80 shadow-inner flex flex-col items-center justify-center relative overflow-hidden">
          {/* Today's Running Spend Indicator */}
          <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {expenseDate === todayStr ? 'Today' : expenseDate}
            </span>
            <span className="font-medium text-slate-300">
              Today's Total: <strong className="text-emerald-400">${todayTotal.toFixed(2)}</strong>
            </span>
          </div>

          {/* Big Amount Number */}
          <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white my-2 flex items-baseline justify-center">
            <span className="text-2xl sm:text-3xl text-slate-500 mr-1 font-semibold">$</span>
            <span>{amountStr}</span>
          </div>

          {/* Active Category & Payer Sub-badge */}
          <div className="flex items-center space-x-2 text-xs">
            {selectedCategoryObj && (
              <span
                className="px-2.5 py-0.5 rounded-full font-medium text-white flex items-center gap-1 shadow-sm"
                style={{ backgroundColor: selectedCategoryObj.color || '#3b82f6' }}
              >
                {ICON_MAP[selectedCategoryObj.icon || 'Tag'] || <Tag className="w-3.5 h-3.5" />}
                {selectedCategoryObj.name}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
              👤 {customPayer || enteredBy}
            </span>
            {notes && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Note
              </span>
            )}
          </div>

          {/* Success Checkmark Banner Overlay */}
          {showSuccessBadge && (
            <div className="absolute inset-0 bg-emerald-600/95 backdrop-blur flex items-center justify-center space-x-2 text-white text-lg font-bold animate-in fade-in zoom-in duration-150">
              <CheckCircle2 className="w-7 h-7 text-white animate-bounce" />
              <span>Expense Logged!</span>
            </div>
          )}
        </div>

        {/* Category Search & Autocomplete Selector */}
        <div className="relative z-20">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
            <span>Budgeted Line Item</span>
            <button
              onClick={() => {
                if (categorySearchQuery.trim()) {
                  setNewCatName(categorySearchQuery.trim());
                }
                setShowCategoryModal(true);
              }}
              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 lowercase font-normal"
            >
              <Plus className="w-3.5 h-3.5" /> new line item
            </button>
          </div>

          {/* Search / Select Bar */}
          <div className="relative">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
              <Search className="w-4 h-4 text-slate-500 shrink-0 mr-2" />
              <input
                type="text"
                value={categorySearchQuery}
                onFocus={() => setIsCategorySearchOpen(true)}
                onKeyDown={handleSearchKeyDown}
                onChange={e => {
                  setCategorySearchQuery(e.target.value);
                  setIsCategorySearchOpen(true);
                }}
                placeholder={
                  selectedCategoryObj
                    ? selectedCategoryObj.displayName
                    : 'Search line items (e.g. Living, Groceries)...'
                }
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none"
              />
              {categorySearchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setCategorySearchQuery('');
                    setIsCategorySearchOpen(false);
                  }}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCategorySearchOpen(prev => !prev)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown List */}
            {isCategorySearchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl max-h-56 overflow-y-auto z-50 p-1 divide-y divide-slate-800/60 custom-scrollbar animate-in fade-in zoom-in-95">
                {filteredCatalogItems.length === 0 ? (
                  <div className="p-3 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      No line items matching &ldquo;<span className="text-white font-medium">{categorySearchQuery}</span>&rdquo;
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCatName(categorySearchQuery.trim());
                        setShowCategoryModal(true);
                        setIsCategorySearchOpen(false);
                      }}
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add as new line item
                    </button>
                  </div>
                ) : (
                  filteredCatalogItems.map((item, index) => {
                    const isSelected = item.id === selectedCategoryId;
                    const isHighlighted = index === highlightedIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => {
                          triggerHaptic(10);
                          setSelectedCategoryId(item.id);
                          setCategorySearchQuery('');
                          setIsCategorySearchOpen(false);
                        }}
                        className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition-all ${
                          isHighlighted
                            ? 'bg-emerald-500/25 border border-emerald-500/60 text-white ring-1 ring-emerald-500/40 shadow-sm'
                            : isSelected
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-white'
                            : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-slate-900 shrink-0"
                            style={{ backgroundColor: item.color || '#3b82f6' }}
                          >
                            {item.groupCategory}
                          </span>
                          <span className="text-xs font-semibold truncate">{item.name}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 shrink-0 ml-2 font-mono">
                          {item.displayName}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Frequently Logged Shortcuts (Dynamic Smart Recents) */}
          {frequentShortcutItems.length > 0 && (
            <div className="flex space-x-1.5 overflow-x-auto pt-1.5 pb-0.5 scrollbar-none snap-x items-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider shrink-0 mr-0.5">
                Frequent:
              </span>
              {frequentShortcutItems.map(item => {
                const isSelected = item.id === selectedCategoryId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      setSelectedCategoryId(item.id);
                      setCategorySearchQuery('');
                      setIsCategorySearchOpen(false);
                    }}
                    className={`flex-shrink-0 snap-start px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center space-x-1.5 transition-all border ${
                      isSelected
                        ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 shadow-sm'
                        : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.color || '#3b82f6' }}
                    />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Controls Row (Payer Selector, Date, Notes Trigger) */}
        <div className="grid grid-cols-3 gap-2">
          {/* Payer Toggle */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-1.5 flex items-center justify-around">
            <button
              onClick={() => {
                triggerHaptic(8);
                setEnteredBy(profileNames.primaryName);
                setCustomPayer('');
              }}
              title={profileNames.primaryName}
              className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-all truncate px-1 ${
                enteredBy === profileNames.primaryName && !customPayer
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {profileNames.primaryName}
            </button>
            {!profileNames.isSingleFiler && (
              <button
                onClick={() => {
                  triggerHaptic(8);
                  setEnteredBy(profileNames.spouseName);
                  setCustomPayer('');
                }}
                title={profileNames.spouseName}
                className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-all truncate px-1 ${
                  enteredBy === profileNames.spouseName && !customPayer
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {profileNames.spouseName}
              </button>
            )}
          </div>

          {/* Date Picker Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(8);
              setShowDateModal(true);
            }}
            className="bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl p-1.5 flex items-center justify-center space-x-1 text-xs font-medium text-slate-300 transition-all cursor-pointer active:scale-95"
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>{expenseDate === todayStr ? 'Today' : expenseDate.slice(5)}</span>
          </button>

          {/* Notes Button */}
          <button
            onClick={() => setShowNotesDrawer(prev => !prev)}
            className={`bg-slate-900/80 border rounded-xl p-1.5 flex items-center justify-center space-x-1 text-xs font-medium transition-all ${
              notes
                ? 'border-amber-500/50 text-amber-300 bg-amber-500/10'
                : 'border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{notes ? 'Edit Note' : 'Add Note'}</span>
          </button>
        </div>

        {/* Collapsible Note Drawer */}
        {showNotesDrawer && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-1.5 text-xs text-slate-400">
              <span>Transaction Note / Tag</span>
              <button onClick={() => setShowNotesDrawer(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="e.g. Hawaii anniversary dinner, groceries at Costco"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        )}

        {/* Touch Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'BACKSPACE'].map(key => {
            const isBackspace = key === 'BACKSPACE';
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleKeypadPress(key)}
                aria-label={isBackspace ? 'Backspace' : key}
                title={isBackspace ? 'Backspace' : undefined}
                className={`h-12 sm:h-14 rounded-2xl font-bold text-xl flex items-center justify-center transition-all active:scale-95 shadow-sm ${
                  isBackspace
                    ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    : 'bg-slate-900 hover:bg-slate-800/90 text-white border border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {isBackspace ? <Delete className="w-5 h-5 text-slate-300" /> : key}
              </button>
            );
          })}
        </div>

        {/* Big Save Button */}
        <button
          type="button"
          disabled={parsedAmount <= 0 || isSubmitting}
          onClick={handleSaveExpense}
          className={`w-full py-3.5 rounded-2xl font-bold text-base flex items-center justify-center space-x-2 transition-all shadow-xl ${
            parsedAmount > 0
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-950/40 active:scale-[0.98]'
              : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Log ${amountStr} Expense</span>
            </>
          )}
        </button>
      </main>

      {/* Recent Expenses Modal / Drawer */}
      {showRecentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col max-w-md w-full mx-auto shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">Recent Transactions</h2>
              </div>
              <button
                onClick={() => setShowRecentModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1 divide-y divide-slate-800/60">
              {recentExpenses.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No expenses logged yet.
                </div>
              ) : (
                recentExpenses.map(exp => (
                  <div key={exp.expenseId} className="pt-2.5 first:pt-0 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-sm text-white">${exp.amount.toFixed(2)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                          {exp.categoryName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-2">
                        <span>{exp.date}</span>
                        <span>•</span>
                        <span>{exp.enteredBy}</span>
                        {exp.notes && (
                          <>
                            <span>•</span>
                            <span className="text-amber-300 truncate max-w-[140px]">{exp.notes}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteExpense(exp.expenseId)}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>{recentExpenses.length} transactions stored locally</span>
              <button
                onClick={() => setShowRecentModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On-The-Fly Category Creator Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-400" /> New Expense Category
              </h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Parent Group Category *
                </label>
                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                  {['Living', 'Housing', 'Transportation', 'Healthcare', 'Leisure', 'Charities'].map(grp => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setNewCatGroup(grp)}
                      className={`py-1 rounded-lg text-xs font-semibold border transition-all ${
                        newCatGroup === grp
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Or enter custom group name..."
                  value={newCatGroup}
                  onChange={e => setNewCatGroup(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Line Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lawn Care, Pet Vet, Groceries"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Estimated Monthly Budget (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-500 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    placeholder="0"
                    value={newCatBudget}
                    onChange={e => setNewCatBudget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Color Tag
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCatColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        newCatColor === c ? 'border-white scale-110 shadow' : 'border-transparent opacity-70'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(ICON_MAP).map(iconName => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setNewCatIcon(iconName)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        newCatIcon === iconName
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 scale-105'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {ICON_MAP[iconName]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Date Selector Modal */}
      {showDateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xs w-full p-4 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" /> Select Expense Date
              </h2>
              <button
                onClick={() => setShowDateModal(false)}
                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setExpenseDate(todayStr);
                  setShowDateModal(false);
                }}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                  expenseDate === todayStr
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  setExpenseDate(d.toISOString().split('T')[0]);
                  setShowDateModal(false);
                }}
                className="py-2 rounded-xl text-xs font-semibold bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800 transition-all"
              >
                Yesterday
              </button>
            </div>

            {/* Custom Date Input */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-400">
                Custom Calendar Date
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={e => {
                  if (e.target.value) {
                    setExpenseDate(e.target.value);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowDateModal(false)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Cloud Authentication & Sync Modal */}
      <CloudAuthModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        onSyncComplete={loadData}
      />
    </div>
  );
};
