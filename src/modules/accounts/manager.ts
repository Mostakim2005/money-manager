import { Account } from '../../types';

export interface AccountGroup {
  id: string;
  name: string;
  type: 'asset' | 'liability' | 'investment';
  accounts: Account[];
  totalBalance: number;
}

export interface NetWorthOverview {
  totalAssets: number;
  totalLiabilities: number;
  totalInvestments: number;
  netWorth: number;
  groups: AccountGroup[];
}

/**
 * Organizes accounts into structured groups matching Realbyte's Accounts tab.
 */
export function buildAccountsHierarchy(
  accounts: Account[],
  investmentTotalBDT: number = 0
): NetWorthOverview {
  const groups: Record<string, AccountGroup> = {
    cash_and_bank: {
      id: 'cash_and_bank',
      name: 'Cash & Bank Accounts',
      type: 'asset',
      accounts: [],
      totalBalance: 0
    },
    mfs: {
      id: 'mfs',
      name: 'Mobile Financial Services (MFS)',
      type: 'asset',
      accounts: [],
      totalBalance: 0
    },
    liabilities: {
      id: 'liabilities',
      name: 'Credit Cards & Liabilities',
      type: 'liability',
      accounts: [],
      totalBalance: 0
    },
    investments: {
      id: 'investments',
      name: 'Savings Schemes & Investments',
      type: 'investment',
      accounts: [],
      totalBalance: investmentTotalBDT
    }
  };

  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const acc of accounts) {
    if (acc.type === 'cash' || acc.type === 'bank') {
      groups.cash_and_bank.accounts.push(acc);
      groups.cash_and_bank.totalBalance += acc.balance;
      totalAssets += acc.balance;
    } else if (acc.type === 'mfs') {
      groups.mfs.accounts.push(acc);
      groups.mfs.totalBalance += acc.balance;
      totalAssets += acc.balance;
    } else if (acc.type === 'credit_card' || acc.type === 'liability') {
      groups.liabilities.accounts.push(acc);
      groups.liabilities.totalBalance += acc.balance;
      totalLiabilities += acc.balance;
    } else if (acc.type === 'asset') {
      groups.investments.accounts.push(acc);
      groups.investments.totalBalance += acc.balance;
    }
  }

  const totalInvestments = groups.investments.totalBalance;
  const netWorth = (totalAssets + totalInvestments) - totalLiabilities;

  return {
    totalAssets,
    totalLiabilities,
    totalInvestments,
    netWorth,
    groups: Object.values(groups)
  };
}
