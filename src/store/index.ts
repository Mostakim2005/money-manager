import { defineStore } from 'pinia';
import type {
  Transaction,
  TransactionType,
  Account,
  Category,
  SanchaypatraScheme,
  FdrDpsAccount,
  SavingsGoal,
  IouRecord,
  CreditCardEmi,
  EarlyEncashmentResult,
  BudgetMode,
  ThemeMode,
  Rule,
  SyncReconciliationReport,
  SyncLogEntry,
  SyncScope,
  RealbyteEndpointOverrides,
  DoubleEntryJournalEntry,
  RecurringSchedule,
  SplitAllocation,
  FeatureFlags,
} from '../types';
import { BANGLADESH_SANCHAYPATRA_SCHEMES, type SchemeDefinition } from '../modules/sanchaypatra/schemes';
import {
  calculateSanchaypatraProfit,
  calculateEarlyEncashment,
  generatePayoutScheduleDates,
  addMonthsClampedISO,
} from '../modules/sanchaypatra/calculator';
import { calculateFdrMaturity, calculateDpsMaturity } from '../modules/sanchaypatra/fdrDpsCalculator';
import {
  executeAccountTransfer,
  applyTransactionToAccounts,
  roundTaka,
  isLiabilityAccount,
} from '../modules/accounts/transferEngine';
import { applyRulesToTransaction } from '../modules/rules/engine';
import { computeTransactionFingerprint, reconcileRealbyteSync } from '../modules/sync/syncCoordinator';
import { createSQLiteConnection, parseRealbyteSqliteVault, type RealbyteSQLiteDump } from '../modules/database/sqliteVault';
import {
  RealbytePcManagerClient,
  normalizePcManagerData,
  DEFAULT_REALBYTE_ENDPOINTS,
  type RawPcManagerPayload,
} from '../modules/realbyte/client';
import { parseCsvStatement } from '../modules/importers/csvParser';
import { parseQifContent } from '../modules/importers/qifParser';
import { parseOfxStatement, mapParsedStatementToTransactions } from '../modules/importers/ofxParser';
import { parseCamtXmlStatement } from '../modules/importers/camtXmlParser';
import { exportTransactionsToCsv, exportFullBackupJson } from '../modules/exporters/csvExporter';
import {
  splitTransaction,
  mergeTransactions,
  processDueRecurringSchedules,
} from '../modules/transactions/recurringAndSplit';
import {
  generateDoubleEntryJournal,
  verifyLedgerTrialBalance,
  exportJournalToBeancount,
} from '../modules/ledger/doubleEntryBridge';

const STORAGE_KEY = 'money_manager_persisted_state_v1';

export function getLocalTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableSanchaypatra: true,
  enableEnvelopeBudgets: false,
  enableVisualCharts: true,
  enableSavingsGoals: true,
  enableCreditCardEmi: true,
  enableIouKhata: true,
  enableMultiCurrency: false,
  enableReceipts: false,
  enableRulesAndRecurring: true,
  enableBankImporters: true,
  enableJsonVaultBackup: true,
  enableDoubleEntry: false,
  enablePrivacyMode: true,
};

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  BDT: 1,
  USD: 120,
  EUR: 130,
  GBP: 152,
  INR: 1.43,
  SAR: 32,
  AED: 32.7,
};

function cloneSchemeDefinitions(defs: SchemeDefinition[], forJson: boolean = false): SchemeDefinition[] {
  return defs.map((def) => ({
    ...def,
    slabRates: def.slabRates.map((slab) => ({
      maxPrincipalBDT: forJson
        ? (slab.maxPrincipalBDT === Infinity ? 999999999999 : slab.maxPrincipalBDT)
        : (slab.maxPrincipalBDT >= 999999999999 || slab.maxPrincipalBDT === null ? Infinity : slab.maxPrincipalBDT),
      annualRate: Number(slab.annualRate),
    })),
  }));
}

function applyThemeToDocument(mode: ThemeMode, disableTransitions: boolean = false): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (disableTransitions) {
    root.classList.add('no-transitions');
  }
  root.setAttribute('data-theme', mode);
  root.classList.toggle('dark', mode === 'dark');
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', mode);
  }
  if (disableTransitions) {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          root.classList.remove('no-transitions');
        });
      });
    } else {
      root.classList.remove('no-transitions');
    }
  }
}

let syncQueue: Promise<unknown> = Promise.resolve();
function withSyncLock<T>(task: () => Promise<T>): Promise<T> {
  const next = syncQueue.then(task, task);
  syncQueue = next.then(() => undefined, () => undefined);
  return next;
}

let dbPersistQueue: Promise<unknown> = Promise.resolve();
function queueDbPersist(task: () => Promise<unknown>): void {
  dbPersistQueue = dbPersistQueue.then(task, task).catch(() => undefined);
}

