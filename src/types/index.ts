export type TransactionType = 'income' | 'expense' | 'transfer';

export type BudgetMode = 'cashflow_ledger' | 'envelope_allocation';

export type ThemeMode = 'dark' | 'light';

export type SyncSource = 'local' | 'realbyte_pc_manager' | 'realbyte_sqlite_backup' | 'bank_import';

export type SyncScope = 'current_month' | 'last_90_days' | 'full_year' | 'all_history';

export interface Transaction {
  id: string;
  externalUid?: string; // Realbyte INOUTCOME / ZINOUTCOME UID or Z_PK
  fingerprint?: string; // Deterministic hash for zero-collision deduplication
  syncSource?: SyncSource;
  date: string; // ISO YYYY-MM-DD
  time?: string; // HH:mm
  amount: number; // Always whole-Taka BDT integer
  type: TransactionType;
  categoryId: string;
  subcategoryId?: string;
  accountId: string; // Source account (e.g. Bank, bKash, Cash)
  targetAccountId?: string; // Destination account for transfers
  note?: string;
  description?: string; // Payee or statement narration
  currency?: string;
  originalAmount?: number;
  exchangeRate?: number;
  receiptPath?: string;
  createdAt: number;
  updatedAt: number;
}

export type AccountType = 'cash' | 'bank' | 'mfs' | 'credit_card' | 'asset' | 'liability';

export interface Account {
  id: string;
  externalUid?: string; // Realbyte ASSETS UID
  name: string;
  type: AccountType;
  balance: number; // Always whole-Taka BDT integer
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
  principal: number; // Whole Taka
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

export interface FdrDpsAccount {
  id: string;
  kind: 'fdr' | 'dps';
  bankName: string;
  accountNumber: string;
  principal: number; // Initial FDR principal or total DPS deposited so far (whole Taka)
  monthlyInstallment: number; // 0 for FDR, monthly deposit for DPS (whole Taka)
  annualRate: number; // e.g. 0.095
  aitRate: number; // e.g. 0.10
  tenureMonths: number;
  paidInstallments: number;
  startDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  expectedMaturityAmount: number; // Whole Taka
  linkedAccountId: string;
  status: 'active' | 'matured' | 'encashed';
}

export interface EarlyEncashmentResult {
  schemeId: string;
  schemeName: string;
  principalBDT: number;
  issueDate: string;
  encashmentDate: string;
  completedYears: number;
  effectiveEarlyRate: number;
  grossAccruedProfitBDT: number;
  aitRate: number;
  aitDeductedBDT: number;
  netAccruedProfitBDT: number;
  alreadyPaidProfitBDT: number;
  adjustmentDeltaBDT: number;
  netSettlementPayoutBDT: number;
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

export interface RealbyteEndpointOverrides {
  accountPath: string;
  categoryPath: string;
  ledgerPath: string;
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

export interface SyncLogEntry {
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

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  linkedAccountId: string;
  color?: string;
  note?: string;
  status: 'active' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export interface IouRecord {
  id: string;
  personName: string;
  direction: 'lent' | 'borrowed';
  principal: number;
  paidAmount: number;
  date: string;
  dueDate?: string;
  accountId: string;
  note?: string;
  status: 'open' | 'settled';
  createdAt: number;
  updatedAt: number;
}

export interface CreditCardEmi {
  id: string;
  accountId: string;
  title: string;
  totalAmount: number;
  tenureMonths: number;
  paidMonths: number;
  monthlyInstallment: number;
  startDate: string;
  nextDueDate: string;
  status: 'active' | 'completed';
}

export interface MonthlyTrendPoint {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface NetWorthTrendPoint {
  monthKey: string;
  label: string;
  netWorth: number;
}
