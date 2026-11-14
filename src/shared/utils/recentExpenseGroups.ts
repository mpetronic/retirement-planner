import type { ActualExpense } from '../types/expenses';

export type RecentSortMode = 'occurred' | 'entered';

export interface RecentExpenseDayGroup {
  /** Local calendar day, formatted YYYY-MM-DD */
  dayKey: string;
  label: string;
  expenses: ActualExpense[];
}

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** YYYY-MM-DD for a Date, using its local calendar day. */
export function toLocalDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * The day an expense belongs to for the active sort. Occurred dates are already plain
 * calendar days. Logged timestamps are converted to the viewer's local day.
 */
export function getExpenseDayKey(expense: ActualExpense, sortBy: RecentSortMode): string {
  if (sortBy === 'entered' && expense.createdAt) {
    const logged = new Date(expense.createdAt);
    if (!Number.isNaN(logged.getTime())) return toLocalDayKey(logged);
  }
  const match = DAY_KEY_PATTERN.exec(expense.date || '');
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

/** "Today", "Yesterday", otherwise a short weekday and date such as "Wed, Nov 11". */
export function formatDayLabel(dayKey: string, now: Date = new Date()): string {
  const match = DAY_KEY_PATTERN.exec(dayKey);
  if (!match) return 'Unknown date';

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const target = new Date(year, monthIndex, day);

  if (dayKey === toLocalDayKey(now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey === toLocalDayKey(yesterday)) return 'Yesterday';

  const options: Intl.DateTimeFormatOptions =
    year === now.getFullYear()
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  return target.toLocaleDateString(undefined, options);
}

/**
 * Splits an already-sorted list into consecutive day groups, preserving the incoming order.
 * Non-adjacent rows from the same day start a new group rather than being reordered.
 */
export function groupExpensesByDay(
  expenses: ActualExpense[],
  sortBy: RecentSortMode,
  now: Date = new Date()
): RecentExpenseDayGroup[] {
  const groups: RecentExpenseDayGroup[] = [];
  for (const expense of expenses) {
    const dayKey = getExpenseDayKey(expense, sortBy);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) {
      last.expenses.push(expense);
    } else {
      groups.push({ dayKey, label: formatDayLabel(dayKey, now), expenses: [expense] });
    }
  }
  return groups;
}
