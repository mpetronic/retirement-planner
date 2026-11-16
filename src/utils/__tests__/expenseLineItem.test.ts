import { describe, it, expect } from 'vitest';
import { getExpenseLineItemIdentity } from '../expenseLineItem';

const expense = (overrides: Partial<Parameters<typeof getExpenseLineItemIdentity>[0]>) => ({
  catalogId: '',
  category: '',
  name: '',
  ...overrides,
});

describe('getExpenseLineItemIdentity', () => {
  it('keeps same-named expenses under different categories apart', () => {
    const homeGas = getExpenseLineItemIdentity(expense({ catalogId: 'cat_home_gas', category: 'Home', name: 'Gas' }));
    const autoGas = getExpenseLineItemIdentity(expense({ catalogId: 'cat_auto_gas', category: 'Auto', name: 'Gas' }));
    expect(homeGas.itemName).toBe(autoGas.itemName);
    expect(homeGas.key).not.toBe(autoGas.key);
  });

  it('separates same-named expenses by category when there is no catalog id', () => {
    const homeGas = getExpenseLineItemIdentity(expense({ category: 'Home', name: 'Gas' }));
    const autoGas = getExpenseLineItemIdentity(expense({ category: 'Auto', name: 'Gas' }));
    expect(homeGas.key).toBe('cat_Home_Gas');
    expect(autoGas.key).toBe('cat_Auto_Gas');
  });

  it('prefers the catalog id, then the legacy category id', () => {
    expect(getExpenseLineItemIdentity(expense({ catalogId: 'a', categoryId: 'b', category: 'Home', name: 'Gas' })).key).toBe('a');
    expect(getExpenseLineItemIdentity(expense({ categoryId: 'b', category: 'Home', name: 'Gas' })).key).toBe('b');
  });

  it('derives group and name from a legacy "Group - Name" label', () => {
    const identity = getExpenseLineItemIdentity(expense({ categoryName: 'Home - Gas - Winter' }));
    expect(identity).toEqual({ group: 'Home', itemName: 'Gas - Winter', key: 'cat_Home_Gas - Winter' });
  });

  it('falls back to placeholders when nothing identifies the expense', () => {
    expect(getExpenseLineItemIdentity(expense({}))).toEqual({ group: 'Uncategorized', itemName: 'Expense', key: 'cat_Uncategorized_Expense' });
  });
});
