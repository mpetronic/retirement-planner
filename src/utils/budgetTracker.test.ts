import { describe, it, expect } from 'vitest';
import { computeBudgetTracker, cumulate, budgetBarGeometry, budgetBarLabel, summarizeLoggedSpending } from './budgetTracker';

describe('computeBudgetTracker', () => {
  const budget = Array(12).fill(100);

  it('treats a past year as fully elapsed', () => {
    const actual = Array(12).fill(120);
    const m = computeBudgetTracker(actual, budget, 2024, new Date(2026, 5, 15));
    expect(m.lastIdx).toBe(11);
    expect(m.ytdActual).toBe(1440);
    expect(m.ytdBudget).toBe(1200);
    expect(m.projectedYearEnd).toBe(1440);
  });

  it('stops at the current month and projects the rest at pace', () => {
    const actual = [150, 150, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const m = computeBudgetTracker(actual, budget, 2026, new Date(2026, 1, 10));
    expect(m.lastIdx).toBe(1);
    expect(m.ytdActual).toBe(300);
    expect(m.ytdBudget).toBe(200);
    // pace 1.5 applied to the 10 remaining budget months
    expect(m.projectedYearEnd).toBe(300 + 10 * 100 * 1.5);
    expect(m.variance[2]).toBeNull();
    expect(m.variance[0]).toBe(-50);
  });

  it('has nothing elapsed for a future year', () => {
    const m = computeBudgetTracker(Array(12).fill(0), budget, 2027, new Date(2026, 5, 15));
    expect(m.hasElapsed).toBe(false);
    expect(m.ytdActual).toBe(0);
    expect(m.projection.every((v) => v === null)).toBe(true);
  });

  it('cumulates', () => {
    expect(cumulate([1, 2, 3])).toEqual([1, 3, 6]);
  });
});

describe('budgetBarGeometry', () => {
  it('shows an under-budget row with the marker at the end of the track', () => {
    const g = budgetBarGeometry(78, 100);
    expect(g.status).toBe('under');
    expect(g.fill).toBeCloseTo(0.78);
    expect(g.marker).toBe(1);
    expect(budgetBarLabel(g)).toBe('22% (under)');
  });

  it('shows an over-budget row with the marker inside the filled bar', () => {
    const g = budgetBarGeometry(163, 100);
    expect(g.status).toBe('over');
    expect(g.fill).toBe(1);
    expect(g.marker).toBeCloseTo(100 / 163);
    expect(budgetBarLabel(g)).toBe('63% (over)');
  });

  it('caps the scale at twice the budget', () => {
    const g = budgetBarGeometry(500, 100);
    expect(g.clamped).toBe(true);
    expect(g.fill).toBe(1);
    expect(g.marker).toBe(0.5);
    expect(budgetBarLabel(g)).toBe('400% (over)');
  });

  it('reports on budget when the difference rounds to zero', () => {
    expect(budgetBarLabel(budgetBarGeometry(100.2, 100))).toBe('On budget');
  });

  it('handles spend with no budget and nothing at all', () => {
    const noBudget = budgetBarGeometry(50, 0);
    expect(noBudget.marker).toBeNull();
    expect(noBudget.fill).toBe(1);
    expect(budgetBarLabel(noBudget)).toBe('No budget');
    const none = budgetBarGeometry(0, 0);
    expect(none.fill).toBe(0);
    expect(budgetBarLabel(none)).toBe('');
  });
});

describe('summarizeLoggedSpending', () => {
  const exp = (amount: number, categoryName: string, category?: string) => ({ amount, categoryName, category });

  it('totals every expense regardless of bucket', () => {
    const s = summarizeLoggedSpending([
      exp(1000, 'Groceries - Food', 'Groceries'),
      exp(200, 'Healthcare - Copay', 'Healthcare'),
      exp(300, 'Healthcare - Medicare Part B', 'Healthcare'),
      exp(50, 'Healthcare - IRMAA', 'Healthcare'),
    ]);
    expect(s.total).toBe(1550);
    expect(s.living).toBe(1000);
    expect(s.healthcareOOP).toBe(200);
    expect(s.premiums).toBe(300);
    expect(s.irmaa).toBe(50);
  });

  it('is not shrunk by a small batch because it sums whatever list it is given', () => {
    const year = Array.from({ length: 10 }, () => exp(7000, 'Housing - Rent', 'Housing'));
    expect(summarizeLoggedSpending(year).total).toBe(70000);
  });
});
