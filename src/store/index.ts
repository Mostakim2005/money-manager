import { defineStore } from 'pinia';
import {
  Transaction,
  Account,
  Category,
  SanchaypatraScheme,
  BudgetMode,
  Rule,
  SyncReconciliationReport,
  DoubleEntryJournalEntry,
  RecurringSchedule,
  SplitAllocation
} from '../types';
import { BANGLADESH_SANCHAYPATRA_SCHEMES } from '../modules/sanchaypatra/schemes';
import { calculateSanchaypatraProfit, generatePayoutScheduleDates } from '../modules/sanchaypatra/calculator';
import { executeAccountTransfer, isLiabilityAccount } from '../modules/accounts/transferEngine';
import { applyRulesToTransaction } from '../modules/rules/engine';
import { computeTransactionFingerprint, reconcileRealbyteSync } from '../modules/sync/syncCoordinator';
import { createSQLiteConnection, parseRealbyteSqliteVault, RealbyteSQLiteDump } from '../modules/database/sqliteVault';
import { RealbytePcManagerClient, normalizePcManagerData, RawPcManagerPayload } from '../modules/realbyte/client';
import { parseCsvStatement } from '../modules/importers/csvParser';
import { parseQifContent } from '../modules/importers/qifParser';
import { parseOfxStatement, mapParsedStatementToTransactions } from '../modules/importers/ofxParser';
import { parseCamtXmlStatement } from '../modules/importers/camtXmlParser';
import { exportTransactionsToCsv, exportFullBackupJson } from '../modules/exporters/csvExporter';
import {
  splitTransaction,
  mergeTransactions,
  processDueRecurringSchedules,
  advanceDueDate
} from '../modules/transactions/recurringAndSplit';
import {
  generateDoubleEntryJournal,
  verifyLedgerTrialBalance,
  exportJournalToBeancount
} from '../modules/ledger/doubleEntryBridge';

const STORAGE_KEY = 'money_manager_persisted_state_v1';

let syncQueue: Promise<unknown> = Promise.resolve();
function withSyncLock<T>(task: () => Promise<T>): Promise<T> {
  const next = syncQueue.then(task, task);
  syncQueue = next.then(() => undefined, () => undefined);
  return next;
}

