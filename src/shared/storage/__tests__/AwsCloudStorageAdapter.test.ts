import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AwsCloudStorageAdapter } from '../AwsCloudStorageAdapter';
import { InMemoryStorageAdapter } from '../InMemoryStorageAdapter';
import { AuthService } from '../../auth/AuthService';

import { IndexedDbStorageAdapter } from '../IndexedDbStorageAdapter';

const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe('AwsCloudStorageAdapter', () => {
  let adapter: AwsCloudStorageAdapter;
  let mockLocal: InMemoryStorageAdapter;

  beforeEach(() => {
    const mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
    vi.stubGlobal('window', {
      localStorage: mockStorage,
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('navigator', {
      onLine: true,
    });
    AuthService.signOut();
    vi.restoreAllMocks();
    mockLocal = new InMemoryStorageAdapter();
    adapter = new AwsCloudStorageAdapter(mockLocal as unknown as IndexedDbStorageAdapter);
  });

  it('saves and retrieves expenses locally', async () => {
    const expense = await adapter.saveExpense({
      date: '2026-09-25',
      amount: 45.5,
      categoryId: 'cat_groceries',
      categoryName: 'Living - Groceries',
      enteredBy: 'Mike',
    });

    expect(expense.expenseId).toBeDefined();
    expect(expense.syncStatus).toBe('PENDING_SYNC');

    const expenses = await adapter.getExpenses(2026, 9);
    expect(expenses.length).toBe(1);
    expect(expenses[0].amount).toBe(45.5);
  });

  it('saves and retrieves categories', async () => {
    const category = await adapter.saveCategory({
      id: 'cat_coffee',
      name: 'Living - Coffee',
      plannedMonthlyDefault: 50,
    });

    expect(category.id).toBe('cat_coffee');
    const allCats = await adapter.getCategories();
    expect(allCats.some(c => c.id === 'cat_coffee')).toBe(true);
  });

  it('flushes pending expenses when authenticated', async () => {
    // Save expense while unauthenticated
    await adapter.saveExpense({
      date: '2026-09-25',
      amount: 100,
      categoryId: 'cat_dining',
      categoryName: 'Leisure - Dining',
      enteredBy: 'Mike',
    });

    const pendingBefore = await adapter.getPendingSyncExpenses();
    expect(pendingBefore.length).toBe(1);

    // Authenticate
    vi.spyOn(AuthService, 'isAuthenticated').mockReturnValue(true);
    vi.spyOn(AuthService, 'getIdToken').mockResolvedValue('mock_token');

    // Mock API Gateway batch response
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', count: 1 }),
    } as unknown as Response);

    const result = await adapter.flushPendingExpenses();
    expect(result.syncedCount).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const pendingAfter = await adapter.getPendingSyncExpenses();
    expect(pendingAfter.length).toBe(0);
  });
});
