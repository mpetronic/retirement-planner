/** Classification rules for rows in the Expense Statement Ingestion Worksheet. */
import { UNCATEGORIZED } from '../shared/utils/merchantMatcher';

/** True when the row has no real category or expense name yet. */
export const isUncategorized = (row: { category: string; lineItem: string }): boolean =>
  row.category === UNCATEGORIZED || row.lineItem === UNCATEGORIZED;

/**
 * True when Smart Match AI should try to categorize the row. Payments and transfers are tagged
 * Uncategorized on load but are never stored, so they are never candidates.
 */
export const isAiMatchCandidate = (row: {
  isPaymentTransfer: boolean;
  category: string;
  lineItem: string;
}): boolean => !row.isPaymentTransfer && isUncategorized(row);
