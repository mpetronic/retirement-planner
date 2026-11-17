import type { ActualExpense } from '../shared/types/expenses';

const CENTS_PER_DOLLAR = 100;
const SPLIT_GROUP_ID_PREFIX = 'split_';

/** A single non-negative decimal term such as "12", "12.", "12.99" or ".5". */
const AMOUNT_TERM_PATTERN = /^(\d+\.?\d*|\.\d+)$/;

export function toCents(dollars: number): number {
  return Math.round(dollars * CENTS_PER_DOLLAR);
}

export function fromCents(cents: number): number {
  return cents / CENTS_PER_DOLLAR;
}

/**
 * Parses an amount field that may hold a simple sum such as "12.99+8.50+22".
 * Returns the total in cents, 0 for an empty field, or null when the text is not a valid amount.
 */
export function parseAmountExpression(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (cleaned === '') return 0;

  let totalCents = 0;
  for (const term of cleaned.split('+')) {
    if (!AMOUNT_TERM_PATTERN.test(term)) return null;
    totalCents += toCents(parseFloat(term));
  }
  return totalCents;
}

export interface SplitBlockDraft {
  /** Local key for the block, only used by the UI. */
  key: string;
  catalogId: string;
  /** Set when the block edits an already stored expense row. */
  expenseId?: string;
  /** One text entry per item typed on the receipt; each may itself be a "+" expression. */
  amounts: string[];
}

/** Sum of a block's entries in cents. Invalid entries count as zero (the UI flags them separately). */
export function blockCents(amounts: string[]): number {
  return amounts.reduce((sum, text) => sum + (parseAmountExpression(text) ?? 0), 0);
}

export function hasInvalidAmount(amounts: string[]): boolean {
  return amounts.some(text => parseAmountExpression(text) === null);
}

export function allocatedCents(blocks: SplitBlockDraft[]): number {
  return blocks.reduce((sum, block) => sum + blockCents(block.amounts), 0);
}

export function remainingCents(totalCents: number, blocks: SplitBlockDraft[]): number {
  return totalCents - allocatedCents(blocks);
}

/**
 * Returns the block's amount entries with the receipt's unallocated remainder added.
 * The remainder fills a trailing empty entry when there is one, otherwise it is appended.
 */
export function withRemainderApplied(blocks: SplitBlockDraft[], blockKey: string, totalCents: number): SplitBlockDraft[] {
  const remaining = remainingCents(totalCents, blocks);
  if (remaining <= 0) return blocks;

  return blocks.map(block => {
    if (block.key !== blockKey) return block;
    const remainderText = fromCents(remaining).toFixed(2);
    const lastIndex = block.amounts.length - 1;
    if (lastIndex >= 0 && block.amounts[lastIndex].trim() === '') {
      return { ...block, amounts: [...block.amounts.slice(0, lastIndex), remainderText] };
    }
    return { ...block, amounts: [...block.amounts, remainderText] };
  });
}

export function newSplitGroupId(): string {
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  const uniquePart =
    webCrypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  return `${SPLIT_GROUP_ID_PREFIX}${uniquePart}`;
}

export interface DuplicateCandidate {
  date: string;
  amount: number;
  /** Number of category rows behind this candidate; 1 for an ordinary expense. */
  splitCount: number;
}

/**
 * Collapses split-receipt rows (same splitGroupId and date) into a single candidate whose amount is
 * the receipt total, so a statement charge for the whole receipt matches the group. Ordinary expenses
 * pass through unchanged.
 */
export function toDuplicateCandidates(
  expenses: Array<Pick<ActualExpense, 'date' | 'amount' | 'splitGroupId'>>
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  const groups = new Map<string, { date: string; cents: number; count: number }>();

  for (const expense of expenses) {
    if (!expense.splitGroupId) {
      candidates.push({ date: expense.date, amount: expense.amount, splitCount: 1 });
      continue;
    }
    const key = `${expense.splitGroupId}|${expense.date}`;
    const group = groups.get(key) ?? { date: expense.date, cents: 0, count: 0 };
    group.cents += toCents(expense.amount);
    group.count += 1;
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    candidates.push({ date: group.date, amount: fromCents(group.cents), splitCount: group.count });
  }
  return candidates;
}

let blockKeyCounter = 0;

export function newBlockKey(): string {
  blockKeyCounter += 1;
  return `blk_${Date.now()}_${blockKeyCounter}`;
}

export function emptyBlock(): SplitBlockDraft {
  return { key: newBlockKey(), catalogId: '', amounts: [''] };
}

