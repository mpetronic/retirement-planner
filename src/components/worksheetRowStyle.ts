/** Row styling for the Expense Statement Ingestion Worksheet. */

/** Fields of a worksheet row that decide how its table row is colored. */
export interface WorksheetRowStyleInput {
  isPaymentTransfer: boolean;
  isDuplicate: boolean;
}

// Muted rows (payments and duplicates) carry no background tint; their badges tell them apart.
const ROW_STYLE_BASE = 'transition-colors';
const ROW_STYLE_PAYMENT = 'text-slate-500 opacity-40';
const ROW_STYLE_DUPLICATE = 'text-slate-500';
const ROW_STYLE_NEEDS_NAME =
  'bg-amber-50/40 dark:bg-amber-400/10 hover:bg-amber-50/70 dark:hover:bg-amber-400/20 ' +
  '[&>td:first-child]:border-l-4 [&>td:first-child]:border-amber-500';
const ROW_STYLE_NORMAL = 'hover:bg-slate-50 dark:hover:bg-slate-800/40';

/**
 * Picks the table row classes. The first match wins: payment, duplicate, needs a name, normal.
 * Payments and duplicates stay muted even when they also need a name, because they are
 * usually not imported and an amber row would be noise.
 */
export function getWorksheetRowClassName(row: WorksheetRowStyleInput, needsName: boolean): string {
  let state = ROW_STYLE_NORMAL;
  if (row.isPaymentTransfer) state = ROW_STYLE_PAYMENT;
  else if (row.isDuplicate) state = ROW_STYLE_DUPLICATE;
  else if (needsName) state = ROW_STYLE_NEEDS_NAME;
  return `${ROW_STYLE_BASE} ${state}`;
}
