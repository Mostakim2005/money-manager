import type { Account, Category, Transaction, TransactionType } from '../../types';
import { computeTransactionFingerprint } from '../sync/syncCoordinator';
import {
  inferAccountType,
  parseDateAndTime,
  normalizeEpochMs,
  extractRealbyteUid,
  collapseRealbyteTransferPairs,
} from '../database/sqliteVault';
import { roundTaka } from '../accounts/transferEngine';

/**
 * Unwraps Realbyte PC Manager responses which may be a direct JSON array
 * or wrapped inside `{ data: [...] }`, `{ list: [...] }`, `{ rows: [...] }`, or `{ result: [...] }`.
 */
export function unwrapRealbyteArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['data', 'list', 'rows', 'result', 'inoutcome', 'assets', 'categories', 'ledger']) {
      if (Array.isArray(obj[key])) return obj[key] as any[];
    }
  }
  return [];
}

/**
 * Client for Realbyte Money Manager's built-in PC Manager HTTP server.
 * When enabled on the Android phone over Wi-Fi, the app listens on port 10000.
 * When running inside Electron, automatically routes through `window.moneyApi.realbyte`
 * in the Node.js Main Process to avoid WebView CORS and timeout limitations.
 */
export class RealbytePcManagerClient {
  private baseUrl: string;
  private phoneIp: string;
  private port: number;

