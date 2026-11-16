import { describe, it, expect } from 'vitest';
import {
  parseAmountExpression,
  blockCents,
  remainingCents,
  withRemainderApplied,
  toDuplicateCandidates,
  findPossibleDuplicates,
  POSSIBLE_DUPLICATE_DATE_WINDOW_DAYS,
  newSplitGroupId,
  hasInvalidAmount,
  type SplitBlockDraft,
} from '../expenseSplit';

const block = (key: string, amounts: string[]): SplitBlockDraft => ({ key, catalogId: key, amounts });

describe('parseAmountExpression', () => {
  it('parses single values and sums', () => {
    expect(parseAmountExpression('12.99')).toBe(1299);
    expect(parseAmountExpression('12.99+8.5+22')).toBe(4349);
    expect(parseAmountExpression(' $1,200.10 ')).toBe(120010);
  });
  it('treats empty as zero and rejects garbage', () => {
    expect(parseAmountExpression('')).toBe(0);
    expect(parseAmountExpression('abc')).toBeNull();
    expect(parseAmountExpression('5+')).toBeNull();
    expect(parseAmountExpression('-5')).toBeNull();
  });
  it('avoids floating point drift', () => {
    expect(parseAmountExpression('0.1+0.2')).toBe(30);
  });
});

describe('split balance', () => {
  const blocks = [block('a', ['25']), block('b', ['12.99', '8.5', '22']), block('c', [''])];
  it('sums blocks and computes remaining', () => {
    expect(blockCents(blocks[1].amounts)).toBe(4349);
    expect(remainingCents(20000, blocks)).toBe(20000 - 2500 - 4349);
  });
  it('flags invalid entries', () => {
    expect(hasInvalidAmount(['1', 'x'])).toBe(true);
    expect(hasInvalidAmount(['1', ''])).toBe(false);
  });
  it('applies the remainder into the trailing empty entry', () => {
    const next = withRemainderApplied(blocks, 'c', 20000);
    expect(next[2].amounts).toEqual(['131.51']);
    expect(remainingCents(20000, next)).toBe(0);
  });
  it('appends the remainder when no empty entry exists', () => {
    const next = withRemainderApplied([block('a', ['25'])], 'a', 10000);
    expect(next[0].amounts).toEqual(['25', '75.00']);
  });
  it('does nothing when over-allocated', () => {
    const over = [block('a', ['300'])];
    expect(withRemainderApplied(over, 'a', 20000)).toBe(over);
  });
});

describe('toDuplicateCandidates', () => {
  it('collapses split groups into one candidate at the receipt total', () => {
    const result = toDuplicateCandidates([
      { date: '2026-11-04', amount: 25, splitGroupId: 'g1' },
      { date: '2026-11-04', amount: 50, splitGroupId: 'g1' },
      { date: '2026-11-04', amount: 90, splitGroupId: 'g1' },
      { date: '2026-11-04', amount: 35, splitGroupId: 'g1' },
      { date: '2026-11-05', amount: 12.34 },
    ]);
    expect(result).toEqual([
      { date: '2026-11-05', amount: 12.34, splitCount: 1 },
      { date: '2026-11-04', amount: 200, splitCount: 4 },
    ]);
  });
  it('keeps separate groups separate', () => {
    const result = toDuplicateCandidates([
      { date: '2026-11-04', amount: 10, splitGroupId: 'g1' },
      { date: '2026-11-04', amount: 20, splitGroupId: 'g2' },
    ]);
    expect(result).toHaveLength(2);
  });
});