export const useMoneyStore = defineStore('money', {
  state: () => {
    const todayISO = getLocalTodayISO();
    const [curYear, curMonth] = todayISO.split('-').map(Number);

    return {
      activeTab: 'daily' as
        | 'transactions'
        | 'daily'
        | 'accounts'
        | 'stats'
        | 'sanchaypatra'
        | 'planning'
        | 'settings',
      sidebarCollapsed: false,
      themeMode: 'dark' as ThemeMode,
      budgetMode: 'cashflow_ledger' as BudgetMode,
      privacyMode: false,
      featureFlags: { ...DEFAULT_FEATURE_FLAGS } as FeatureFlags,
      selectedYear: curYear || 2026,
      selectedMonth: curMonth || 11,
      selectedDate: todayISO,
      lastDeletedTransaction: null as Transaction | null,

      // Global Keypad Modal State
      keypadOpen: false,
      keypadInitialType: 'expense' as TransactionType,
      keypadInitialDate: todayISO,

      // Sync configuration & diagnostics
      cloudSyncPath: 'money_android.sqlite',
      phoneIp: '192.168.1.105',
      phonePort: 10000,
      syncScope: 'current_month' as SyncScope,
      realbyteEndpointOverrides: { ...DEFAULT_REALBYTE_ENDPOINTS } as RealbyteEndpointOverrides,
      syncStatus: 'Synced' as 'Synced' | 'Syncing' | 'Disconnected',
      lastSyncReport: null as SyncReconciliationReport | null,
      syncLogs: [] as SyncLogEntry[],
      electronDbInfo: null as null | {
        dbPath: string;
        journalMode: string;
        walMode: boolean;
      },

      // Multi-currency exchange rates to BDT
      exchangeRates: { ...DEFAULT_EXCHANGE_RATES } as Record<string, number>,

      // Editable Sanchaypatra Government Slab Definitions
      customSchemeDefinitions: cloneSchemeDefinitions(BANGLADESH_SANCHAYPATRA_SCHEMES) as SchemeDefinition[],

      // Initial Bangladeshi Categories
      categories: [
        { id: 'groceries', externalUid: 'rb-uid-101', name: 'Groceries & Bazar', type: 'expense', color: '#10B981', subcategories: ['Supermarket', 'Fresh Bazar', 'Spices'], budgetMonthlyAllocated: 15000 },
        { id: 'rent', externalUid: 'rb-uid-102', name: 'House Rent', type: 'expense', color: '#EF4444', subcategories: ['Monthly Rent', 'Service Charge'], budgetMonthlyAllocated: 25000 },
        { id: 'utilities', externalUid: 'rb-uid-103', name: 'Electricity & Gas', type: 'expense', color: '#F59E0B', subcategories: ['DESCO', 'Titas Gas', 'WASA', 'Internet'], budgetMonthlyAllocated: 4000 },
        { id: 'transport', externalUid: 'rb-uid-104', name: 'Transport / Uber / Fuel', type: 'expense', color: '#6366F1', subcategories: ['Uber / Pathao', 'CNG / Metro', 'Fuel'], budgetMonthlyAllocated: 5000 },
        { id: 'dining', externalUid: 'rb-uid-105', name: 'Dining & Snacks', type: 'expense', color: '#EC4899', subcategories: ['Family Dinner', 'Tea & Coffee'], budgetMonthlyAllocated: 6000 },
        { id: 'medical', externalUid: 'rb-uid-106', name: 'Healthcare & Pharma', type: 'expense', color: '#14B8A6', subcategories: ['Pharmacy', 'Doctor'], budgetMonthlyAllocated: 3000 },
        { id: 'salary', externalUid: 'rb-uid-201', name: 'Monthly Salary', type: 'income', color: '#3B82F6', subcategories: ['Base Pay', 'Bonus'] },
        { id: 'sanchay_return', externalUid: 'rb-uid-202', name: 'Sanchaypatra Profit', type: 'income', color: '#8B5CF6', subcategories: ['Profit Payout', 'Encashment'] },
      ] as Category[],

      // Initial Bangladeshi Accounts
      accounts: [
        { id: 'cash_wallet', externalUid: 'rb-uid-1', name: 'Cash Wallet', type: 'cash', balance: 8500, currency: 'BDT', color: '#10B981' },
        { id: 'sonali_bank', externalUid: 'rb-uid-2', name: 'Sonali Bank (Savings)', type: 'bank', balance: 145000, currency: 'BDT', accountNumber: '2050...102', color: '#3B82F6' },
        { id: 'city_bank', externalUid: 'rb-uid-3', name: 'City Bank (Current)', type: 'bank', balance: 68000, currency: 'BDT', accountNumber: '1102...884', color: '#0EA5E9' },
        { id: 'bkash', externalUid: 'rb-uid-4', name: 'bKash Personal', type: 'mfs', balance: 12450, currency: 'BDT', accountNumber: '017...889', color: '#E11D48' },
        { id: 'nagad', externalUid: 'rb-uid-5', name: 'Nagad Wallet', type: 'mfs', balance: 4200, currency: 'BDT', accountNumber: '018...441', color: '#F97316' },
        { id: 'city_amex', externalUid: 'rb-uid-6', name: 'City Bank Amex Card', type: 'credit_card', balance: 18500, currency: 'BDT', accountNumber: '3770...901', creditLimit: 150000, billingDay: 25, dueDay: 12, color: '#D97706' },
      ] as Account[],

      // Active Sanchaypatra Certificates
      sanchaypatraSchemes: [
        {
          id: 'sp-1',
          schemeDefId: 'bd_5yr',
          name: '5-Year Bangladesh Sanchaypatra',
          registrationNo: 'BD-SP-992014',
          principal: 1000000,
          issueDate: '2025-06-15',
          maturityDate: '2030-06-15',
          tenureYears: 5,
          payoutFrequencyMonths: 6,
          slabGrossRate: 0.1128,
          aitRate: 0.10,
          netPeriodicProfit: 50760,
          linkedAccountId: 'sonali_bank',
          nextPayoutDate: '2026-12-15',
          status: 'active',
        },
        {
          id: 'sp-2',
          schemeDefId: 'paribar',
          name: 'Paribar Sanchaypatra',
          registrationNo: 'BD-PAR-448190',
          principal: 500000,
          issueDate: '2026-01-10',
          maturityDate: '2031-01-10',
          tenureYears: 5,
          payoutFrequencyMonths: 1,
          slabGrossRate: 0.1152,
          aitRate: 0.05,
          netPeriodicProfit: 4560,
          linkedAccountId: 'city_bank',
          nextPayoutDate: '2026-11-10',
          status: 'active',
        },
      ] as SanchaypatraScheme[],

      // Optional FDR & DPS Deposits (starts empty to keep initial Net Worth exact)
      fdrDpsAccounts: [] as FdrDpsAccount[],

      // Planning & Debt Modules
      savingsGoals: [] as SavingsGoal[],
      iouRecords: [] as IouRecord[],
      creditCardEmis: [] as CreditCardEmi[],

      // Recurring Bills & Scheduled Income
      recurringSchedules: [
        {
          id: 'rec-rent',
          name: 'Monthly Apartment Rent',
          amount: 25000,
          type: 'expense',
          categoryId: 'rent',
          accountId: 'city_bank',
          frequency: 'monthly',
          nextDueDate: '2026-12-01',
          autoPost: true,
          note: 'Automated monthly rent schedule',
        },
        {
          id: 'rec-desco',
          name: 'DESCO Electricity & Titas Gas',
          amount: 3800,
          type: 'expense',
          categoryId: 'utilities',
          accountId: 'bkash',
          frequency: 'monthly',
          nextDueDate: '2026-11-15',
          autoPost: true,
          note: 'Monthly utility bill',
        },
      ] as RecurringSchedule[],

      // Auto-categorization Rules (Actual Budget Engine)
      rules: [
        {
          id: 'rule-unimart',
          name: 'Supermarkets (Unimart / Shwapno / Meena) → Groceries',
          enabled: true,
          matchMode: 'ANY',
          conditions: [{ field: 'note', operator: 'contains', value: 'unimart, shwapno, meena, agora' }],
          actions: [{ field: 'categoryId', value: 'groceries' }],
        },
        {
          id: 'rule-uber',
          name: 'Ride Share (Uber / Pathao / CNG) → Transport',
          enabled: true,
          matchMode: 'ANY',
          conditions: [{ field: 'note', operator: 'contains', value: 'uber, pathao, cng, obhai' }],
          actions: [{ field: 'categoryId', value: 'transport' }],
        },
        {
          id: 'rule-desco',
          name: 'Utility Bills (DESCO / Titas / WASA) → Utilities',
          enabled: true,
          matchMode: 'ANY',
          conditions: [{ field: 'note', operator: 'contains', value: 'desco, titas, wasa, dpdc' }],
          actions: [{ field: 'categoryId', value: 'utilities' }],
        },
      ] as Rule[],

      // Sample Transactions
      transactions: [
        { id: 't1', externalUid: 'rb-uid-5001', date: '2026-11-01', time: '10:00', amount: 85000, type: 'income', categoryId: 'salary', accountId: 'city_bank', note: 'Monthly Salary November', createdAt: 1762000000000, updatedAt: 1762000000000 },
        { id: 't2', externalUid: 'rb-uid-5002', date: '2026-11-02', time: '12:30', amount: 25000, type: 'expense', categoryId: 'rent', accountId: 'city_bank', note: 'Apartment rent', createdAt: 1762086000000, updatedAt: 1762086000000 },
        { id: 't3', externalUid: 'rb-uid-5003', date: '2026-11-03', time: '18:45', amount: 3500, type: 'expense', categoryId: 'groceries', accountId: 'bkash', note: 'Unimart bazar', createdAt: 1762172000000, updatedAt: 1762172000000 },
        { id: 't4', externalUid: 'rb-uid-5004', date: '2026-11-04', time: '14:15', amount: 1200, type: 'expense', categoryId: 'transport', accountId: 'cash_wallet', note: 'CNG & fuel', createdAt: 1762258000000, updatedAt: 1762258000000 },
        { id: 't5', externalUid: 'rb-uid-5005', date: '2026-11-05', time: '20:00', amount: 2800, type: 'expense', categoryId: 'dining', accountId: 'city_amex', note: 'Dinner with family', createdAt: 1762344000000, updatedAt: 1762344000000 },
        { id: 't6', externalUid: 'rb-uid-5006', date: '2026-11-07', time: '11:00', amount: 4560, type: 'income', categoryId: 'sanchay_return', accountId: 'city_bank', note: 'Paribar Sanchaypatra monthly profit', createdAt: 1762516000000, updatedAt: 1762516000000 },
      ] as Transaction[],
    };
  },

  getters: {
    totalSanchaypatraPrincipal(state): number {
      return state.sanchaypatraSchemes
        .filter((s) => s.status !== 'encashed')
        .reduce((sum, s) => sum + roundTaka(s.principal), 0);
    },
    totalFdrDpsPrincipal(state): number {
      return state.fdrDpsAccounts
        .filter((f) => f.status !== 'encashed')
        .reduce((sum, f) => sum + roundTaka(f.principal), 0);
    },
    totalAssetAccountsBalance(state): number {
      return state.accounts
        .filter((a) => !a.archived && a.type === 'asset')
        .reduce((sum, a) => sum + roundTaka(a.balance), 0);
    },
    totalLiquidAssets(state): number {
      return state.accounts
        .filter((a) => !a.archived && (a.type === 'cash' || a.type === 'bank' || a.type === 'mfs'))
        .reduce((sum, a) => sum + roundTaka(a.balance), 0);
    },
    totalLiabilities(state): number {
      return state.accounts
        .filter((a) => !a.archived && (a.type === 'credit_card' || a.type === 'liability'))
        .reduce((sum, a) => sum + roundTaka(a.balance), 0);
    },
    totalNetWorth(): number {
      return (
        this.totalLiquidAssets +
        this.totalAssetAccountsBalance +
        this.totalSanchaypatraPrincipal +
        this.totalFdrDpsPrincipal -
        this.totalLiabilities
      );
    },
    doubleEntryJournal(state): DoubleEntryJournalEntry[] {
      return generateDoubleEntryJournal(state.transactions, state.accounts, state.categories);
    },
    trialBalance(): { totalDebits: number; totalCredits: number; isBalanced: boolean } {
      return verifyLedgerTrialBalance(this.doubleEntryJournal);
    },
    beancountExport(): string {
      return exportJournalToBeancount(this.doubleEntryJournal, 'BDT');
    },
    csvExport(state): string {
      return exportTransactionsToCsv(state.transactions, state.accounts, state.categories);
    },
    fullBackupJson(state): string {
      return exportFullBackupJson({
        transactions: state.transactions,
        accounts: state.accounts,
        categories: state.categories,
        sanchaypatraSchemes: state.sanchaypatraSchemes,
        fdrDpsAccounts: state.fdrDpsAccounts,
        rules: state.rules,
        recurringSchedules: state.recurringSchedules,
        savingsGoals: state.savingsGoals,
        iouRecords: state.iouRecords,
        creditCardEmis: state.creditCardEmis,
        exchangeRates: state.exchangeRates,
        customSchemeDefinitions: cloneSchemeDefinitions(state.customSchemeDefinitions, true),
        featureFlags: { ...state.featureFlags },
      });
    },
  },

  actions: {
    buildElectronSnapshot(): Record<string, any> {
      return {
        preferences: {
          themeMode: this.themeMode,
          budgetMode: this.budgetMode,
          privacyMode: this.privacyMode,
          featureFlags: { ...this.featureFlags },
          cloudSyncPath: this.cloudSyncPath,
          phoneIp: this.phoneIp,
          phonePort: this.phonePort,
          lastSyncReport: this.lastSyncReport,
          syncScope: this.syncScope,
          realbyteEndpointOverrides: { ...this.realbyteEndpointOverrides },
          exchangeRates: { ...this.exchangeRates },
          customSchemeDefinitions: cloneSchemeDefinitions(this.customSchemeDefinitions, true),
        },
        accounts: this.accounts.map((a) => ({ ...a })),
        categories: this.categories.map((c) => ({ ...c })),
        transactions: this.transactions.map((t) => ({ ...t })),
        sanchaypatraSchemes: this.sanchaypatraSchemes.map((s) => ({ ...s })),
        fdrDpsAccounts: this.fdrDpsAccounts.map((f) => ({ ...f })),
        recurringSchedules: this.recurringSchedules.map((r) => ({ ...r })),
        rules: this.rules.map((r) => ({ ...r })),
        savingsGoals: this.savingsGoals.map((g) => ({ ...g })),
        iouRecords: this.iouRecords.map((i) => ({ ...i })),
        creditCardEmis: this.creditCardEmis.map((e) => ({ ...e })),
        syncLogs: this.syncLogs.slice(0, 100),
      };
    },

    persistState() {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              themeMode: this.themeMode,
              budgetMode: this.budgetMode,
              privacyMode: this.privacyMode,
              featureFlags: this.featureFlags,
              cloudSyncPath: this.cloudSyncPath,
              phoneIp: this.phoneIp,
              phonePort: this.phonePort,
              syncScope: this.syncScope,
              realbyteEndpointOverrides: this.realbyteEndpointOverrides,
              lastSyncReport: this.lastSyncReport,
              syncLogs: this.syncLogs.slice(0, 100),
              exchangeRates: this.exchangeRates,
              customSchemeDefinitions: cloneSchemeDefinitions(this.customSchemeDefinitions, true),
              categories: this.categories,
              accounts: this.accounts,
              sanchaypatraSchemes: this.sanchaypatraSchemes,
              fdrDpsAccounts: this.fdrDpsAccounts,
              savingsGoals: this.savingsGoals,
              iouRecords: this.iouRecords,
              creditCardEmis: this.creditCardEmis,
              recurringSchedules: this.recurringSchedules,
              rules: this.rules,
              transactions: this.transactions,
            })
          );
        }
      } catch {
        // Ignore storage quota errors
      }

      const electronDb = typeof window !== 'undefined' ? window.moneyApi?.db : undefined;
      if (electronDb?.saveState) {
        const snapshot = this.buildElectronSnapshot();
        queueDbPersist(() => electronDb.saveState(snapshot));
      }
    },

    applyHydratedPayload(parsed: Record<string, any>) {
      if (parsed.themeMode === 'light' || parsed.themeMode === 'dark') {
        this.themeMode = parsed.themeMode;
        applyThemeToDocument(this.themeMode, false);
      }
      if (parsed.budgetMode === 'cashflow_ledger' || parsed.budgetMode === 'envelope_allocation') {
        this.budgetMode = parsed.budgetMode;
      }
      if (typeof parsed.privacyMode === 'boolean') this.privacyMode = parsed.privacyMode;
      if (parsed.featureFlags && typeof parsed.featureFlags === 'object') {
        this.featureFlags = { ...DEFAULT_FEATURE_FLAGS, ...parsed.featureFlags };
      }
      if (typeof parsed.cloudSyncPath === 'string') this.cloudSyncPath = parsed.cloudSyncPath;
      if (typeof parsed.phoneIp === 'string') this.phoneIp = parsed.phoneIp;
      if (typeof parsed.phonePort === 'number') this.phonePort = parsed.phonePort;
      if (
        parsed.syncScope === 'current_month' ||
        parsed.syncScope === 'last_90_days' ||
        parsed.syncScope === 'full_year' ||
        parsed.syncScope === 'all_history'
      ) {
        this.syncScope = parsed.syncScope;
      }
      if (parsed.realbyteEndpointOverrides && typeof parsed.realbyteEndpointOverrides === 'object') {
        this.realbyteEndpointOverrides = {
          ...DEFAULT_REALBYTE_ENDPOINTS,
          ...parsed.realbyteEndpointOverrides,
        };
      }
      if (parsed.lastSyncReport) this.lastSyncReport = parsed.lastSyncReport;
      if (Array.isArray(parsed.syncLogs)) this.syncLogs = parsed.syncLogs;
      if (parsed.exchangeRates && typeof parsed.exchangeRates === 'object') {
        this.exchangeRates = { ...DEFAULT_EXCHANGE_RATES, ...parsed.exchangeRates };
      }
      if (Array.isArray(parsed.customSchemeDefinitions) && parsed.customSchemeDefinitions.length > 0) {
        this.customSchemeDefinitions = cloneSchemeDefinitions(parsed.customSchemeDefinitions, false);
      }
      if (Array.isArray(parsed.categories)) this.categories = parsed.categories;
      if (Array.isArray(parsed.accounts)) this.accounts = parsed.accounts;
      if (Array.isArray(parsed.sanchaypatraSchemes)) this.sanchaypatraSchemes = parsed.sanchaypatraSchemes;
      if (Array.isArray(parsed.fdrDpsAccounts)) this.fdrDpsAccounts = parsed.fdrDpsAccounts;
      if (Array.isArray(parsed.savingsGoals)) this.savingsGoals = parsed.savingsGoals;
      if (Array.isArray(parsed.iouRecords)) this.iouRecords = parsed.iouRecords;
      if (Array.isArray(parsed.creditCardEmis)) this.creditCardEmis = parsed.creditCardEmis;
      if (Array.isArray(parsed.recurringSchedules)) this.recurringSchedules = parsed.recurringSchedules;
      if (Array.isArray(parsed.rules)) this.rules = parsed.rules;
      if (Array.isArray(parsed.transactions)) this.transactions = parsed.transactions;
    },

    hydrateState() {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              this.applyHydratedPayload(parsed);
            }
          }
        }
      } catch {
        // Ignore invalid JSON
      }
    },

    async hydrateFromElectronDb() {
      const electronDb = typeof window !== 'undefined' ? window.moneyApi?.db : undefined;
      if (!electronDb?.loadState) {
        this.hydrateState();
        return;
      }

      try {
        const dbState = await electronDb.loadState();
        if (!dbState) {
          // 1-time automatic migration from localStorage (or initial seed) -> SQLite WAL
          this.hydrateState();
          await electronDb.saveState(this.buildElectronSnapshot());
        } else {
          const prefs = dbState.preferences || {};
          this.applyHydratedPayload({
            ...prefs,
            accounts: dbState.accounts,
            categories: dbState.categories,
            transactions: dbState.transactions,
            sanchaypatraSchemes: dbState.sanchaypatraSchemes,
            fdrDpsAccounts: dbState.fdrDpsAccounts,
            recurringSchedules: dbState.recurringSchedules,
            rules: dbState.rules,
            savingsGoals: dbState.savingsGoals,
            iouRecords: dbState.iouRecords,
            creditCardEmis: dbState.creditCardEmis,
            syncLogs: dbState.syncLogs,
          });
          this.persistState();
        }

        if (electronDb.getInfo) {
          const info = await electronDb.getInfo();
          this.electronDbInfo = {
            dbPath: info.dbPath,
            journalMode: info.journalMode,
            walMode: String(info.journalMode).toUpperCase() === 'WAL',
          };
        }
      } catch {
        this.hydrateState();
      }
    },

    openQuickKeypad(opts?: { type?: TransactionType; date?: string }) {
      this.keypadInitialType = opts?.type || 'expense';
      this.keypadInitialDate = opts?.date || this.selectedDate || getLocalTodayISO();
      this.keypadOpen = true;
    },

    closeQuickKeypad() {
      this.keypadOpen = false;
    },

    togglePrivacyMode() {
      this.privacyMode = !this.privacyMode;
      this.persistState();
    },

    setBudgetMode(mode: BudgetMode) {
      this.budgetMode = mode;
      this.featureFlags.enableEnvelopeBudgets = mode === 'envelope_allocation';
      this.persistState();
    },

    updateSyncConfig(config: {
      phoneIp?: string;
      phonePort?: number;
      cloudSyncPath?: string;
      syncScope?: SyncScope;
      endpointOverrides?: Partial<RealbyteEndpointOverrides>;
    }) {
      if (config.phoneIp !== undefined) this.phoneIp = config.phoneIp.trim();
      if (config.phonePort !== undefined) this.phonePort = Number(config.phonePort) || 10000;
      if (config.cloudSyncPath !== undefined) this.cloudSyncPath = config.cloudSyncPath.trim();
      if (config.syncScope !== undefined) this.syncScope = config.syncScope;
      if (config.endpointOverrides) {
        this.realbyteEndpointOverrides = {
          ...this.realbyteEndpointOverrides,
          ...config.endpointOverrides,
        };
      }
      this.persistState();
    },

    setFeatureFlag<K extends keyof FeatureFlags>(key: K, enabled: boolean) {
      this.featureFlags[key] = enabled;
      if (key === 'enableEnvelopeBudgets') {
        this.budgetMode = enabled ? 'envelope_allocation' : 'cashflow_ledger';
      }
      if (!enabled) {
        if (key === 'enableSanchaypatra' && this.activeTab === 'sanchaypatra') {
          this.activeTab = 'daily';
        }
        const anyPlanning =
          this.featureFlags.enableSavingsGoals ||
          this.featureFlags.enableCreditCardEmi ||
          this.featureFlags.enableIouKhata;
        if (!anyPlanning && this.activeTab === 'planning') {
          this.activeTab = 'daily';
        }
        if (key === 'enablePrivacyMode') {
          this.privacyMode = false;
        }
      }
      this.persistState();
    },

    applyFeaturePreset(preset: 'realbyte_minimal' | 'full_suite') {
      if (preset === 'realbyte_minimal') {
        this.featureFlags = {
          enableSanchaypatra: false,
          enableEnvelopeBudgets: false,
          enableVisualCharts: false,
          enableSavingsGoals: false,
          enableCreditCardEmi: false,
          enableIouKhata: false,
          enableMultiCurrency: false,
          enableReceipts: false,
          enableRulesAndRecurring: false,
          enableBankImporters: false,
          enableJsonVaultBackup: true,
          enableDoubleEntry: false,
          enablePrivacyMode: true,
        };
        this.budgetMode = 'cashflow_ledger';
        if (this.activeTab === 'sanchaypatra' || this.activeTab === 'planning') {
          this.activeTab = 'daily';
        }
      } else {
        this.featureFlags = {
          enableSanchaypatra: true,
          enableEnvelopeBudgets: true,
          enableVisualCharts: true,
          enableSavingsGoals: true,
          enableCreditCardEmi: true,
          enableIouKhata: true,
          enableMultiCurrency: true,
          enableReceipts: true,
          enableRulesAndRecurring: true,
          enableBankImporters: true,
          enableJsonVaultBackup: true,
          enableDoubleEntry: true,
          enablePrivacyMode: true,
        };
        this.budgetMode = 'envelope_allocation';
      }
      this.persistState();
    },

    toggleTheme() {
      this.themeMode = this.themeMode === 'dark' ? 'light' : 'dark';
      applyThemeToDocument(this.themeMode, true);
      this.persistState();
    },

    computeSyncDateRange(scope?: SyncScope): { startDate: string; endDate: string } {
      const activeScope = scope || this.syncScope || 'current_month';
      const today = getLocalTodayISO();
      if (activeScope === 'current_month') {
        return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
      }
      if (activeScope === 'last_90_days') {
        const d = new Date(`${today}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 89);
        return { startDate: d.toISOString().slice(0, 10), endDate: today };
      }
      if (activeScope === 'full_year') {
        return { startDate: `${this.selectedYear}-01-01`, endDate: `${this.selectedYear}-12-31` };
      }
      return { startDate: '2020-01-01', endDate: today };
    },

    recordSyncLog(entry: Omit<SyncLogEntry, 'id'>) {
      const full: SyncLogEntry = {
        ...entry,
        id: `slog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      this.syncLogs.unshift(full);
      if (this.syncLogs.length > 100) {
        this.syncLogs = this.syncLogs.slice(0, 100);
      }
      const electronDb = typeof window !== 'undefined' ? window.moneyApi?.db : undefined;
      if (electronDb?.appendSyncLog) {
        queueDbPersist(() => electronDb.appendSyncLog(full));
      }
    },

    addTransaction(txn: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
      if (txn.externalUid && this.transactions.some((t) => t.externalUid === txn.externalUid)) {
        return;
      }

      // Optional multi-currency conversion to whole-Taka BDT
      let normalizedAmount = roundTaka(txn.amount);
      if (txn.currency && txn.currency !== 'BDT' && txn.originalAmount && txn.originalAmount > 0) {
        const rate = txn.exchangeRate || this.exchangeRates[txn.currency] || 1;
        normalizedAmount = roundTaka(txn.originalAmount * rate);
      }

      if (txn.type === 'transfer') {
        if (!txn.targetAccountId) {
          throw new Error('Transfer transaction requires a targetAccountId');
        }
        if (txn.targetAccountId === txn.accountId) {
          throw new Error('Source and target accounts must be different');
        }
        const result = executeAccountTransfer(this.accounts, {
          sourceAccountId: txn.accountId,
          targetAccountId: txn.targetAccountId,
          amount: normalizedAmount,
          date: txn.date,
          time: txn.time,
          note: txn.note || txn.description,
        });
        this.accounts = result.updatedAccounts;
        const transferWithFp: Transaction = {
          ...result.transferTransaction,
          receiptPath: txn.receiptPath,
          fingerprint: computeTransactionFingerprint(result.transferTransaction),
          syncSource: 'local',
        };
        this.transactions.unshift(transferWithFp);
        this.persistState();
        return;
      }

      const now = Date.now();
      const draftTxn: Transaction = {
        ...txn,
        amount: normalizedAmount,
        id: 'tx-' + now + '-' + Math.random().toString(36).slice(2, 6),
        syncSource: txn.syncSource || 'local',
        createdAt: now,
        updatedAt: now,
      };

      const ruledTxn = applyRulesToTransaction(draftTxn, this.rules);
      ruledTxn.fingerprint = computeTransactionFingerprint(ruledTxn);

      this.transactions.unshift(ruledTxn);
      applyTransactionToAccounts(this.accounts, ruledTxn, 1);
      this.persistState();
    },

    deleteTransaction(txnId: string) {
      const idx = this.transactions.findIndex((t) => t.id === txnId);
      if (idx === -1) return;
      const txn = this.transactions[idx];

      applyTransactionToAccounts(this.accounts, txn, -1);

      this.lastDeletedTransaction = { ...txn };
      this.transactions.splice(idx, 1);
      this.persistState();
    },

    bulkDeleteTransactions(txnIds: string[]): number {
      const idSet = new Set(txnIds);
      let deletedCount = 0;
      const remaining: Transaction[] = [];
      for (const txn of this.transactions) {
        if (idSet.has(txn.id)) {
          applyTransactionToAccounts(this.accounts, txn, -1);
          this.lastDeletedTransaction = { ...txn };
          deletedCount++;
        } else {
          remaining.push(txn);
        }
      }
      if (deletedCount > 0) {
        this.transactions = remaining;
        this.persistState();
      }
      return deletedCount;
    },

    bulkRecategorizeTransactions(txnIds: string[], categoryId: string): number {
      const targetCat = this.categories.find((c) => c.id === categoryId);
      if (!targetCat) return 0;
      const idSet = new Set(txnIds);
      let updatedCount = 0;
      const now = Date.now();

      this.transactions = this.transactions.map((txn) => {
        if (!idSet.has(txn.id) || txn.type === 'transfer' || txn.type !== targetCat.type) {
          return txn;
        }
        const updated: Transaction = {
          ...txn,
          categoryId,
          subcategoryId: undefined,
          updatedAt: now,
        };
        updated.fingerprint = computeTransactionFingerprint(updated);
        updatedCount++;
        return updated;
      });

      if (updatedCount > 0) this.persistState();
      return updatedCount;
    },

    undoLastDelete(): boolean {
      if (!this.lastDeletedTransaction) return false;
      const txn = { ...this.lastDeletedTransaction };

      applyTransactionToAccounts(this.accounts, txn, 1);

      this.transactions.unshift(txn);
      this.lastDeletedTransaction = null;
      this.persistState();
      return true;
    },

    editTransaction(txnId: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) {
      const idx = this.transactions.findIndex((t) => t.id === txnId);
      if (idx === -1) return;
      const oldTxn = this.transactions[idx];

      const nextType = updates.type ?? oldTxn.type;
      const nextAccountId = updates.accountId ?? oldTxn.accountId;
      const nextTargetAccountId =
        updates.targetAccountId !== undefined ? updates.targetAccountId : oldTxn.targetAccountId;

      if (nextType === 'transfer') {
        if (!nextTargetAccountId) {
          throw new Error('Transfer transaction requires a targetAccountId');
        }
        if (nextTargetAccountId === nextAccountId) {
          throw new Error('Source and target accounts must be different');
        }
      }

      applyTransactionToAccounts(this.accounts, oldTxn, -1);

      const updatedTxn: Transaction = {
        ...oldTxn,
        ...updates,
        amount: updates.amount !== undefined ? roundTaka(updates.amount) : oldTxn.amount,
        id: oldTxn.id,
        createdAt: oldTxn.createdAt,
        updatedAt: Date.now(),
      };
      updatedTxn.fingerprint = computeTransactionFingerprint(updatedTxn);

      applyTransactionToAccounts(this.accounts, updatedTxn, 1);

      this.transactions[idx] = updatedTxn;
      this.persistState();
    },

    splitExistingTransaction(txnId: string, splits: SplitAllocation[]) {
      const idx = this.transactions.findIndex((t) => t.id === txnId);
      if (idx === -1) return;
      const parentTxn = this.transactions[idx];
      const children = splitTransaction(parentTxn, splits);
      this.transactions.splice(idx, 1, ...children);
      this.persistState();
    },

    mergeSelectedTransactions(txnIds: string[]) {
      const targets = this.transactions.filter((t) => txnIds.includes(t.id));
      if (targets.length < 2) return;
      const merged = mergeTransactions(targets);
      this.transactions = [merged, ...this.transactions.filter((t) => !txnIds.includes(t.id))];
      this.persistState();
    },

    // Account CRUD & Balance Reconciliation
    addAccount(acc: Omit<Account, 'id'>) {
      this.accounts.push({
        ...acc,
        balance: roundTaka(acc.balance),
        id: 'acc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        updatedAt: Date.now(),
      });
      this.persistState();
    },

    editAccount(accountId: string, updates: Partial<Omit<Account, 'id'>>) {
      const idx = this.accounts.findIndex((a) => a.id === accountId);
      if (idx === -1) return;
      const prev = this.accounts[idx];
      this.accounts[idx] = {
        ...prev,
        ...updates,
        balance: updates.balance !== undefined ? roundTaka(updates.balance) : prev.balance,
        creditLimit:
          updates.creditLimit !== undefined ? roundTaka(updates.creditLimit) : prev.creditLimit,
        updatedAt: Date.now(),
      };
      this.persistState();
    },

    archiveAccount(accountId: string, archived: boolean) {
      this.editAccount(accountId, { archived });
    },

    deleteAccount(accountId: string, force: boolean = false) {
      const hasTxns = this.transactions.some(
        (t) => t.accountId === accountId || t.targetAccountId === accountId
      );
      if (hasTxns && !force) {
        throw new Error(
          'This account has existing transactions. Archive it instead or confirm forced removal.'
        );
      }
      this.accounts = this.accounts.filter((a) => a.id !== accountId);
      this.persistState();
    },

    reconcileAccountBalance(
      accountId: string,
      actualBalanceBDT: number,
      note: string = 'Balance Adjustment (Reconciled)'
    ): Transaction | null {
      const acc = this.accounts.find((a) => a.id === accountId);
      if (!acc) throw new Error(`Account '${accountId}' not found`);

      const target = roundTaka(actualBalanceBDT);
      const current = roundTaka(acc.balance);
      const delta = target - current;
      if (delta === 0) return null;

      const isLiab = isLiabilityAccount(acc.type);
      // For assets: +delta is income, -delta is expense.
      // For liabilities (debt): +delta (more owed) is expense, -delta (less owed) is income.
      const txnType: 'income' | 'expense' = isLiab
        ? delta > 0
          ? 'expense'
          : 'income'
        : delta > 0
          ? 'income'
          : 'expense';

      let adjCategory = this.categories.find(
        (c) => c.type === txnType && c.name.toLowerCase().includes('adjustment')
      );
      if (!adjCategory) {
        const catId = txnType === 'income' ? 'adj_income' : 'adj_expense';
        adjCategory = {
          id: catId,
          name: 'Balance Adjustment',
          type: txnType,
          color: '#64748B',
          budgetMonthlyAllocated: 0,
        };
        this.categories.push(adjCategory);
      }

      this.addTransaction({
        date: getLocalTodayISO(),
        time: new Date().toTimeString().slice(0, 5),
        amount: Math.abs(delta),
        type: txnType,
        categoryId: adjCategory.id,
        accountId: acc.id,
        description: 'Balance Adjustment',
        note,
      });

      return this.transactions[0] || null;
    },

    // Category CRUD & Envelope Budgets
    addCategory(cat: Omit<Category, 'id'>) {
      this.categories.push({
        ...cat,
        budgetMonthlyAllocated: roundTaka(cat.budgetMonthlyAllocated || 0),
        subcategories: cat.subcategories || [],
        id: 'cat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        updatedAt: Date.now(),
      });
      this.persistState();
    },

    editCategory(catId: string, updates: Partial<Omit<Category, 'id'>>) {
      const idx = this.categories.findIndex((c) => c.id === catId);
      if (idx === -1) return;
      const prev = this.categories[idx];
      this.categories[idx] = {
        ...prev,
        ...updates,
        budgetMonthlyAllocated:
          updates.budgetMonthlyAllocated !== undefined
            ? roundTaka(updates.budgetMonthlyAllocated)
            : prev.budgetMonthlyAllocated,
        updatedAt: Date.now(),
      };
      this.persistState();
    },

    updateCategoryBudget(catId: string, budgetMonthlyAllocated: number) {
      this.editCategory(catId, { budgetMonthlyAllocated: roundTaka(Math.max(0, budgetMonthlyAllocated)) });
    },

    deleteCategory(catId: string, fallbackCategoryId?: string) {
      const target = this.categories.find((c) => c.id === catId);
      if (!target) return;
      if (fallbackCategoryId && fallbackCategoryId !== catId) {
        this.transactions = this.transactions.map((t) =>
          t.categoryId === catId ? { ...t, categoryId: fallbackCategoryId, updatedAt: Date.now() } : t
        );
      }
      this.categories = this.categories.filter((c) => c.id !== catId);
      this.persistState();
    },

    // Rules & Recurring Schedules
    addRule(rule: Omit<Rule, 'id'>) {
      if (!rule.conditions || rule.conditions.length === 0) {
        throw new Error('A rule must contain at least one condition');
      }
      this.rules.push({
        ...rule,
        id: 'rule-' + Date.now(),
      });
      this.persistState();
    },

    deleteRule(ruleId: string) {
      this.rules = this.rules.filter((r) => r.id !== ruleId);
      this.persistState();
    },

    runRulesOnExistingTransactions(): number {
      let updatedCount = 0;
      this.transactions = this.transactions.map((tx) => {
        if (tx.type === 'transfer') return tx;
        const ruled = applyRulesToTransaction(tx, this.rules);
        if (
          ruled.categoryId !== tx.categoryId ||
          ruled.subcategoryId !== tx.subcategoryId ||
          ruled.accountId !== tx.accountId
        ) {
          updatedCount++;
          ruled.updatedAt = Date.now();
          ruled.fingerprint = computeTransactionFingerprint(ruled);
          return ruled;
        }
        return tx;
      });
      if (updatedCount > 0) this.persistState();
      return updatedCount;
    },

    addRecurringSchedule(sched: Omit<RecurringSchedule, 'id'>) {
      this.recurringSchedules.push({
        ...sched,
        amount: roundTaka(sched.amount),
        id: 'rec-' + Date.now(),
      });
      this.persistState();
    },

    deleteRecurringSchedule(schedId: string) {
      this.recurringSchedules = this.recurringSchedules.filter((s) => s.id !== schedId);
      this.persistState();
    },

    runDueRecurringSchedules(asOfDateISO?: string): number {
      const targetDate = asOfDateISO || getLocalTodayISO();
      const { updatedSchedules, generatedTransactions } = processDueRecurringSchedules(
        this.recurringSchedules,
        targetDate
      );
      this.recurringSchedules = updatedSchedules;
      for (const tx of generatedTransactions) {
        this.addTransaction(tx);
      }
      this.persistState();
      return generatedTransactions.length;
    },

    // Sanchaypatra & FDR/DPS Management
    addSanchaypatra(schemeData: {
      name: string;
      registrationNo: string;
      principal: number;
      issueDate: string;
      schemeDefId: string;
      linkedAccountId: string;
    }) {
      const def =
        this.customSchemeDefinitions.find((s) => s.id === schemeData.schemeDefId) ||
        BANGLADESH_SANCHAYPATRA_SCHEMES.find((s) => s.id === schemeData.schemeDefId);
      if (!def) return;

      const wholePrincipal = roundTaka(schemeData.principal);
      const calc = calculateSanchaypatraProfit(
        wholePrincipal,
        def,
        this.totalSanchaypatraPrincipal + wholePrincipal
      );

      const schedule = generatePayoutScheduleDates(
        schemeData.issueDate,
        def.tenureYears,
        def.payoutIntervalMonths
      );
      const maturityDate = addMonthsClampedISO(schemeData.issueDate, def.tenureYears * 12);

      const newScheme: SanchaypatraScheme = {
        id: 'sp-' + Date.now(),
        schemeDefId: def.id,
        name: def.name,
        registrationNo: schemeData.registrationNo,
        principal: wholePrincipal,
        issueDate: schemeData.issueDate,
        maturityDate,
        tenureYears: def.tenureYears,
        payoutFrequencyMonths: def.payoutIntervalMonths,
        slabGrossRate: calc.effectiveAnnualRate,
        aitRate: calc.aitRate,
        netPeriodicProfit: calc.netPeriodicPayoutBDT,
        linkedAccountId: schemeData.linkedAccountId,
        nextPayoutDate: schedule[0] || schemeData.issueDate,
        status: 'active',
      };

      this.sanchaypatraSchemes.push(newScheme);
      this.persistState();
    },

    editSanchaypatra(id: string, updates: Partial<Omit<SanchaypatraScheme, 'id'>>) {
      const idx = this.sanchaypatraSchemes.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const prev = this.sanchaypatraSchemes[idx];
      const nextPrincipal =
        updates.principal !== undefined ? roundTaka(updates.principal) : prev.principal;
      const nextIssueDate = updates.issueDate ?? prev.issueDate;
      const nextTenure = updates.tenureYears ?? prev.tenureYears;

      this.sanchaypatraSchemes[idx] = {
        ...prev,
        ...updates,
        principal: nextPrincipal,
        netPeriodicProfit:
          updates.netPeriodicProfit !== undefined
            ? roundTaka(updates.netPeriodicProfit)
            : prev.netPeriodicProfit,
        maturityDate:
          updates.issueDate || updates.tenureYears
            ? addMonthsClampedISO(nextIssueDate, nextTenure * 12)
            : updates.maturityDate ?? prev.maturityDate,
      };
      this.persistState();
    },

    deleteSanchaypatra(id: string) {
      this.sanchaypatraSchemes = this.sanchaypatraSchemes.filter((s) => s.id !== id);
      this.persistState();
    },

    encashSanchaypatra(
      id: string,
      encashmentDateISO: string = getLocalTodayISO(),
      alreadyPaidOverride?: number
    ): EarlyEncashmentResult | null {
      const scheme = this.sanchaypatraSchemes.find((s) => s.id === id);
      if (!scheme || scheme.status === 'encashed') return null;

      const recordedPaid =
        alreadyPaidOverride !== undefined
          ? alreadyPaidOverride
          : this.transactions
              .filter(
                (t) =>
                  t.type === 'income' &&
                  t.categoryId === 'sanchay_return' &&
                  (t.note || '').includes(scheme.registrationNo)
              )
              .reduce((sum, t) => sum + t.amount, 0);

      const res = calculateEarlyEncashment(scheme, encashmentDateISO, recordedPaid);
      scheme.status = 'encashed';

      // Credit net settlement payout into linked bank account
      this.addTransaction({
        date: encashmentDateISO,
        time: '11:00',
        amount: res.netSettlementPayoutBDT,
        type: 'income',
        categoryId: 'sanchay_return',
        accountId: scheme.linkedAccountId,
        description: `Encashment: ${scheme.name}`,
        note: `${scheme.name} (${scheme.registrationNo}) encashment settlement (${res.completedYears} yrs)`,
      });

      this.persistState();
      return res;
    },

    updateSchemeDefinition(updatedDef: SchemeDefinition) {
      const idx = this.customSchemeDefinitions.findIndex((s) => s.id === updatedDef.id);
      if (idx !== -1) {
        this.customSchemeDefinitions[idx] = cloneSchemeDefinitions([updatedDef])[0];
      } else {
        this.customSchemeDefinitions.push(cloneSchemeDefinitions([updatedDef])[0]);
      }
      this.persistState();
    },

    resetSchemeDefinitions() {
      this.customSchemeDefinitions = cloneSchemeDefinitions(BANGLADESH_SANCHAYPATRA_SCHEMES);
      this.persistState();
    },

    collectSanchaypatraPayout(schemeId: string) {
      const scheme = this.sanchaypatraSchemes.find((s) => s.id === schemeId);
      if (!scheme) return;

      if (
        scheme.status === 'matured' ||
        scheme.status === 'encashed' ||
        scheme.nextPayoutDate > scheme.maturityDate
      ) {
        scheme.status = scheme.status === 'encashed' ? 'encashed' : 'matured';
        this.persistState();
        return;
      }

      this.addTransaction({
        date: scheme.nextPayoutDate,
        time: '10:00',
        amount: roundTaka(scheme.netPeriodicProfit),
        type: 'income',
        categoryId: 'sanchay_return',
        accountId: scheme.linkedAccountId,
        note: `${scheme.name} (${scheme.registrationNo}) profit payout`,
      });

      const nextDate = addMonthsClampedISO(scheme.nextPayoutDate, scheme.payoutFrequencyMonths);
      scheme.nextPayoutDate = nextDate;
      if (nextDate > scheme.maturityDate) {
        scheme.status = 'matured';
      }
      this.persistState();
    },

    addFdrDps(input: {
      kind: 'fdr' | 'dps';
      bankName: string;
      accountNumber: string;
      principal: number;
      monthlyInstallment: number;
      annualRate: number;
      aitRate: number;
      tenureMonths: number;
      startDate: string;
      linkedAccountId: string;
    }) {
      const maturityDate = addMonthsClampedISO(input.startDate, input.tenureMonths);
      let expectedMaturityAmount = 0;
      let principal = roundTaka(input.principal);
      const monthlyInstallment = roundTaka(input.monthlyInstallment);

      if (input.kind === 'fdr') {
        const res = calculateFdrMaturity({
          principalBDT: principal,
          annualRate: input.annualRate,
          tenureMonths: input.tenureMonths,
          aitRate: input.aitRate,
        });
        expectedMaturityAmount = res.netMaturityAmountBDT;
      } else {
        const res = calculateDpsMaturity({
          monthlyInstallmentBDT: monthlyInstallment,
          annualRate: input.annualRate,
          tenureMonths: input.tenureMonths,
          aitRate: input.aitRate,
        });
        expectedMaturityAmount = res.netMaturityAmountBDT;
        principal = Math.max(principal, monthlyInstallment);
      }

      this.fdrDpsAccounts.push({
        id: `fdr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        kind: input.kind,
        bankName: input.bankName.trim(),
        accountNumber: input.accountNumber.trim(),
        principal,
        monthlyInstallment,
        annualRate: input.annualRate,
        aitRate: input.aitRate,
        tenureMonths: input.tenureMonths,
        paidInstallments: input.kind === 'dps' ? 1 : 0,
        startDate: input.startDate,
        maturityDate,
        expectedMaturityAmount,
        linkedAccountId: input.linkedAccountId,
        status: 'active',
      });
      this.persistState();
    },

    deleteFdrDps(id: string) {
      this.fdrDpsAccounts = this.fdrDpsAccounts.filter((f) => f.id !== id);
      this.persistState();
    },

    logDpsInstallment(id: string, dateISO: string = getLocalTodayISO()) {
      const item = this.fdrDpsAccounts.find((f) => f.id === id);
      if (!item || item.kind !== 'dps' || item.status !== 'active') return;
      if (item.paidInstallments >= item.tenureMonths) {
        item.status = 'matured';
        this.persistState();
        return;
      }
      const amt = roundTaka(item.monthlyInstallment);
      item.paidInstallments += 1;
      item.principal = roundTaka(item.principal + amt);
      if (item.paidInstallments >= item.tenureMonths) {
        item.status = 'matured';
      }

      if (item.linkedAccountId) {
        this.addTransaction({
          date: dateISO,
          time: '10:00',
          amount: amt,
          type: 'expense',
          categoryId: 'utilities',
          accountId: item.linkedAccountId,
          description: `DPS Installment: ${item.bankName}`,
          note: `${item.bankName} DPS (${item.paidInstallments}/${item.tenureMonths})`,
        });
      }
      this.persistState();
    },

    // Savings Goals / Sinking Funds
    addSavingsGoal(goal: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt' | 'status'>) {
      const now = Date.now();
      const currentAmount = roundTaka(goal.currentAmount);
      const targetAmount = roundTaka(goal.targetAmount);
      this.savingsGoals.push({
        ...goal,
        targetAmount,
        currentAmount,
        status: currentAmount >= targetAmount ? 'completed' : 'active',
        id: `goal-${now}`,
        createdAt: now,
        updatedAt: now,
      });
      this.persistState();
    },

    deleteSavingsGoal(id: string) {
      this.savingsGoals = this.savingsGoals.filter((g) => g.id !== id);
      this.persistState();
    },

    contributeToSavingsGoal(id: string, amountBDT: number, logExpense: boolean = false) {
      const goal = this.savingsGoals.find((g) => g.id === id);
      if (!goal) return;
      const whole = roundTaka(Math.max(0, amountBDT));
      if (whole <= 0) return;

      goal.currentAmount = roundTaka(goal.currentAmount + whole);
      goal.updatedAt = Date.now();
      if (goal.currentAmount >= goal.targetAmount) {
        goal.status = 'completed';
      }

      if (logExpense && goal.linkedAccountId) {
        this.addTransaction({
          date: getLocalTodayISO(),
          time: '12:00',
          amount: whole,
          type: 'expense',
          categoryId: 'groceries',
          accountId: goal.linkedAccountId,
          description: `Goal: ${goal.name}`,
          note: `Savings Goal contribution: ${goal.name}`,
        });
      }
      this.persistState();
    },

    // Credit Card EMI Tracker
    addCreditCardEmi(input: {
      accountId: string;
      title: string;
      totalAmount: number;
      tenureMonths: number;
      startDate: string;
    }) {
      const totalAmount = roundTaka(input.totalAmount);
      const tenureMonths = Math.max(1, Math.round(input.tenureMonths));
      const monthlyInstallment = Math.round(totalAmount / tenureMonths);
      this.creditCardEmis.push({
        id: `emi-${Date.now()}`,
        accountId: input.accountId,
        title: input.title.trim(),
        totalAmount,
        tenureMonths,
        paidMonths: 0,
        monthlyInstallment,
        startDate: input.startDate,
        nextDueDate: addMonthsClampedISO(input.startDate, 1),
        status: 'active',
      });
      this.persistState();
    },

    deleteCreditCardEmi(id: string) {
      this.creditCardEmis = this.creditCardEmis.filter((e) => e.id !== id);
      this.persistState();
    },

    logEmiInstallment(id: string, dateISO: string = getLocalTodayISO()) {
      const emi = this.creditCardEmis.find((e) => e.id === id);
      if (!emi || emi.status === 'completed') return;
      emi.paidMonths += 1;
      emi.nextDueDate = addMonthsClampedISO(emi.nextDueDate, 1);
      if (emi.paidMonths >= emi.tenureMonths) {
        emi.status = 'completed';
      }

      this.addTransaction({
        date: dateISO,
        time: '12:00',
        amount: roundTaka(emi.monthlyInstallment),
        type: 'expense',
        categoryId: 'utilities',
        accountId: emi.accountId,
        description: `EMI: ${emi.title}`,
        note: `${emi.title} EMI (${emi.paidMonths}/${emi.tenureMonths})`,
      });
      this.persistState();
    },

    // Lent / Borrowed IOU Khata
    addIouRecord(rec: Omit<IouRecord, 'id' | 'paidAmount' | 'status' | 'createdAt' | 'updatedAt'>) {
      const now = Date.now();
      this.iouRecords.push({
        ...rec,
        principal: roundTaka(rec.principal),
        paidAmount: 0,
        status: 'open',
        id: `iou-${now}`,
        createdAt: now,
        updatedAt: now,
      });
      this.persistState();
    },

    deleteIouRecord(id: string) {
      this.iouRecords = this.iouRecords.filter((r) => r.id !== id);
      this.persistState();
    },

    settleIouRecord(
      id: string,
      amountBDT: number,
      accountId?: string,
      dateISO: string = getLocalTodayISO()
    ) {
      const rec = this.iouRecords.find((r) => r.id === id);
      if (!rec || rec.status === 'settled') return;
      const remaining = Math.max(0, roundTaka(rec.principal) - roundTaka(rec.paidAmount));
      const applied = Math.min(remaining, roundTaka(Math.max(0, amountBDT)));
      if (applied <= 0) return;

      rec.paidAmount = roundTaka(rec.paidAmount + applied);
      rec.updatedAt = Date.now();
      if (rec.paidAmount >= rec.principal) {
        rec.status = 'settled';
      }

      const targetAcc = accountId || rec.accountId;
      if (targetAcc) {
        const txnType: 'income' | 'expense' = rec.direction === 'lent' ? 'income' : 'expense';
        const fallbackCat =
          this.categories.find((c) => c.type === txnType)?.id ||
          (txnType === 'income' ? 'salary' : 'groceries');

        this.addTransaction({
          date: dateISO,
          time: '12:00',
          amount: applied,
          type: txnType,
          categoryId: fallbackCat,
          accountId: targetAcc,
          description: `IOU Settlement: ${rec.personName}`,
          note: `${rec.direction === 'lent' ? 'Received back from' : 'Repaid to'} ${rec.personName}`,
        });
      }
      this.persistState();
    },

    updateExchangeRate(currencyCode: string, rateToBDT: number) {
      const code = currencyCode.trim().toUpperCase();
      if (!code || rateToBDT <= 0) return;
      this.exchangeRates[code] = Number(rateToBDT);
      this.persistState();
    },

    // Full Backup Vault Restore
    restoreFullBackupJson(
      rawBackup: string | Record<string, any>,
      mode: 'replace' | 'merge' = 'replace'
    ): { restoredTransactions: number; restoredAccounts: number; restoredCategories: number } {
      const parsed = typeof rawBackup === 'string' ? JSON.parse(rawBackup) : rawBackup;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON backup payload');
      }
      const isMoneyManagerVault =
        parsed.schema === 'money-manager-vault-v1' ||
        (Array.isArray(parsed.transactions) &&
          Array.isArray(parsed.accounts) &&
          Array.isArray(parsed.categories));

      if (!isMoneyManagerVault) {
        throw new Error('Unrecognized backup schema: expected money-manager-vault-v1');
      }

      if (mode === 'replace') {
        this.accounts = (parsed.accounts || []).map((a: Account) => ({
          ...a,
          balance: roundTaka(a.balance),
        }));
        this.categories = (parsed.categories || []).map((c: Category) => ({ ...c }));
        this.transactions = (parsed.transactions || []).map((t: Transaction) => ({
          ...t,
          amount: roundTaka(t.amount),
          fingerprint: t.fingerprint || computeTransactionFingerprint(t),
        }));
        if (Array.isArray(parsed.sanchaypatraSchemes)) {
          this.sanchaypatraSchemes = parsed.sanchaypatraSchemes.map((s: SanchaypatraScheme) => ({ ...s }));
        }
        if (Array.isArray(parsed.fdrDpsAccounts)) {
          this.fdrDpsAccounts = parsed.fdrDpsAccounts.map((f: FdrDpsAccount) => ({ ...f }));
        }
        if (Array.isArray(parsed.rules)) {
          this.rules = parsed.rules.map((r: Rule) => ({ ...r }));
        }
        if (Array.isArray(parsed.recurringSchedules)) {
          this.recurringSchedules = parsed.recurringSchedules.map((s: RecurringSchedule) => ({ ...s }));
        }
        if (Array.isArray(parsed.savingsGoals)) {
          this.savingsGoals = parsed.savingsGoals.map((g: SavingsGoal) => ({ ...g }));
        }
        if (Array.isArray(parsed.iouRecords)) {
          this.iouRecords = parsed.iouRecords.map((i: IouRecord) => ({ ...i }));
        }
        if (Array.isArray(parsed.creditCardEmis)) {
          this.creditCardEmis = parsed.creditCardEmis.map((e: CreditCardEmi) => ({ ...e }));
        }
        if (parsed.exchangeRates && typeof parsed.exchangeRates === 'object') {
          this.exchangeRates = { ...DEFAULT_EXCHANGE_RATES, ...parsed.exchangeRates };
        }
        if (Array.isArray(parsed.customSchemeDefinitions)) {
          this.customSchemeDefinitions = cloneSchemeDefinitions(parsed.customSchemeDefinitions, false);
        }
        if (parsed.featureFlags && typeof parsed.featureFlags === 'object') {
          this.featureFlags = { ...DEFAULT_FEATURE_FLAGS, ...parsed.featureFlags };
        }
      } else {
        const reconciled = reconcileRealbyteSync(
          {
            transactions: this.transactions,
            accounts: this.accounts,
            categories: this.categories,
          },
          {
            transactions: parsed.transactions || [],
            accounts: parsed.accounts || [],
            categories: parsed.categories || [],
          },
          'realbyte_sqlite_backup',
          true
        );
        this.transactions = reconciled.transactions;
        this.accounts = reconciled.accounts;
        this.categories = reconciled.categories;
        this.lastSyncReport = reconciled.report;
      }

      this.persistState();
      return {
        restoredTransactions: this.transactions.length,
        restoredAccounts: this.accounts.length,
        restoredCategories: this.categories.length,
      };
    },

    syncFromPcManager(
      overridePayload?: RawPcManagerPayload,
      options?: {
        scope?: SyncScope;
        startDate?: string;
        endDate?: string;
        dryRun?: boolean;
        applyRemoteDeletions?: boolean;
      }
    ): Promise<SyncReconciliationReport> {
      return withSyncLock(async () => {
        this.syncStatus = 'Syncing';
        const resolvedRange =
          options?.startDate && options?.endDate
            ? { startDate: options.startDate, endDate: options.endDate }
            : this.computeSyncDateRange(options?.scope);
        const scopeLabel = options?.scope || this.syncScope || 'custom';

        try {
          let payload: RawPcManagerPayload;
          const { startDate, endDate } = resolvedRange;

          if (overridePayload) {
            payload = overridePayload;
          } else {
            const client = new RealbytePcManagerClient(
              this.phoneIp,
              this.phonePort,
              this.realbyteEndpointOverrides
            );
            const reachable = await client.checkConnection();
            if (!reachable) {
              this.syncStatus = 'Disconnected';
              throw new Error(
                `Unable to reach Realbyte PC Manager at http://${this.phoneIp}:${this.phonePort}. Enable PC Manager on your phone over the same Wi-Fi network.`
              );
            }
            const [accounts, categories, transactions] = await Promise.all([
              client.fetchAccounts(),
              client.fetchCategories(),
              client.fetchTransactionsChunked(startDate, endDate),
            ]);
            payload = { accounts, categories, transactions };
          }

          const normalized = normalizePcManagerData(payload);
          const shouldComputeWindow =
            Boolean(options?.startDate && options?.endDate) || Boolean(options?.scope);

          const reconciled = reconcileRealbyteSync(
            {
              transactions: this.transactions,
              accounts: this.accounts,
              categories: this.categories,
            },
            normalized,
            'realbyte_pc_manager',
            true,
            {
              dryRun: options?.dryRun,
              fetchedDateWindow: shouldComputeWindow ? { startDate, endDate } : undefined,
            }
          );

          if (!options?.dryRun) {
            let finalTransactions = reconciled.transactions;
            let deletedCount = 0;

            if (options?.applyRemoteDeletions && reconciled.report.previewDiff?.toDelete.length) {
              const delIds = new Set(reconciled.report.previewDiff.toDelete.map((d) => d.id));
              finalTransactions = finalTransactions.filter((t) => !delIds.has(t.id));
              deletedCount = delIds.size;
            }

            this.transactions = finalTransactions;
            this.accounts = reconciled.accounts;
            this.categories = reconciled.categories;
            this.lastSyncReport = reconciled.report;
            this.syncStatus = 'Synced';

            this.recordSyncLog({
              source: 'realbyte_pc_manager',
              timestamp: Date.now(),
              insertedCount: reconciled.report.insertedTransactions,
              updatedCount: reconciled.report.updatedTransactions,
              skippedCount: reconciled.report.skippedDuplicates,
              deletedCount,
              mergedAccounts: reconciled.report.mergedAccounts,
              mergedCategories: reconciled.report.mergedCategories,
              walVerified: reconciled.report.walModeVerified,
              scopeLabel,
              status: 'success',
            });
            this.persistState();
          } else {
            this.syncStatus = 'Synced';
          }
          return reconciled.report;
        } catch (err: any) {
          this.syncStatus = 'Disconnected';
          if (!options?.dryRun) {
            this.recordSyncLog({
              source: 'realbyte_pc_manager',
              timestamp: Date.now(),
              insertedCount: 0,
              updatedCount: 0,
              skippedCount: 0,
              deletedCount: 0,
              mergedAccounts: 0,
              mergedCategories: 0,
              walVerified: true,
              scopeLabel,
              status: 'error',
              errorMessage: err?.message || 'PC Manager sync error',
            });
          }
          throw err;
        }
      });
    },

    syncFromSqliteVault(
      vaultInput: string | Uint8Array | ArrayBuffer | RealbyteSQLiteDump | null,
      options?: { dryRun?: boolean; filePath?: string }
    ): Promise<SyncReconciliationReport> {
      return withSyncLock(async () => {
        this.syncStatus = 'Syncing';
        const conn = createSQLiteConnection({
          dbPath: this.cloudSyncPath,
          journalMode: 'WAL',
          synchronous: 'NORMAL',
          busyTimeoutMs: 5000,
          enforceWal: true,
        });

        await conn.open();
        try {
          const pragmaCheck = conn.verifyPragmas();
          let resolvedInput = vaultInput;

          if (options?.filePath && typeof window !== 'undefined' && window.moneyApi?.realbyte?.readSqliteFile) {
            resolvedInput = (await window.moneyApi.realbyte.readSqliteFile(options.filePath)) as RealbyteSQLiteDump;
          }

          if (!resolvedInput) {
            throw new Error('No SQLite vault input or file path supplied.');
          }

          const reconciled = await conn.withAtomicTransaction(() => {
            const parsedVault = parseRealbyteSqliteVault(resolvedInput!);
            return reconcileRealbyteSync(
              {
                transactions: this.transactions,
                accounts: this.accounts,
                categories: this.categories,
              },
              parsedVault,
              'realbyte_sqlite_backup',
              pragmaCheck.walMode,
              { dryRun: options?.dryRun }
            );
          });

          if (!options?.dryRun) {
            this.transactions = reconciled.transactions;
            this.accounts = reconciled.accounts;
            this.categories = reconciled.categories;
            this.lastSyncReport = reconciled.report;
            this.syncStatus = 'Synced';

            this.recordSyncLog({
              source: 'realbyte_sqlite_backup',
              timestamp: Date.now(),
              insertedCount: reconciled.report.insertedTransactions,
              updatedCount: reconciled.report.updatedTransactions,
              skippedCount: reconciled.report.skippedDuplicates,
              deletedCount: 0,
              mergedAccounts: reconciled.report.mergedAccounts,
              mergedCategories: reconciled.report.mergedCategories,
              walVerified: reconciled.report.walModeVerified,
              scopeLabel: options?.filePath ? 'binary_sqlite_file' : 'vault_dump',
              status: 'success',
            });
            this.persistState();
          } else {
            this.syncStatus = 'Synced';
          }
          return reconciled.report;
        } catch (err: any) {
          this.syncStatus = 'Disconnected';
          if (!options?.dryRun) {
            this.recordSyncLog({
              source: 'realbyte_sqlite_backup',
              timestamp: Date.now(),
              insertedCount: 0,
              updatedCount: 0,
              skippedCount: 0,
              deletedCount: 0,
              mergedAccounts: 0,
              mergedCategories: 0,
              walVerified: true,
              scopeLabel: options?.filePath ? 'binary_sqlite_file' : 'vault_dump',
              status: 'error',
              errorMessage: err?.message || 'SQLite vault sync failed',
            });
          }
          throw err;
        } finally {
          await conn.close();
        }
      });
    },

    importBankStatement(
      format: 'csv' | 'qif' | 'ofx' | 'camt',
      content: string,
      targetAccountId: string
    ): SyncReconciliationReport {
      let mapped: Transaction[] = [];

      if (format === 'ofx') {
        const parsed = parseOfxStatement(content);
        mapped = mapParsedStatementToTransactions(parsed, targetAccountId, 'groceries', 'salary');
      } else if (format === 'camt') {
        const parsed = parseCamtXmlStatement(content);
        mapped = mapParsedStatementToTransactions(
          parsed.map((p, idx) => ({
            date: p.date,
            payee: p.payee,
            amount: p.amount,
            type: p.type,
            fitId: p.acctSvcrRef || `camt-${p.date}-${p.amount}-${idx}`,
            memo: p.notes || p.payee,
          })),
          targetAccountId,
          'groceries',
          'salary'
        );
      } else if (format === 'csv') {
        const parsed = parseCsvStatement(content);
        mapped = mapParsedStatementToTransactions(
          parsed.map((p, idx) => ({
            date: p.date,
            payee: p.payee,
            amount: p.amount,
            type: p.type,
            fitId: `csv-${p.date}-${p.amount}-${idx}`,
            memo: p.notes || p.payee,
          })),
          targetAccountId,
          'groceries',
          'salary'
        );
      } else if (format === 'qif') {
        const parsed = parseQifContent(content);
        mapped = mapParsedStatementToTransactions(
          parsed.transactions.map((q, idx) => {
            const rawAmt = parseFloat((q.amount || '0').replace(/[^0-9.-]/g, '')) || 0;
            return {
              date: q.date || this.selectedDate,
              payee: q.payee || q.memo || 'QIF Entry',
              amount: Math.abs(rawAmt),
              type: rawAmt >= 0 ? 'income' : 'expense',
              fitId: `qif-${q.date || ''}-${Math.abs(rawAmt)}-${idx}`,
              memo: q.memo || q.payee,
            };
          }),
          targetAccountId,
          'groceries',
          'salary'
        );
      }

      const ruledTransactions = mapped.map((tx) => {
        const ruled = applyRulesToTransaction(tx, this.rules);
        ruled.fingerprint = computeTransactionFingerprint(ruled);
        return ruled;
      });

      const reconciled = reconcileRealbyteSync(
        {
          transactions: this.transactions,
          accounts: this.accounts,
          categories: this.categories,
        },
        { transactions: ruledTransactions },
        'realbyte_sqlite_backup',
        true,
        { adjustAccountBalances: true }
      );

      this.transactions = reconciled.transactions;
      this.accounts = reconciled.accounts;
      this.lastSyncReport = reconciled.report;
      this.persistState();
      return reconciled.report;
    },
  },
});
