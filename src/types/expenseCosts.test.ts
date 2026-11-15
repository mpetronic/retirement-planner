import { describe, it, expect } from 'vitest';
import { normalizeDetailedExpenses, resolveExpenseCost } from './index';

describe('resolveExpenseCost', () => {
  const costs = {
    MD: { rent: 100, only_md: 50 },
    ALL: { rent: 10, shared: 7 },
  };

  it('prefers the state entry, then the all-states entry, then zero', () => {
    expect(resolveExpenseCost(costs, 'MD', 'rent')).toBe(100);
    expect(resolveExpenseCost(costs, 'TX', 'rent')).toBe(10);
    expect(resolveExpenseCost(costs, 'TX', 'shared')).toBe(7);
  });

  it('never falls back to another state', () => {
    expect(resolveExpenseCost(costs, 'TX', 'only_md')).toBe(0);
    expect(resolveExpenseCost(undefined, 'TX', 'rent')).toBe(0);
  });
});

describe('normalizeDetailedExpenses', () => {
  it('starts with no states and no mirror fields', () => {
    const norm = normalizeDetailedExpenses(undefined) as unknown as Record<string, unknown>;
    expect(norm.states).toEqual([]);
    expect(norm.costs).toEqual({});
    expect('MD' in norm).toBe(false);
    expect('FL' in norm).toBe(false);
  });

  it('keeps any state present in costs and drops legacy mirror fields', () => {
    const norm = normalizeDetailedExpenses({
      catalog: { categories: ['Living'], items: [] },
      costs: { TX: { rent: 5 } },
      frequencies: {},
      MD: { rent: 9 },
    }) as unknown as Record<string, unknown>;
    expect(norm.states).toEqual(expect.arrayContaining(['TX', 'MD']));
    expect((norm.costs as Record<string, unknown>).MD).toEqual({ rent: 9 });
    expect('MD' in norm).toBe(false);
  });

  it('migrates the legacy top-level per-state format into costs', () => {
    const norm = normalizeDetailedExpenses({
      MD: { groceries: 800 },
      FL: { groceries: 700 },
      frequencies: { groceries: 12 },
    });
    expect(norm.costs.MD.groceries).toBe(800);
    expect(norm.costs.FL.groceries).toBe(700);
    expect(norm.catalog.items.map((i) => i.id)).toContain('groceries');
    expect(norm.states).toEqual(expect.arrayContaining(['MD', 'FL']));
  });
});
