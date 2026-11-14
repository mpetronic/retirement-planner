import { describe, it, expect } from 'vitest';
import {
  parseAmountExpression,
  blockCents,
  remainingCents,
  withRemainderApplied,
  toDuplicateCandidates,
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

describe('newSplitGroupId', () => {
  it('is prefixed and unique', () => {
    const a = newSplitGroupId();
    expect(a.startsWith('split_')).toBe(true);
    expect(a).not.toBe(newSplitGroupId());
  });
});
