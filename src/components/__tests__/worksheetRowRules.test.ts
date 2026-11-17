import { describe, it, expect } from 'vitest';
import { isAiMatchCandidate, isUncategorized } from '../worksheetRowRules';
import { UNCATEGORIZED } from '../../shared/utils/merchantMatcher';

const row = (overrides: Partial<{ isPaymentTransfer: boolean; category: string; lineItem: string }> = {}) => ({
  isPaymentTransfer: false,
  category: 'Living',
  lineItem: 'Groceries',
  ...overrides,
});

describe('isUncategorized', () => {
  it('flags an uncategorized category or expense name', () => {
    expect(isUncategorized(row({ category: UNCATEGORIZED }))).toBe(true);
    expect(isUncategorized(row({ lineItem: UNCATEGORIZED }))).toBe(true);
    expect(isUncategorized(row())).toBe(false);
  });
});

describe('isAiMatchCandidate', () => {
  it('includes an uncategorized purchase', () => {
    expect(isAiMatchCandidate(row({ category: UNCATEGORIZED, lineItem: UNCATEGORIZED }))).toBe(true);
  });

  it('excludes a categorized row', () => {
    expect(isAiMatchCandidate(row())).toBe(false);
  });

  it('excludes an uncategorized payment or transfer', () => {
    expect(
      isAiMatchCandidate(row({ isPaymentTransfer: true, category: UNCATEGORIZED, lineItem: UNCATEGORIZED }))
    ).toBe(false);
  });

  it('is not affected by the duplicate flag', () => {
    const duplicate = { ...row({ category: UNCATEGORIZED, lineItem: UNCATEGORIZED }), isDuplicate: true };
    expect(isAiMatchCandidate(duplicate)).toBe(true);
  });
});
