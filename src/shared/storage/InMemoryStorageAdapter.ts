import { ActualExpense, ExpenseCategory, FullHouseholdArchive, StorageAdapter } from '../types/expenses';
import { DEFAULT_EXPENSE_CATEGORIES } from './defaultCategories';

export class InMemoryStorageAdapter implements StorageAdapter {
  private categories: ExpenseCategory[];
  private expenses: ActualExpense[];

  constructor(initialExpenses?: ActualExpense[]) {
    this.categories = [...DEFAULT_EXPENSE_CATEGORIES];
    this.expenses = initialExpenses ? [...initialExpenses] : [];
  }

  async getCategories(): Promise<ExpenseCategory[]> {
    return [...this.categories];
  }

  async saveCategory(category: Omit<ExpenseCategory, 'createdAt'>): Promise<ExpenseCategory> {
    const existingIndex = this.categories.findIndex(c => c.id === category.id);
    const fullCategory: ExpenseCategory = {
      ...category,
      createdAt: existingIndex >= 0 ? this.categories[existingIndex].createdAt : new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.categories[existingIndex] = fullCategory;
    } else {
      this.categories.push(fullCategory);
    }

    return fullCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    this.categories = this.categories.filter(c => c.id !== id);
  }

  async getExpenses(year: number, month?: number): Promise<ActualExpense[]> {
    const yearPrefix = `${year}-`;
    const monthPrefix = month !== undefined ? `${year}-${String(month).padStart(2, '0')}-` : null;

    return this.expenses.filter(e => {
      if (monthPrefix) {
        return e.date.startsWith(monthPrefix);
      }
      return e.date.startsWith(yearPrefix);
    });
  }

  async getRecentExpenses(limit: number = 20): Promise<ActualExpense[]> {
    return [...this.expenses]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async saveExpense(expense: Omit<ActualExpense, 'expenseId' | 'createdAt' | 'updatedAt' | 'syncStatus'>): Promise<ActualExpense> {
    const now = new Date().toISOString();
    const newRecord: ActualExpense = {
      ...expense,
      expenseId: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      syncStatus: 'PENDING_SYNC',
      createdAt: now,
      updatedAt: now,
    };

    this.expenses.push(newRecord);
    return newRecord;
  }

  async updateExpense(id: string, updates: Partial<ActualExpense>): Promise<ActualExpense> {
    const index = this.expenses.findIndex(e => e.expenseId === id);
    if (index === 0 && this.expenses.length === 0) {
      throw new Error(`Expense ${id} not found`);
    }
    if (index === -1) {
      throw new Error(`Expense ${id} not found`);
    }

    const updated = {
      ...this.expenses[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.expenses[index] = updated;
    return updated;
  }

  async deleteExpense(id: string): Promise<void> {
    this.expenses = this.expenses.filter(e => e.expenseId !== id);
  }

  async getPendingSyncExpenses(): Promise<ActualExpense[]> {
    return this.expenses.filter(e => e.syncStatus === 'PENDING_SYNC');
  }

  async markExpensesSynced(expenseIds: string[]): Promise<void> {
    const idSet = new Set(expenseIds);
    this.expenses = this.expenses.map(e => (idSet.has(e.expenseId) ? { ...e, syncStatus: 'SYNCED' } : e));
  }

  async exportArchive(): Promise<FullHouseholdArchive> {
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      householdId: 'local_household',
      categories: [...this.categories],
      expenses: [...this.expenses],
      annualOperations: {},
    };
  }

  async importArchive(archive: FullHouseholdArchive): Promise<void> {
    if (archive.categories) {
      this.categories = [...archive.categories];
    }
    if (archive.expenses) {
      this.expenses = [...archive.expenses];
    }
  }
}
