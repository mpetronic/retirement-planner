import { describe, it, expect } from 'vitest';
import { getWorksheetRowClassName } from '../worksheetRowStyle';

const row = (overrides: Partial<{ isPaymentTransfer: boolean; isDuplicate: boolean }> = {}) => ({
  isPaymentTransfer: false,
  isDuplicate: false,
  ...overrides,
});

describe('getWorksheetRowClassName', () => {
  it('uses the slate hover for a normal row', () => {
    const cls = getWorksheetRowClassName(row(), false);
    expect(cls).toContain('hover:bg-slate-50');
    expect(cls).not.toContain('amber');
  });

  it('tints a row that needs an expense name amber with a left edge', () => {
    const cls = getWorksheetRowClassName(row(), true);
    expect(cls).toContain('bg-amber-50/40');
    expect(cls).toContain('dark:bg-amber-400/10');
    expect(cls).toContain('border-l-4');
  });

  it('mutes duplicates with no background tint', () => {
    const cls = getWorksheetRowClassName(row({ isDuplicate: true }), false);
    expect(cls).toContain('text-slate-500');
    expect(cls).not.toMatch(/\bbg-|dark:bg-|hover:/);
    expect(cls).not.toContain('opacity-40');
  });

  it('mutes and dims payments with no background tint', () => {
    const cls = getWorksheetRowClassName(row({ isPaymentTransfer: true }), false);
    expect(cls).toContain('opacity-40');
    expect(cls).not.toMatch(/\bbg-|dark:bg-|hover:/);
  });

  it('keeps duplicates and payments muted even when they also need a name', () => {
    expect(getWorksheetRowClassName(row({ isDuplicate: true }), true)).not.toContain('amber');
    expect(getWorksheetRowClassName(row({ isPaymentTransfer: true }), true)).not.toContain('amber');
  });

  it('treats a payment that is also a duplicate as a payment', () => {
    const cls = getWorksheetRowClassName(row({ isPaymentTransfer: true, isDuplicate: true }), false);
    expect(cls).toContain('opacity-40');
  });
});
