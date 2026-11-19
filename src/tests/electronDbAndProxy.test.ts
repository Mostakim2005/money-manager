import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import http from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MoneySqliteService } from '../../electron/db/sqliteService';
import { readRealbyteBinarySqlite } from '../../electron/db/realbyteReader';
import {
  checkRealbyteConnection,
  fetchRealbyteAccounts,
  fetchRealbyteCategories,
  fetchRealbyteTransactions,
  probeRealbyteEndpoints,
} from '../../electron/net/realbyteProxy';
import { parseRealbyteSqliteVault } from '../modules/database/sqliteVault';
import { reconcileRealbyteSync } from '../modules/sync/syncCoordinator';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'money-manager-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup issues on Windows handles
    }
  }
});

describe('Electron better-sqlite3 WAL Service & Realbyte Binary Reader', () => {
  it('initializes MoneySqliteService with WAL mode, foreign keys, and atomic whole-Taka round-trip', () => {
    const dir = createTempDir();
    const dbPath = path.join(dir, 'money_manager.sqlite');
    const service = new MoneySqliteService(dbPath);

    try {
      const info = service.getDbInfo();
      expect(info.journalMode.toUpperCase()).toBe('WAL');
      expect(info.foreignKeys).toBe(1);
      expect(info.busyTimeout).toBeGreaterThanOrEqual(5000);
      expect(service.loadFullState()).toBeNull();

      service.saveFullState({
        preferences: {
          themeMode: 'dark',
          budgetMode: 'cashflow_ledger',
          privacyMode: false,
          featureFlags: { enableSanchaypatra: true },
          cloudSyncPath: 'money_android.sqlite',
          phoneIp: '192.168.1.105',
          phonePort: 10000,
          lastSyncReport: null,
          syncScope: 'current_month',
          realbyteEndpointOverrides: {
            accountPath: '/moneyBook/account/select.do',
            categoryPath: '/moneyBook/category/select.do',
            ledgerPath: '/moneyBook/ledger/select.do',
          },
          exchangeRates: { BDT: 1, USD: 120 },
        },
        accounts: [
          { id: 'acc-1', name: 'City Bank', type: 'bank', balance: 50000.6, currency: 'BDT' },
        ],
        categories: [
          { id: 'cat-1', name: 'Groceries', type: 'expense', subcategories: ['Bazar'], budgetMonthlyAllocated: 12000 },
        ],
        transactions: [
          {
            id: 'tx-1',
            date: '2026-11-19',
            amount: 1450.7, // Must round to whole Taka 1451 in SQLite INTEGER column
            type: 'expense',
            categoryId: 'cat-1',
            accountId: 'acc-1',
            note: 'Shwapno shopping',
            createdAt: 1000,
            updatedAt: 2000,
          },
        ],
        sanchaypatraSchemes: [],
        fdrDpsAccounts: [],
        recurringSchedules: [],
        rules: [],
        savingsGoals: [],
        iouRecords: [],
        creditCardEmis: [],
      });

      service.appendSyncLog({
        id: 'log-1',
        source: 'realbyte_pc_manager',
        timestamp: 5000,
        insertedCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        deletedCount: 0,
        mergedAccounts: 1,
        mergedCategories: 1,
        walVerified: true,
        scopeLabel: 'current_month',
        status: 'success',
      });

      const loaded = service.loadFullState()!;
      expect(loaded).not.toBeNull();
      expect(loaded.accounts[0].balance).toBe(50001);
      expect(loaded.transactions[0].amount).toBe(1451);
      expect(loaded.categories[0].subcategories).toEqual(['Bazar']);
      expect(loaded.syncLogs).toHaveLength(1);
      expect(loaded.syncLogs![0].walVerified).toBe(true);
    } finally {
      service.close();
    }
  });

  it('reads a real binary Realbyte SQLite database and reconciles with zero duplicates', () => {
    const dir = createTempDir();
    const rbPath = path.join(dir, 'money_android.sqlite');
    const rbDb = new Database(rbPath);
    try {
      rbDb.exec(`
        CREATE TABLE ASSETS (UID INTEGER PRIMARY KEY, NAME TEXT, AMOUNT INTEGER, ASSET_TYPE TEXT, CURRENCY TEXT);
        CREATE TABLE ZCATEGORY (UID INTEGER PRIMARY KEY, NAME TEXT, DO_TYPE TEXT);
        CREATE TABLE INOUTCOME (
          UID INTEGER PRIMARY KEY, WDATE INTEGER, UTIME INTEGER, DO_TYPE TEXT,
          MONEY INTEGER, ASSET_UID INTEGER, TO_ASSET_UID INTEGER, CATEGORY_UID INTEGER, NOTE TEXT, DESCRIPTION TEXT
        );
        INSERT INTO ASSETS VALUES (1, 'Cash Wallet', 8500, 'cash', 'BDT');
        INSERT INTO ASSETS VALUES (2, 'bKash Personal', 15000, 'mfs', 'BDT');
        INSERT INTO ZCATEGORY VALUES (10, 'Groceries', '1');
        INSERT INTO INOUTCOME VALUES (1001, 1763510400000, 1763510400000, '1', 750, 1, NULL, 10, 'Fresh vegetables', 'Karwan Bazar');
        INSERT INTO INOUTCOME VALUES (1002, 1763510400000, 1763510400000, '3', 3000, 2, 1, 10, 'ATM Cash Out', 'bKash ATM');
        INSERT INTO INOUTCOME VALUES (1003, 1763510400000, 1763510400000, '4', 3000, 1, 2, 10, 'ATM Cash Out', 'bKash ATM');
      `);
    } finally {
      rbDb.close();
    }

    const fromPath = readRealbyteBinarySqlite(rbPath);
    const fromBuffer = readRealbyteBinarySqlite(readFileSync(rbPath));
    expect(fromPath.assets).toHaveLength(2);
    expect(fromBuffer.inoutcome).toHaveLength(3);

    const parsedVault = parseRealbyteSqliteVault(fromPath);
    // Paired DO_TYPE 3 & 4 must collapse into 1 canonical transfer + 1 expense = 2 transactions
    expect(parsedVault.transactions).toHaveLength(2);
    expect(parsedVault.transactions.some((t) => t.type === 'transfer' && t.amount === 3000)).toBe(true);

    const pass1 = reconcileRealbyteSync(
      { transactions: [], accounts: [], categories: [] },
      parsedVault,
      'realbyte_sqlite_backup',
      true
    );
    expect(pass1.report.insertedTransactions).toBe(2);

    const pass2 = reconcileRealbyteSync(
      { transactions: pass1.transactions, accounts: pass1.accounts, categories: pass1.categories },
      parsedVault,
      'realbyte_sqlite_backup',
      true
    );
    expect(pass2.report.insertedTransactions).toBe(0);
    expect(pass2.report.skippedDuplicates).toBe(2);

    expect(() => readRealbyteBinarySqlite(Buffer.from('not-a-sqlite-file'))).toThrow(
      'Invalid SQLite binary buffer'
    );
  });
});

