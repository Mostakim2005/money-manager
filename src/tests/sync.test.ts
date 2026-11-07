import { describe, it, expect } from 'vitest';
import {
  createSQLiteConnection,
  parseRealbyteSqliteVault,
  createMockSqliteBinary,
  type RealbyteSQLiteDump,
} from '../modules/database/sqliteVault';
import {
  computeTransactionFingerprint,
  reconcileRealbyteSync,
} from '../modules/sync/syncCoordinator';
import { normalizePcManagerData } from '../modules/realbyte/client';
import type { Account, Category, Transaction } from '../types';

describe('SQLite Vault PRAGMA & Concurrency (Trap 3)', () => {
  it('enforces WAL journal_mode, NORMAL synchronous, and 5000ms busy_timeout', async () => {
    const conn = createSQLiteConnection();
    await conn.open();

    const pragmaCheck = conn.verifyPragmas();
    expect(pragmaCheck.walMode).toBe(true);
    expect(pragmaCheck.synchronousNormal).toBe(true);
    expect(pragmaCheck.busyTimeoutConfigured).toBe(true);

    expect(conn.executedStatements).toContain('PRAGMA journal_mode=WAL;');
    expect(conn.executedStatements).toContain('PRAGMA synchronous=NORMAL;');
    expect(conn.executedStatements).toContain('PRAGMA busy_timeout=5000;');
    expect(conn.isOpen).toBe(true);
  });

  it('executes atomic transaction with BEGIN IMMEDIATE and COMMIT on success', async () => {
    const conn = createSQLiteConnection();
    await conn.open();

    const result = await conn.withAtomicTransaction(async () => {
      expect(conn.inTransaction).toBe(true);
      await conn.execute("INSERT INTO test_table VALUES ('record_1');");
      return 'success_payload';
    });

    expect(result).toBe('success_payload');
    expect(conn.inTransaction).toBe(false);
    expect(conn.executedStatements).toContain('BEGIN IMMEDIATE');
    expect(conn.executedStatements).toContain("INSERT INTO test_table VALUES ('record_1');");
    expect(conn.executedStatements).toContain('COMMIT');
  });

  it('executes atomic rollback on error, re-throws, and resets inTransaction state', async () => {
    const conn = createSQLiteConnection();
    await conn.open();

    await expect(
      conn.withAtomicTransaction(async () => {
        expect(conn.inTransaction).toBe(true);
        await conn.execute("INSERT INTO test_table VALUES ('record_fail');");
        throw new Error('Database disk I/O simulated failure');
      })
    ).rejects.toThrow('Database disk I/O simulated failure');

    expect(conn.inTransaction).toBe(false);
    expect(conn.executedStatements).toContain('BEGIN IMMEDIATE');
    expect(conn.executedStatements).toContain("INSERT INTO test_table VALUES ('record_fail');");
    expect(conn.executedStatements).toContain('ROLLBACK');
    expect(conn.executedStatements).not.toContain('COMMIT');
  });
});

