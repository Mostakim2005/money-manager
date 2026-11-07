import { describe, it, expect } from 'vitest';
import { computePeriodAnalytics } from '../modules/statistics/analytics';
import { Transaction, Category } from '../types';

describe('Period Statistics & Analytics Engine', () => {
  const categories: Category[] = [
    { id: 'groceries', name: 'Groceries', type: 'expense', color: '#10B981' },
    { id: 'rent', name: 'House Rent', type: 'expense', color: '#EF4444' },
    { id: 'salary', name: 'Monthly Salary', type: 'income', color: '#3B82F6' },
    { id: 'sanchaypatra', name: 'Sanchaypatra Profit', type: 'income', color: '#8B5CF6' }
  ];

  const transactions: Transaction[] = [
    { id: '1', date: '2026-11-01', amount: 50000, type: 'income', categoryId: 'salary', accountId: 'bank', createdAt: 0, updatedAt: 0 },
    { id: '2', date: '2026-11-05', amount: 8640, type: 'income', categoryId: 'sanchaypatra', accountId: 'bank', createdAt: 0, updatedAt: 0 },
    { id: '3', date: '2026-11-02', amount: 20000, type: 'expense', categoryId: 'rent', accountId: 'bank', createdAt: 0, updatedAt: 0 },
    { id: '4', date: '2026-11-04', amount: 5000, type: 'expense', categoryId: 'groceries', accountId: 'cash', createdAt: 0, updatedAt: 0 }
  ];

  it('computes total income, expenses, net savings, and category percentage breakdown', () => {
    const stats = computePeriodAnalytics(transactions, categories);

    expect(stats.totalIncome).toBe(58640);
    expect(stats.totalExpense).toBe(25000);
    expect(stats.netSavings).toBe(33640);
    expect(stats.savingsRatePercentage).toBe(57.4);

    expect(stats.expenseBreakdown.length).toBe(2);
    // Rent is 20,000 / 25,000 = 80%
    expect(stats.expenseBreakdown[0].categoryName).toBe('House Rent');
    expect(stats.expenseBreakdown[0].totalAmount).toBe(20000);
    expect(stats.expenseBreakdown[0].percentage).toBe(80.0);

    // Groceries is 5,000 / 25,000 = 20%
    expect(stats.expenseBreakdown[1].categoryName).toBe('Groceries');
    expect(stats.expenseBreakdown[1].percentage).toBe(20.0);
  });
});
