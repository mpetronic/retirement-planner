/**
 * A reimbursable expense is money paid on someone else's behalf that will be paid back, such as
 * the friend's half of a shared purchase. It is logged so receipts still reconcile to card
 * statements, but it is not the household's own spending and is left out of every spending total.
 */
export const REIMBURSABLE_CATALOG_ID = 'reimbursable';
export const REIMBURSABLE_GROUP = 'Reimbursable';
export const REIMBURSABLE_NAME = 'Paid for others';
export const REIMBURSABLE_DISPLAY_NAME = `${REIMBURSABLE_GROUP} - ${REIMBURSABLE_NAME}`;

/** True when the expense is logged against the built-in reimbursable item. */
export function isReimbursableExpense(expense: { catalogId?: string; categoryId?: string }): boolean {
  const id = expense.catalogId || expense.categoryId || '';
  return id.toLowerCase() === REIMBURSABLE_CATALOG_ID;
}

/** Keeps only expenses that count as the household's own spending. */
export function excludeReimbursable<T extends { catalogId?: string; categoryId?: string }>(expenses: T[]): T[] {
  return expenses.filter((expense) => !isReimbursableExpense(expense));
}
