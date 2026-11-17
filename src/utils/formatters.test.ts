import { describe, it, expect } from 'vitest';
import { formatSuccessRate } from './formatters';

describe('formatSuccessRate', () => {
  it('shows one failed trial out of 5,000 instead of rounding to 100%', () => {
    expect(formatSuccessRate(4999 / 5000)).toBe('99.98%');
  });

  it('formats a full success and zero', () => {
    expect(formatSuccessRate(1)).toBe('100.00%');
    expect(formatSuccessRate(0)).toBe('0.00%');
  });

  it('rounds to two decimals', () => {
    expect(formatSuccessRate(0.85)).toBe('85.00%');
    expect(formatSuccessRate(0.123456)).toBe('12.35%');
  });
});
