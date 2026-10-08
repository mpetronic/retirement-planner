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

/**
 * Fetches all expenses recorded in AWS DynamoDB for the current household.
 * Connects directly through the cloud API endpoint using authenticated credentials.
 */
export async function fetchAllExpensesFromDynamoDb(): Promise<Array<Record<string, unknown>>> {
  const adapter = getStorageAdapter();
  if (adapter instanceof AwsCloudStorageAdapter && adapter.getAllExpensesFromCloud) {
    return adapter.getAllExpensesFromCloud();
  }
  const cloud = new AwsCloudStorageAdapter();
  return cloud.getAllExpensesFromCloud();
}

export * from '../types/expenses';
export * from './defaultCategories';
export * from './IndexedDbStorageAdapter';
export * from './InMemoryStorageAdapter';
export * from './AwsCloudStorageAdapter';
export * from './PlanSyncService';
