export interface ElectronPersistedPreferences {
  themeMode: 'dark' | 'light';
  budgetMode: 'cashflow_ledger' | 'envelope_allocation';
  privacyMode: boolean;
  featureFlags: Record<string, boolean>;
  cloudSyncPath: string;
  phoneIp: string;
  phonePort: number;
  lastSyncReport: Record<string, unknown> | null;
  syncScope: string;
  realbyteEndpointOverrides: {
    accountPath: string;
    categoryPath: string;
    ledgerPath: string;
  };
  exchangeRates: Record<string, number>;
  customSchemeDefinitions?: unknown[];
}

export interface ElectronStateSnapshot {
  preferences: ElectronPersistedPreferences;
  accounts: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  sanchaypatraSchemes: Record<string, unknown>[];
  fdrDpsAccounts: Record<string, unknown>[];
  recurringSchedules: Record<string, unknown>[];
  rules: Record<string, unknown>[];
  savingsGoals: Record<string, unknown>[];
  iouRecords: Record<string, unknown>[];
  creditCardEmis: Record<string, unknown>[];
  syncLogs?: ElectronSyncLogEntry[];
}

export interface ElectronSyncLogEntry {
  id: string;
  source: 'realbyte_pc_manager' | 'realbyte_sqlite_backup';
  timestamp: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  deletedCount: number;
  mergedAccounts: number;
  mergedCategories: number;
  walVerified: boolean;
  scopeLabel?: string;
  status: 'success' | 'error';
  errorMessage?: string;
}

export interface RealbyteEndpointOverrides {
  accountPath?: string;
  categoryPath?: string;
  ledgerPath?: string;
}

export interface RealbyteProbeEndpointResult {
  label: string;
  path: string;
  url: string;
  status: number;
  ok: boolean;
  contentType: string;
  isHtml: boolean;
  topLevelKeys: string[];
  sampleCount: number;
  elapsedMs: number;
  error?: string;
  previewSnippet?: string;
}
