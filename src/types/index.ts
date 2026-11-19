export type TransactionType = 'income' | 'expense' | 'transfer';

export type BudgetMode = 'cashflow_ledger' | 'envelope_allocation';

export type ThemeMode = 'dark' | 'light';

export type SyncSource = 'local' | 'realbyte_pc_manager' | 'realbyte_sqlite_backup' | 'bank_import';

export interface Transaction {
  id: string;
  externalUid?: string; // Realbyte INOUTCOME / ZINOUTCOME UID or Z_PK
  fingerprint?: string; // Deterministic hash for zero-collision deduplication
  syncSource?: SyncSource;
  date: string; // ISO YYYY-MM-DD
  time?: string; // HH:mm
  amount: number;
  type: TransactionType;
  categoryId: string;
  subcategoryId?: string;
  accountId: string; // Source account (e.g. Bank, bKash, Cash)
  targetAccountId?: string; // Destination account for transfers
  note?: string;
  description?: string; // Payee or statement narration
  createdAt: number;
  updatedAt: number;
}

export type AccountType = 'cash' | 'bank' | 'mfs' | 'credit_card' | 'asset' | 'liability';

export interface Account {
  id: string;
  externalUid?: string; // Realbyte ASSETS UID
  name: string;
  type: AccountType;
  balance: number;
  currency: string; // e.g. BDT
  accountNumber?: string;
  creditLimit?: number;
  billingDay?: number;
  dueDay?: number;
  archived?: boolean;
  color?: string;
  icon?: string;
  updatedAt?: number;
}

export interface Category {
  id: string;
  externalUid?: string; // Realbyte ZCATEGORY UID
  name: string;
  parentId?: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  subcategories?: string[];
  budgetMonthlyAllocated?: number; // Used when BudgetMode is 'envelope_allocation'
  updatedAt?: number;
}

export interface SanchaypatraScheme {
  id: string;
  schemeDefId?: string;
  name: string; // e.g., "5-Year Bangladesh Sanchaypatra"
  registrationNo: string;
  principal: number; // e.g. 1,000,000 BDT (Whole Taka)
  issueDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  tenureYears: number;
  payoutFrequencyMonths: number; // 1 for monthly, 3 for quarterly, 6 for half-yearly, 12 for yearly
  slabGrossRate: number; // e.g. 0.1128 (11.28%)
  aitRate: number; // 0.05 (5%) or 0.10 (10%)
  netPeriodicProfit: number;
  linkedAccountId: string; // Bank account where profits are deposited
  nextPayoutDate: string;
  status?: 'active' | 'matured' | 'encashed';
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  income: number;
  expense: number;
  transferTotal?: number;
  net: number;
  transactionCount: number;
}

export interface MonthSummary {
  year: number;
  month: number; // 1 - 12
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  days: Record<string, DailySummary>;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  matchMode?: 'ALL' | 'ANY';
  conditions: {
    field: 'payee' | 'note' | 'amount' | 'accountId';
    operator: 'contains' | 'equals' | 'greater_than' | 'less_than' | 'matches_any';
    value: string | number;
  }[];
  actions: {
    field: 'categoryId' | 'subcategoryId' | 'accountId';
    value: string;
  }[];
}

export interface SyncReconciliationReport {
  source: 'realbyte_pc_manager' | 'realbyte_sqlite_backup';
  timestamp: number;
  insertedTransactions: number;
  updatedTransactions: number;
  skippedDuplicates: number;
  deletedOnRemote?: number;
  mergedAccounts: number;
  mergedCategories: number;
  walModeVerified: boolean;
  dryRun?: boolean;
  previewDiff?: {
    toInsert: Transaction[];
    toUpdate: { before: Transaction; after: Transaction }[];
    toDelete: Transaction[];
  };
}

export interface FeatureFlags {
  enableSanchaypatra: boolean;
  enableEnvelopeBudgets: boolean;
  enableVisualCharts: boolean;
  enableSavingsGoals: boolean;
  enableCreditCardEmi: boolean;
  enableIouKhata: boolean;
  enableMultiCurrency: boolean;
  enableReceipts: boolean;
  enableRulesAndRecurring: boolean;
  enableBankImporters: boolean;
  enableJsonVaultBackup: boolean;
  enableDoubleEntry: boolean;
  enablePrivacyMode: boolean;
}

export interface JournalPosting {
  accountName: string;
  debitBDT: number;
  creditBDT: number;
}

export interface DoubleEntryJournalEntry {
  id: string;
  transactionId: string;
  date: string;
  narration: string;
  postings: JournalPosting[];
  balanced: boolean;
}

export interface RecurringSchedule {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  targetAccountId?: string;
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'weekly';
  nextDueDate: string; // YYYY-MM-DD
  autoPost: boolean;
  note?: string;
}

export interface SplitAllocation {
  categoryId: string;
  amount: number;
  note?: string;
}