describe('Realbyte SQLite Backup Parser (sqliteVault.ts)', () => {
  const sampleDump: RealbyteSQLiteDump = {
    assets: [
      { UID: 1, NAME: 'Cash Wallet', AMOUNT: 3500, ASSET_TYPE: 'cash', CURRENCY: 'BDT' },
      { UID: 2, NAME: 'City Bank Account', AMOUNT: 75000, ASSET_TYPE: 'bank', CURRENCY: 'BDT' },
    ],
    categories: [
      { UID: 10, NAME: 'Groceries', DO_TYPE: '1' },
      { UID: 20, NAME: 'Salary', DO_TYPE: '0' },
    ],
    inoutcome: [
      {
        UID: 101,
        WDATE: 1730980800000, // 2024-11-07
        UTIME: 1730980800000,
        DO_TYPE: '1', // Expense
        MONEY: 450,
        ASSET_UID: 1,
        CATEGORY_UID: 10,
        NOTE: 'Supermarket vegetables',
        DESCRIPTION: 'Agora Superstore',
      },
      {
        UID: 102,
        WDATE: 1730984400000,
        UTIME: 1730984400000,
        DO_TYPE: '0', // Income
        MONEY: 85000,
        ASSET_UID: 2,
        CATEGORY_UID: 20,
        NOTE: 'Monthly Consulting',
        DESCRIPTION: 'Client Retainer',
      },
      {
        UID: 103,
        WDATE: 1730988000000,
        UTIME: 1730988000000,
        DO_TYPE: '2', // Transfer
        MONEY: 5000,
        ASSET_UID: 2,
        TO_ASSET_UID: 1,
        CATEGORY_UID: 10,
        NOTE: 'ATM Cash Withdrawal',
        DESCRIPTION: 'City Bank ATM',
      },
    ],
  };

  it('correctly parses structured JSON dump with income, expense, and transfer', () => {
    const parsed = parseRealbyteSqliteVault(sampleDump);

    expect(parsed.accounts.length).toBe(2);
    expect(parsed.categories.length).toBe(2);
    expect(parsed.transactions.length).toBe(3);

    // Expense
    const expenseTxn = parsed.transactions.find(t => t.id === 'rb-txn-101')!;
    expect(expenseTxn.type).toBe('expense');
    expect(expenseTxn.amount).toBe(450);
    expect(expenseTxn.accountId).toBe('rb-acc-1');
    expect(expenseTxn.categoryId).toBe('rb-cat-10');
    expect(expenseTxn.externalUid).toBe('rb-uid-101');
    expect(expenseTxn.syncSource).toBe('realbyte_sqlite_backup');
    expect(expenseTxn.fingerprint).toBeDefined();

    // Income
    const incomeTxn = parsed.transactions.find(t => t.id === 'rb-txn-102')!;
    expect(incomeTxn.type).toBe('income');
    expect(incomeTxn.amount).toBe(85000);
    expect(incomeTxn.accountId).toBe('rb-acc-2');

    // Transfer
    const transferTxn = parsed.transactions.find(t => t.id === 'rb-txn-103')!;
    expect(transferTxn.type).toBe('transfer');
    expect(transferTxn.amount).toBe(5000);
    expect(transferTxn.accountId).toBe('rb-acc-2');
    expect(transferTxn.targetAccountId).toBe('rb-acc-1');
  });

  it('correctly parses raw SQL dump statements with strings, escapes, and commas', () => {
    const sqlDump = `
      BEGIN TRANSACTION;
      CREATE TABLE INOUTCOME (UID INTEGER, WDATE INTEGER, UTIME INTEGER, DO_TYPE TEXT, MONEY REAL, ASSET_UID INTEGER, TO_ASSET_UID INTEGER, CATEGORY_UID INTEGER, NOTE TEXT, DESCRIPTION TEXT);
      INSERT INTO INOUTCOME (UID, WDATE, UTIME, DO_TYPE, MONEY, ASSET_UID, TO_ASSET_UID, CATEGORY_UID, NOTE, DESCRIPTION)
      VALUES (201, 1730980800000, 1730980800000, '1', 650.50, 5, NULL, 15, 'Fish, Chicken & Beef', 'Karwan Bazar');
      INSERT INTO ASSETS (UID, NAME, AMOUNT, ASSET_TYPE) VALUES (5, 'bKash Wallet', 12500, 'mfs');
      INSERT INTO ZCATEGORY (UID, NAME, DO_TYPE) VALUES (15, 'Food & Groceries', '1');
      COMMIT;
    `;

    const parsed = parseRealbyteSqliteVault(sqlDump);
    expect(parsed.transactions.length).toBe(1);
    expect(parsed.accounts.length).toBe(1);
    expect(parsed.categories.length).toBe(1);

    expect(parsed.transactions[0].id).toBe('rb-txn-201');
    expect(parsed.transactions[0].amount).toBe(650.5);
    expect(parsed.transactions[0].note).toBe('Fish, Chicken & Beef');
    expect(parsed.transactions[0].description).toBe('Karwan Bazar');
    expect(parsed.accounts[0].name).toBe('bKash Wallet');
    expect(parsed.accounts[0].type).toBe('mfs');
    expect(parsed.categories[0].name).toBe('Food & Groceries');
  });

  it('correctly parses binary SQLite buffer verifying "SQLite format 3\\0" 16-byte header', () => {
    const binaryVault = createMockSqliteBinary(sampleDump);
    const parsed = parseRealbyteSqliteVault(binaryVault);

    expect(parsed.transactions.length).toBe(3);
    expect(parsed.accounts.length).toBe(2);
    expect(parsed.categories.length).toBe(2);
  });

  it('rejects corrupted binary buffers lacking "SQLite format 3\\0" header', () => {
    const corruptedBuffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(() => parseRealbyteSqliteVault(corruptedBuffer)).toThrow(
      'Invalid SQLite binary buffer: missing "SQLite format 3" header'
    );
  });
});

