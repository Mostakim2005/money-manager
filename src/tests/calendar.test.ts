import { describe, it, expect } from 'vitest';
import { buildMonthCalendarMatrix } from '../modules/calendar/matrix';
import { Transaction } from '../types';

describe('Calendar Matrix Engine', () => {
  const sampleTransactions: Transaction[] = [
    {
      id: 'tx-1',
      date: '2026-11-05',
      amount: 1500,
      type: 'expense',
      categoryId: 'groceries',
      accountId: 'cash',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'tx-2',
      date: '2026-11-05',
      amount: 500,
      type: 'expense',
      categoryId: 'transport',
      accountId: 'bkash',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'tx-3',
      date: '2026-11-05',
      amount: 50000,
      type: 'income',
      categoryId: 'salary',
      accountId: 'bank',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'tx-4',
      date: '2026-11-12',
      amount: 3200,
      type: 'expense',
      categoryId: 'dining',
      accountId: 'card',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  it('correctly aggregates daily income and expense totals for Realbyte calendar view', () => {
    const summary = buildMonthCalendarMatrix(sampleTransactions, 2026, 11);

    expect(summary.totalIncome).toBe(50000);
    expect(summary.totalExpense).toBe(5200);
    expect(summary.netBalance).toBe(44800);

    const day5 = summary.days['2026-11-05'];
    expect(day5).toBeDefined();
    expect(day5.income).toBe(50000);
    expect(day5.expense).toBe(2000);
    expect(day5.net).toBe(48000);
    expect(day5.transactionCount).toBe(3);

    const day12 = summary.days['2026-11-12'];
    expect(day12).toBeDefined();
    expect(day12.income).toBe(0);
    expect(day12.expense).toBe(3200);
    expect(day12.net).toBe(-3200);
  });
});
