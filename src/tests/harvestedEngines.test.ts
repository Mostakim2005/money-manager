import { describe, it, expect } from 'vitest';
import { parseCamtXmlStatement } from '../modules/importers/camtXmlParser';
import { exportTransactionsToCsv, exportFullBackupJson, escapeCsvField } from '../modules/exporters/csvExporter';
import {
  splitTransaction,
  mergeTransactions,
  advanceDueDate,
  processDueRecurringSchedules,
} from '../modules/transactions/recurringAndSplit';
import { Account, Category, RecurringSchedule, Transaction } from '../types';

describe('ISO 20022 CAMT.052 / CAMT.053 XML Statement Parser', () => {
  it('correctly parses CAMT.053 XML statement with debit and credit entries', () => {
    const camtSample = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Id>STMT-2026-11</Id>
      <Ntry>
        <Amt Ccy="BDT">2450.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt>
          <Dt>2026-11-05</Dt>
        </BookgDt>
        <AcctSvcrRef>REF-BD-20261105-01</AcctSvcrRef>
        <NtryDtls>
          <TxDtls>
            <RltdPties>
              <Cdtr>
                <Nm>Meena Bazar Dhanmondi</Nm>
              </Cdtr>
            </RltdPties>
            <RmtInf>
              <Ustrd>Weekly grocery essentials</Ustrd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="BDT">85000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt>
          <DtTm>2026-11-06T09:30:00</DtTm>
        </BookgDt>
        <AcctSvcrRef>REF-BD-20261106-02</AcctSvcrRef>
        <NtryDtls>
          <TxDtls>
            <RltdPties>
              <Dbtr>
                <Nm>Apex Holdings Ltd</Nm>
              </Dbtr>
            </RltdPties>
            <RmtInf>
              <Ustrd>November 2026 Salary</Ustrd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

    const parsed = parseCamtXmlStatement(camtSample);
    expect(parsed).toHaveLength(2);

    // Debit transaction (expense)
    expect(parsed[0].amount).toBe(2450);
    expect(parsed[0].currency).toBe('BDT');
    expect(parsed[0].type).toBe('expense');
    expect(parsed[0].date).toBe('2026-11-05');
    expect(parsed[0].payee).toBe('Meena Bazar Dhanmondi');
    expect(parsed[0].notes).toBe('Weekly grocery essentials');
    expect(parsed[0].acctSvcrRef).toBe('REF-BD-20261105-01');

    // Credit transaction (income)
    expect(parsed[1].amount).toBe(85000);
    expect(parsed[1].currency).toBe('BDT');
    expect(parsed[1].type).toBe('income');
    expect(parsed[1].date).toBe('2026-11-06');
    expect(parsed[1].payee).toBe('Apex Holdings Ltd');
    expect(parsed[1].notes).toBe('November 2026 Salary');
    expect(parsed[1].acctSvcrRef).toBe('REF-BD-20261106-02');
  });

  it('handles CAMT entries with AddtlNtryInf and ValDt fallback', () => {
    const camtWithAddtl = `<Document>
      <Ntry>
        <Amt Ccy="EUR">45.50</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <ValDt>
          <Dt>2026-11-07</Dt>
        </ValDt>
        <AddtlNtryInf>Online Subscription Service</AddtlNtryInf>
      </Ntry>
    </Document>`;

    const parsed = parseCamtXmlStatement(camtWithAddtl);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].amount).toBe(45.5);
    expect(parsed[0].currency).toBe('EUR');
    expect(parsed[0].type).toBe('expense');
    expect(parsed[0].date).toBe('2026-11-07');
    expect(parsed[0].payee).toBe('Online Subscription Service');
  });

  it('returns empty array on invalid or empty CAMT input', () => {
    expect(parseCamtXmlStatement('')).toEqual([]);
    expect(parseCamtXmlStatement('<Document></Document>')).toEqual([]);
  });
});