describe('Realbyte PC Manager Client & Normalizer (client.ts)', () => {
  it('normalizes PC Manager JSON into domain transactions with deterministic fingerprint', () => {
    const rawPcManagerPayload = {
      assets: [{ uid: 1, name: 'Cash', amount: 3500, asset_type: 'cash' }],
      categories: [{ uid: 10, name: 'Groceries', do_type: '1' }],
      inoutcome: [
        {
          uid: 501,
          wdate: 1730980800000,
          utime: 1730980800000,
          do_type: '1',
          money: 300,
          asset_uid: 1,
          category_uid: 10,
          note: 'Morning Breakfast',
          description: 'Local Bakery',
        },
      ],
    };

    const normalized = normalizePcManagerData(rawPcManagerPayload);
    expect(normalized.transactions.length).toBe(1);
    expect(normalized.accounts.length).toBe(1);
    expect(normalized.categories.length).toBe(1);

    const txn = normalized.transactions[0];
    expect(txn.syncSource).toBe('realbyte_pc_manager');
    expect(txn.externalUid).toBe('rb-uid-501');
    expect(txn.id).toBe('rb-txn-501');
    expect(txn.fingerprint).toBeDefined();

    // Verify deterministic fingerprint matches between PC Manager and SQLite vault
    const sqliteEquivalent = parseRealbyteSqliteVault({
      inoutcome: [
        {
          UID: 501,
          WDATE: 1730980800000,
          UTIME: 1730980800000,
          DO_TYPE: '1',
          MONEY: 300,
          ASSET_UID: 1,
          CATEGORY_UID: 10,
          NOTE: 'Morning Breakfast',
          DESCRIPTION: 'Local Bakery',
        },
      ],
    });

    expect(txn.fingerprint).toBe(sqliteEquivalent.transactions[0].fingerprint);
  });
});

