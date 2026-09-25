import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorageAdapter } from '../InMemoryStorageAdapter';

describe('InMemoryStorageAdapter', () => {
  let adapter: InMemoryStorageAdapter;

  beforeEach(() => {
    adapter = new InMemoryStorageAdapter();
  });

  it('initializes with empty categories ensuring Planner SSOT', async () => {
    const categories = await adapter.getCategories();
    expect(categories.length).toBe(0);
  });

  it('saves a new custom category', async () => {
    const newCat = await adapter.saveCategory({
      id: 'cat_custom_golf',
      name: 'Golf & Hobbies',
      plannedMonthlyDefault: 150,
      color: '#10b981',
      icon: 'Tag',
      isCustom: true,
    });

    expect(newCat.id).toBe('cat_custom_golf');
    const categories = await adapter.getCategories();
    expect(categories.some(c => c.id === 'cat_custom_golf')).toBe(true);
  });

  it('logs an expense and retrieves it in recents and annual filter', async () => {
    const logged = await adapter.saveExpense({
      date: '2026-09-24',
      amount: 68.5,
      categoryId: 'cat_dining',
      categoryName: 'Dining & Restaurants',
      enteredBy: 'Mike',
      notes: 'Lunch meeting',
    });

    expect(logged.expenseId).toBeDefined();
    expect(logged.amount).toBe(68.5);
    expect(logged.syncStatus).toBe('PENDING_SYNC');

    // Query 2026
    const expenses2026 = await adapter.getExpenses(2026);
    expect(expenses2026.length).toBe(1);
    expect(expenses2026[0].expenseId).toBe(logged.expenseId);

    // Query 2026-09
    const expensesSep = await adapter.getExpenses(2026, 9);
    expect(expensesSep.length).toBe(1);

    // Query 2026-10 (empty)
    const expensesOct = await adapter.getExpenses(2026, 10);
    expect(expensesOct.length).toBe(0);

    // Recents
    const recents = await adapter.getRecentExpenses();
    expect(recents.length).toBe(1);
    expect(recents[0].expenseId).toBe(logged.expenseId);
  });

  it('marks expenses as synced', async () => {
    const exp1 = await adapter.saveExpense({
      date: '2026-09-24',
      amount: 25.0,
      categoryId: 'cat_groceries',
      categoryName: 'Groceries & Household',
      enteredBy: 'Wife',
    });

    let pending = await adapter.getPendingSyncExpenses();
    expect(pending.length).toBe(1);

    await adapter.markExpensesSynced([exp1.expenseId]);

    pending = await adapter.getPendingSyncExpenses();
    expect(pending.length).toBe(0);
  });

  it('exports and imports a full archive', async () => {
    await adapter.saveExpense({
      date: '2026-09-24',
      amount: 100.0,
      categoryId: 'cat_travel',
      categoryName: 'Travel & Vacations',
      enteredBy: 'Mike',
    });

    const archive = await adapter.exportArchive();
    expect(archive.schemaVersion).toBe(1);
    expect(archive.expenses.length).toBe(1);

    const freshAdapter = new InMemoryStorageAdapter([]);
    await freshAdapter.importArchive(archive);

    const importedExpenses = await freshAdapter.getExpenses(2026);
    expect(importedExpenses.length).toBe(1);
    expect(importedExpenses[0].amount).toBe(100.0);
  });
});
