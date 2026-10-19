import { describe, it, expect } from 'vitest';
import {
  formatDbExpensesForSpreadsheet,
  generateExpensesExcelBlob,
  KNOWN_DB_EXPENSE_COLUMNS,
} from '../expensesExcelExport';

describe('expensesExcelExport', () => {
  it('handles empty expense list gracefully', () => {
    expect(formatDbExpensesForSpreadsheet([])).toEqual([]);
    const blob = generateExpensesExcelBlob([]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('formats standard DynamoDB expenses including all standard fields', () => {
    const rawItems: Array<Record<string, unknown>> = [
      {
        PK: 'HOUSEHOLD#petronic-household',
        SK: 'EXPENSE#2026-03-01#exp_123',
        GSI1PK: 'HOUSEHOLD#petronic-household#EXPENSES',
        GSI1SK: '2026-03-01',
        entityType: 'EXPENSE',
        expenseId: 'exp_123',
        date: '2026-03-01',
        amount: 145.5,
        categoryId: 'home-groceries',
        categoryName: 'Home - Groceries',
        enteredBy: 'Mike',
        notes: 'Weekly supermarket run',
        tags: ['groceries', 'food'],
        createdAt: '2026-03-01T12:00:00.000Z',
        updatedAt: '2026-03-01T12:00:00.000Z',
        syncStatus: 'SYNCED',
      },
    ];

    const formatted = formatDbExpensesForSpreadsheet(rawItems);
    expect(formatted).toHaveLength(1);

    const row = formatted[0];
    expect(row['Date']).toBe('2026-03-01');
    expect(row['Amount ($)']).toBe(145.5);
    expect(row['Category Name']).toBe('Home - Groceries');
    expect(row['Category ID']).toBe('home-groceries');
    expect(row['Entered By']).toBe('Mike');
    expect(row['Notes / Description']).toBe('Weekly supermarket run');
    expect(row['Tags']).toBe('groceries, food');
    expect(row['Expense ID']).toBe('exp_123');
    expect(row['Entity Type']).toBe('EXPENSE');
    expect(row['Sync Status']).toBe('SYNCED');
    expect(row['DynamoDB PK']).toBe('HOUSEHOLD#petronic-household');
    expect(row['DynamoDB SK']).toBe('EXPENSE#2026-03-01#exp_123');
    expect(row['DynamoDB GSI1PK']).toBe('HOUSEHOLD#petronic-household#EXPENSES');
    expect(row['DynamoDB GSI1SK']).toBe('2026-03-01');
  });

  it('discovers and appends dynamic attributes from DynamoDB records', () => {
    const rawItems: Array<Record<string, unknown>> = [
      {
        PK: 'HOUSEHOLD#petronic-household',
        SK: 'EXPENSE#2026-04-10#exp_999',
        date: '2026-04-10',
        amount: 500,
        customAttribute1: 'ExtraValue',
        nestedObject: { flag: true },
      },
    ];

    const formatted = formatDbExpensesForSpreadsheet(rawItems);
    expect(formatted).toHaveLength(1);
    const row = formatted[0];

    expect(row['customAttribute1']).toBe('ExtraValue');
    expect(row['nestedObject']).toBe('{"flag":true}');
  });

  it('sorts expenses chronologically descending', () => {
    const rawItems: Array<Record<string, unknown>> = [
      { expenseId: 'old', date: '2025-01-10', createdAt: '2025-01-10T10:00:00Z', amount: 10 },
      { expenseId: 'new', date: '2026-05-20', createdAt: '2026-05-20T10:00:00Z', amount: 20 },
      { expenseId: 'mid', date: '2025-12-15', createdAt: '2025-12-15T10:00:00Z', amount: 15 },
    ];

    const formatted = formatDbExpensesForSpreadsheet(rawItems);
    expect(formatted.map((r) => r['Expense ID'])).toEqual(['new', 'mid', 'old']);
  });

  it('includes all known field columns in KNOWN_DB_EXPENSE_COLUMNS', () => {
    const keys = KNOWN_DB_EXPENSE_COLUMNS.map((c) => c.key);
    expect(keys).toContain('date');
    expect(keys).toContain('amount');
    expect(keys).toContain('categoryName');
    expect(keys).toContain('categoryId');
    expect(keys).toContain('enteredBy');
    expect(keys).toContain('notes');
    expect(keys).toContain('tags');
    expect(keys).toContain('expenseId');
    expect(keys).toContain('createdAt');
    expect(keys).toContain('updatedAt');
    expect(keys).toContain('entityType');
    expect(keys).toContain('syncStatus');
    expect(keys).toContain('PK');
    expect(keys).toContain('SK');
    expect(keys).toContain('GSI1PK');
    expect(keys).toContain('GSI1SK');
  });
});