describe('Zero Collision & Zero Duplicate Reconciliation (syncCoordinator.ts)', () => {
  it('guarantees 0 duplicate records when syncing via PC Manager first, then SQLite backup', () => {
    const rawData = {
      accounts: [{ uid: 1, name: 'City Bank', amount: 50000, asset_type: 'bank' }],
      categories: [{ uid: 10, name: 'Dining', do_type: '1' }],
      transactions: [
        {
          uid: 1001,
          wdate: 1730980800000,
          utime: 1730980800000,
          do_type: '1',
          money: 750,
          asset_uid: 1,
          category_uid: 10,
          note: 'Dinner with colleagues',
        },
        {
          uid: 1002,
          wdate: 1730984400000,
          utime: 1730984400000,
          do_type: '0',
          money: 12000,
          asset_uid: 1,
          category_uid: 10,
          note: 'Freelance Design',
        },
      ],
    };

    const pcData = normalizePcManagerData(rawData);

    // Initial state: empty ledger
    const initialState = { transactions: [], accounts: [], categories: [] };

    // Pass 1: Sync from Realbyte PC Manager Wi-Fi
    const pass1 = reconcileRealbyteSync(
      initialState,
      { transactions: pcData.transactions, accounts: pcData.accounts, categories: pcData.categories },
      'realbyte_pc_manager',
      true
    );

    expect(pass1.report.insertedTransactions).toBe(2);
    expect(pass1.report.skippedDuplicates).toBe(0);
    expect(pass1.report.updatedTransactions).toBe(0);
    expect(pass1.transactions.length).toBe(2);
    expect(pass1.report.walModeVerified).toBe(true);

    // Pass 2: Sync the exact same data from a subsequent SQLite backup vault file
    const sqliteData = parseRealbyteSqliteVault({
      assets: [{ UID: 1, NAME: 'City Bank', AMOUNT: 50000, ASSET_TYPE: 'bank' }],
      categories: [{ UID: 10, NAME: 'Dining', DO_TYPE: '1' }],
      inoutcome: [
        {
          UID: 1001,
          WDATE: 1730980800000,
          UTIME: 1730980800000,
          DO_TYPE: '1',
          MONEY: 750,
          ASSET_UID: 1,
          CATEGORY_UID: 10,
          NOTE: 'Dinner with colleagues',
        },
        {
          UID: 1002,
          WDATE: 1730984400000,
          UTIME: 1730984400000,
          DO_TYPE: '0',
          MONEY: 12000,
          ASSET_UID: 1,
          CATEGORY_UID: 10,
          NOTE: 'Freelance Design',
        },
      ],
    });

    const pass2 = reconcileRealbyteSync(
      { transactions: pass1.transactions, accounts: pass1.accounts, categories: pass1.categories },
      { transactions: sqliteData.transactions, accounts: sqliteData.accounts, categories: sqliteData.categories },
      'realbyte_sqlite_backup',
      true
    );

    // STRICT VERIFICATION: Exactly 0 inserted, 2 skipped duplicates!
    expect(pass2.report.insertedTransactions).toBe(0);
    expect(pass2.report.skippedDuplicates).toBe(2);
    expect(pass2.report.updatedTransactions).toBe(0);
    expect(pass2.transactions.length).toBe(2);
  });

  it('guarantees 0 duplicate records in reverse order (SQLite backup first, then PC Manager)', () => {
    const rawSqliteDump: RealbyteSQLiteDump = {
      assets: [{ UID: 1, NAME: 'Cash', AMOUNT: 2000, ASSET_TYPE: 'cash' }],
      categories: [{ UID: 5, NAME: 'Transit', DO_TYPE: '1' }],
      inoutcome: [
        {
          UID: 801,
          WDATE: 1730980800000,
          UTIME: 1730980800000,
          DO_TYPE: '1',
          MONEY: 80,
          ASSET_UID: 1,
          CATEGORY_UID: 5,
          NOTE: 'Metro rail fare',
        },
      ],
    };

    const sqliteData = parseRealbyteSqliteVault(rawSqliteDump);
    const pass1 = reconcileRealbyteSync(
      { transactions: [], accounts: [], categories: [] },
      sqliteData,
      'realbyte_sqlite_backup',
      true
    );

    expect(pass1.report.insertedTransactions).toBe(1);
    expect(pass1.transactions.length).toBe(1);

    // Pass 2 via PC Manager Wi-Fi
    const pcData = normalizePcManagerData({
      assets: [{ uid: 1, name: 'Cash', amount: 2000, asset_type: 'cash' }],
      categories: [{ uid: 5, name: 'Transit', do_type: '1' }],
      transactions: [
        {
          uid: 801,
          wdate: 1730980800000,
          utime: 1730980800000,
          do_type: '1',
          money: 80,
          asset_uid: 1,
          category_uid: 5,
          note: 'Metro rail fare',
        },
      ],
    });

    const pass2 = reconcileRealbyteSync(
      { transactions: pass1.transactions, accounts: pass1.accounts, categories: pass1.categories },
      pcData,
      'realbyte_pc_manager',
      true
    );

    expect(pass2.report.insertedTransactions).toBe(0);
    expect(pass2.report.skippedDuplicates).toBe(1);
    expect(pass2.transactions.length).toBe(1);
  });

  it('deduplicates via deterministic fingerprint when externalUid is missing on existing transaction', () => {
    // Existing transaction logged locally without externalUid
    const existingTxn: Transaction = {
      id: 'local-manual-1',
      date: '2024-11-07',
      type: 'expense',
      amount: 1500,
      accountId: 'rb-acc-1',
      categoryId: 'rb-cat-2',
      note: 'Grocery store receipt',
      createdAt: 1730980800000,
      updatedAt: 1730980800000,
    };
    existingTxn.fingerprint = computeTransactionFingerprint(existingTxn);

    // Incoming from Realbyte with same details + externalUid
    const incomingTxn: Transaction = {
      id: 'rb-txn-999',
      externalUid: 'rb-uid-999',
      date: '2024-11-07',
      type: 'expense',
      amount: 1500,
      accountId: 'rb-acc-1',
      categoryId: 'rb-cat-2',
      note: 'Grocery store receipt',
      createdAt: 1730980800000,
      updatedAt: 1730980800000,
    };

    const result = reconcileRealbyteSync(
      { transactions: [existingTxn], accounts: [], categories: [] },
      { transactions: [incomingTxn] },
      'realbyte_pc_manager',
      true
    );

    expect(result.report.insertedTransactions).toBe(0);
    expect(result.report.skippedDuplicates).toBe(1);
    expect(result.transactions.length).toBe(1);
    // Verifies externalUid was backfilled onto the matched record
    expect(result.transactions[0].externalUid).toBe('rb-uid-999');
  });
});

