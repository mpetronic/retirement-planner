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
