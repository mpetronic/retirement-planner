import { describe, it, expect } from 'vitest';
import type { ActualExpense } from '../types/expenses';
import { formatDayLabel, getExpenseDayKey, groupExpensesByDay } from './recentExpenseGroups';

const NOW = new Date(2026, 10, 13, 12, 0, 0); // Fri Nov 13 2026, local time

const makeExpense = (id: string, date: string, createdAt?: string): ActualExpense =>
  ({
    expenseId: id,
    date,
    amount: 10,
    categoryId: 'cat',
    categoryName: 'Living - Groceries',
    enteredBy: 'Mark',
    createdAt,
  }) as ActualExpense;

describe('formatDayLabel', () => {
  it('labels today and yesterday', () => {
    expect(formatDayLabel('2026-11-13', NOW)).toBe('Today');
    expect(formatDayLabel('2026-11-12', NOW)).toBe('Yesterday');
  });

  it('labels yesterday correctly across a month boundary', () => {
    const firstOfMonth = new Date(2026, 11, 1, 9, 0, 0);
    expect(formatDayLabel('2026-11-30', firstOfMonth)).toBe('Yesterday');
  });

  it('uses a short date for older days and adds the year for other years', () => {
    const sameYear = formatDayLabel('2026-11-05', NOW);
    expect(sameYear).toContain('5');
    expect(sameYear).not.toContain('2026');
    expect(formatDayLabel('2025-12-24', NOW)).toContain('2025');
  });

  it('falls back for an unparseable key', () => {
    expect(formatDayLabel('', NOW)).toBe('Unknown date');
  });
});

describe('getExpenseDayKey', () => {
  it('uses the occurred date when sorting by occurred', () => {
    const exp = makeExpense('a', '2026-11-10', '2026-11-12T12:00:00');
    expect(getExpenseDayKey(exp, 'occurred')).toBe('2026-11-10');
  });

  it('uses the local logged day when sorting by entered', () => {
    const exp = makeExpense('a', '2026-11-10', '2026-11-12T12:00:00');
    expect(getExpenseDayKey(exp, 'entered')).toBe('2026-11-12');
  });

  it('falls back to the occurred date when there is no logged time', () => {
    const exp = makeExpense('a', '2026-11-10');
    expect(getExpenseDayKey(exp, 'entered')).toBe('2026-11-10');
  });
});

describe('groupExpensesByDay', () => {
  it('groups consecutive rows from the same day and keeps the order', () => {
    const list = [
      makeExpense('a', '2026-11-13'),
      makeExpense('b', '2026-11-13'),
      makeExpense('c', '2026-11-12'),
    ];
    const groups = groupExpensesByDay(list, 'occurred', NOW);
    expect(groups.map(g => g.label)).toEqual(['Today', 'Yesterday']);
    expect(groups[0].expenses.map(e => e.expenseId)).toEqual(['a', 'b']);
    expect(groups[1].expenses.map(e => e.expenseId)).toEqual(['c']);
  });

  it('does not reorder rows when a day reappears later in the list', () => {
    const list = [
      makeExpense('a', '2026-11-13'),
      makeExpense('b', '2026-11-12'),
      makeExpense('c', '2026-11-13'),
    ];
    const groups = groupExpensesByDay(list, 'occurred', NOW);
    expect(groups.map(g => g.dayKey)).toEqual(['2026-11-13', '2026-11-12', '2026-11-13']);
  });

  it('returns no groups for an empty list', () => {
    expect(groupExpensesByDay([], 'occurred', NOW)).toEqual([]);
  });
});
