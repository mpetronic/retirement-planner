import * as XLSX from 'xlsx';
import { saveFileWithLocationPrompt, SaveFileResult } from './exportHelpers';

export interface ExpenseExportFieldConfig {
  key: string;
  label: string;
  width?: number;
  format?: (value: unknown) => string | number;
}

export const KNOWN_DB_EXPENSE_COLUMNS: ExpenseExportFieldConfig[] = [
  { key: 'date', label: 'Date', width: 14 },
  { key: 'amount', label: 'Amount ($)', width: 14, format: (v) => (typeof v === 'number' ? v : Number(v) || 0) },
  { key: 'categoryName', label: 'Category Name', width: 28 },
  { key: 'categoryId', label: 'Category ID', width: 26 },
  { key: 'enteredBy', label: 'Entered By', width: 16 },
  { key: 'notes', label: 'Notes / Description', width: 44, format: (v) => (typeof v === 'string' ? v : String(v ?? '')) },
  { key: 'tags', label: 'Tags', width: 20, format: (v) => (Array.isArray(v) ? v.join(', ') : String(v ?? '')) },
  { key: 'expenseId', label: 'Expense ID', width: 30 },
  { key: 'createdAt', label: 'Created At', width: 26 },
  { key: 'updatedAt', label: 'Updated At', width: 26 },
  { key: 'entityType', label: 'Entity Type', width: 14, format: (v) => (typeof v === 'string' ? v : 'EXPENSE') },
  { key: 'syncStatus', label: 'Sync Status', width: 14, format: (v) => (typeof v === 'string' ? v : 'SYNCED') },
  { key: 'PK', label: 'DynamoDB PK', width: 34 },
  { key: 'SK', label: 'DynamoDB SK', width: 44 },
  { key: 'GSI1PK', label: 'DynamoDB GSI1PK', width: 40 },
  { key: 'GSI1SK', label: 'DynamoDB GSI1SK', width: 16 },
];

/**
 * Transforms raw DynamoDB expense records into formatted spreadsheet rows
 * ensuring every field stored in the database has its own column.
 */
export function formatDbExpensesForSpreadsheet(
  expenses: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  if (!expenses || expenses.length === 0) return [];

  // 1. Discover all unique keys across all records
  const allDiscoveredKeys = new Set<string>();
  for (const exp of expenses) {
    if (exp && typeof exp === 'object') {
      Object.keys(exp).forEach((k) => allDiscoveredKeys.add(k));
    }
  }

  // 2. Identify any dynamic keys not in our predefined known list
  const knownKeysSet = new Set(KNOWN_DB_EXPENSE_COLUMNS.map((c) => c.key));
  const dynamicKeys: string[] = [];
  allDiscoveredKeys.forEach((k) => {
    if (!knownKeysSet.has(k)) {
      dynamicKeys.push(k);
    }
  });
  dynamicKeys.sort();

  // 3. Sort expenses chronologically descending (newest first)
  const sortedExpenses = [...expenses].sort((a, b) => {
    const dateA = typeof a.date === 'string' ? a.date : '';
    const dateB = typeof b.date === 'string' ? b.date : '';
    const dateCmp = dateB.localeCompare(dateA);
    if (dateCmp !== 0) return dateCmp;
    const timeA = typeof a.createdAt === 'string' ? a.createdAt : '';
    const timeB = typeof b.createdAt === 'string' ? b.createdAt : '';
    return timeB.localeCompare(timeA);
  });

  // 4. Map each expense into a row object with all fields
  return sortedExpenses.map((exp) => {
    const row: Record<string, unknown> = {};

    // Standard known columns
    for (const col of KNOWN_DB_EXPENSE_COLUMNS) {
      const rawVal = exp[col.key];
      const val = col.format ? col.format(rawVal) : (rawVal !== undefined && rawVal !== null ? (rawVal as string | number) : '');
      row[col.label] = val;
    }

    // Dynamic extra columns from DynamoDB
    for (const key of dynamicKeys) {
      const rawVal = exp[key];
      row[key] = Array.isArray(rawVal)
        ? rawVal.join(', ')
        : typeof rawVal === 'object' && rawVal !== null
        ? JSON.stringify(rawVal)
        : (rawVal !== undefined && rawVal !== null ? (rawVal as string | number) : '');
    }

    return row;
  });
}

/**
 * Builds an Excel workbook Blob with all DynamoDB expenses.
 */
export function generateExpensesExcelBlob(expenses: Array<Record<string, unknown>>): Blob {
  const rows = formatDbExpensesForSpreadsheet(expenses);
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  if (rows.length > 0) {
    const sample = rows[0];
    const colLabels = Object.keys(sample);
    const cols = colLabels.map((label) => {
      const known = KNOWN_DB_EXPENSE_COLUMNS.find((c) => c.label === label);
      if (known?.width) {
        return { wch: known.width };
      }
      return { wch: Math.max(label.length + 4, 15) };
    });
    ws['!cols'] = cols;
  }

  XLSX.utils.book_append_sheet(wb, ws, 'DynamoDB Expenses');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Initiates the file save / download flow for DynamoDB expenses.
 */
export async function downloadExpensesSpreadsheet(
  expenses: Array<Record<string, unknown>>,
  suggestedFilename?: string
): Promise<SaveFileResult> {
  const blob = generateExpensesExcelBlob(expenses);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = suggestedFilename || `RetirementPlanner_DynamoDB_Expenses_${dateStr}.xlsx`;
  return saveFileWithLocationPrompt(blob, filename, 'excel', true);
}
