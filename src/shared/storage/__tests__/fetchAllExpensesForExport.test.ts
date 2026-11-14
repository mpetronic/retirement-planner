import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAllExpensesForExport, setStorageAdapter } from '../index';
import { InMemoryStorageAdapter } from '../InMemoryStorageAdapter';
import { AwsCloudStorageAdapter } from '../AwsCloudStorageAdapter';

describe('fetchAllExpensesForExport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the local adapter without contacting AWS', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const cloudSpy = vi.spyOn(AwsCloudStorageAdapter.prototype, 'getAllExpensesFromCloud');

    const local = new InMemoryStorageAdapter();
    await local.saveExpense({
      date: '2026-09-24',
      amount: 12.5,
      categoryId: 'cat_dining',
      categoryName: 'Dining - Lunch',
      enteredBy: 'Primary',
    });
    setStorageAdapter(local);

    const result = await fetchAllExpensesForExport();

    expect(result.source).toBe('local');
    expect(result.records).toHaveLength(1);
    expect(cloudSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('reads DynamoDB through the cloud adapter when it is active', async () => {
    const cloud = new AwsCloudStorageAdapter();
    const cloudSpy = vi
      .spyOn(cloud, 'getAllExpensesFromCloud')
      .mockResolvedValue([{ expenseId: 'e1' }]);
    setStorageAdapter(cloud);

    const result = await fetchAllExpensesForExport();

    expect(result.source).toBe('cloud');
    expect(result.records).toEqual([{ expenseId: 'e1' }]);
    expect(cloudSpy).toHaveBeenCalledOnce();
  });
});
