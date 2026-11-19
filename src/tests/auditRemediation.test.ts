import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMoneyStore } from '../store';
import { calculateSanchaypatraProfit, addMonthsClampedISO } from '../modules/sanchaypatra/calculator';
import { BANGLADESH_SANCHAYPATRA_SCHEMES } from '../modules/sanchaypatra/schemes';
import { normalizePcManagerData } from '../modules/realbyte/client';
import { reconcileRealbyteSync, computeTransactionFingerprint } from '../modules/sync/syncCoordinator';
import { parseCsvStatement } from '../modules/importers/csvParser';
import { applyRulesToTransaction } from '../modules/rules/engine';
import { processDueRecurringSchedules, mergeTransactions } from '../modules/transactions/recurringAndSplit';
import { exportJournalToBeancount, generateDoubleEntryJournal } from '../modules/ledger/doubleEntryBridge';
import { buildAccountsHierarchy } from '../modules/accounts/manager';
import type { Transaction } from '../types';
import sanchaypatraVectors from '../../shared/test-vectors/sanchaypatra_slabs.json';
import syncVectors from '../../shared/test-vectors/sync_reconciliation.json';

describe('Batch 1 Audit Remediation & Golden Test Vectors', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    let storage: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      },
      length: 0,
      key: () => null,
    } as Storage;
  });

  it('passes all shared Sanchaypatra cumulative slab golden test vectors (Fixes C5)', () => {
    for (const vec of sanchaypatraVectors.vectors) {
      const scheme = BANGLADESH_SANCHAYPATRA_SCHEMES.find(s => s.id === vec.schemeId)!;
      const calc = calculateSanchaypatraProfit(vec.principalBDT, scheme, vec.totalHoldingsBDT);

      expect(calc.grossAnnualProfitBDT).toBe(vec.expected.grossAnnualProfitBDT);
      expect(calc.aitRate).toBe(vec.expected.aitRate);
      expect(calc.annualAitTaxBDT).toBe(vec.expected.annualAitTaxBDT);
      expect(calc.netAnnualProfitBDT).toBe(vec.expected.netAnnualProfitBDT);
      expect(calc.netPeriodicPayoutBDT).toBe(vec.expected.netPeriodicPayoutBDT);
    }
  });

  it('clamps month-end Sanchaypatra payout dates and stops collecting past maturity (Fixes H6 & H7)', () => {
    expect(addMonthsClampedISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsClampedISO('2028-01-31', 1)).toBe('2028-02-29'); // 2028 leap year

    const store = useMoneyStore();
    const scheme = store.sanchaypatraSchemes[0];
    scheme.nextPayoutDate = '2030-06-15';
    scheme.maturityDate = '2030-06-15';

    const beforeCount = store.transactions.length;
    // Collect final maturity installment
    store.collectSanchaypatraPayout(scheme.id);
    expect(store.transactions.length).toBe(beforeCount + 1);
    expect(scheme.status).toBe('matured');

    // Subsequent call after maturity must NOT generate another payout transaction
    store.collectSanchaypatraPayout(scheme.id);
    expect(store.transactions.length).toBe(beforeCount + 1);
  });

  it('passes shared Realbyte sync vectors: identical same-day rides (R7) & paired transfer legs 3/4 (R4)', () => {
    // 1. Identical same-day rickshaw rides
    const rideVec = syncVectors.vectors[0];
    const norm1 = normalizePcManagerData({ transactions: rideVec.incomingTransactions });
    const pass1 = reconcileRealbyteSync(
      { transactions: [], accounts: [], categories: [] },
      norm1,
      'realbyte_pc_manager',
      true
    );
    expect(pass1.report.insertedTransactions).toBe(rideVec.expectedPass1!.inserted);
    expect(pass1.transactions.length).toBe(rideVec.expectedPass1!.totalCount);

    const pass2 = reconcileRealbyteSync(
      { transactions: pass1.transactions, accounts: pass1.accounts, categories: pass1.categories },
      norm1,
      'realbyte_pc_manager',
      true
    );
    expect(pass2.report.insertedTransactions).toBe(rideVec.expectedPass2!.inserted);
    expect(pass2.report.skippedDuplicates).toBe(rideVec.expectedPass2!.skipped);
    expect(pass2.transactions.length).toBe(rideVec.expectedPass2!.totalCount);

    // 2. Paired transfer legs (DO_TYPE 3 & 4)
    const transferVec = syncVectors.vectors[1];
    const normTransfer = normalizePcManagerData({ transactions: transferVec.incomingTransactions });
    expect(normTransfer.transactions.length).toBe(transferVec.expectedNormalizedCount);
    expect(normTransfer.transactions[0].type).toBe(transferVec.expectedType);
    expect(normTransfer.transactions[0].amount).toBe(transferVec.expectedAmountBDT);
    expect(normTransfer.transactions[0].accountId).toBe('rb-acc-3');
    expect(normTransfer.transactions[0].targetAccountId).toBe('rb-acc-4');
  });

  it('never double-counts account balances when incoming Realbyte payload includes account snapshots (Fixes C2 & R8)', () => {
    const existingAccounts = [
      { id: 'cash_wallet', externalUid: 'rb-uid-1', name: 'Cash Wallet', type: 'cash' as const, balance: 8500, currency: 'BDT' }
    ];
    const incoming = normalizePcManagerData({
      accounts: [{ uid: 1, name: 'Cash Wallet', amount: 7850, asset_type: 'cash' }],
      transactions: [
        { uid: 9901, wdate: '2026-11-19', utime: 1763550000000, do_type: '1', money: 650, asset_uid: 1, category_uid: 105, note: 'Snacks' }
      ]
    });

    const reconciled = reconcileRealbyteSync(
      { transactions: [], accounts: existingAccounts, categories: [] },
      incoming,
      'realbyte_pc_manager',
      true
    );

    // Balance must equal authoritative snapshot (7850), NOT 7850 - 650 = 7200!
    expect(reconciled.accounts[0].balance).toBe(7850);
  });

  it('correctly increases credit card debt on synced liability expenses when adjustAccountBalances is true (Fixes C3)', () => {
    const existingAccounts = [
      { id: 'city_amex', externalUid: 'rb-uid-6', name: 'City Bank Amex', type: 'credit_card' as const, balance: 10000, currency: 'BDT' }
    ];
    const incoming = normalizePcManagerData({
      transactions: [
        { uid: 9950, wdate: '2026-11-19', utime: 1763550000000, do_type: '1', money: 2500, asset_uid: 6, category_uid: 105, note: 'Card Dinner' }
      ]
    });

    const reconciled = reconcileRealbyteSync(
      { transactions: [], accounts: existingAccounts, categories: [] },
      { transactions: incoming.transactions.map(t => ({ ...t, accountId: 'city_amex' })) },
      'realbyte_pc_manager',
      true,
      { adjustAccountBalances: true }
    );

    // Credit card expense increases debt owed: 10000 + 2500 = 12500
    expect(reconciled.accounts[0].balance).toBe(12500);
  });

  it('deduplicates locally logged transactions against Realbyte incoming transactions after FK remapping (Fixes C4 & R6)', () => {
    const localAcc = { id: 'bkash', externalUid: 'rb-uid-4', name: 'bKash Personal', type: 'mfs' as const, balance: 12000, currency: 'BDT' };
    const localCat = { id: 'groceries', externalUid: 'rb-uid-101', name: 'Groceries & Bazar', type: 'expense' as const };
    const localTxn: Transaction = {
      id: 'tx-local-1',
      date: '2026-11-19',
      type: 'expense',
      amount: 1500,
      accountId: 'bkash',
      categoryId: 'groceries',
      note: 'Bazar items',
      createdAt: 1763550000000,
      updatedAt: 1763550000000
    };
    localTxn.fingerprint = computeTransactionFingerprint(localTxn);

    // Incoming Realbyte transaction uses raw Realbyte IDs (asset_uid: 4 -> rb-acc-4, category_uid: 101 -> rb-cat-101)
    const incoming = normalizePcManagerData({
      accounts: [{ uid: 4, name: 'bKash Personal', amount: 12000, asset_type: 'mfs' }],
      categories: [{ uid: 101, name: 'Groceries & Bazar', do_type: '1' }],
      transactions: [
        { uid: 8801, wdate: '2026-11-19', utime: 1763550000000, do_type: '1', money: 1500, asset_uid: 4, category_uid: 101, note: 'Bazar items' }
      ]
    });

    const reconciled = reconcileRealbyteSync(
      { transactions: [localTxn], accounts: [localAcc], categories: [localCat] },
      incoming,
      'realbyte_pc_manager',
      true
    );

    // Must match after remapping rb-acc-4 -> bkash and rb-cat-101 -> groceries!
    expect(reconciled.report.insertedTransactions).toBe(0);
    expect(reconciled.report.skippedDuplicates).toBe(1);
    expect(reconciled.transactions.length).toBe(1);
    expect(reconciled.transactions[0].externalUid).toBe('rb-uid-8801');
  });

  it('parses RFC-4180 quoted commas and Bangladeshi DD/MM/YYYY dates in CSV statements (Fixes H5)', () => {
    const csv = `Date,Particulars,Debit,Credit,Balance
19/11/2026,"Shwapno, Gulshan-2","1,450.00",,45000.00
05-Nov-2026,"Salary, Bonus & Allowance",,"85,000.00",130000.00`;

    const parsed = parseCsvStatement(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].date).toBe('2026-11-19');
    expect(parsed[0].payee).toBe('Shwapno, Gulshan-2');
    expect(parsed[0].amount).toBe(1450);
    expect(parsed[0].type).toBe('expense');

    expect(parsed[1].date).toBe('2026-11-05');
    expect(parsed[1].payee).toBe('Salary, Bonus & Allowance');
    expect(parsed[1].amount).toBe(85000);
    expect(parsed[1].type).toBe('income');
  });

  it('enforces autoPost === false in recurring schedules and matches multi-keyword rules (Fixes H2 & M5)', () => {
    const schedules = [
      {
        id: 'rec-manual',
        name: 'Manual Review Bill',
        amount: 2000,
        type: 'expense' as const,
        categoryId: 'utilities',
        accountId: 'city_bank',
        frequency: 'monthly' as const,
        nextDueDate: '2026-11-01',
        autoPost: false
      }
    ];
    const res = processDueRecurringSchedules(schedules, '2026-11-19');
    expect(res.generatedTransactions).toHaveLength(0);

    const store = useMoneyStore();
    const shwapnoTx = applyRulesToTransaction(
      {
        id: 't-test',
        date: '2026-11-19',
        amount: 900,
        type: 'expense',
        categoryId: 'dining',
        accountId: 'cash_wallet',
        note: 'Weekly shopping at Shwapno outlet',
        createdAt: 1,
        updatedAt: 1
      },
      store.rules
    );
    expect(shwapnoTx.categoryId).toBe('groceries');
  });

  it('keeps Header Net Worth and AccountsTab Net Worth identical even with type="asset" accounts (Fixes H3)', () => {
    const store = useMoneyStore();
    store.addAccount({
      name: 'FDR Fixed Deposit',
      type: 'asset',
      balance: 250000,
      currency: 'BDT'
    });

    const hierarchy = buildAccountsHierarchy(store.accounts, store.totalSanchaypatraPrincipal);
    expect(store.totalNetWorth).toBe(hierarchy.netWorth);
  });

  it('restores full JSON vault backups and rejects merging transfers with different targets (Fixes C6 & H8)', () => {
    const store = useMoneyStore();
    const backup = store.fullBackupJson;

    store.transactions = [];
    store.accounts = [];
    expect(store.transactions.length).toBe(0);

    const report = store.restoreFullBackupJson(backup, 'replace');
    expect(report.restoredTransactions).toBeGreaterThan(0);
    expect(report.restoredAccounts).toBeGreaterThan(0);

    expect(() =>
      mergeTransactions([
        {
          id: 'tr1',
          date: '2026-11-19',
          amount: 1000,
          type: 'transfer',
          categoryId: 'transfer',
          accountId: 'city_bank',
          targetAccountId: 'bkash',
          createdAt: 1,
          updatedAt: 1
        },
        {
          id: 'tr2',
          date: '2026-11-19',
          amount: 2000,
          type: 'transfer',
          categoryId: 'transfer',
          accountId: 'city_bank',
          targetAccountId: 'nagad',
          createdAt: 2,
          updatedAt: 2
        }
      ])
    ).toThrow('Cannot merge transfer transactions with different target accounts');
  });

  it('strips underscores and emits optional open directives in Beancount export (Fixes M6)', () => {
    const entries = generateDoubleEntryJournal(
      [
        {
          id: 'tx-b1',
          date: '2026-11-19',
          amount: 500,
          type: 'expense',
          categoryId: 'cat_food_1',
          accountId: 'cash_wallet_1',
          note: 'Line 1\nLine 2',
          createdAt: 1,
          updatedAt: 1
        }
      ],
      [],
      []
    );
    const out = exportJournalToBeancount(entries, 'BDT', { includeOpenDirectives: true });
    expect(out).toContain('1970-01-01 open Assets:cashwallet1 BDT');
    expect(out).toContain('1970-01-01 open Expenses:catfood1 BDT');
    expect(out).not.toContain('_');
  });
});
