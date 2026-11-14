export const EXPENSE_SCHEMA_VERSION = '2';

export type ExpenseCacheResetAction = 'none' | 'mark-version-only' | 'clear-and-repull' | 'defer';

interface ExpenseCacheResetInput {
  storedVersion: string | null;
  /** True when the adapter mirrors a cloud database that can repopulate a cleared cache. */
  isCloudBacked: boolean;
  /** True when the cloud can be reached right now (online and signed in). */
  canReachCloud: boolean;
}

/**
 * Decides what to do about the one-time expense cache reset for the unified schema.
 * Clearing is only safe when the cache can be refilled from the cloud immediately; a local-only
 * store (localhost) has no other copy, so it must never be cleared.
 */
export function decideExpenseCacheReset({
  storedVersion,
  isCloudBacked,
  canReachCloud,
}: ExpenseCacheResetInput): ExpenseCacheResetAction {
  if (storedVersion === EXPENSE_SCHEMA_VERSION) return 'none';
  if (!isCloudBacked) return 'mark-version-only';
  return canReachCloud ? 'clear-and-repull' : 'defer';
}
