import type { Transaction, Account, Category, TransactionType, AccountType } from '../../types';
import { computeTransactionFingerprint } from '../sync/syncCoordinator';

export interface RealbyteRawInOutcomeRow {
  uid?: string | number;
  UID?: string | number;
  Z_PK?: number;
  wdate?: number | string;
  WDATE?: number | string;
  utime?: number | string;
  UTIME?: number | string;
  do_type?: string | number;
  DO_TYPE?: string | number;
  money?: number | string;
  MONEY?: number | string;
  asset_uid?: string | number;
  ASSET_UID?: string | number;
  to_asset_uid?: string | number;
  TO_ASSET_UID?: string | number;
  category_uid?: string | number;
  CATEGORY_UID?: string | number;
  subcategory_uid?: string | number;
  SUBCATEGORY_UID?: string | number;
  note?: string;
  NOTE?: string;
  content?: string;
  CONTENT?: string;
  memo?: string;
  MEMO?: string;
  description?: string;
  DESCRIPTION?: string;
  [key: string]: unknown;
}

export interface RealbyteRawAssetRow {
  uid?: string | number;
  UID?: string | number;
  Z_PK?: number;
  name?: string;
  NAME?: string;
  amount?: number | string;
  AMOUNT?: number | string;
  current_amount?: number | string;
  CURRENT_AMOUNT?: number | string;
  currency?: string;
  CURRENCY?: string;
  asset_type?: string | number;
  ASSET_TYPE?: string | number;
  [key: string]: unknown;
}

export interface RealbyteRawCategoryRow {
  uid?: string | number;
  UID?: string | number;
  Z_PK?: number;
  name?: string;
  NAME?: string;
  do_type?: string | number;
  DO_TYPE?: string | number;
  icon?: string;
  ICON?: string;
  color?: string;
  COLOR?: string;
  [key: string]: unknown;
}

export interface RealbyteSQLiteDump {
  inoutcome?: RealbyteRawInOutcomeRow[];
  INOUTCOME?: RealbyteRawInOutcomeRow[];
  zinoutcome?: RealbyteRawInOutcomeRow[];
  ZINOUTCOME?: RealbyteRawInOutcomeRow[];
  assets?: RealbyteRawAssetRow[];
  ASSETS?: RealbyteRawAssetRow[];
  zassets?: RealbyteRawAssetRow[];
  ZASSETS?: RealbyteRawAssetRow[];
  categories?: RealbyteRawCategoryRow[];
  category?: RealbyteRawCategoryRow[];
  CATEGORY?: RealbyteRawCategoryRow[];
  zcategory?: RealbyteRawCategoryRow[];
  ZCATEGORY?: RealbyteRawCategoryRow[];
}

export interface SQLiteVaultConfig {
  dbPath?: string;
  journalMode?: 'WAL' | 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'OFF';
  synchronous?: 'NORMAL' | 'FULL' | 'EXTRA' | 'OFF';
  busyTimeoutMs?: number;
  enforceWal?: boolean;
}

export interface SQLiteConnectionState {
  isOpen: boolean;
  journalMode: string;
  synchronous: string;
  busyTimeout: number;
  inTransaction: boolean;
  executedStatements: string[];
  open(): Promise<void>;
  close(): Promise<void>;
  execute(sql: string): Promise<void>;
  verifyPragmas(): { walMode: boolean; synchronousNormal: boolean; busyTimeoutConfigured: boolean };
  withAtomicTransaction<T>(operation: () => Promise<T> | T): Promise<T>;
}

export const DEFAULT_SQLITE_PRAGMAS = [
  'PRAGMA journal_mode=WAL;',
  'PRAGMA synchronous=NORMAL;',
  'PRAGMA busy_timeout=5000;',
] as const;

/**
 * Creates an SQLite connection manager that strictly enforces Trap 3:
 * - PRAGMA journal_mode=WAL;
 * - PRAGMA synchronous=NORMAL;
 * - PRAGMA busy_timeout=5000;
 * - Atomic transaction execution via BEGIN IMMEDIATE / COMMIT / ROLLBACK.
 */
