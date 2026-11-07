import type { Account, Category, Transaction, TransactionType } from '../../types';
import { computeTransactionFingerprint } from '../sync/syncCoordinator';
import { inferAccountType, parseDateAndTime } from '../database/sqliteVault';

/**
 * Client for Realbyte Money Manager's built-in PC Manager HTTP server.
 * When enabled on the Android phone over Wi-Fi, the app listens on port 10000.
 */
export class RealbytePcManagerClient {
  private baseUrl: string;

  constructor(phoneIp: string, port: number = 10000) {
    this.baseUrl = `http://${phoneIp}:${port}/moneyBook`;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Health check to verify connection to the phone's PC Manager server.
   */
  public async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetches account definitions from Realbyte PC Manager.
   */
  public async fetchAccounts(): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}/account/select.do`);
    if (!response.ok) throw new Error(`Failed to fetch accounts: ${response.statusText}`);
    return await response.json();
  }

  /**
   * Fetches category definitions from Realbyte PC Manager.
   */
  public async fetchCategories(): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}/category/select.do`);
    if (!response.ok) throw new Error(`Failed to fetch categories: ${response.statusText}`);
    return await response.json();
  }

  /**
   * Fetches income and expense transactions for a specific date range.
   */
  public async fetchTransactions(startDate: string, endDate: string): Promise<unknown[]> {
    const response = await fetch(`${this.baseUrl}/ledger/select.do?start=${startDate}&end=${endDate}`);
    if (!response.ok) throw new Error(`Failed to fetch transactions: ${response.statusText}`);
    return await response.json();
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
 * - Sets deterministic externalUid: 'rb-uid-' + uid
 * - Generates deterministic transaction fingerprint matching the SQLite backup vault format
 */
export function normalizePcManagerData(rawPayload: RawPcManagerPayload): {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
} {
  const rawAccounts = rawPayload.accounts || rawPayload.assets || rawPayload.asset || [];
  const rawCategories = rawPayload.categories || rawPayload.category || [];
  const rawTransactions = rawPayload.transactions || rawPayload.inoutcome || rawPayload.ledger || [];

  const accounts: Account[] = rawAccounts.map((row: any) => {
    const uid = row.uid ?? row.UID ?? row.Z_PK ?? 1;
    const name = String(row.name ?? row.NAME ?? `Account ${uid}`).trim();
    const balance = Number(row.amount ?? row.AMOUNT ?? row.current_amount ?? row.CURRENT_AMOUNT ?? 0);
    const currency = String(row.currency ?? row.CURRENCY ?? 'BDT');
    const assetType = row.asset_type ?? row.ASSET_TYPE;

    return {
      id: `rb-acc-${uid}`,
      externalUid: `rb-uid-${uid}`,
      name,
      balance,
      currency,
      type: inferAccountType(String(assetType || ''), name),
      updatedAt: row.utime ? Number(row.utime) : Date.now(),
    };
  });

  const categories: Category[] = rawCategories.map((row: any) => {
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
  });

  const transactions: Transaction[] = rawTransactions.map((row: any) => {
    const uid = row.uid ?? row.UID ?? row.Z_PK ?? Math.floor(Math.random() * 1000000);
    const wdate = row.wdate ?? row.WDATE ?? Date.now();
    const utime = row.utime ?? row.UTIME ?? wdate;
    const doType = String(row.do_type ?? row.DO_TYPE ?? '1');
    const money = Number(row.money ?? row.MONEY ?? row.amount ?? 0);
    const assetUid = row.asset_uid ?? row.ASSET_UID ?? row.account_uid ?? 1;
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
      syncSource: 'realbyte_pc_manager',
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
  });

  return {
    accounts,
    categories,
    transactions,
  };
}
