import { describe, it, expect } from 'vitest';
import { parseOfxStatement, mapParsedStatementToTransactions, normalizeOfxDate } from '../modules/importers/ofxParser';
import { executeAccountTransfer } from '../modules/accounts/transferEngine';
import {
  generateDoubleEntryJournal,
  verifyLedgerTrialBalance,
  exportJournalToBeancount,
} from '../modules/ledger/doubleEntryBridge';
import { Account, Category, Transaction } from '../types';

describe('OFX / QFX Statement Parser', () => {
  it('normalizes various OFX date formats into YYYY-MM-DD', () => {
    expect(normalizeOfxDate('20261105')).toBe('2026-11-05');
    expect(normalizeOfxDate('20261105120000')).toBe('2026-11-05');
    expect(normalizeOfxDate('20261105120000[0:GMT]')).toBe('2026-11-05');
    expect(normalizeOfxDate('20261105120000.000[-5:EST]')).toBe('2026-11-05');
    expect(normalizeOfxDate('2026-11-05')).toBe('2026-11-05');
  });

  it('correctly parses SGML-style OFX 1.x with unclosed tags', () => {
    const ofx1Sample = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252

<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261105120000[0:GMT]
            <TRNAMT>-1250.00
            <FITID>OFX-TX-001
            <NAME>Agora Superstore
            <MEMO>Weekly bazar
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20261106
            <TRNAMT>50000.00
            <FITID>OFX-TX-002
            <NAME>Brain Station 23
            <MEMO>Monthly salary
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

    const results = parseOfxStatement(ofx1Sample);
    expect(results).toHaveLength(2);

    expect(results[0].fitId).toBe('OFX-TX-001');
    expect(results[0].date).toBe('2026-11-05');
    expect(results[0].amount).toBe(1250);
    expect(results[0].type).toBe('expense');
    expect(results[0].payee).toBe('Agora Superstore');
    expect(results[0].memo).toBe('Weekly bazar');

    expect(results[1].fitId).toBe('OFX-TX-002');
    expect(results[1].date).toBe('2026-11-06');
    expect(results[1].amount).toBe(50000);
    expect(results[1].type).toBe('income');
    expect(results[1].payee).toBe('Brain Station 23');
    expect(results[1].memo).toBe('Monthly salary');
  });

  it('correctly parses XML-style OFX 2.x with closed tags and entity decoding', () => {
    const ofx2Sample = `<?xml version="1.0" encoding="utf-8"?>
<?OFX OFXHEADER="200" VERSION="211"?>
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20261107103000</DTPOSTED>
            <TRNAMT>-3450.50</TRNAMT>
            <FITID>FIT-XML-9981</FITID>
            <NAME>Shwapno &amp; LifeStyle</NAME>
            <MEMO>Household items</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

    const results = parseOfxStatement(ofx2Sample);
    expect(results).toHaveLength(1);

    expect(results[0].fitId).toBe('FIT-XML-9981');
    expect(results[0].date).toBe('2026-11-07');
    expect(results[0].amount).toBe(3450.5);
    expect(results[0].type).toBe('expense');
    expect(results[0].payee).toBe('Shwapno & LifeStyle');
    expect(results[0].memo).toBe('Household items');
  });

  it('returns empty array when content has no transactions', () => {
    expect(parseOfxStatement('')).toEqual([]);
    expect(parseOfxStatement('<OFX></OFX>')).toEqual([]);
  });

  it('maps parsed statement items into deterministic transactions for duplicate protection', () => {
    const items = [
      {
        date: '2026-11-05',
        payee: 'Unimart Gulshan',
        amount: 2800,
        type: 'expense' as const,
        fitId: 'UNIMART-001',
        memo: 'Groceries',
      },
      {
        date: '2026-11-06',
        payee: 'Client Honorarium',
        amount: 20000,
        type: 'income' as const,
        fitId: 'CLIENT-991',
      },
    ];

    const run1 = mapParsedStatementToTransactions(items, 'sonali_bank', 'groceries', 'salary');
    const run2 = mapParsedStatementToTransactions(items, 'sonali_bank', 'groceries', 'salary');

    expect(run1).toHaveLength(2);
    expect(run1[0].fingerprint).toBe('ofx:sonali_bank:UNIMART-001');
    expect(run1[0].externalUid).toBe('UNIMART-001');
    expect(run1[0].categoryId).toBe('groceries');
    expect(run1[0].syncSource).toBe('bank_import');

    expect(run1[1].fingerprint).toBe('ofx:sonali_bank:CLIENT-991');
    expect(run1[1].categoryId).toBe('salary');

    // Deterministic deduplication test: repeated imports yield strictly equal fingerprints and IDs
    expect(run1[0].id).toBe(run2[0].id);
    expect(run1[0].fingerprint).toBe(run2[0].fingerprint);
    expect(run1[1].id).toBe(run2[1].id);
    expect(run1[1].fingerprint).toBe(run2[1].fingerprint);
  });
});

describe('Account Transfer Engine', () => {
  const initialAccounts: Account[] = [
    { id: 'sonali_bank', name: 'Sonali Bank', type: 'bank', balance: 100000, currency: 'BDT' },
    { id: 'bkash', name: 'bKash Personal', type: 'mfs', balance: 5000, currency: 'BDT' },
    { id: 'city_amex', name: 'City Bank Amex', type: 'credit_card', balance: 18500, currency: 'BDT' },
    { id: 'cash_wallet', name: 'Cash Wallet', type: 'cash', balance: 4000, currency: 'BDT' },
  ];

  it('transfers between asset accounts (Bank to bKash)', () => {
    const { updatedAccounts, transferTransaction } = executeAccountTransfer(initialAccounts, {
      sourceAccountId: 'sonali_bank',
      targetAccountId: 'bkash',
      amount: 12000,
      date: '2026-11-07',
      note: 'Fund bKash wallet',
    });

    const updatedBank = updatedAccounts.find((a) => a.id === 'sonali_bank')!;
    const updatedBkash = updatedAccounts.find((a) => a.id === 'bkash')!;

    expect(updatedBank.balance).toBe(88000); // 100,000 - 12,000
    expect(updatedBkash.balance).toBe(17000); // 5,000 + 12,000
    expect(transferTransaction.type).toBe('transfer');
    expect(transferTransaction.accountId).toBe('sonali_bank');
    expect(transferTransaction.targetAccountId).toBe('bkash');
    expect(transferTransaction.amount).toBe(12000);
    expect(transferTransaction.description).toBe('Fund bKash wallet');
  });

  it('transfers from asset account to credit card reduces credit card debt', () => {
    const { updatedAccounts, transferTransaction } = executeAccountTransfer(initialAccounts, {
      sourceAccountId: 'sonali_bank',
      targetAccountId: 'city_amex',
      amount: 10000,
      date: '2026-11-07',
      note: 'Credit card bill payment',
    });

    const updatedBank = updatedAccounts.find((a) => a.id === 'sonali_bank')!;
    const updatedAmex = updatedAccounts.find((a) => a.id === 'city_amex')!;

    expect(updatedBank.balance).toBe(90000); // 100,000 - 10,000
    // Liability debt reduces: 18,500 - 10,000 = 8,500
    expect(updatedAmex.balance).toBe(8500);
    expect(transferTransaction.targetAccountId).toBe('city_amex');
  });

  it('transfers from credit card (cash advance) increases credit card debt', () => {
    const { updatedAccounts } = executeAccountTransfer(initialAccounts, {
      sourceAccountId: 'city_amex',
      targetAccountId: 'cash_wallet',
      amount: 3000,
      date: '2026-11-07',
      note: 'ATM cash advance',
    });

    const updatedAmex = updatedAccounts.find((a) => a.id === 'city_amex')!;
    const updatedCash = updatedAccounts.find((a) => a.id === 'cash_wallet')!;

    // Liability balance increases because more debt was incurred: 18,500 + 3,000 = 21,500
    expect(updatedAmex.balance).toBe(21500);
    expect(updatedCash.balance).toBe(7000); // 4,000 + 3,000
  });

  it('validates transfer parameters and rejects invalid requests', () => {
    // Same source and target
    expect(() =>
      executeAccountTransfer(initialAccounts, {
        sourceAccountId: 'sonali_bank',
        targetAccountId: 'sonali_bank',
        amount: 500,
        date: '2026-11-07',
      })
    ).toThrow('Source and target accounts must be different');

    // Zero or negative amount
    expect(() =>
      executeAccountTransfer(initialAccounts, {
        sourceAccountId: 'sonali_bank',
        targetAccountId: 'bkash',
        amount: 0,
        date: '2026-11-07',
      })
    ).toThrow('Transfer amount must be greater than zero');

    expect(() =>
      executeAccountTransfer(initialAccounts, {
        sourceAccountId: 'sonali_bank',
        targetAccountId: 'bkash',
        amount: -100,
        date: '2026-11-07',
      })
    ).toThrow('Transfer amount must be greater than zero');

    // Non-existent source account
    expect(() =>
      executeAccountTransfer(initialAccounts, {
        sourceAccountId: 'non_existent_acc',
        targetAccountId: 'bkash',
        amount: 1000,
        date: '2026-11-07',
      })
    ).toThrow("Source account 'non_existent_acc' not found");

    // Non-existent target account
    expect(() =>
      executeAccountTransfer(initialAccounts, {
        sourceAccountId: 'sonali_bank',
        targetAccountId: 'non_existent_acc',
        amount: 1000,
        date: '2026-11-07',
      })
    ).toThrow("Target account 'non_existent_acc' not found");
  });

  it('guarantees immutability of the source accounts array', () => {
    const originalBalance = initialAccounts[0].balance;
    executeAccountTransfer(initialAccounts, {
      sourceAccountId: 'sonali_bank',
      targetAccountId: 'bkash',
      amount: 5000,
      date: '2026-11-07',
    });

    expect(initialAccounts[0].balance).toBe(originalBalance);
  });
});

describe('Double-Entry Bridge & Beancount Export', () => {
  const accounts: Account[] = [
    { id: 'sonali_bank', name: 'Sonali Bank', type: 'bank', balance: 100000, currency: 'BDT' },
    { id: 'bkash', name: 'bKash Personal', type: 'mfs', balance: 5000, currency: 'BDT' },
    { id: 'city_amex', name: 'City Bank Amex', type: 'credit_card', balance: 18500, currency: 'BDT' },
  ];

  const categories: Category[] = [
    { id: 'groceries', name: 'Groceries', type: 'expense' },
    { id: 'dining', name: 'Dining', type: 'expense' },
    { id: 'salary', name: 'Salary', type: 'income' },
  ];

  it('generates balanced journal entries for expense, income, and transfer', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        date: '2026-11-01',
        amount: 3500,
        type: 'expense',
        categoryId: 'groceries',
        accountId: 'sonali_bank',
        description: 'Bazar shopping',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'tx-2',
        date: '2026-11-02',
        amount: 2500,
        type: 'expense',
        categoryId: 'dining',
        accountId: 'city_amex',
        description: 'Restaurant dinner on credit',
        createdAt: 2000,
        updatedAt: 2000,
      },
      {
        id: 'tx-3',
        date: '2026-11-03',
        amount: 80000,
        type: 'income',
        categoryId: 'salary',
        accountId: 'sonali_bank',
        description: 'November Paycheck',
        createdAt: 3000,
        updatedAt: 3000,
      },
      {
        id: 'tx-4',
        date: '2026-11-04',
        amount: 10000,
        type: 'transfer',
        categoryId: 'transfer',
        accountId: 'sonali_bank',
        targetAccountId: 'bkash',
        description: 'Bank to bKash transfer',
        createdAt: 4000,
        updatedAt: 4000,
      },
      {
        id: 'tx-5',
        date: '2026-11-05',
        amount: 15000,
        type: 'transfer',
        categoryId: 'transfer',
        accountId: 'sonali_bank',
        targetAccountId: 'city_amex',
        description: 'Credit Card Bill Payment',
        createdAt: 5000,
        updatedAt: 5000,
      },
    ];

    const entries = generateDoubleEntryJournal(transactions, accounts, categories);
    expect(entries).toHaveLength(5);

    // 1. Expense paid with Bank asset: Debit Expenses, Credit Assets
    expect(entries[0].postings[0]).toEqual({
      accountName: 'Expenses:Groceries',
      debitBDT: 3500,
      creditBDT: 0,
    });
    expect(entries[0].postings[1]).toEqual({
      accountName: 'Assets:SonaliBank',
      debitBDT: 0,
      creditBDT: 3500,
    });
    expect(entries[0].balanced).toBe(true);

    // 2. Expense paid with Credit Card: Debit Expenses, Credit Liabilities
    expect(entries[1].postings[0]).toEqual({
      accountName: 'Expenses:Dining',
      debitBDT: 2500,
      creditBDT: 0,
    });
    expect(entries[1].postings[1]).toEqual({
      accountName: 'Liabilities:CityBankAmex',
      debitBDT: 0,
      creditBDT: 2500,
    });
    expect(entries[1].balanced).toBe(true);

    // 3. Income deposited into Bank: Debit Assets, Credit Income
    expect(entries[2].postings[0]).toEqual({
      accountName: 'Assets:SonaliBank',
      debitBDT: 80000,
      creditBDT: 0,
    });
    expect(entries[2].postings[1]).toEqual({
      accountName: 'Income:Salary',
      debitBDT: 0,
      creditBDT: 80000,
    });
    expect(entries[2].balanced).toBe(true);

    // 4. Transfer Asset to Asset (Bank to bKash): Debit Target Asset, Credit Source Asset
    expect(entries[3].postings[0]).toEqual({
      accountName: 'Assets:bKashPersonal',
      debitBDT: 10000,
      creditBDT: 0,
    });
    expect(entries[3].postings[1]).toEqual({
      accountName: 'Assets:SonaliBank',
      debitBDT: 0,
      creditBDT: 10000,
    });
    expect(entries[3].balanced).toBe(true);

    // 5. Transfer Asset to Liability (Card Bill Payment): Debit Target Liability, Credit Source Asset
    expect(entries[4].postings[0]).toEqual({
      accountName: 'Liabilities:CityBankAmex',
      debitBDT: 15000,
      creditBDT: 0,
    });
    expect(entries[4].postings[1]).toEqual({
      accountName: 'Assets:SonaliBank',
      debitBDT: 0,
      creditBDT: 15000,
    });
    expect(entries[4].balanced).toBe(true);
  });

  it('verifies ledger trial balance', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        date: '2026-11-01',
        amount: 3500,
        type: 'expense',
        categoryId: 'groceries',
        accountId: 'sonali_bank',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'tx-2',
        date: '2026-11-02',
        amount: 50000,
        type: 'income',
        categoryId: 'salary',
        accountId: 'sonali_bank',
        createdAt: 2000,
        updatedAt: 2000,
      },
    ];

    const entries = generateDoubleEntryJournal(transactions, accounts, categories);
    const balance = verifyLedgerTrialBalance(entries);

    expect(balance.totalDebits).toBe(53500);
    expect(balance.totalCredits).toBe(53500);
    expect(balance.isBalanced).toBe(true);
  });

  it('exports valid Beancount format with correct sign conventions', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx-1',
        date: '2026-11-01',
        amount: 1250,
        type: 'expense',
        categoryId: 'groceries',
        accountId: 'sonali_bank',
        description: 'Agora Superstore',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'tx-2',
        date: '2026-11-02',
        amount: 50000,
        type: 'income',
        categoryId: 'salary',
        accountId: 'sonali_bank',
        description: 'Monthly Salary',
        createdAt: 2000,
        updatedAt: 2000,
      },
    ];

    const entries = generateDoubleEntryJournal(transactions, accounts, categories);
    const beancountOutput = exportJournalToBeancount(entries, 'BDT');

    const expected = `2026-11-01 * "Agora Superstore"
  Expenses:Groceries  1250.00 BDT
  Assets:SonaliBank  -1250.00 BDT

2026-11-02 * "Monthly Salary"
  Assets:SonaliBank  50000.00 BDT
  Income:Salary  -50000.00 BDT`;

    expect(beancountOutput).toBe(expected);
  });
});
