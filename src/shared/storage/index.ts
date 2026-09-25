import { StorageAdapter } from '../types/expenses';
import { IndexedDbStorageAdapter } from './IndexedDbStorageAdapter';
import { InMemoryStorageAdapter } from './InMemoryStorageAdapter';

let defaultAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!defaultAdapter) {
    if (typeof window !== 'undefined' && window.indexedDB) {
      defaultAdapter = new IndexedDbStorageAdapter();
    } else {
      defaultAdapter = new InMemoryStorageAdapter();
    }
  }
  return defaultAdapter;
}

export function setStorageAdapter(adapter: StorageAdapter): void {
  defaultAdapter = adapter;
}

export * from '../types/expenses';
export * from './defaultCategories';
export * from './IndexedDbStorageAdapter';
export * from './InMemoryStorageAdapter';