describe('CORS-Free Node Realbyte HTTP Proxy', () => {
  it('fetches JSON, probes endpoints, and rejects HTML session-expired pages', async () => {
    const server = http.createServer((req, res) => {
      const reqUrl = req.url || '/';
      if (reqUrl === '/moneyBook/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      } else if (reqUrl.startsWith('/moneyBook/account/select.do')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ uid: 1, name: 'Cash Wallet', amount: 5000 }] }));
      } else if (reqUrl.startsWith('/moneyBook/category/select.do')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ uid: 10, name: 'Food', do_type: '1' }]));
      } else if (reqUrl.startsWith('/moneyBook/ledger/select.do')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ list: [{ uid: 55, money: 250, do_type: '1', asset_uid: 1, category_uid: 10 }] }));
      } else if (reqUrl.startsWith('/moneyBook/expired.do')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<!DOCTYPE html><html><body>Session Closed</body></html>');
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    const port = address.port;

    try {
      expect(await checkRealbyteConnection('127.0.0.1', port)).toBe(true);

      const accs = await fetchRealbyteAccounts('127.0.0.1', port);
      expect((accs as any).data).toHaveLength(1);

      const cats = await fetchRealbyteCategories('127.0.0.1', port);
      expect(Array.isArray(cats)).toBe(true);

      const txns = await fetchRealbyteTransactions('127.0.0.1', port, '2026-11-01', '2026-11-30');
      expect((txns as any).list).toHaveLength(1);

      const probes = await probeRealbyteEndpoints('127.0.0.1', port);
      expect(probes).toHaveLength(4);
      expect(probes.every((p) => p.ok && !p.isHtml)).toBe(true);

      // HTML session-expired detection
      await expect(
        fetchRealbyteAccounts('127.0.0.1', port, { accountPath: '/moneyBook/expired.do' })
      ).rejects.toThrow('REALBYTE_SESSION_INACTIVE');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
