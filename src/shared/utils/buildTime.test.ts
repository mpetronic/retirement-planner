import { describe, it, expect } from 'vitest';
import { formatBuildTime } from './buildTime';

describe('formatBuildTime', () => {
  it('formats a valid ISO timestamp with date and time', () => {
    const result = formatBuildTime('2026-11-13T20:49:21.000Z', 'en-US');
    expect(result).toContain('2026');
    expect(result).toContain('Nov');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('returns the raw text when the timestamp cannot be parsed', () => {
    expect(formatBuildTime('not-a-date')).toBe('not-a-date');
  });

  it('returns a placeholder for an empty value', () => {
    expect(formatBuildTime('')).toBe('Unknown');
  });
});