describe('findPossibleDuplicates', () => {
  const row = (expenseId: string, date: string, amount: number, createdAt: string, splitGroupId?: string) => ({
    expenseId,
    date,
    amount,
    createdAt,
    splitGroupId,
  });

  it('flags same-day same-amount entries and suggests all but the earliest created', () => {
    const result = findPossibleDuplicates([
      row('manual', '2026-03-10', 42.5, '2026-03-10T12:00:00Z'),
      row('imported', '2026-03-10', 42.5, '2026-04-01T09:00:00Z'),
      row('other', '2026-03-10', 42.51, '2026-03-10T12:00:00Z'),
    ]);
    expect(result.groupCount).toBe(1);
    expect([...result.byExpenseId.keys()].sort()).toEqual(['imported', 'manual']);
    expect(result.byExpenseId.get('manual')!.daysApart).toBe(0);
    expect(result.extraExpenseIds).toEqual(['imported']);
  });

  it('matches entries within the date window, including across a month end', () => {
    const result = findPossibleDuplicates([
      row('manual', '2026-02-27', 80, '2026-02-27T12:00:00Z'),
      row('posted', '2026-03-02', 80, '2026-03-05T09:00:00Z'),
    ]);
    expect(POSSIBLE_DUPLICATE_DATE_WINDOW_DAYS).toBe(3);
    expect(result.byExpenseId.get('posted')!.daysApart).toBe(3);
    expect(result.byExpenseId.get('posted')!.groupFirstDate).toBe('2026-02-27');
    expect(result.extraExpenseIds).toEqual(['posted']);
  });

  it('does not match entries outside the window', () => {
    const result = findPossibleDuplicates([
      row('a', '2026-03-01', 80, '2026-03-01T12:00:00Z'),
      row('b', '2026-03-05', 80, '2026-03-05T12:00:00Z'),
    ]);
    expect(result.groupCount).toBe(0);
    expect(result.byExpenseId.size).toBe(0);
  });

  it('flags a chain of near-date repeats but suggests none of them for deletion', () => {
    const result = findPossibleDuplicates([
      row('mon', '2026-03-02', 5, '2026-03-02T08:00:00Z'),
      row('wed', '2026-03-04', 5, '2026-03-04T08:00:00Z'),
      row('fri', '2026-03-06', 5, '2026-03-06T08:00:00Z'),
    ]);
    expect(result.groupCount).toBe(1);
    expect(result.byExpenseId.size).toBe(3);
    expect(result.byExpenseId.get('mon')!.daysApart).toBe(4);
    expect(result.extraExpenseIds).toEqual([]);
  });

  it('counts a split receipt once at its total and flags every row of it', () => {
    const result = findPossibleDuplicates([
      row('split-a', '2026-11-04', 25, '2026-11-04T10:00:00Z', 'g1'),
      row('split-b', '2026-11-04', 75, '2026-11-04T10:00:00Z', 'g1'),
      row('statement', '2026-11-05', 100, '2026-11-20T10:00:00Z'),
      row('unrelated', '2026-11-04', 25, '2026-11-04T10:00:00Z'),
    ]);
    expect([...result.byExpenseId.keys()].sort()).toEqual(['split-a', 'split-b', 'statement']);
    expect(result.extraExpenseIds).toEqual(['statement']);
  });

  it('keeps the split receipt and suggests its rows only when it was created later', () => {
    const result = findPossibleDuplicates([
      row('statement', '2026-11-04', 100, '2026-11-01T10:00:00Z'),
      row('split-a', '2026-11-04', 25, '2026-11-10T10:00:00Z', 'g1'),
      row('split-b', '2026-11-04', 75, '2026-11-10T10:00:00Z', 'g1'),
    ]);
    expect(result.extraExpenseIds.sort()).toEqual(['split-a', 'split-b']);
  });

  it('ignores zero amounts and unparseable dates', () => {
    const result = findPossibleDuplicates([
      row('z1', '2026-03-01', 0, ''),
      row('z2', '2026-03-01', 0, ''),
      row('bad1', 'not-a-date', 10, ''),
      row('bad2', 'not-a-date', 10, ''),
    ]);
    expect(result.groupCount).toBe(0);
  });
});

describe('newSplitGroupId', () => {
  it('is prefixed and unique', () => {
    const a = newSplitGroupId();
    expect(a.startsWith('split_')).toBe(true);
    expect(a).not.toBe(newSplitGroupId());
  });
});