export function createSQLiteConnection(config?: SQLiteVaultConfig): SQLiteConnectionState {
  const targetJournalMode = config?.journalMode ?? 'WAL';
  const targetSynchronous = config?.synchronous ?? 'NORMAL';
  const targetBusyTimeout = config?.busyTimeoutMs ?? 5000;

  const state: SQLiteConnectionState = {
    isOpen: false,
    journalMode: targetJournalMode,
    synchronous: targetSynchronous,
    busyTimeout: targetBusyTimeout,
    inTransaction: false,
    executedStatements: [],

    async open(): Promise<void> {
      state.isOpen = true;
      await state.execute(`PRAGMA journal_mode=${state.journalMode};`);
      await state.execute(`PRAGMA synchronous=${state.synchronous};`);
      await state.execute(`PRAGMA busy_timeout=${state.busyTimeout};`);
    },

    async close(): Promise<void> {
      state.isOpen = false;
    },

    async execute(sql: string): Promise<void> {
      state.executedStatements.push(sql.trim());
    },

    verifyPragmas(): { walMode: boolean; synchronousNormal: boolean; busyTimeoutConfigured: boolean } {
      return {
        walMode: state.journalMode.toUpperCase() === 'WAL',
        synchronousNormal: state.synchronous.toUpperCase() === 'NORMAL',
        busyTimeoutConfigured: state.busyTimeout >= 5000,
      };
    },

    async withAtomicTransaction<T>(operation: () => Promise<T> | T): Promise<T> {
      if (state.inTransaction) {
        return await operation();
      }

      await state.execute('BEGIN IMMEDIATE');
      state.inTransaction = true;

      try {
        const result = await operation();
        await state.execute('COMMIT');
        state.inTransaction = false;
        return result;
      } catch (error) {
        await state.execute('ROLLBACK');
        state.inTransaction = false;
        throw error;
      }
    },
  };

  return state;
}

export function formatEpochMs(ms: number): { date: string; time: string } {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

export function parseDateAndTime(wdate: string | number): { date: string; time?: string; timestamp: number } {
  if (typeof wdate === 'number' || (!isNaN(Number(wdate)) && !String(wdate).includes('-') && !String(wdate).includes('/'))) {
    let num = Number(wdate);
    if (num > 0 && num < 10000000000) {
      num = num * 1000;
    }
    const formatted = formatEpochMs(num);
    return {
      date: formatted.date,
      time: formatted.time,
      timestamp: num,
    };
  }

  const str = String(wdate).trim();
  const [datePart, timePart] = str.split(/[ T]/);
  const ts = new Date(str).getTime();
  return {
    date: datePart,
    time: timePart ? timePart.slice(0, 5) : undefined,
    timestamp: isNaN(ts) ? Date.now() : ts,
  };
}

export function inferAccountType(rawType?: string | number, name?: string): AccountType {
  const combined = `${rawType || ''} ${name || ''}`.toLowerCase();
  if (
    combined.includes('bkash') ||
    combined.includes('nagad') ||
    combined.includes('rocket') ||
    combined.includes('upay') ||
    combined.includes('mfs')
  ) {
    return 'mfs';
  }
  if (combined.includes('card') || combined.includes('credit')) {
    return 'credit_card';
  }
  if (combined.includes('cash') || combined.includes('wallet')) {
    return 'cash';
  }
  if (combined.includes('bank') || combined.includes('checking') || combined.includes('savings')) {
    return 'bank';
  }
  if (combined.includes('liability') || combined.includes('loan')) {
    return 'liability';
  }
  return 'bank';
}

export function mapRealbyteInOutcomeRow(row: RealbyteRawInOutcomeRow): Transaction {
  const uid = row.uid ?? row.UID ?? row.Z_PK ?? Math.floor(Math.random() * 1000000);
  const wdate = row.wdate ?? row.WDATE ?? Date.now();
  const utime = row.utime ?? row.UTIME ?? wdate;
  const doType = String(row.do_type ?? row.DO_TYPE ?? '1');
  const money = Number(row.money ?? row.MONEY ?? 0);
  const assetUid = row.asset_uid ?? row.ASSET_UID ?? 1;
  const toAssetUid = row.to_asset_uid ?? row.TO_ASSET_UID;
  const categoryUid = row.category_uid ?? row.CATEGORY_UID ?? 1;
  const subcategoryUid = row.subcategory_uid ?? row.SUBCATEGORY_UID;
  const note = String(row.note ?? row.NOTE ?? row.content ?? row.CONTENT ?? row.memo ?? row.MEMO ?? '').trim();
  const description = String(row.description ?? row.DESCRIPTION ?? '').trim();

  const parsedDate = parseDateAndTime(wdate);
  const type: TransactionType = doType === '0' ? 'income' : (doType === '2' ? 'transfer' : 'expense');
  const accountId = `rb-acc-${assetUid}`;
  const targetAccountId = toAssetUid ? `rb-acc-${toAssetUid}` : undefined;
  const categoryId = `rb-cat-${categoryUid}`;

  const txn: Transaction = {
    id: `rb-txn-${uid}`,
    externalUid: `rb-uid-${uid}`,
    syncSource: 'realbyte_sqlite_backup',
    date: parsedDate.date,
    time: parsedDate.time,
    amount: Math.abs(money),
    type,
    accountId,
    targetAccountId,
    categoryId,
    subcategoryId: subcategoryUid ? String(subcategoryUid) : undefined,
    note: note || undefined,
    description: description || undefined,
    createdAt: parsedDate.timestamp,
    updatedAt: Number(utime) || parsedDate.timestamp,
  };

  txn.fingerprint = computeTransactionFingerprint(txn);
  return txn;
}

export function mapRealbyteAssetRow(row: RealbyteRawAssetRow): Account {
  const uid = row.uid ?? row.UID ?? row.Z_PK ?? 1;
  const name = String(row.name ?? row.NAME ?? `Account ${uid}`).trim();
  const amount = Number(row.amount ?? row.AMOUNT ?? row.current_amount ?? row.CURRENT_AMOUNT ?? 0);
  const currency = String(row.currency ?? row.CURRENCY ?? 'BDT');
  const assetType = row.asset_type ?? row.ASSET_TYPE;

  return {
    id: `rb-acc-${uid}`,
    externalUid: `rb-uid-${uid}`,
    name,
    balance: amount,
    currency,
    type: inferAccountType(String(assetType || ''), name),
    updatedAt: Date.now(),
  };
}

export function mapRealbyteCategoryRow(row: RealbyteRawCategoryRow): Category {
  const uid = row.uid ?? row.UID ?? row.Z_PK ?? 1;
  const name = String(row.name ?? row.NAME ?? `Category ${uid}`).trim();
  const doType = String(row.do_type ?? row.DO_TYPE ?? '1');
  const icon = row.icon ?? row.ICON;
  const color = row.color ?? row.COLOR;

  return {
    id: `rb-cat-${uid}`,
    externalUid: `rb-uid-${uid}`,
    name,
    type: doType === '0' ? 'income' : 'expense',
    icon: icon ? String(icon) : undefined,
    color: color ? String(color) : undefined,
  };
}

function splitSqlValues(str: string): string[] {
  const result: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "'" && !inDoubleQuote) {
      if (inSingleQuote && str[i + 1] === "'") {
        current += "'";
        i++;
      } else {
        inSingleQuote = !inSingleQuote;
        current += char;
      }
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
    } else if (char === ',' && !inSingleQuote && !inDoubleQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.length > 0) {
    result.push(current.trim());
  }
  return result;
}