describe('CSV & Vault Backup Exporters', () => {
  const accounts: Account[] = [
    { id: 'acc_bank', name: 'City Bank Ltd', type: 'bank', balance: 50000, currency: 'BDT' },
    { id: 'acc_bkash', name: 'bKash Personal', type: 'mfs', balance: 12000, currency: 'BDT' },
  ];

  const categories: Category[] = [
    { id: 'cat_groceries', name: 'Groceries & Bazar', type: 'expense' },
    { id: 'cat_salary', name: 'Monthly Salary', type: 'income' },
  ];

  it('protects against CSV formula injection and escapes special characters per RFC-4180', () => {
    // Formula triggers: =, +, -, @
    expect(escapeCsvField('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(escapeCsvField('+12345')).toBe("'+12345");
    expect(escapeCsvField('@admin')).toBe("'@admin");

    // RFC-4180 quoting and double-quote escaping
    expect(escapeCsvField('Apples, Bananas & Oranges')).toBe('"Apples, Bananas & Oranges"');
    expect(escapeCsvField('He said "Hello"')).toBe('"He said ""Hello"""');
    expect(escapeCsvField("Line1\nLine2")).toBe('"Line1\nLine2"');
  });

  it('exports transactions to CSV with resolved account and category names', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        date: '2026-11-01',
        time: '10:30',
        amount: 3200,
        type: 'expense',
        categoryId: 'cat_groceries',
        accountId: 'acc_bank',
        note: 'Bazar, fish and spices',
        description: 'Shwapno Supermarket',
        externalUid: 'OFX-9981',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'tx-2',
        date: '2026-11-02',
        time: '14:00',
        amount: 5000,
        type: 'transfer',
        categoryId: 'transfer',
        accountId: 'acc_bank',
        targetAccountId: 'acc_bkash',
        note: 'Refill wallet',
        description: 'Transfer to bKash',
        createdAt: 2000,
        updatedAt: 2000,
      },
    ];

    const csv = exportTransactionsToCsv(transactions, accounts, categories);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('Date,Time,Type,Account,TargetAccount,Category,Amount,Note,Description,ExternalUID');
    expect(lines[1]).toContain('2026-11-01');
    expect(lines[1]).toContain('City Bank Ltd');
    expect(lines[1]).toContain('Groceries & Bazar');
    expect(lines[1]).toContain('3200.00');
    expect(lines[1]).toContain('"Bazar, fish and spices"');
    expect(lines[1]).toContain('OFX-9981');

    // Transfer resolves both Account and TargetAccount names
    expect(lines[2]).toContain('transfer');
    expect(lines[2]).toContain('City Bank Ltd');
    expect(lines[2]).toContain('bKash Personal');
  });

  it('exports a full JSON vault backup with schema and metadata', () => {
    const backupJson = exportFullBackupJson({
      transactions: [],
      accounts,
      categories,
      sanchaypatraSchemes: [],
      rules: [],
    });

    const parsed = JSON.parse(backupJson);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.schema).toBe('money-manager-vault-v1');
    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.accounts).toHaveLength(2);
    expect(parsed.categories).toHaveLength(2);
  });
});

describe('Split Transactions Engine', () => {
  const parentTx: Transaction = {
    id: 'tx-parent-001',
    date: '2026-11-05',
    time: '15:00',
    amount: 5000,
    type: 'expense',
    categoryId: 'groceries',
    accountId: 'acc_bank',
    description: 'Agora Superstore Shopping',
    note: 'Weekly family shopping',
    createdAt: 1000,
    updatedAt: 1000,
  };

  it('correctly splits a transaction into multiple categorized parts', () => {
    const splits = [
      { categoryId: 'groceries', amount: 3500, note: 'Vegetables & Meat' },
      { categoryId: 'cosmetics', amount: 1500, note: 'Toiletries' },
    ];

    const result = splitTransaction(parentTx, splits);
    expect(result).toHaveLength(2);

    expect(result[0].id).toBe('tx-parent-001-split-1');
    expect(result[0].amount).toBe(3500);
    expect(result[0].categoryId).toBe('groceries');
    expect(result[0].note).toBe('Vegetables & Meat');
    expect(result[0].date).toBe('2026-11-05');
    expect(result[0].accountId).toBe('acc_bank');

    expect(result[1].id).toBe('tx-parent-001-split-2');
    expect(result[1].amount).toBe(1500);
    expect(result[1].categoryId).toBe('cosmetics');
    expect(result[1].note).toBe('Toiletries');
  });

  it('throws error when splits sum does not equal parent amount', () => {
    const invalidSplits = [
      { categoryId: 'groceries', amount: 3000 },
      { categoryId: 'dining', amount: 1000 }, // sum 4000 !== 5000
    ];

    expect(() => splitTransaction(parentTx, invalidSplits)).toThrow(/must equal parent amount/);
  });

  it('throws error when fewer than 2 splits are provided', () => {
    expect(() => splitTransaction(parentTx, [{ categoryId: 'groceries', amount: 5000 }])).toThrow(
      'Split transaction requires at least 2 allocations'
    );
  });
});

