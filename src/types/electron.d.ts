import type { RealbyteEndpointOverrides, RealbyteProbeEndpointResult, SyncLogEntry } from './index';

export interface MoneyElectronApi {
  isElectron: true;
  db: {
    loadState(): Promise<Record<string, any> | null>;
    saveState(snapshot: Record<string, any>): Promise<{ ok: boolean }>;
    getSyncLogs(limit?: number): Promise<SyncLogEntry[]>;
    appendSyncLog(entry: SyncLogEntry): Promise<{ ok: boolean }>;
    getInfo(): Promise<{
      dbPath: string;
      journalMode: string;
      synchronous: number;
      busyTimeout: number;
      foreignKeys: number;
      counts: Record<string, number>;
    }>;
  };
  realbyte: {
    checkConnection(phoneIp: string, port: number): Promise<boolean>;
    fetchAccounts(phoneIp: string, port: number, overrides?: Partial<RealbyteEndpointOverrides>): Promise<unknown>;
    fetchCategories(phoneIp: string, port: number, overrides?: Partial<RealbyteEndpointOverrides>): Promise<unknown>;
    fetchTransactions(
      phoneIp: string,
      port: number,
      startDate: string,
      endDate: string,
      overrides?: Partial<RealbyteEndpointOverrides>
    ): Promise<unknown>;
    probeEndpoints(
      phoneIp: string,
      port: number,
      overrides?: Partial<RealbyteEndpointOverrides>
    ): Promise<RealbyteProbeEndpointResult[]>;
    readSqliteFile(filePath: string): Promise<{
      inoutcome: Record<string, unknown>[];
      assets: Record<string, unknown>[];
      categories: Record<string, unknown>[];
    }>;
  };
  fs: {
    saveFile(options: {
      defaultName: string;
      content: string;
      filters?: { name: string; extensions: string[] }[];
    }): Promise<{ canceled: boolean; filePath?: string }>;
    pickFile(options?: {
      title?: string;
      filters?: { name: string; extensions: string[] }[];
    }): Promise<{
      canceled: boolean;
      filePath?: string;
      fileName?: string;
      textContent?: string;
    }>;
    saveReceipt(options: { originalName: string; bytes: number[] }): Promise<{ filePath: string }>;
    openPath(targetPath: string): Promise<{ ok: boolean; error?: string }>;
  };
}

declare global {
  interface Window {
    moneyApi?: MoneyElectronApi;
  }
}

export {};
