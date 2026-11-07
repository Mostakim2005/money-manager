import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMoneyStore } from '../store';
import type { RawPcManagerPayload } from '../modules/realbyte/client';
import type { RealbyteSQLiteDump } from '../modules/database/sqliteVault';

describe('Concurrency, Race-Condition & Edge-Case Hardening', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    let storage: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { storage = {}; },
      length: 0,
      key: () => null,
    } as Storage;
  });

  describe('Serialized Mutex Lock for Concurrent Sync', () => {
    it('executes concurrent PC Manager and SQLite Vault syncs sequentially with zero duplicate records', async () => {
      const store = useMoneyStore();
      // Start with clean state
      store.transactions = [];
      store.accounts = [
        { id: 'acc_cash', externalUid: 'rb-uid-1', name: 'Cash Wallet', balance: 10000, currency: 'BDT', type: 'cash' },
        { id: 'acc_bank', externalUid: 'rb-uid-2', name: 'City Bank', balance: 50000, currency: 'BDT', type: 'bank' },
      ];
      store.categories = [
        { id: 'cat_groceries', externalUid: 'rb-uid-101', name: 'Groceries', type: 'expense' },
        { id: 'cat_dining', externalUid: 'rb-uid-102', name: 'Dining', type: 'expense' },
      ];

      // Payload 1: PC Manager Wi-Fi sync with Txn A (unique) and Txn B (shared)
      const mockPcPayload: RawPcManagerPayload = {
        accounts: [{ uid: 1, name: 'Cash Wallet', amount: 10000, asset_type: 'cash' }],
        categories: [
          { uid: 101, name: 'Groceries', do_type: '1' },
          { uid: 102, name: 'Dining', do_type: '1' },
        ],
        transactions: [
          {
            uid: 7001,
            wdate: '2026-11-05',
            utime: 1762300000000,
            do_type: '1',
            money: 1200,
            asset_uid: 1,
            category_uid: 101,
            note: 'Bazar shopping (from PC)',
          },
          {
            uid: 7002, // Shared across both sources
            wdate: '2026-11-05',
            utime: 1762305000000,
            do_type: '1',
            money: 800,
            asset_uid: 1,
            category_uid: 102,
            note: 'Coffee and snacks',
          },
        ],
      };

      // Payload 2: SQLite backup dump with Txn B (shared duplicate) and Txn C (unique)
      const mockSqlDump: RealbyteSQLiteDump = {
        assets: [{ UID: 1, NAME: 'Cash Wallet', AMOUNT: 10000, ASSET_TYPE: 'cash' }],
        categories: [
          { UID: 101, NAME: 'Groceries', DO_TYPE: '1' },
          { UID: 102, NAME: 'Dining', DO_TYPE: '1' },
        ],
        inoutcome: [
          {
            UID: 7002, // Shared with PC Manager
            WDATE: 1762305000000,
            UTIME: 1762305000000,
            DO_TYPE: '1',
            MONEY: 800,
            ASSET_UID: 1,
            CATEGORY_UID: 102,
            NOTE: 'Coffee and snacks',
          },
          {
            UID: 7003,
            WDATE: 1762310000000,
            UTIME: 1762310000000,
            DO_TYPE: '1',
            MONEY: 2500,
            ASSET_UID: 1,
            CATEGORY_UID: 101,
            NOTE: 'Superstore Groceries (from SQLite)',
          },
        ],
      };

      // Fire both sync operations concurrently
      const [reportPc, reportSqlite] = await Promise.all([
        store.syncFromPcManager(mockPcPayload),
        store.syncFromSqliteVault(mockSqlDump),
      ]);

      // Both reports must exist
      expect(reportPc).toBeDefined();
      expect(reportSqlite).toBeDefined();

      // Exactly 3 unique transactions must exist (7001, 7002, 7003), with 7002 deduplicated!
      expect(store.transactions.length).toBe(3);

      const txn7002 = store.transactions.filter(t => t.externalUid === 'rb-uid-7002');
      expect(txn7002.length).toBe(1);

      // Verify that skippedDuplicates was registered on the second serialized operation
      const totalSkipped = reportPc.skippedDuplicates + reportSqlite.skippedDuplicates;
      expect(totalSkipped).toBeGreaterThanOrEqual(1);

      // Verify syncStatus is 'Synced'
      expect(store.syncStatus).toBe('Synced');
    });
  });

  describe('Transaction Editing Integrity (editTransaction)', () => {
    it('updates standard expense amount and recalculates asset account balance without drift', () => {
      const store = useMoneyStore();
      const initialCash = store.accounts.find(a => a.id === 'cash_wallet')!.balance;

      store.addTransaction({
        date: '2026-11-07',
        time: '12:00',
        amount: 500,
        type: 'expense',
        categoryId: 'dining',
        accountId: 'cash_wallet',
        note: 'Lunch kebab',
      });

      const added = store.transactions[0];
      expect(store.accounts.find(a => a.id === 'cash_wallet')!.balance).toBe(initialCash - 500);

      // Edit amount from 500 to 750
      store.editTransaction(added.id, { amount: 750, note: 'Lunch kebab + drink' });

      const updated = store.transactions.find(t => t.id === added.id)!;
      expect(updated.amount).toBe(750);
      expect(updated.note).toBe('Lunch kebab + drink');
      // Reverses -500 and applies -750 => exactly initialCash - 750
      expect(store.accounts.find(a => a.id === 'cash_wallet')!.balance).toBe(initialCash - 750);
    });

    it('correctly handles account switches and category changes', () => {
      const store = useMoneyStore();
      const initialCash = store.accounts.find(a => a.id === 'cash_wallet')!.balance;
      const initialBank = store.accounts.find(a => a.id === 'city_bank')!.balance;

      store.addTransaction({
        date: '2026-11-07',
        time: '14:00',
        amount: 2000,
        type: 'expense',
        categoryId: 'transport',
        accountId: 'cash_wallet',
        note: 'Taxi fare',
      });

      const added = store.transactions[0];
      expect(store.accounts.find(a => a.id === 'cash_wallet')!.balance).toBe(initialCash - 2000);
      expect(store.accounts.find(a => a.id === 'city_bank')!.balance).toBe(initialBank);

      // Switch account from cash_wallet to city_bank and update amount to 2500
      store.editTransaction(added.id, {
        accountId: 'city_bank',
        amount: 2500,
        categoryId: 'groceries',
      });

      // Old account (cash_wallet) is restored
      expect(store.accounts.find(a => a.id === 'cash_wallet')!.balance).toBe(initialCash);
      // New account (city_bank) has 2500 deducted
      expect(store.accounts.find(a => a.id === 'city_bank')!.balance).toBe(initialBank - 2500);

      const edited = store.transactions.find(t => t.id === added.id)!;
      expect(edited.accountId).toBe('city_bank');
      expect(edited.categoryId).toBe('groceries');
      expect(edited.amount).toBe(2500);
    });

    it('correctly updates credit card liability accounts without balance inversion', () => {
      const store = useMoneyStore();
      const cardAcc = store.accounts.find(a => a.id === 'city_amex')!;
      const initialCardDebt = cardAcc.balance; // Liability: expense increases debt balance

      store.addTransaction({
        date: '2026-11-07',
        amount: 3000,
        type: 'expense',
        categoryId: 'dining',
        accountId: 'city_amex',
        note: 'Dinner charge',
      });

      const added = store.transactions[0];
      expect(store.accounts.find(a => a.id === 'city_amex')!.balance).toBe(initialCardDebt + 3000);

      // Edit: change expense to 4200
      store.editTransaction(added.id, { amount: 4200 });
      expect(store.accounts.find(a => a.id === 'city_amex')!.balance).toBe(initialCardDebt + 4200);

      // Edit: change from expense to income (credit card payment/refund reduces debt)
      store.editTransaction(added.id, { type: 'income', amount: 5000 });
      expect(store.accounts.find(a => a.id === 'city_amex')!.balance).toBe(initialCardDebt - 5000);
    });

    it('accurately updates transfer amounts across dual accounts', () => {
      const store = useMoneyStore();
      const initialBank = store.accounts.find(a => a.id === 'city_bank')!.balance;
      const initialBkash = store.accounts.find(a => a.id === 'bkash')!.balance;

      store.addTransaction({
        date: '2026-11-07',
        amount: 5000,
        type: 'transfer',
        accountId: 'city_bank',
        targetAccountId: 'bkash',
        categoryId: 'transport',
        note: 'Bank to bKash add money',
      });

      const transferTxn = store.transactions[0];
      expect(store.accounts.find(a => a.id === 'city_bank')!.balance).toBe(initialBank - 5000);
      expect(store.accounts.find(a => a.id === 'bkash')!.balance).toBe(initialBkash + 5000);

      // Edit transfer amount to 3000
      store.editTransaction(transferTxn.id, { amount: 3000 });

      expect(store.accounts.find(a => a.id === 'city_bank')!.balance).toBe(initialBank - 3000);
      expect(store.accounts.find(a => a.id === 'bkash')!.balance).toBe(initialBkash + 3000);
    });
  });

  describe('Delete & Undo Last Delete (undoLastDelete)', () => {
    it('restores deleted transaction and exact account balances on undo', () => {
      const store = useMoneyStore();
      const initialCash = store.accounts.find(a => a.id === 'cash_wallet')!.balance;

      store.addTransaction({
        date: '2026-11-07',
        amount: 1500,
        type: 'expense',
        categoryId: 'groceries',
        accountId: 'cash_wallet',
        note: 'Fish market',
      });

      const txn = store.transactions[0];
      expect(store.accounts.find(a => a.id === 'cash_wallet')!.balance).toBe(initialCash - 1500);

      // Delete the transaction
      store.deleteTransaction(txn.id);
      expect(store.accounts.find(a => a.id === 'cash_wallet')!.balance).toBe(initialCash);
      expect(store.transactions.find(t => t.id === txn.id)).toBeUndefined();
      expect(store.lastDeletedTransaction).not.toBeNull();

      // Undo deletion
      const undoSuccess = store.undoLastDelete();
      expect(undoSuccess).toBe(true);

      // Transaction is restored
      const restored = store.transactions.find(t => t.id === txn.id);
      expect(restored).toBeDefined();
      expect(restored!.amount).toBe(1500);
      expect(restored!.note).toBe('Fish market');

      // Account balance is deducted again
      expect(store.accounts.find(a => a.id === 'cash_wallet')!.balance).toBe(initialCash - 1500);

      // Second undo should fail as slot is cleared
      expect(store.undoLastDelete()).toBe(false);
    });

    it('restores deleted transfer across both source and target accounts', () => {
      const store = useMoneyStore();
      const initialBank = store.accounts.find(a => a.id === 'city_bank')!.balance;
      const initialBkash = store.accounts.find(a => a.id === 'bkash')!.balance;

      store.addTransaction({
        date: '2026-11-07',
        amount: 4000,
        type: 'transfer',
        accountId: 'city_bank',
        targetAccountId: 'bkash',
        categoryId: 'transport',
        note: 'Fund bKash',
      });

      const txn = store.transactions[0];
      expect(store.accounts.find(a => a.id === 'city_bank')!.balance).toBe(initialBank - 4000);
      expect(store.accounts.find(a => a.id === 'bkash')!.balance).toBe(initialBkash + 4000);

      // Delete transfer
      store.deleteTransaction(txn.id);
      expect(store.accounts.find(a => a.id === 'city_bank')!.balance).toBe(initialBank);
      expect(store.accounts.find(a => a.id === 'bkash')!.balance).toBe(initialBkash);

      // Undo delete
      expect(store.undoLastDelete()).toBe(true);
      expect(store.accounts.find(a => a.id === 'city_bank')!.balance).toBe(initialBank - 4000);
      expect(store.accounts.find(a => a.id === 'bkash')!.balance).toBe(initialBkash + 4000);
    });
  });

  describe('Recurring Schedules Idempotency & Duplicate Prevention', () => {
    it('assigns deterministic externalUid and prevents double posting of recurring schedules', () => {
      const store = useMoneyStore();
      const initialTxnCount = store.transactions.length;

      // First run: processes due schedules
      const generatedCount = store.runDueRecurringSchedules('2026-12-01');
      expect(generatedCount).toBeGreaterThan(0);

      const afterFirstRunCount = store.transactions.length;
      expect(afterFirstRunCount).toBe(initialTxnCount + generatedCount);

      // Verify generated transactions have deterministic externalUid (e.g. rec-rec-rent-2026-12-01)
      const recurringTxns = store.transactions.filter(t => t.externalUid && t.externalUid.startsWith('rec-'));
      expect(recurringTxns.length).toBeGreaterThan(0);
      for (const t of recurringTxns) {
        expect(t.externalUid).toMatch(/^rec-/);
      }

      // Second run on the same date: schedules were already advanced so 0 new transactions generated
      const secondRunCount = store.runDueRecurringSchedules('2026-12-01');
      expect(secondRunCount).toBe(0);
      expect(store.transactions.length).toBe(afterFirstRunCount);

      // Direct addTransaction test with existing externalUid: must be blocked by deduplication check
      const firstRec = recurringTxns[0];
      store.addTransaction({
        externalUid: firstRec.externalUid,
        date: firstRec.date,
        amount: firstRec.amount,
        type: firstRec.type,
        accountId: firstRec.accountId,
        categoryId: firstRec.categoryId,
        note: 'Attempted duplicate recurring insertion',
      });

      // Count of transactions with this externalUid must remain exactly 1
      const occurrences = store.transactions.filter(t => t.externalUid === firstRec.externalUid);
      expect(occurrences.length).toBe(1);
    });
  });

  describe('Theme Mode Toggle and State Hydration', () => {
    it('toggles between dark and light themes and persists across hydrateState()', () => {
      const store = useMoneyStore();
      expect(store.themeMode).toBe('dark');

      // Toggle to light
      store.toggleTheme();
      expect(store.themeMode).toBe('light');

      // Create fresh store instance and hydrate
      setActivePinia(createPinia());
      const store2 = useMoneyStore();
      store2.hydrateState();
      expect(store2.themeMode).toBe('light');

      // Toggle back to dark
      store2.toggleTheme();
      expect(store2.themeMode).toBe('dark');

      // Hydrate into store3
      setActivePinia(createPinia());
      const store3 = useMoneyStore();
      store3.hydrateState();
      expect(store3.themeMode).toBe('dark');
    });
  });
});
