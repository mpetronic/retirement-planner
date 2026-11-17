import { describe, it, expect } from 'vitest';
import {
  REIMBURSABLE_CATALOG_ID,
  REIMBURSABLE_GROUP,
  REIMBURSABLE_NAME,
  isReimbursableExpense,
  excludeReimbursable,
} from './reimbursableExpense';
import { getPlannerExpenseCatalog, findCatalogItem } from './plannerCategories';
import { toDuplicateCandidates, findPossibleDuplicates } from '../../utils/expenseSplit';

describe('isReimbursableExpense', () => {
  it('recognises the built-in id on either id field', () => {
    expect(isReimbursableExpense({ catalogId: REIMBURSABLE_CATALOG_ID })).toBe(true);
    expect(isReimbursableExpense({ categoryId: REIMBURSABLE_CATALOG_ID })).toBe(true);
  });

  it('does not treat ordinary or unidentified expenses as reimbursable', () => {
    expect(isReimbursableExpense({ catalogId: 'gas' })).toBe(false);
    expect(isReimbursableExpense({})).toBe(false);
  });
});

describe('excludeReimbursable', () => {
  it('keeps only expenses that count as spending', () => {
    const wine = { catalogId: 'wine', amount: 20 };
    const friendsBottle = { catalogId: REIMBURSABLE_CATALOG_ID, amount: 20 };
    expect(excludeReimbursable([wine, friendsBottle])).toEqual([wine]);
  });
});

describe('built-in reimbursable catalog item', () => {
  it('is offered by the expense catalog and found by category and name', () => {
    const catalog = getPlannerExpenseCatalog();
    expect(findCatalogItem(catalog, REIMBURSABLE_GROUP, REIMBURSABLE_NAME)?.id).toBe(REIMBURSABLE_CATALOG_ID);
  });
});

describe('split receipt with a reimbursable part', () => {
  const split = [
    { expenseId: 'mine', date: '2026-11-10', amount: 20, splitGroupId: 'g1', createdAt: '2026-11-10T18:00:00Z', catalogId: 'wine' },
    { expenseId: 'hers', date: '2026-11-10', amount: 20, splitGroupId: 'g1', createdAt: '2026-11-10T18:00:00Z', catalogId: REIMBURSABLE_CATALOG_ID },
  ];

  it('still matches the card charge at the full receipt total', () => {
    expect(toDuplicateCandidates(split)).toEqual([{ date: '2026-11-10', amount: 40, splitCount: 2 }]);
  });

  it('is flagged against an imported row for the full charge', () => {
    const imported = { expenseId: 'card', date: '2026-11-11', amount: 40, createdAt: '2026-11-20T09:00:00Z', catalogId: 'wine' };
    const result = findPossibleDuplicates([...split, imported]);
    expect([...result.byExpenseId.keys()].sort()).toEqual(['card', 'hers', 'mine']);
    expect(result.extraExpenseIds).toEqual(['card']);
  });
});