  constructor(phoneIp: string, port: number = 10000) {
    this.phoneIp = phoneIp.trim();
    this.port = port;
    this.baseUrl = `http://${this.phoneIp}:${this.port}/moneyBook`;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { method: 'GET', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Health check to verify connection to the phone's PC Manager server.
   */
  public async checkConnection(): Promise<boolean> {
    const electronApi = (globalThis as any)?.window?.moneyApi?.realbyte;
    if (electronApi?.checkConnection) {
      return await electronApi.checkConnection(this.phoneIp, this.port);
    }
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/`, 4000);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetches account definitions from Realbyte PC Manager.
   */
  public async fetchAccounts(): Promise<unknown[]> {
    const electronApi = (globalThis as any)?.window?.moneyApi?.realbyte;
    if (electronApi?.fetchAccounts) {
      return unwrapRealbyteArray(await electronApi.fetchAccounts(this.phoneIp, this.port));
    }
    const response = await this.fetchWithTimeout(`${this.baseUrl}/account/select.do`, 10000);
    if (!response.ok) throw new Error(`Failed to fetch accounts: ${response.statusText}`);
    return unwrapRealbyteArray(await response.json());
  }

  /**
   * Fetches category definitions from Realbyte PC Manager.
   */
  public async fetchCategories(): Promise<unknown[]> {
    const electronApi = (globalThis as any)?.window?.moneyApi?.realbyte;
    if (electronApi?.fetchCategories) {
      return unwrapRealbyteArray(await electronApi.fetchCategories(this.phoneIp, this.port));
    }
    const response = await this.fetchWithTimeout(`${this.baseUrl}/category/select.do`, 10000);
    if (!response.ok) throw new Error(`Failed to fetch categories: ${response.statusText}`);
    return unwrapRealbyteArray(await response.json());
  }

  /**
   * Fetches income and expense transactions for a specific date range.
   */
  public async fetchTransactions(startDate: string, endDate: string): Promise<unknown[]> {
    const electronApi = (globalThis as any)?.window?.moneyApi?.realbyte;
    if (electronApi?.fetchTransactions) {
      return unwrapRealbyteArray(
        await electronApi.fetchTransactions(this.phoneIp, this.port, startDate, endDate)
      );
    }
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/ledger/select.do?start=${startDate}&end=${endDate}`,
      15000
    );
    if (!response.ok) throw new Error(`Failed to fetch transactions: ${response.statusText}`);
    return unwrapRealbyteArray(await response.json());
  }
}

export interface RawPcManagerPayload {
  accounts?: any[];
  assets?: any[];
  asset?: any[];
  categories?: any[];
  category?: any[];
  transactions?: any[];
  inoutcome?: any[];
  ledger?: any[];
  [key: string]: any;
}

/**
 * Converts Realbyte PC Manager JSON responses into normalized domain records:
 * - Assigns syncSource: 'realbyte_pc_manager'
 * - Sets deterministic externalUid: 'rb-uid-' + uid (never Math.random()!)
 * - Collapses paired transfer legs (DO_TYPE 3 & 4) into a single canonical transfer
 * - Normalizes 10-digit Unix second timestamps into milliseconds
 */
export function normalizePcManagerData(rawPayload: RawPcManagerPayload): {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
} {
  const rawAccounts = unwrapRealbyteArray(
    rawPayload.accounts || rawPayload.assets || rawPayload.asset || []
  );
  const rawCategories = unwrapRealbyteArray(
    rawPayload.categories || rawPayload.category || []
  );
  const rawTransactions = collapseRealbyteTransferPairs(
    unwrapRealbyteArray(
      rawPayload.transactions || rawPayload.inoutcome || rawPayload.ledger || []
    )
  );

  const accounts: Account[] = rawAccounts.map((row: any, idx: number) => {
    const uid = extractRealbyteUid(row) ?? idx + 1;
    const name = String(row.name ?? row.NAME ?? `Account ${uid}`).trim();
    const balance = roundTaka(
      Number(row.amount ?? row.AMOUNT ?? row.current_amount ?? row.CURRENT_AMOUNT ?? 0)
    );
    const currency = String(row.currency ?? row.CURRENCY ?? 'BDT');
    const assetType = row.asset_type ?? row.ASSET_TYPE;

    return {
      id: `rb-acc-${uid}`,
      externalUid: `rb-uid-${uid}`,
      name,
      balance,
      currency,
      type: inferAccountType(String(assetType || ''), name),
      updatedAt: normalizeEpochMs(row.utime ?? row.UTIME, Date.now()),
    };
  });

  const categories: Category[] = rawCategories.map((row: any, idx: number) => {
    const uid = extractRealbyteUid(row) ?? idx + 1;
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
  });

  const transactions: Transaction[] = rawTransactions.map((row: any, idx: number) => {
    const uid = extractRealbyteUid(row);
    const wdate = row.wdate ?? row.WDATE ?? Date.now();
    const utime = row.utime ?? row.UTIME ?? wdate;
    const doType = String(row.do_type ?? row.DO_TYPE ?? '1');
    const money = roundTaka(Math.abs(Number(row.money ?? row.MONEY ?? row.amount ?? 0)));
    const assetUid = row.asset_uid ?? row.ASSET_UID ?? row.account_uid ?? 1;
    const toAssetUid = row.to_asset_uid ?? row.TO_ASSET_UID;
    const categoryUid = row.category_uid ?? row.CATEGORY_UID ?? 1;
    const subcategoryUid = row.subcategory_uid ?? row.SUBCATEGORY_UID;
    const note = String(
      row.note ?? row.NOTE ?? row.content ?? row.CONTENT ?? row.memo ?? row.MEMO ?? ''
    ).trim();
    const description = String(row.description ?? row.DESCRIPTION ?? '').trim();

    const parsedDate = parseDateAndTime(wdate);
    const type: TransactionType =
      doType === '0' ? 'income' : doType === '2' || doType === '3' || doType === '4' ? 'transfer' : 'expense';
    const accountId = `rb-acc-${assetUid}`;
    const targetAccountId = toAssetUid ? `rb-acc-${toAssetUid}` : undefined;
    const categoryId = `rb-cat-${categoryUid}`;
    const normalizedUtime = normalizeEpochMs(utime, parsedDate.timestamp);

    const deterministicFallbackId = `rb-txn-noid-${parsedDate.date}-${money}-${assetUid}-${categoryUid}-${idx}`;

    const txn: Transaction = {
      id: uid !== undefined ? `rb-txn-${uid}` : deterministicFallbackId,
      externalUid: uid !== undefined ? `rb-uid-${uid}` : undefined,
      syncSource: 'realbyte_pc_manager',
      date: parsedDate.date,
      time: parsedDate.time,
      amount: money,
      type,
      accountId,
      targetAccountId,
      categoryId,
      subcategoryId: subcategoryUid ? String(subcategoryUid) : undefined,
      note: note || undefined,
      description: description || undefined,
      createdAt: parsedDate.timestamp,
      updatedAt: normalizedUtime,
    };

    txn.fingerprint = computeTransactionFingerprint(txn);
    return txn;
  });

  return {
    accounts,
    categories,
    transactions,
  };
}
