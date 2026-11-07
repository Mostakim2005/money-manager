import { defineStore } from 'pinia';
import { Transaction, Account, Category, SanchaypatraScheme, BudgetMode } from '../types';
import { BANGLADESH_SANCHAYPATRA_SCHEMES } from '../modules/sanchaypatra/schemes';
import { calculateSanchaypatraProfit, generatePayoutScheduleDates } from '../modules/sanchaypatra/calculator';

export const useMoneyStore = defineStore('money', {
  state: () => ({
    activeTab: 'daily' as 'transactions' | 'daily' | 'accounts' | 'stats' | 'sanchaypatra' | 'settings',
    budgetMode: 'cashflow_ledger' as BudgetMode,
    selectedYear: 2026,
    selectedMonth: 11, // November
    selectedDate: '2026-11-07',

    // Sync configuration
    cloudSyncPath: 'C:\\Users\\kazir\\Google Drive\\MoneyManager\\money_android.sqlite',
    phoneIp: '192.168.1.105',
    phonePort: 10000,
    syncStatus: 'Synced' as 'Synced' | 'Syncing' | 'Disconnected',

    // Initial Bangladeshi Categories
    categories: [
      { id: 'groceries', name: 'Groceries & Bazar', type: 'expense', color: '#10B981', budgetMonthlyAllocated: 15000 },
      { id: 'rent', name: 'House Rent', type: 'expense', color: '#EF4444', budgetMonthlyAllocated: 25000 },
      { id: 'utilities', name: 'Electricity & Gas', type: 'expense', color: '#F59E0B', budgetMonthlyAllocated: 4000 },
      { id: 'transport', name: 'Transport / Uber / Fuel', type: 'expense', color: '#6366F1', budgetMonthlyAllocated: 5000 },
      { id: 'dining', name: 'Dining & Snacks', type: 'expense', color: '#EC4899', budgetMonthlyAllocated: 6000 },
      { id: 'medical', name: 'Healthcare & Pharma', type: 'expense', color: '#14B8A6', budgetMonthlyAllocated: 3000 },
      { id: 'salary', name: 'Monthly Salary', type: 'income', color: '#3B82F6' },
      { id: 'sanchay_return', name: 'Sanchaypatra Profit', type: 'income', color: '#8B5CF6' }
    ] as Category[],

    // Initial Bangladeshi Accounts
    accounts: [
      { id: 'cash_wallet', name: 'Cash Wallet', type: 'cash', balance: 8500, currency: 'BDT', color: '#10B981' },
      { id: 'sonali_bank', name: 'Sonali Bank (Savings)', type: 'bank', balance: 145000, currency: 'BDT', accountNumber: '2050...102', color: '#3B82F6' },
      { id: 'city_bank', name: 'City Bank (Current)', type: 'bank', balance: 68000, currency: 'BDT', accountNumber: '1102...884', color: '#0EA5E9' },
      { id: 'bkash', name: 'bKash Personal', type: 'mfs', balance: 12450, currency: 'BDT', accountNumber: '017...889', color: '#E11D48' },
      { id: 'nagad', name: 'Nagad Wallet', type: 'mfs', balance: 4200, currency: 'BDT', accountNumber: '018...441', color: '#F97316' },
      { id: 'city_amex', name: 'City Bank Amex Card', type: 'credit_card', balance: 18500, currency: 'BDT', accountNumber: '3770...901', color: '#D97706' }
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

    // Sample Transactions
    transactions: [
      { id: 't1', date: '2026-11-01', time: '10:00', amount: 85000, type: 'income', categoryId: 'salary', accountId: 'city_bank', note: 'Monthly Salary November', createdAt: Date.now(), updatedAt: Date.now() },
      { id: 't2', date: '2026-11-02', time: '12:30', amount: 25000, type: 'expense', categoryId: 'rent', accountId: 'city_bank', note: 'Apartment rent', createdAt: Date.now(), updatedAt: Date.now() },
      { id: 't3', date: '2026-11-03', time: '18:45', amount: 3500, type: 'expense', categoryId: 'groceries', accountId: 'bkash', note: 'Unimart bazar', createdAt: Date.now(), updatedAt: Date.now() },
      { id: 't4', date: '2026-11-04', time: '14:15', amount: 1200, type: 'expense', categoryId: 'transport', accountId: 'cash_wallet', note: 'CNG & fuel', createdAt: Date.now(), updatedAt: Date.now() },
      { id: 't5', date: '2026-11-05', time: '20:00', amount: 2800, type: 'expense', categoryId: 'dining', accountId: 'city_amex', note: 'Dinner with family', createdAt: Date.now(), updatedAt: Date.now() },
      { id: 't6', date: '2026-11-07', time: '11:00', amount: 4560, type: 'income', categoryId: 'sanchay_return', accountId: 'city_bank', note: 'Paribar Sanchaypatra monthly profit', createdAt: Date.now(), updatedAt: Date.now() }
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
    }
  },

  actions: {
    addTransaction(txn: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) {
      const newTxn: Transaction = {
        ...txn,
        id: 'tx-' + Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.transactions.unshift(newTxn);

      // Adjust account balance
      const account = this.accounts.find(a => a.id === txn.accountId);
      if (account) {
        if (txn.type === 'income') account.balance += txn.amount;
        else if (txn.type === 'expense') account.balance -= txn.amount;
      }
    },

    addAccount(acc: Omit<Account, 'id'>) {
      this.accounts.push({
        ...acc,
        id: 'acc-' + Date.now()
      });
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
    }
  }
});
