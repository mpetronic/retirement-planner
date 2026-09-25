import { ExpenseCategory } from '../types/expenses';
import { normalizeDetailedExpenses, ExpenseItemDefinition } from '../../types';

export interface PlannerExpenseLineItem {
  id: string;
  groupCategory: string;
  name: string;
  displayName: string;
  plannedMonthlyDefault: number;
  color?: string;
  icon?: string;
  isCustom?: boolean;
}

const GROUP_COLORS: Record<string, string> = {
  Living: '#10b981', // emerald
  Housing: '#f59e0b', // amber
  Transportation: '#3b82f6', // blue
  Insurance: '#06b6d4', // cyan
  Healthcare: '#ef4444', // red
  Leisure: '#ec4899', // pink
  Charities: '#14b8a6', // teal
  Other: '#8b5cf6', // purple
};

export function getPlannerExpenseCatalog(): PlannerExpenseLineItem[] {
  const lineItems: PlannerExpenseLineItem[] = [];
  const seenIds = new Set<string>();

  // 1. Attempt to read detailedExpenses from planner localStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('retirement_planner_inputs');
      if (raw) {
        const parsed = JSON.parse(raw);
        const detailed = parsed.detailedExpenses;
        if (detailed && detailed.catalog && Array.isArray(detailed.catalog.items) && detailed.catalog.items.length > 0) {
          const costsMD = detailed.costs?.MD || detailed.MD || {};
          const costsFL = detailed.costs?.FL || detailed.FL || {};
          const frequencies = detailed.frequencies || {};

          for (const item of detailed.catalog.items) {
            const group = item.category || 'Living';
            const cost = costsMD[item.id] ?? costsFL[item.id] ?? 0;
            const freq = frequencies[item.id] ?? item.defaultFrequency ?? 12;
            const monthlyCost = freq > 0 ? (cost * freq) / 12 : cost;

            const displayName = `${group} - ${item.name}`;
            lineItems.push({
              id: item.id,
              groupCategory: group,
              name: item.name,
              displayName,
              plannedMonthlyDefault: Math.round(monthlyCost),
              color: GROUP_COLORS[group] || '#6366f1',
              icon: 'Tag',
              isCustom: false,
            });
            seenIds.add(item.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to read planner detailed expenses from localStorage:', err);
    }
  }

  return lineItems;
}

export function savePlannerExpenseLineItem(item: {
  id?: string;
  name: string;
  groupCategory: string;
  plannedMonthlyDefault?: number;
}): PlannerExpenseLineItem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('retirement_planner_inputs');
    const parsed = raw ? JSON.parse(raw) : {};
    const norm = normalizeDetailedExpenses(parsed.detailedExpenses);

    const group = (item.groupCategory || 'Living').trim();
    const name = item.name.trim();
    if (!name) return null;

    // Check if category group exists in catalog.categories
    if (!norm.catalog.categories.includes(group)) {
      norm.catalog.categories.push(group);
    }

    // Check if item exists in catalog.items
    let existing = norm.catalog.items.find(
      i => i.name.trim().toLowerCase() === name.toLowerCase() && i.category.trim().toLowerCase() === group.toLowerCase()
    );

    const itemId = existing?.id || item.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const monthlyCost = Number(item.plannedMonthlyDefault) || 0;

    if (!existing) {
      const newItem: ExpenseItemDefinition = {
        id: itemId,
        name,
        category: group,
        defaultFrequency: 12,
        isOneTime: false,
        targetYear: null,
      };
      norm.catalog.items.push(newItem);
      existing = newItem;
    }

    // Set frequencies and costs
    norm.frequencies[itemId] = 12;
    norm.costs = norm.costs || {};
    norm.costs.MD = norm.costs.MD || {};
    norm.costs.FL = norm.costs.FL || {};
    norm.costs.MD[itemId] = monthlyCost;
    norm.costs.FL[itemId] = monthlyCost;
    norm.MD = norm.costs.MD;
    norm.FL = norm.costs.FL;

    parsed.detailedExpenses = norm;
    window.localStorage.setItem('retirement_planner_inputs', JSON.stringify(parsed));

    // Dispatch custom and storage event for live UI reactivity across tabs
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('retirement_planner_inputs_updated', { detail: parsed }));

    const displayName = `${group} - ${name}`;
    return {
      id: itemId,
      groupCategory: group,
      name,
      displayName,
      plannedMonthlyDefault: monthlyCost,
      color: GROUP_COLORS[group] || '#6366f1',
      icon: 'Tag',
      isCustom: false,
    };
  } catch (err) {
    console.error('Failed to save line item to planner inputs:', err);
    return null;
  }
}

export function syncCustomCategoriesToPlanner(customCategories: ExpenseCategory[]): void {
  if (typeof window === 'undefined' || !customCategories || customCategories.length === 0) return;
  for (const cat of customCategories) {
    if (!cat.isCustom) continue;
    const parts = cat.name.includes(' - ') ? cat.name.split(' - ') : ['Custom', cat.name];
    const group = parts[0].trim();
    const name = parts[1] ? parts[1].trim() : cat.name.trim();
    savePlannerExpenseLineItem({
      id: cat.id,
      name,
      groupCategory: group,
      plannedMonthlyDefault: cat.plannedMonthlyDefault || 0,
    });
  }
}

export function mergeWithCustomCategories(
  plannerItems: PlannerExpenseLineItem[],
  customCategories: ExpenseCategory[]
): PlannerExpenseLineItem[] {
  const result = [...plannerItems];
  const seenIds = new Set(plannerItems.map(p => p.id));
  const seenDisplayNames = new Set(plannerItems.map(p => p.displayName.toLowerCase()));
  const seenNames = new Set(plannerItems.map(p => p.name.toLowerCase()));

  for (const cat of customCategories) {
    // Only merge user-created custom categories (isCustom === true)
    if (!cat.isCustom) continue;
    if (seenIds.has(cat.id)) continue;

    const parts = cat.name.includes(' - ') ? cat.name.split(' - ') : ['Custom', cat.name];
    const groupCategory = parts[0].trim();
    const name = parts[1] ? parts[1].trim() : cat.name.trim();
    const displayName = cat.name.includes(' - ') ? cat.name : `${groupCategory} - ${name}`;

    if (seenDisplayNames.has(displayName.toLowerCase()) || seenNames.has(name.toLowerCase())) {
      continue;
    }

    result.push({
      id: cat.id,
      groupCategory,
      name,
      displayName,
      plannedMonthlyDefault: cat.plannedMonthlyDefault || 0,
      color: cat.color || '#8b5cf6',
      icon: cat.icon || 'Tag',
      isCustom: true,
    });
    seenIds.add(cat.id);
    seenDisplayNames.add(displayName.toLowerCase());
  }

  return result;
}