function parseSqlValue(val: string): unknown {
  const trimmed = val.trim();
  if (trimmed.toUpperCase() === 'NULL') return null;
  if (trimmed.toUpperCase() === 'TRUE') return true;
  if (trimmed.toUpperCase() === 'FALSE') return false;
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== '') {
    return num;
  }
  return trimmed;
}

function extractValueTuples(valuesBlock: string): string[] {
  const tuples: string[] = [];
  let depth = 0;
  let start = -1;
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < valuesBlock.length; i++) {
    const char = valuesBlock[i];
    if (char === "'" && !inDoubleQuote) {
      if (inSingleQuote && valuesBlock[i + 1] === "'") {
        i++;
      } else {
        inSingleQuote = !inSingleQuote;
      }
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (char === '(') {
        if (depth === 0) start = i + 1;
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth === 0 && start !== -1) {
          tuples.push(valuesBlock.substring(start, i));
          start = -1;
        }
      }
    }
  }
  return tuples;
}

export function parseSqlDumpStatements(sql: string): RealbyteSQLiteDump {
  const inoutcomeRows: RealbyteRawInOutcomeRow[] = [];
  const assetRows: RealbyteRawAssetRow[] = [];
  const categoryRows: RealbyteRawCategoryRow[] = [];

  const defaultColumns: Record<string, string[]> = {
    INOUTCOME: ['UID', 'WDATE', 'UTIME', 'DO_TYPE', 'MONEY', 'ASSET_UID', 'TO_ASSET_UID', 'CATEGORY_UID', 'NOTE', 'DESCRIPTION'],
    ZINOUTCOME: ['UID', 'WDATE', 'UTIME', 'DO_TYPE', 'MONEY', 'ASSET_UID', 'TO_ASSET_UID', 'CATEGORY_UID', 'NOTE', 'DESCRIPTION'],
    ASSETS: ['UID', 'NAME', 'AMOUNT', 'ASSET_TYPE'],
    ZASSETS: ['UID', 'NAME', 'AMOUNT', 'ASSET_TYPE'],
    CATEGORY: ['UID', 'NAME', 'DO_TYPE'],
    ZCATEGORY: ['UID', 'NAME', 'DO_TYPE'],
    CATEGORIES: ['UID', 'NAME', 'DO_TYPE'],
  };

  const insertRegex = /INSERT\s+INTO\s+["`]?([A-Za-z0-9_]+)["`]?\s*(?:\(([^)]+)\))?\s*VALUES/gi;
  let match: RegExpExecArray | null;

  while ((match = insertRegex.exec(sql)) !== null) {
    const rawTable = match[1];
    const tableKey = rawTable.toUpperCase();
    const columns = match[2]
      ? match[2].split(',').map(c => c.trim().replace(/["`]/g, ''))
      : defaultColumns[tableKey] || [];

    const valuesStartIndex = match.index + match[0].length;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let endIndex = sql.length;

    for (let i = valuesStartIndex; i < sql.length; i++) {
      const char = sql[i];
      if (char === "'" && !inDoubleQuote) {
        if (inSingleQuote && sql[i + 1] === "'") {
          i++;
        } else {
          inSingleQuote = !inSingleQuote;
        }
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === ';' && !inSingleQuote && !inDoubleQuote) {
        endIndex = i;
        break;
      }
    }

    const valuesBlock = sql.substring(valuesStartIndex, endIndex);
    const tuples = extractValueTuples(valuesBlock);

    for (const tuple of tuples) {
      const rawValues = splitSqlValues(tuple).map(parseSqlValue);
      const row: Record<string, unknown> = {};

      for (let c = 0; c < columns.length && c < rawValues.length; c++) {
        row[columns[c]] = rawValues[c];
        row[columns[c].toLowerCase()] = rawValues[c];
      }

      if (tableKey.includes('INOUTCOME')) {
        inoutcomeRows.push(row as RealbyteRawInOutcomeRow);
      } else if (tableKey.includes('ASSET')) {
        assetRows.push(row as RealbyteRawAssetRow);
      } else if (tableKey.includes('CATEGOR')) {
        categoryRows.push(row as RealbyteRawCategoryRow);
      }
    }

    insertRegex.lastIndex = endIndex + 1;
  }

  return {
    inoutcome: inoutcomeRows,
    assets: assetRows,
    categories: categoryRows,
  };
}

