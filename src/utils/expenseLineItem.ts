import { ActualExpense } from '../shared/types/expenses';

const CATEGORY_NAME_SEPARATOR = ' - ';

/** The category group, expense name and grouping key that identify one row of the actuals list. */
export interface ExpenseLineItemIdentity {
  group: string;
  itemName: string;
  key: string;
}

type ExpenseLineItemFields = Pick<ActualExpense, 'catalogId' | 'category' | 'name' | 'categoryId' | 'categoryName'>;

/**
 * Resolves the line item a logged expense belongs to. The key is the catalog id when the expense
 * has one, so two expenses that share a name under different categories stay separate.
 * Both the per-row counts and the row breakdown must use this so they select the same expenses.
 */
export function getExpenseLineItemIdentity(expense: ExpenseLineItemFields): ExpenseLineItemIdentity {
  const legacyName = expense.categoryName || '';
  const hasLegacyGroup = legacyName.includes(CATEGORY_NAME_SEPARATOR);
  const legacyParts = legacyName.split(CATEGORY_NAME_SEPARATOR);

  const group = expense.category || (hasLegacyGroup ? legacyParts[0].trim() : legacyName || 'Uncategorized');
  const itemName = expense.name ||
    (hasLegacyGroup ? legacyParts.slice(1).join(CATEGORY_NAME_SEPARATOR).trim() : legacyName || 'Expense');
  const key = expense.catalogId || expense.categoryId || `cat_${group}_${itemName}`;

  return { group, itemName, key };
}
