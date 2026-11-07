import { Transaction, DailySummary, MonthSummary } from '../../types';

/**
 * Aggregates transactions into a monthly calendar matrix matching Realbyte's color-coded daily grid.
 */
export function buildMonthCalendarMatrix(
  transactions: Transaction[],
  year: number,
  month: number // 1-12
): MonthSummary {
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysMap: Record<string, DailySummary> = {};

  // Initialize all days of the month with zero values
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    daysMap[dayStr] = {
      date: dayStr,
      dayNumber: d,
      income: 0,
      expense: 0,
      net: 0,
      transactionCount: 0
    };
  }

  let totalIncome = 0;
  let totalExpense = 0;

  for (const txn of transactions) {
    if (!txn.date) continue;
    const [tYear, tMonth] = txn.date.split('-').map(Number);

    if (tYear === year && tMonth === month) {
      const daySummary = daysMap[txn.date];
      if (daySummary) {
        daySummary.transactionCount += 1;
        if (txn.type === 'income') {
          daySummary.income += txn.amount;
          totalIncome += txn.amount;
        } else if (txn.type === 'expense') {
          daySummary.expense += txn.amount;
          totalExpense += txn.amount;
        }
        daySummary.net = daySummary.income - daySummary.expense;
      }
    }
  }

  return {
    year,
    month,
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    days: daysMap
  };
}