/** Two same-amount entries this many days apart or fewer are treated as possible duplicates. */
export const POSSIBLE_DUPLICATE_DATE_WINDOW_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface PossibleDuplicateInfo {
  /** Identifies the group; members of one group share it. */
  groupId: number;
  /** Days between the earliest and latest entry in the group; 0 when all share one date. */
  daysApart: number;
  /** Earliest date in the group, for ordering groups. */
  groupFirstDate: string;
}

export interface PossibleDuplicates {
  /** Every flagged expense row, keyed by expenseId. Rows of a split receipt are all flagged. */
  byExpenseId: Map<string, PossibleDuplicateInfo>;
  /**
   * Rows suggested for deletion: everything but the earliest-created entry of a same-day group, or
   * the later-created entry of a two-entry near-date group. Larger near-date groups are left to the
   * user because they are more likely to be genuine repeat purchases.
   */
  extraExpenseIds: string[];
  groupCount: number;
}

interface DuplicateUnit {
  expenseIds: string[];
  dayNumber: number;
  date: string;
  cents: number;
  createdAt: string;
}

function toDayNumber(isoDate: string): number | null {
  const match = ISO_DATE_PATTERN.exec(isoDate || '');
  if (!match) return null;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / MS_PER_DAY);
}

/**
 * Finds stored expenses that may be duplicates of each other, using the import worksheet's rule
 * (same amount, split receipts counted once at the receipt total) with a date window, because a
 * hand-entered purchase and its bank posting can land on different days. Same-amount entries are
 * sorted by date and chained: an entry joins a group when it is within the window of the previous one.
 */
export function findPossibleDuplicates(
  expenses: Array<Pick<ActualExpense, 'expenseId' | 'date' | 'amount' | 'splitGroupId' | 'createdAt'>>,
  windowDays: number = POSSIBLE_DUPLICATE_DATE_WINDOW_DAYS
): PossibleDuplicates {
  const units: DuplicateUnit[] = [];
  const splitUnits = new Map<string, DuplicateUnit>();

  for (const expense of expenses) {
    const dayNumber = toDayNumber(expense.date);
    if (dayNumber === null) continue;
    const cents = toCents(expense.amount);
    const createdAt = expense.createdAt || '';

    if (!expense.splitGroupId) {
      units.push({ expenseIds: [expense.expenseId], dayNumber, date: expense.date, cents, createdAt });
      continue;
    }
    const key = `${expense.splitGroupId}|${expense.date}`;
    const unit = splitUnits.get(key);
    if (unit) {
      unit.expenseIds.push(expense.expenseId);
      unit.cents += cents;
      if (createdAt < unit.createdAt) unit.createdAt = createdAt;
    } else {
      splitUnits.set(key, { expenseIds: [expense.expenseId], dayNumber, date: expense.date, cents, createdAt });
    }
  }
  units.push(...splitUnits.values());

  const unitsByCents = new Map<number, DuplicateUnit[]>();
  for (const unit of units) {
    if (unit.cents === 0) continue;
    const sameAmount = unitsByCents.get(unit.cents);
    if (sameAmount) sameAmount.push(unit);
    else unitsByCents.set(unit.cents, [unit]);
  }

  const byExpenseId = new Map<string, PossibleDuplicateInfo>();
  const extraExpenseIds: string[] = [];
  let groupCount = 0;

  const recordGroup = (group: DuplicateUnit[]) => {
    if (group.length < 2) return;
    groupCount += 1;
    const daysApart = group[group.length - 1].dayNumber - group[0].dayNumber;
    const info: PossibleDuplicateInfo = { groupId: groupCount, daysApart, groupFirstDate: group[0].date };
    for (const unit of group) {
      for (const expenseId of unit.expenseIds) byExpenseId.set(expenseId, info);
    }

    const isSameDay = daysApart === 0;
    if (!isSameDay && group.length > 2) return;
    // Keep the earliest-created entry (stable for ties, so the earlier-dated one wins)
    const byCreation = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const unit of byCreation.slice(1)) extraExpenseIds.push(...unit.expenseIds);
  };

  for (const sameAmount of unitsByCents.values()) {
    if (sameAmount.length < 2) continue;
    sameAmount.sort((a, b) => a.dayNumber - b.dayNumber);
    let group: DuplicateUnit[] = [sameAmount[0]];
    for (const unit of sameAmount.slice(1)) {
      if (unit.dayNumber - group[group.length - 1].dayNumber <= windowDays) {
        group.push(unit);
      } else {
        recordGroup(group);
        group = [unit];
      }
    }
    recordGroup(group);
  }

  return { byExpenseId, extraExpenseIds, groupCount };
}
