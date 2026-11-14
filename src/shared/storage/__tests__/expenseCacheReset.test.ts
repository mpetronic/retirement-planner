import { describe, it, expect } from 'vitest';
import { decideExpenseCacheReset } from '../expenseCacheReset';

describe('decideExpenseCacheReset', () => {
  it('does nothing when already on the current schema', () => {
    expect(decideExpenseCacheReset({ storedVersion: '2', isCloudBacked: true, canReachCloud: true })).toBe('none');
  });
  it('never clears a local-only store', () => {
    expect(decideExpenseCacheReset({ storedVersion: null, isCloudBacked: false, canReachCloud: false })).toBe('mark-version-only');
    expect(decideExpenseCacheReset({ storedVersion: '1', isCloudBacked: false, canReachCloud: true })).toBe('mark-version-only');
  });
  it('clears and re-pulls only when the cloud is reachable', () => {
    expect(decideExpenseCacheReset({ storedVersion: null, isCloudBacked: true, canReachCloud: true })).toBe('clear-and-repull');
  });
  it('defers when cloud-backed but offline or signed out', () => {
    expect(decideExpenseCacheReset({ storedVersion: null, isCloudBacked: true, canReachCloud: false })).toBe('defer');
  });
});