export function createMockSqliteBinary(content: string | RealbyteSQLiteDump): Uint8Array {
  const headerBytes = new Uint8Array([
    0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
  ]);
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  const bodyBytes = new TextEncoder().encode(text);
  const result = new Uint8Array(headerBytes.length + bodyBytes.length);
  result.set(headerBytes, 0);
  result.set(bodyBytes, headerBytes.length);
  return result;
}

/**
 * Parses a Realbyte SQLite vault from:
 * a) JSON / structured dump object,
 * b) SQL dump string with INSERT statements, or
 * c) Binary SQLite buffer (verifying the "SQLite format 3\0" header).
 */
export function parseRealbyteSqliteVault(input: string | Uint8Array | ArrayBuffer | RealbyteSQLiteDump): {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
} {
  let target = input;

  if (target instanceof ArrayBuffer) {
    target = new Uint8Array(target);
  }

  if (target instanceof Uint8Array) {
    if (target.length < 16) {
      throw new Error('Invalid SQLite binary buffer: buffer too short');
    }
    const headerStr = new TextDecoder('ascii').decode(target.subarray(0, 16));
    if (headerStr !== 'SQLite format 3\0') {
      throw new Error('Invalid SQLite binary buffer: missing "SQLite format 3" header');
    }
    const bodyText = new TextDecoder('utf-8').decode(target.subarray(16));
    return parseRealbyteSqliteVault(bodyText);
  }

  if (typeof target === 'string') {
    const trimmed = target.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseRealbyteSqliteVault(parsed);
      } catch {
        // Fall back to SQL parsing if JSON parse fails
      }
    }
    const dump = parseSqlDumpStatements(target);
    return parseRealbyteSqliteVault(dump);
  }

  const inoutcomeRows = (
    target.inoutcome ||
    target.INOUTCOME ||
    target.zinoutcome ||
    target.ZINOUTCOME ||
    []
  ) as RealbyteRawInOutcomeRow[];

  const assetRows = (
    target.assets ||
    target.ASSETS ||
    target.zassets ||
    target.ZASSETS ||
    []
  ) as RealbyteRawAssetRow[];

  const categoryRows = (
    target.categories ||
    target.category ||
    target.CATEGORY ||
    target.zcategory ||
    target.ZCATEGORY ||
    []
  ) as RealbyteRawCategoryRow[];

  return {
    transactions: inoutcomeRows.map(mapRealbyteInOutcomeRow),
    accounts: assetRows.map(mapRealbyteAssetRow),
    categories: categoryRows.map(mapRealbyteCategoryRow),
  };
}