describe('Merge Transactions Engine', () => {
  const tx1: Transaction = {
    id: 'tx-merge-1',
    date: '2026-11-01',
    time: '10:00',
    amount: 1500,
    type: 'expense',
    categoryId: 'groceries',
    accountId: 'acc_bank',
    note: 'Bazar Part 1',
    description: 'Agora Bazar',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const tx2: Transaction = {
    id: 'tx-merge-2',
    date: '2026-11-02',
    time: '11:00',
    amount: 2500,
    type: 'expense',
    categoryId: 'groceries',
    accountId: 'acc_bank',
    note: 'Bazar Part 2',
    description: 'Agora Bazar',
    createdAt: 2000,
    updatedAt: 2000,
  };

  it('merges multiple transactions of same type and account into one', () => {
    const merged = mergeTransactions([tx1, tx2]);

    expect(merged.id).toBe('tx-merge-1'); // Keeps earliest transaction base
    expect(merged.date).toBe('2026-11-01');
    expect(merged.amount).toBe(4000); // 1500 + 2500
    expect(merged.note).toBe('Bazar Part 1 | Bazar Part 2');
    expect(merged.description).toBe('Agora Bazar');
  });

  it('rejects merging transactions with different types or accounts', () => {
    const mismatchedTx: Transaction = {
      ...tx2,
      id: 'tx-diff-acc',
      accountId: 'acc_bkash', // different account
    };

    expect(() => mergeTransactions([tx1, mismatchedTx])).toThrow(
      'Cannot merge transactions with different types or accounts'
    );
  });

  it('rejects merging fewer than 2 transactions', () => {
    expect(() => mergeTransactions([tx1])).toThrow('Merging requires at least 2 transactions');
  });
});

describe('Recurring Schedules Engine', () => {
  it('correctly advances due date across weekly, monthly, quarterly, and yearly intervals', () => {
    expect(advanceDueDate('2026-11-01', 'weekly')).toBe('2026-11-08');
    expect(advanceDueDate('2026-11-01', 'monthly')).toBe('2026-12-01');
    expect(advanceDueDate('2026-12-01', 'monthly')).toBe('2027-01-01');
    expect(advanceDueDate('2026-11-01', 'quarterly')).toBe('2027-02-01');
    expect(advanceDueDate('2026-11-01', 'yearly')).toBe('2027-11-01');

    // Month-end clamping
    expect(advanceDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
  });

  it('processes due recurring schedules and generates transaction payloads', () => {
    const schedules: RecurringSchedule[] = [
      {
        id: 'sched-rent',
        name: 'House Rent',
        amount: 25000,
        type: 'expense',
        categoryId: 'rent',
        accountId: 'acc_bank',
        frequency: 'monthly',
        nextDueDate: '2026-11-01',
        autoPost: true,
        note: 'Apartment rent',
      },
      {
        id: 'sched-future',
        name: 'Future Utility',
        amount: 3000,
        type: 'expense',
        categoryId: 'utilities',
        accountId: 'acc_bank',
        frequency: 'monthly',
        nextDueDate: '2026-11-20', // Not yet due as of 2026-11-07
        autoPost: true,
      },
    ];

    const result = processDueRecurringSchedules(schedules, '2026-11-07');

    // Only rent was due
    expect(result.generatedTransactions).toHaveLength(1);
    expect(result.generatedTransactions[0].date).toBe('2026-11-01');
    expect(result.generatedTransactions[0].amount).toBe(25000);
    expect(result.generatedTransactions[0].description).toBe('House Rent');

    // Rent schedule next due date advanced to 2026-12-01
    const updatedRent = result.updatedSchedules.find((s) => s.id === 'sched-rent')!;
    expect(updatedRent.nextDueDate).toBe('2026-12-01');

    // Future schedule untouched
    const updatedFuture = result.updatedSchedules.find((s) => s.id === 'sched-future')!;
    expect(updatedFuture.nextDueDate).toBe('2026-11-20');
  });

  it('handles multi-period catch-up when a recurring schedule is overdue by multiple intervals', () => {
    const overdueWeeklySchedule: RecurringSchedule[] = [
      {
        id: 'sched-maid',
        name: 'Weekly Maid Allowance',
        amount: 1000,
        type: 'expense',
        categoryId: 'household',
        accountId: 'acc_bank',
        frequency: 'weekly',
        nextDueDate: '2026-10-01',
        autoPost: true,
      },
    ];

    // Evaluate on 2026-10-22 (3 weeks later)
    const result = processDueRecurringSchedules(overdueWeeklySchedule, '2026-10-22');

    // Occurrences: Oct 01, Oct 08, Oct 15, Oct 22
    expect(result.generatedTransactions).toHaveLength(4);
    expect(result.generatedTransactions.map((t) => t.date)).toEqual([
      '2026-10-01',
      '2026-10-08',
      '2026-10-15',
      '2026-10-22',
    ]);

    // Next due date advances past 2026-10-22 to 2026-10-29
    expect(result.updatedSchedules[0].nextDueDate).toBe('2026-10-29');
  });
});
