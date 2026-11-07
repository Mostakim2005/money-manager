import { Account, Category, Transaction } from '../../types';

/**
 * Escapes CSV fields in compliance with RFC-4180 and protects against CSV formula injection.
 * (Adapted from Actual Budget export-to-csv.ts)
 */
export function escapeCsvField(val: string | number | undefined | null): string {
  if (val === null || val === undefined) return '';
  let str = String(val);

  // Security: Prevent CSV / spreadsheet formula injection attacks
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // RFC-4180 escaping: if field contains comma, quote, or newline, enclose in quotes and double internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Exports transactions to RFC-4180 compliant CSV with user-friendly account and category names.
 * Header: Date,Time,Type,Account,TargetAccount,Category,Amount,Note,Description,ExternalUID
 */
export function exportTransactionsToCsv(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[]
): string {
  const accountMap = new Map<string, string>(accounts.map((a) => [a.id, a.name]));
  const categoryMap = new Map<string, string>(categories.map((c) => [c.id, c.name]));

  const headers = [
    'Date',
    'Time',
    'Type',
    'Account',
    'TargetAccount',
    'Category',
    'Amount',
    'Note',
    'Description',
    'ExternalUID',
  ];

  const rows = transactions.map((tx) => {
    const accountName = accountMap.get(tx.accountId) || tx.accountId;
    const targetAccountName = tx.targetAccountId ? (accountMap.get(tx.targetAccountId) || tx.targetAccountId) : '';
    const categoryName = categoryMap.get(tx.categoryId) || tx.categoryId;

    return [
      escapeCsvField(tx.date),
      escapeCsvField(tx.time || ''),
      escapeCsvField(tx.type),
      escapeCsvField(accountName),
      escapeCsvField(targetAccountName),
      escapeCsvField(categoryName),
      escapeCsvField(tx.amount.toFixed(2)),
      escapeCsvField(tx.note || ''),
      escapeCsvField(tx.description || ''),
      escapeCsvField(tx.externalUid || ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Exports entire application state as a structured, versioned JSON vault backup.
 */
export function exportFullBackupJson(state: {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  sanchaypatraSchemes: any[];
  rules: any[];
  recurringSchedules?: any[];
}): string {
  const backupPayload = {
    version: '1.0.0',
    schema: 'money-manager-vault-v1',
    exportedAt: new Date().toISOString(),
    ...state,
  };

  return JSON.stringify(backupPayload, null, 2);
}
