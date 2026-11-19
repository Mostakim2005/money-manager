import type {
  Account,
  Category,
  RealbyteEndpointOverrides,
  RealbyteProbeEndpointResult,
  Transaction,
  TransactionType,
} from '../../types';
import { computeTransactionFingerprint } from '../sync/syncCoordinator';
import {
  inferAccountType,
  parseDateAndTime,
  normalizeEpochMs,
  extractRealbyteUid,
  collapseRealbyteTransferPairs,
} from '../database/sqliteVault';
import { roundTaka } from '../accounts/transferEngine';

export const DEFAULT_REALBYTE_ENDPOINTS: RealbyteEndpointOverrides = {
  accountPath: '/moneyBook/account/select.do',
  categoryPath: '/moneyBook/category/select.do',
  ledgerPath: '/moneyBook/ledger/select.do',
};

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

function normalizePath(rawPath: string | undefined, fallback: string): string {
  const cleaned = String(rawPath || '').trim() || fallback;
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

function isHtmlString(contentType: string, text: string): boolean {
  const ct = contentType.toLowerCase();
  const trimmed = text.trim().toLowerCase();
  return (
    ct.includes('text/html') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head') ||
    trimmed.startsWith('<body')
  );
}

/**
 * Splits a `[startDate, endDate]` window into <= 92-day chunks so long historical fetches
 * do not overwhelm Realbyte's embedded phone HTTP server.
 */
export function splitDateRangeIntoChunks(
  startDate: string,
  endDate: string,
  maxDaysPerChunk: number = 90
): { startDate: string; endDate: string }[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [{ startDate, endDate }];
  }

  const chunks: { startDate: string; endDate: string }[] = [];
  let cursor = new Date(start.getTime());

  while (cursor <= end) {
    const chunkEnd = new Date(cursor.getTime());
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + maxDaysPerChunk - 1);
    const actualEnd = chunkEnd > end ? end : chunkEnd;

    chunks.push({
      startDate: cursor.toISOString().slice(0, 10),
      endDate: actualEnd.toISOString().slice(0, 10),
    });

    const nextCursor = new Date(actualEnd.getTime());
    nextCursor.setUTCDate(nextCursor.getUTCDate() + 1);
    cursor = nextCursor;
  }

  return chunks;
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
  private overrides: RealbyteEndpointOverrides;

  constructor(
    phoneIp: string,
    port: number = 10000,
    endpointOverrides?: Partial<RealbyteEndpointOverrides>
  ) {
    this.phoneIp = phoneIp.trim();
    this.port = port;
    this.baseUrl = `http://${this.phoneIp}:${this.port}/moneyBook`;
    this.overrides = {
      accountPath: normalizePath(endpointOverrides?.accountPath, DEFAULT_REALBYTE_ENDPOINTS.accountPath),
      categoryPath: normalizePath(endpointOverrides?.categoryPath, DEFAULT_REALBYTE_ENDPOINTS.categoryPath),
      ledgerPath: normalizePath(endpointOverrides?.ledgerPath, DEFAULT_REALBYTE_ENDPOINTS.ledgerPath),
    };
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async fetchJsonBrowserWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { method: 'GET', signal: controller.signal });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      if (isHtmlString(response.headers.get('content-type') || '', text)) {
        throw new Error(
          'REALBYTE_SESSION_INACTIVE: Realbyte PC Manager returned an HTML page instead of JSON. Re-open PC Manager on your phone.'
        );
      }
      return text.trim() ? JSON.parse(text) : [];
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
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(`${this.baseUrl}/`, { method: 'GET', signal: controller.signal });
        return response.ok;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return false;
    }
  }

  /**
   * Probes root, accounts, categories, and ledger endpoints and returns diagnostic metadata.
   */
  public async probeEndpoints(): Promise<RealbyteProbeEndpointResult[]> {
    const electronApi = (globalThis as any)?.window?.moneyApi?.realbyte;
    if (electronApi?.probeEndpoints) {
      return await electronApi.probeEndpoints(this.phoneIp, this.port, this.overrides);
    }

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;
    const targets = [
      { label: 'Root Server', path: '/moneyBook/' },
      { label: 'Accounts', path: this.overrides.accountPath },
      { label: 'Categories', path: this.overrides.categoryPath },
      { label: 'Ledger (Current Month)', path: `${this.overrides.ledgerPath}?start=${monthStart}&end=${today}` },
    ];

    const results: RealbyteProbeEndpointResult[] = [];
    for (const target of targets) {
      const url = `http://${this.phoneIp}:${this.port}${target.path}`;
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(url, { method: 'GET', signal: controller.signal });
        const text = await res.text();
        const ct = res.headers.get('content-type') || '';
        const html = isHtmlString(ct, text);
        let topLevelKeys: string[] = [];
        let sampleCount = 0;

        if (!html && text.trim()) {
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              topLevelKeys = ['[array]'];
              sampleCount = parsed.length;
            } else if (parsed && typeof parsed === 'object') {
              topLevelKeys = Object.keys(parsed);
              sampleCount = unwrapRealbyteArray(parsed).length;
            }
          } catch {
            // Non-JSON payload
          }
        }

        results.push({
          label: target.label,
          path: target.path,
          url,
          status: res.status,
          ok: res.ok,
          contentType: ct,
          isHtml: html,
          topLevelKeys,
          sampleCount,
          elapsedMs: Date.now() - started,
          previewSnippet: text.slice(0, 180),
        });
      } catch (err) {
        results.push({
          label: target.label,
          path: target.path,
          url,
          status: 0,
          ok: false,
          contentType: '',
          isHtml: false,
          topLevelKeys: [],
          sampleCount: 0,
          elapsedMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        clearTimeout(timer);
      }
    }

    return results;
  }

  /**
   * Fetches account definitions from Realbyte PC Manager.
   */
  public async fetchAccounts(): Promise<unknown[]> {
    const electronApi = (globalThis as any)?.window?.moneyApi?.realbyte;
    if (electronApi?.fetchAccounts) {
      return unwrapRealbyteArray(await electronApi.fetchAccounts(this.phoneIp, this.port, this.overrides));
    }
    const raw = await this.fetchJsonBrowserWithTimeout(
      `http://${this.phoneIp}:${this.port}${this.overrides.accountPath}`,
      10000
    );
    return unwrapRealbyteArray(raw);
  }

  /**
   * Fetches category definitions from Realbyte PC Manager.
   */
  public async fetchCategories(): Promise<unknown[]> {
    const electronApi = (globalThis as any)?.window?.moneyApi?.realbyte;
    if (electronApi?.fetchCategories) {
      return unwrapRealbyteArray(await electronApi.fetchCategories(this.phoneIp, this.port, this.overrides));
    }
    const raw = await this.fetchJsonBrowserWithTimeout(
      `http://${this.phoneIp}:${this.port}${this.overrides.categoryPath}`,
      10000
    );
    return unwrapRealbyteArray(raw);
  }

  /**
   * Fetches income and expense transactions for a specific date range.
   */
  public async fetchTransactions(startDate: string, endDate: string): Promise<unknown[]> {
    const electronApi = (globalThis as any)?.window?.moneyApi?.realbyte;
    if (electronApi?.fetchTransactions) {
      return unwrapRealbyteArray(
        await electronApi.fetchTransactions(this.phoneIp, this.port, startDate, endDate, this.overrides)
      );
    }
    const sep = this.overrides.ledgerPath.includes('?') ? '&' : '?';
    const raw = await this.fetchJsonBrowserWithTimeout(
      `http://${this.phoneIp}:${this.port}${this.overrides.ledgerPath}${sep}start=${startDate}&end=${endDate}`,
      15000
    );
    return unwrapRealbyteArray(raw);
  }

  /**
   * Fetches transactions across arbitrarily long periods in 3-month chunks with deduplication.
   */
  public async fetchTransactionsChunked(startDate: string, endDate: string): Promise<unknown[]> {
    const chunks = splitDateRangeIntoChunks(startDate, endDate, 90);
    if (chunks.length <= 1) {
      return this.fetchTransactions(startDate, endDate);
    }

    const collected: unknown[] = [];
    const seenKeys = new Set<string>();
    for (const chunk of chunks) {
      const rows = await this.fetchTransactions(chunk.startDate, chunk.endDate);
      for (const row of rows) {
        const obj = row as Record<string, unknown>;
        const uid = extractRealbyteUid(obj);
        if (uid !== undefined) {
          const key = `uid:${uid}`;
          if (seenKeys.has(key)) continue;
          seenKeys.add(key);
        }
        collected.push(row);
      }
    }
    return collected;
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