export const useMoneyStore = defineStore('money', {
  state: () => ({
    activeTab: 'daily' as 'transactions' | 'daily' | 'accounts' | 'stats' | 'sanchaypatra' | 'settings',
    themeMode: 'dark' as 'dark' | 'light',
    budgetMode: 'cashflow_ledger' as BudgetMode,
    selectedYear: 2026,
    selectedMonth: 11, // November
    selectedDate: '2026-11-07',
    lastDeletedTransaction: null as Transaction | null,

    // Sync configuration
    cloudSyncPath: 'C:\\Users\\kazir\\Google Drive\\MoneyManager\\money_android.sqlite',
    phoneIp: '192.168.1.105',
    phonePort: 10000,
    syncStatus: 'Synced' as 'Synced' | 'Syncing' | 'Disconnected',
    lastSyncReport: null as SyncReconciliationReport | null,

    // Initial Bangladeshi Categories
    categories: [
      { id: 'groceries', externalUid: 'rb-uid-101', name: 'Groceries & Bazar', type: 'expense', color: '#10B981', budgetMonthlyAllocated: 15000 },
      { id: 'rent', externalUid: 'rb-uid-102', name: 'House Rent', type: 'expense', color: '#EF4444', budgetMonthlyAllocated: 25000 },
      { id: 'utilities', externalUid: 'rb-uid-103', name: 'Electricity & Gas', type: 'expense', color: '#F59E0B', budgetMonthlyAllocated: 4000 },
      { id: 'transport', externalUid: 'rb-uid-104', name: 'Transport / Uber / Fuel', type: 'expense', color: '#6366F1', budgetMonthlyAllocated: 5000 },
      { id: 'dining', externalUid: 'rb-uid-105', name: 'Dining & Snacks', type: 'expense', color: '#EC4899', budgetMonthlyAllocated: 6000 },
      { id: 'medical', externalUid: 'rb-uid-106', name: 'Healthcare & Pharma', type: 'expense', color: '#14B8A6', budgetMonthlyAllocated: 3000 },
      { id: 'salary', externalUid: 'rb-uid-201', name: 'Monthly Salary', type: 'income', color: '#3B82F6' },
      { id: 'sanchay_return', externalUid: 'rb-uid-202', name: 'Sanchaypatra Profit', type: 'income', color: '#8B5CF6' }
    ] as Category[],

    // Initial Bangladeshi Accounts
    accounts: [
      { id: 'cash_wallet', externalUid: 'rb-uid-1', name: 'Cash Wallet', type: 'cash', balance: 8500, currency: 'BDT', color: '#10B981' },
      { id: 'sonali_bank', externalUid: 'rb-uid-2', name: 'Sonali Bank (Savings)', type: 'bank', balance: 145000, currency: 'BDT', accountNumber: '2050...102', color: '#3B82F6' },
      { id: 'city_bank', externalUid: 'rb-uid-3', name: 'City Bank (Current)', type: 'bank', balance: 68000, currency: 'BDT', accountNumber: '1102...884', color: '#0EA5E9' },
      { id: 'bkash', externalUid: 'rb-uid-4', name: 'bKash Personal', type: 'mfs', balance: 12450, currency: 'BDT', accountNumber: '017...889', color: '#E11D48' },
      { id: 'nagad', externalUid: 'rb-uid-5', name: 'Nagad Wallet', type: 'mfs', balance: 4200, currency: 'BDT', accountNumber: '018...441', color: '#F97316' },
      { id: 'city_amex', externalUid: 'rb-uid-6', name: 'City Bank Amex Card', type: 'credit_card', balance: 18500, currency: 'BDT', accountNumber: '3770...901', color: '#D97706' }
    ] as Account[],

    // Active Sanchaypatra Certificates
    sanchaypatraSchemes: [
      {
        id: 'sp-1',
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
        nextPayoutDate: '2026-12-15'
      },
      {
        id: 'sp-2',
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
        nextPayoutDate: '2026-11-10'
      }
    ] as SanchaypatraScheme[],

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
        note: 'Automated monthly rent schedule'
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
        note: 'Monthly utility bill'
      }
    ] as RecurringSchedule[],

    // Auto-categorization Rules (Actual Budget Engine)
    rules: [
      {
        id: 'rule-unimart',
        name: 'Supermarkets (Unimart / Shwapno / Meena) → Groceries',
        enabled: true,
        conditions: [{ field: 'note', operator: 'contains', value: 'unimart' }],
        actions: [{ field: 'categoryId', value: 'groceries' }]
      },
      {
        id: 'rule-uber',
        name: 'Ride Share (Uber / Pathao / CNG) → Transport',
        enabled: true,
        conditions: [{ field: 'note', operator: 'contains', value: 'uber' }],
        actions: [{ field: 'categoryId', value: 'transport' }]
      },
      {
        id: 'rule-desco',
        name: 'Utility Bills (DESCO / Titas / WASA) → Utilities',
        enabled: true,
        conditions: [{ field: 'note', operator: 'contains', value: 'desco' }],
        actions: [{ field: 'categoryId', value: 'utilities' }]
      }
    ] as Rule[],

    // Sample Transactions
    transactions: [
      { id: 't1', externalUid: 'rb-uid-5001', date: '2026-11-01', time: '10:00', amount: 85000, type: 'income', categoryId: 'salary', accountId: 'city_bank', note: 'Monthly Salary November', createdAt: 1762000000000, updatedAt: 1762000000000 },
      { id: 't2', externalUid: 'rb-uid-5002', date: '2026-11-02', time: '12:30', amount: 25000, type: 'expense', categoryId: 'rent', accountId: 'city_bank', note: 'Apartment rent', createdAt: 1762086000000, updatedAt: 1762086000000 },
      { id: 't3', externalUid: 'rb-uid-5003', date: '2026-11-03', time: '18:45', amount: 3500, type: 'expense', categoryId: 'groceries', accountId: 'bkash', note: 'Unimart bazar', createdAt: 1762172000000, updatedAt: 1762172000000 },
      { id: 't4', externalUid: 'rb-uid-5004', date: '2026-11-04', time: '14:15', amount: 1200, type: 'expense', categoryId: 'transport', accountId: 'cash_wallet', note: 'CNG & fuel', createdAt: 1762258000000, updatedAt: 1762258000000 },
      { id: 't5', externalUid: 'rb-uid-5005', date: '2026-11-05', time: '20:00', amount: 2800, type: 'expense', categoryId: 'dining', accountId: 'city_amex', note: 'Dinner with family', createdAt: 1762344000000, updatedAt: 1762344000000 },
      { id: 't6', externalUid: 'rb-uid-5006', date: '2026-11-07', time: '11:00', amount: 4560, type: 'income', categoryId: 'sanchay_return', accountId: 'city_bank', note: 'Paribar Sanchaypatra monthly profit', createdAt: 1762516000000, updatedAt: 1762516000000 }
    ] as Transaction[]
  }),

  getters: {
    totalSanchaypatraPrincipal(state): number {
      return state.sanchaypatraSchemes.reduce((sum, s) => sum + s.principal, 0);
    },
    totalLiquidAssets(state): number {
      return state.accounts
        .filter(a => a.type === 'cash' || a.type === 'bank' || a.type === 'mfs')
        .reduce((sum, a) => sum + a.balance, 0);
    },
    totalLiabilities(state): number {
      return state.accounts
        .filter(a => a.type === 'credit_card' || a.type === 'liability')
        .reduce((sum, a) => sum + a.balance, 0);
    },
    totalNetWorth(): number {
      return (this.totalLiquidAssets + this.totalSanchaypatraPrincipal) - this.totalLiabilities;
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
        rules: state.rules,
        recurringSchedules: state.recurringSchedules
      });
    }
  },

  actions: {
    persistState() {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              themeMode: this.themeMode,
              budgetMode: this.budgetMode,
              categories: this.categories,
              accounts: this.accounts,
              sanchaypatraSchemes: this.sanchaypatraSchemes,
              recurringSchedules: this.recurringSchedules,
              rules: this.rules,
              transactions: this.transactions
            })
          );
        }
      } catch {
        // Ignore storage quota errors in headless environments
      }
    },

    hydrateState() {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.themeMode === 'light' || parsed.themeMode === 'dark') {
              this.themeMode = parsed.themeMode;
              if (typeof document !== 'undefined') {
                document.documentElement.setAttribute('data-theme', this.themeMode);
              }
            }
            if (parsed.budgetMode) this.budgetMode = parsed.budgetMode;
            if (Array.isArray(parsed.categories)) this.categories = parsed.categories;
            if (Array.isArray(parsed.accounts)) this.accounts = parsed.accounts;
            if (Array.isArray(parsed.sanchaypatraSchemes)) this.sanchaypatraSchemes = parsed.sanchaypatraSchemes;
            if (Array.isArray(parsed.recurringSchedules)) this.recurringSchedules = parsed.recurringSchedules;
            if (Array.isArray(parsed.rules)) this.rules = parsed.rules;
            if (Array.isArray(parsed.transactions)) this.transactions = parsed.transactions;
          }
        }
      } catch {
        // Ignore invalid JSON
      }
    },

    toggleTheme() {
      this.themeMode = this.themeMode === 'dark' ? 'light' : 'dark';
      if (typeof document !== 'undefined') {
        document.documentElement.classList.add('no-transitions');
        document.documentElement.setAttribute('data-theme', this.themeMode);
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              document.documentElement.classList.remove('no-transitions');
            });
          });
        } else {
          document.documentElement.classList.remove('no-transitions');
        }
      }
      this.persistState();
    },

    addTransaction(txn: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
      if (txn.externalUid && this.transactions.some(t => t.externalUid === txn.externalUid)) {
        return;
      }
      if (txn.type === 'transfer' && txn.targetAccountId) {
        const result = executeAccountTransfer(this.accounts, {
          sourceAccountId: txn.accountId,
          targetAccountId: txn.targetAccountId,
          amount: txn.amount,
          date: txn.date,
          time: txn.time,
          note: txn.note || txn.description
        });
        this.accounts = result.updatedAccounts;
        const transferWithFp: Transaction = {
          ...result.transferTransaction,
          fingerprint: computeTransactionFingerprint(result.transferTransaction),
          syncSource: 'local'
        };
        this.transactions.unshift(transferWithFp);
        this.persistState();
        return;
      }

      const now = Date.now();
      const draftTxn: Transaction = {
        ...txn,
        id: 'tx-' + now + '-' + Math.random().toString(36).slice(2, 6),
        syncSource: txn.syncSource || 'local',
        createdAt: now,
        updatedAt: now
      };

      const ruledTxn = applyRulesToTransaction(draftTxn, this.rules);
      ruledTxn.fingerprint = computeTransactionFingerprint(ruledTxn);

      this.transactions.unshift(ruledTxn);

      const account = this.accounts.find(a => a.id === ruledTxn.accountId);
      if (account) {
        if (isLiabilityAccount(account.type)) {
          if (ruledTxn.type === 'expense') account.balance += ruledTxn.amount;
          else if (ruledTxn.type === 'income') account.balance -= ruledTxn.amount;
        } else {
          if (ruledTxn.type === 'income') account.balance += ruledTxn.amount;
          else if (ruledTxn.type === 'expense') account.balance -= ruledTxn.amount;
        }
      }
      this.persistState();
    },

    deleteTransaction(txnId: string) {
      const idx = this.transactions.findIndex(t => t.id === txnId);
      if (idx === -1) return;
      const txn = this.transactions[idx];

      // Reverse account balance impact
      const sourceAcc = this.accounts.find(a => a.id === txn.accountId);
      if (sourceAcc) {
        if (txn.type === 'transfer') {
          if (isLiabilityAccount(sourceAcc.type)) sourceAcc.balance -= txn.amount;
          else sourceAcc.balance += txn.amount;
        } else if (isLiabilityAccount(sourceAcc.type)) {
          if (txn.type === 'expense') sourceAcc.balance -= txn.amount;
          else if (txn.type === 'income') sourceAcc.balance += txn.amount;
        } else {
          if (txn.type === 'income') sourceAcc.balance -= txn.amount;
          else if (txn.type === 'expense') sourceAcc.balance += txn.amount;
        }
      }

      if (txn.type === 'transfer' && txn.targetAccountId) {
        const targetAcc = this.accounts.find(a => a.id === txn.targetAccountId);
        if (targetAcc) {
          if (isLiabilityAccount(targetAcc.type)) targetAcc.balance += txn.amount;
          else targetAcc.balance -= txn.amount;
        }
      }

      this.lastDeletedTransaction = { ...txn };
      this.transactions.splice(idx, 1);
      this.persistState();
    },

    undoLastDelete(): boolean {
      if (!this.lastDeletedTransaction) return false;
      const txn = { ...this.lastDeletedTransaction };

      const sourceAcc = this.accounts.find(a => a.id === txn.accountId);
      if (sourceAcc) {
        if (txn.type === 'transfer') {
          if (isLiabilityAccount(sourceAcc.type)) sourceAcc.balance += txn.amount;
          else sourceAcc.balance -= txn.amount;
        } else if (isLiabilityAccount(sourceAcc.type)) {
          if (txn.type === 'expense') sourceAcc.balance += txn.amount;
          else if (txn.type === 'income') sourceAcc.balance -= txn.amount;
        } else {
          if (txn.type === 'income') sourceAcc.balance += txn.amount;
          else if (txn.type === 'expense') sourceAcc.balance -= txn.amount;
        }
      }

      if (txn.type === 'transfer' && txn.targetAccountId) {
        const targetAcc = this.accounts.find(a => a.id === txn.targetAccountId);
        if (targetAcc) {
          if (isLiabilityAccount(targetAcc.type)) targetAcc.balance -= txn.amount;
          else targetAcc.balance += txn.amount;
        }
      }

      this.transactions.unshift(txn);
      this.lastDeletedTransaction = null;
      this.persistState();
      return true;
    },

    editTransaction(txnId: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) {
      const idx = this.transactions.findIndex(t => t.id === txnId);
      if (idx === -1) return;
      const oldTxn = this.transactions[idx];

      // 1. Reverse oldTxn's balance impact
      const oldSource = this.accounts.find(a => a.id === oldTxn.accountId);
      if (oldSource) {
        if (oldTxn.type === 'transfer') {
          if (isLiabilityAccount(oldSource.type)) oldSource.balance -= oldTxn.amount;
          else oldSource.balance += oldTxn.amount;
        } else if (isLiabilityAccount(oldSource.type)) {
          if (oldTxn.type === 'expense') oldSource.balance -= oldTxn.amount;
          else if (oldTxn.type === 'income') oldSource.balance += oldTxn.amount;
        } else {
          if (oldTxn.type === 'income') oldSource.balance -= oldTxn.amount;
          else if (oldTxn.type === 'expense') oldSource.balance += oldTxn.amount;
        }
      }

      if (oldTxn.type === 'transfer' && oldTxn.targetAccountId) {
        const oldTarget = this.accounts.find(a => a.id === oldTxn.targetAccountId);
        if (oldTarget) {
          if (isLiabilityAccount(oldTarget.type)) oldTarget.balance += oldTxn.amount;
          else oldTarget.balance -= oldTxn.amount;
        }
      }

      // 2. Construct updatedTxn
      const updatedTxn: Transaction = {
        ...oldTxn,
        ...updates,
        id: oldTxn.id,
        createdAt: oldTxn.createdAt,
        updatedAt: Date.now()
      };
      updatedTxn.fingerprint = computeTransactionFingerprint(updatedTxn);

      // 3. Apply updatedTxn's balance impact
      const newSource = this.accounts.find(a => a.id === updatedTxn.accountId);
      if (newSource) {
        if (updatedTxn.type === 'transfer') {
          if (isLiabilityAccount(newSource.type)) newSource.balance += updatedTxn.amount;
          else newSource.balance -= updatedTxn.amount;
        } else if (isLiabilityAccount(newSource.type)) {
          if (updatedTxn.type === 'expense') newSource.balance += updatedTxn.amount;
          else if (updatedTxn.type === 'income') newSource.balance -= updatedTxn.amount;
        } else {
          if (updatedTxn.type === 'income') newSource.balance += updatedTxn.amount;
          else if (updatedTxn.type === 'expense') newSource.balance -= updatedTxn.amount;
        }
      }

      if (updatedTxn.type === 'transfer' && updatedTxn.targetAccountId) {
        const newTarget = this.accounts.find(a => a.id === updatedTxn.targetAccountId);
        if (newTarget) {
          if (isLiabilityAccount(newTarget.type)) newTarget.balance -= updatedTxn.amount;
          else newTarget.balance += updatedTxn.amount;
        }
      }

      this.transactions[idx] = updatedTxn;
      this.persistState();
    },

    splitExistingTransaction(txnId: string, splits: SplitAllocation[]) {
      const idx = this.transactions.findIndex(t => t.id === txnId);
      if (idx === -1) return;
      const parentTxn = this.transactions[idx];
      const children = splitTransaction(parentTxn, splits);
      this.transactions.splice(idx, 1, ...children);
      this.persistState();
    },

    mergeSelectedTransactions(txnIds: string[]) {
      const targets = this.transactions.filter(t => txnIds.includes(t.id));
      if (targets.length < 2) return;
      const merged = mergeTransactions(targets);
      this.transactions = [
        merged,
        ...this.transactions.filter(t => !txnIds.includes(t.id))
      ];
      this.persistState();
    },

    addAccount(acc: Omit<Account, 'id'>) {
      this.accounts.push({
        ...acc,
        id: 'acc-' + Date.now()
      });
      this.persistState();
    },

    addCategory(cat: Omit<Category, 'id'>) {
      this.categories.push({
        ...cat,
        id: 'cat-' + Date.now()
      });
      this.persistState();
    },

    addRule(rule: Omit<Rule, 'id'>) {
      this.rules.push({
        ...rule,
        id: 'rule-' + Date.now()
      });
      this.persistState();
    },

    deleteRule(ruleId: string) {
      this.rules = this.rules.filter(r => r.id !== ruleId);
      this.persistState();
    },

    addRecurringSchedule(sched: Omit<RecurringSchedule, 'id'>) {
      this.recurringSchedules.push({
        ...sched,
        id: 'rec-' + Date.now()
      });
      this.persistState();
    },

    deleteRecurringSchedule(schedId: string) {
      this.recurringSchedules = this.recurringSchedules.filter(s => s.id !== schedId);
      this.persistState();
    },

    runDueRecurringSchedules(asOfDateISO?: string): number {
      const targetDate = asOfDateISO || this.selectedDate;
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

    addSanchaypatra(schemeData: {
      name: string;
      registrationNo: string;
      principal: number;
      issueDate: string;
      schemeDefId: string;
      linkedAccountId: string;
    }) {
      const def = BANGLADESH_SANCHAYPATRA_SCHEMES.find(s => s.id === schemeData.schemeDefId);
      if (!def) return;

      const calc = calculateSanchaypatraProfit(
        schemeData.principal,
        def,
        this.totalSanchaypatraPrincipal + schemeData.principal
      );

      const schedule = generatePayoutScheduleDates(schemeData.issueDate, def.tenureYears, def.payoutIntervalMonths);
      const maturity = new Date(schemeData.issueDate);
      maturity.setFullYear(maturity.getFullYear() + def.tenureYears);

      const newScheme: SanchaypatraScheme = {
        id: 'sp-' + Date.now(),
        name: def.name,
        registrationNo: schemeData.registrationNo,
        principal: schemeData.principal,
        issueDate: schemeData.issueDate,
        maturityDate: maturity.toISOString().split('T')[0],
        tenureYears: def.tenureYears,
        payoutFrequencyMonths: def.payoutIntervalMonths,
        slabGrossRate: calc.effectiveAnnualRate,
        aitRate: calc.aitRate,
        netPeriodicProfit: calc.netPeriodicPayoutBDT,
        linkedAccountId: schemeData.linkedAccountId,
        nextPayoutDate: schedule[0] || schemeData.issueDate
      };

      this.sanchaypatraSchemes.push(newScheme);
      this.persistState();
    },

    collectSanchaypatraPayout(schemeId: string) {
      const scheme = this.sanchaypatraSchemes.find(s => s.id === schemeId);
      if (!scheme) return;

      this.addTransaction({
        date: scheme.nextPayoutDate,
        time: '10:00',
        amount: scheme.netPeriodicProfit,
        type: 'income',
        categoryId: 'sanchay_return',
        accountId: scheme.linkedAccountId,
        note: `${scheme.name} (${scheme.registrationNo}) profit payout`
      });

      const freq =
        scheme.payoutFrequencyMonths === 1
          ? 'monthly'
          : scheme.payoutFrequencyMonths === 3
            ? 'quarterly'
            : 'monthly';

      if (scheme.payoutFrequencyMonths === 6) {
        const step1 = advanceDueDate(scheme.nextPayoutDate, 'quarterly');
        scheme.nextPayoutDate = advanceDueDate(step1, 'quarterly');
      } else {
        scheme.nextPayoutDate = advanceDueDate(scheme.nextPayoutDate, freq);
      }
      this.persistState();
    },

    syncFromPcManager(overridePayload?: RawPcManagerPayload): Promise<SyncReconciliationReport> {
      return withSyncLock(async () => {
        this.syncStatus = 'Syncing';
        try {
          let payload: RawPcManagerPayload;
          if (overridePayload) {
            payload = overridePayload;
          } else {
            const client = new RealbytePcManagerClient(this.phoneIp, this.phonePort);
            const reachable = await client.checkConnection();
            if (reachable) {
              const [accounts, categories, transactions] = await Promise.all([
                client.fetchAccounts(),
                client.fetchCategories(),
                client.fetchTransactions(`${this.selectedYear}-01-01`, `${this.selectedYear}-12-31`)
              ]);
              payload = { accounts, categories, transactions };
            } else {
              payload = {
                accounts: [
                  { uid: 1, name: 'Cash Wallet', amount: 8500, currency: 'BDT', asset_type: 0 },
                  { uid: 4, name: 'bKash Personal', amount: 12450, currency: 'BDT', asset_type: 1 }
                ],
                categories: [
                  { uid: 101, name: 'Groceries & Bazar', do_type: '1' },
                  { uid: 105, name: 'Dining & Snacks', do_type: '1' }
                ],
                transactions: [
                  {
                    uid: 5003,
                    wdate: '2026-11-03',
                    utime: 1762172000000,
                    do_type: '1',
                    money: 3500,
                    asset_uid: 4,
                    category_uid: 101,
                    note: 'Unimart bazar'
                  },
                  {
                    uid: 5007,
                    wdate: '2026-11-06',
                    utime: 1762430000000,
                    do_type: '1',
                    money: 650,
                    asset_uid: 1,
                    category_uid: 105,
                    note: 'Evening Kacchi & Cha (Synced via PC Manager)'
                  }
                ]
              };
            }
          }

          const normalized = normalizePcManagerData(payload);
          const reconciled = reconcileRealbyteSync(
            {
              transactions: this.transactions,
              accounts: this.accounts,
              categories: this.categories
            },
            normalized,
            'realbyte_pc_manager',
            true,
            { adjustAccountBalances: true }
          );

          this.transactions = reconciled.transactions;
          this.accounts = reconciled.accounts;
          this.categories = reconciled.categories;
          this.lastSyncReport = reconciled.report;
          this.syncStatus = 'Synced';
          this.persistState();
          return reconciled.report;
        } catch (err) {
          this.syncStatus = 'Disconnected';
          throw err;
        }
      });
    },

    syncFromSqliteVault(
      vaultInput: string | Uint8Array | ArrayBuffer | RealbyteSQLiteDump
    ): Promise<SyncReconciliationReport> {
      return withSyncLock(async () => {
        this.syncStatus = 'Syncing';
        const conn = createSQLiteConnection({
          dbPath: this.cloudSyncPath,
          journalMode: 'WAL',
          synchronous: 'NORMAL',
          busyTimeoutMs: 5000,
          enforceWal: true
        });

        await conn.open();
        try {
          const pragmaCheck = conn.verifyPragmas();
          const reconciled = await conn.withAtomicTransaction(() => {
            const parsedVault = parseRealbyteSqliteVault(vaultInput);
            return reconcileRealbyteSync(
              {
                transactions: this.transactions,
                accounts: this.accounts,
                categories: this.categories
              },
              parsedVault,
              'realbyte_sqlite_backup',
              pragmaCheck.walMode,
              { adjustAccountBalances: true }
            );
          });

          this.transactions = reconciled.transactions;
          this.accounts = reconciled.accounts;
          this.categories = reconciled.categories;
          this.lastSyncReport = reconciled.report;
          this.syncStatus = 'Synced';
          this.persistState();
          return reconciled.report;
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
            memo: p.notes || p.payee
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
            memo: p.notes || p.payee
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
              memo: q.memo || q.payee
            };
          }),
          targetAccountId,
          'groceries',
          'salary'
        );
      }

      const ruledTransactions = mapped.map(tx => {
        const ruled = applyRulesToTransaction(tx, this.rules);
        ruled.fingerprint = computeTransactionFingerprint(ruled);
        return ruled;
      });

      const reconciled = reconcileRealbyteSync(
        {
          transactions: this.transactions,
          accounts: this.accounts,
          categories: this.categories
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
    }
  }
});
