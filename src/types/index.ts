export type TransactionType = 'income' | 'expense' | 'transfer';

export type BudgetMode = 'cashflow_ledger' | 'envelope_allocation';

export interface Transaction {
  id: string;
  date: string; // ISO YYYY-MM-DD
  time?: string; // HH:mm
  amount: number;
  type: TransactionType;
  categoryId: string;
  subcategoryId?: string;
  accountId: string; // Source account (e.g. Bank, bKash, Cash)
  targetAccountId?: string; // For transfers
  note?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export type AccountType = 'cash' | 'bank' | 'mfs' | 'credit_card' | 'asset' | 'liability';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string; // e.g. BDT
  accountNumber?: string;
  color?: string;
  icon?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  subcategories?: string[];
  budgetMonthlyAllocated?: number; // Used only when BudgetMode is 'envelope_allocation'
}

export interface SanchaypatraScheme {
  id: string;
  name: string; // e.g., "5-Year Bangladesh Sanchaypatra"
  registrationNo: string;
  principal: number; // e.g. 1,000,000 BDT
  issueDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  tenureYears: number;
  payoutFrequencyMonths: number; // 1 for monthly, 3 for quarterly
  slabGrossRate: number; // e.g. 0.1128 (11.28%)
  aitRate: number; // 0.05 (5%) or 0.10 (10%)
  netPeriodicProfit: number;
  linkedAccountId: string; // Bank account where profits are deposited
  nextPayoutDate: string;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  income: number;
  expense: number;
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
  conditions: {
    field: 'payee' | 'note' | 'amount' | 'accountId';
    operator: 'contains' | 'equals' | 'greater_than' | 'less_than';
    value: string | number;
  }[];
  actions: {
    field: 'categoryId' | 'subcategoryId' | 'accountId';
    value: string;
  }[];
}
