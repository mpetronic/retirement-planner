import { describe, it, expect } from 'vitest';
import {
  MAX_IGNORE_PATTERN_LENGTH,
  compileIgnorePatterns,
  isIgnoredByPatterns,
  replaceIgnorePattern,
  validateIgnorePattern,
} from './ignoreRules';

describe('validateIgnorePattern', () => {
  it('accepts a normal regex', () => {
    expect(validateIgnorePattern('DIVIDEND|INTEREST')).toBeNull();
  });

  it('rejects blank, invalid, and over-long patterns', () => {
    expect(validateIgnorePattern('   ')).not.toBeNull();
    expect(validateIgnorePattern('(unclosed')).not.toBeNull();
    expect(validateIgnorePattern('a'.repeat(MAX_IGNORE_PATTERN_LENGTH + 1))).not.toBeNull();
  });
});

describe('compileIgnorePatterns', () => {
  it('skips blank and invalid entries without throwing', () => {
    expect(compileIgnorePatterns(['DIVIDEND', '', '(bad', '  '])).toHaveLength(1);
    expect(compileIgnorePatterns(undefined)).toEqual([]);
  });
});

describe('isIgnoredByPatterns', () => {
  const regexes = compileIgnorePatterns([
    'DIVIDEND|INTEREST',
    'PAYMENT.*CAPITAL ONE',
    'TRANSFER (TO|FROM).*SAVINGS',
  ]);

  it('matches dividends, interest, card payments and savings transfers', () => {
    expect(isIgnoredByPatterns('Interest Earned 03/31', regexes)).toBe(true);
    expect(isIgnoredByPatterns('ANNUAL DIVIDEND PAID', regexes)).toBe(true);
    expect(isIgnoredByPatterns('Online payment to CAPITAL ONE', regexes)).toBe(true);
    expect(isIgnoredByPatterns('Transfer to Savings x1234', regexes)).toBe(true);
  });

  it('is case-insensitive and leaves ordinary purchases alone', () => {
    expect(isIgnoredByPatterns('dividend', regexes)).toBe(true);
    expect(isIgnoredByPatterns('GIANT FOOD #123', regexes)).toBe(false);
  });

  it('matches nothing when there are no patterns', () => {
    expect(isIgnoredByPatterns('INTEREST', [])).toBe(false);
  });
});

describe('replaceIgnorePattern', () => {
  const list = ['DIVIDEND', 'INTEREST', 'TRANSFER.*SAVINGS'];

  it('replaces the pattern in place, trimmed, keeping the order', () => {
    expect(replaceIgnorePattern(list, 1, '  INTEREST EARNED ')).toEqual({
      patterns: ['DIVIDEND', 'INTEREST EARNED', 'TRANSFER.*SAVINGS'],
    });
  });

  it('allows saving a pattern unchanged', () => {
    expect(replaceIgnorePattern(list, 0, 'DIVIDEND')).toEqual({ patterns: list });
  });

  it('rejects blank, invalid, and too-long text', () => {
    expect('error' in replaceIgnorePattern(list, 0, '  ')).toBe(true);
    expect('error' in replaceIgnorePattern(list, 0, '(bad')).toBe(true);
    expect('error' in replaceIgnorePattern(list, 0, 'a'.repeat(MAX_IGNORE_PATTERN_LENGTH + 1))).toBe(true);
  });

  it('rejects a duplicate of another pattern', () => {
    expect(replaceIgnorePattern(list, 0, 'INTEREST')).toEqual({ error: 'That pattern is already in the list.' });
  });

  it('rejects an index that is out of range', () => {
    expect('error' in replaceIgnorePattern(list, 5, 'X')).toBe(true);
    expect('error' in replaceIgnorePattern(list, -1, 'X')).toBe(true);
  });

  it('does not change the original list', () => {
    replaceIgnorePattern(list, 0, 'CHANGED');
    expect(list[0]).toBe('DIVIDEND');
  });
});