describe('Last-Write-Wins (LWW) Conflict Resolution', () => {
  it('updates existing transaction when incoming record has a newer updatedAt timestamp', () => {
    const existingTxn: Transaction = {
      id: 'rb-txn-301',
      externalUid: 'rb-uid-301',
      date: '2024-11-07',
      type: 'expense',
      amount: 500,
      accountId: 'acc-1',
      categoryId: 'cat-1',
      note: 'Coffee',
      createdAt: 1000,
      updatedAt: 1000,
    };

    const initialAccount: Account = {
      id: 'acc-1',
      name: 'Cash',
      balance: 10000,
      currency: 'BDT',
      type: 'cash',
    };

    // Incoming updated on phone with newer amount and newer timestamp
    const incomingTxn: Transaction = {
      id: 'rb-txn-301',
      externalUid: 'rb-uid-301',
      date: '2024-11-07',
      type: 'expense',
      amount: 650, // increased from 500 to 650
      accountId: 'acc-1',
      categoryId: 'cat-1',
      note: 'Coffee with snack',
      createdAt: 1000,
      updatedAt: 2000, // newer!
    };

    const result = reconcileRealbyteSync(
      { transactions: [existingTxn], accounts: [initialAccount], categories: [] },
      { transactions: [incomingTxn] },
      'realbyte_sqlite_backup',
      true,
      { adjustAccountBalances: true }
    );

    expect(result.report.updatedTransactions).toBe(1);
    expect(result.report.insertedTransactions).toBe(0);
    expect(result.report.skippedDuplicates).toBe(0);

    const updated = result.transactions[0];
    expect(updated.amount).toBe(650);
    expect(updated.note).toBe('Coffee with snack');
    expect(updated.updatedAt).toBe(2000);

    // Balance reflects the 150 BDT additional expense (10000 - 150 = 9850)
    const acc = result.accounts.find(a => a.id === 'acc-1')!;
    expect(acc.balance).toBe(9850);
  });

  it('preserves existing transaction when incoming record has older or equal updatedAt timestamp', () => {
    const existingTxn: Transaction = {
      id: 'rb-txn-302',
      externalUid: 'rb-uid-302',
      date: '2024-11-07',
      type: 'expense',
      amount: 1000,
      accountId: 'acc-1',
      categoryId: 'cat-1',
      note: 'Latest note',
      createdAt: 1000,
      updatedAt: 3000, // Newer on PC
    };

    // Stale incoming from an older phone backup
    const incomingTxn: Transaction = {
      id: 'rb-txn-302',
      externalUid: 'rb-uid-302',
      date: '2024-11-07',
      type: 'expense',
      amount: 800,
      accountId: 'acc-1',
      categoryId: 'cat-1',
      note: 'Old note',
      createdAt: 1000,
      updatedAt: 2000, // Older than existing
    };

    const result = reconcileRealbyteSync(
      { transactions: [existingTxn], accounts: [], categories: [] },
      { transactions: [incomingTxn] },
      'realbyte_sqlite_backup',
      true
    );

    expect(result.report.updatedTransactions).toBe(0);
    expect(result.report.skippedDuplicates).toBe(1);
    expect(result.transactions[0].amount).toBe(1000);
    expect(result.transactions[0].note).toBe('Latest note');
  });
});

describe('Accounts and Categories Reconciliation', () => {
  it('merges accounts and categories by name or externalUid and remaps transaction foreign keys', () => {
    const existingAccount: Account = {
      id: 'acc-existing-1',
      name: 'City Bank',
      balance: 20000,
      currency: 'BDT',
      type: 'bank',
    };

    const existingCategory: Category = {
      id: 'cat-existing-1',
      name: 'Utilities',
      type: 'expense',
    };

    const incomingAccount: Account = {
      id: 'rb-acc-55',
      externalUid: 'rb-uid-55',
      name: 'city bank', // case-insensitive match
      balance: 25000,
      currency: 'BDT',
      type: 'bank',
      updatedAt: 2000,
    };

    const incomingCategory: Category = {
      id: 'rb-cat-77',
      externalUid: 'rb-uid-77',
      name: 'utilities',
      type: 'expense',
    };

    const incomingTxn: Transaction = {
      id: 'rb-txn-12',
      externalUid: 'rb-uid-12',
      date: '2024-11-07',
      type: 'expense',
      amount: 1200,
      accountId: 'rb-acc-55', // references incoming account id
      categoryId: 'rb-cat-77', // references incoming category id
      note: 'Electricity Bill',
      createdAt: 1000,
      updatedAt: 1000,
    };

    const result = reconcileRealbyteSync(
      {
        transactions: [],
        accounts: [existingAccount],
        categories: [existingCategory],
      },
      {
        transactions: [incomingTxn],
        accounts: [incomingAccount],
        categories: [incomingCategory],
      },
      'realbyte_sqlite_backup',
      true
    );

    expect(result.report.mergedAccounts).toBe(1);
    expect(result.report.mergedCategories).toBe(1);
    expect(result.accounts.length).toBe(1);
    expect(result.categories.length).toBe(1);

    // Foreign keys were remapped to existing account and category IDs
    expect(result.transactions[0].accountId).toBe('acc-existing-1');
    expect(result.transactions[0].categoryId).toBe('cat-existing-1');
    // Account externalUid backfilled
    expect(result.accounts[0].externalUid).toBe('rb-uid-55');
  });
});
