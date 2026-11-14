import { StorageAdapter } from '../types/expenses';
import { AwsCloudStorageAdapter } from './AwsCloudStorageAdapter';
import { IndexedDbStorageAdapter } from './IndexedDbStorageAdapter';
import { InMemoryStorageAdapter } from './InMemoryStorageAdapter';
import { isLocalhostEnvironment } from '../utils/appMode';

let defaultAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!defaultAdapter) {
    if (typeof window !== 'undefined' && window.indexedDB) {
      if (isLocalhostEnvironment()) {
        defaultAdapter = new IndexedDbStorageAdapter();
      } else {
        defaultAdapter = new AwsCloudStorageAdapter(new IndexedDbStorageAdapter());
      }
    } else {
      defaultAdapter = new InMemoryStorageAdapter();
    }
  }
  return defaultAdapter;
}

export function setStorageAdapter(adapter: StorageAdapter): void {
  defaultAdapter = adapter;
}

export type ExpenseExportSource = 'cloud' | 'local';

export interface ExpenseExportData {
  records: Array<Record<string, unknown>>;
  source: ExpenseExportSource;
}

/**
 * Fetches every expense from the database backing the active operating mode.
 * - Production (AwsCloudStorageAdapter): AWS DynamoDB for the current household.
 * - Localhost / in-memory: the browser's local store only; AWS is never contacted.
 */
export async function fetchAllExpensesForExport(): Promise<ExpenseExportData> {
  const adapter = getStorageAdapter();
  const source: ExpenseExportSource = adapter instanceof AwsCloudStorageAdapter ? 'cloud' : 'local';
  if (!adapter.getAllExpensesFromCloud) {
    throw new Error('The active storage adapter does not support exporting all expenses.');
  }
  return { records: await adapter.getAllExpensesFromCloud(), source };
}

export * from '../types/expenses';
export * from './defaultCategories';
export * from './IndexedDbStorageAdapter';
export * from './InMemoryStorageAdapter';
export * from './AwsCloudStorageAdapter';
export * from './PlanSyncService';
