import { describe, it, expect } from 'vitest';
import { buildAccountsHierarchy } from '../modules/accounts/manager';
import { Account } from '../types';

describe('Accounts Hierarchy Engine', () => {
  const sampleAccounts: Account[] = [
    { id: '1', name: 'Cash Wallet', type: 'cash', balance: 5000, currency: 'BDT' },
    { id: '2', name: 'City Bank', type: 'bank', balance: 120000, currency: 'BDT' },
    { id: '3', name: 'bKash Personal', type: 'mfs', balance: 8500, currency: 'BDT' },
    { id: '4', name: 'Nagad', type: 'mfs', balance: 3200, currency: 'BDT' },
    { id: '5', name: 'City Bank Amex Card', type: 'credit_card', balance: 15000, currency: 'BDT' }
  ];

  it('correctly organizes accounts into Cash/Bank, MFS, and Liabilities with Net Worth calculation', () => {
    const sanchaypatraInvestmentsBDT = 1000000;
    const overview = buildAccountsHierarchy(sampleAccounts, sanchaypatraInvestmentsBDT);

    // Assets = Cash (5k) + Bank (120k) + bKash (8.5k) + Nagad (3.2k) = 136,700 BDT
    expect(overview.totalAssets).toBe(136700);

    // Liabilities = Amex Card (15k)
    expect(overview.totalLiabilities).toBe(15000);

    // Investments = 1,000,000 BDT
    expect(overview.totalInvestments).toBe(1000000);

    // Net Worth = (Assets 136,700 + Investments 1,000,000) - Liabilities 15,000 = 1,121,700 BDT
    expect(overview.netWorth).toBe(1121700);

    const cashBankGroup = overview.groups.find(g => g.id === 'cash_and_bank');
    expect(cashBankGroup?.accounts.length).toBe(2);
    expect(cashBankGroup?.totalBalance).toBe(125000);

    const mfsGroup = overview.groups.find(g => g.id === 'mfs');
    expect(mfsGroup?.accounts.length).toBe(2);
    expect(mfsGroup?.totalBalance).toBe(11700);
  });
});
