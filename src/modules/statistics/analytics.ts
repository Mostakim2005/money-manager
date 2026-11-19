import type {
  Category,
  MonthlyTrendPoint,
  NetWorthTrendPoint,
  Transaction,
} from '../../types';
import { roundTaka } from '../accounts/transferEngine';

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  percentage: number;
  color?: string;
  transactionCount: number;
}

export interface PeriodAnalytics {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRatePercentage: number;
  expenseBreakdown: CategoryBreakdownItem[];
  incomeBreakdown: CategoryBreakdownItem[];
}

/**
 * Computes category breakdown and savings statistics matching Realbyte's Stats tab.
 */
export function computePeriodAnalytics(
  transactions: Transaction[],
  categories: Category[]
): PeriodAnalytics {
  const categoryMap = new Map<string, Category>(categories.map(c => [c.id, c]));

  let totalIncome = 0;
  let totalExpense = 0;

  const expenseCategorySums = new Map<string, { amount: number; count: number }>();
  const incomeCategorySums = new Map<string, { amount: number; count: number }>();

  for (const txn of transactions) {
    if (txn.type === 'expense') {
      totalExpense += txn.amount;
      const current = expenseCategorySums.get(txn.categoryId) || { amount: 0, count: 0 };
      current.amount += txn.amount;
      current.count += 1;
      expenseCategorySums.set(txn.categoryId, current);
    } else if (txn.type === 'income') {
      totalIncome += txn.amount;
      const current = incomeCategorySums.get(txn.categoryId) || { amount: 0, count: 0 };
      current.amount += txn.amount;
      current.count += 1;
      incomeCategorySums.set(txn.categoryId, current);
    }
  }

  const buildBreakdown = (
    sums: Map<string, { amount: number; count: number }>,
    total: number
  ): CategoryBreakdownItem[] => {
    const items: CategoryBreakdownItem[] = [];
    sums.forEach((val, catId) => {
      const cat = categoryMap.get(catId);
      items.push({
        categoryId: catId,
        categoryName: cat?.name || 'Uncategorized',
        totalAmount: val.amount,
        percentage: total > 0 ? Number(((val.amount / total) * 100).toFixed(1)) : 0,
        color: cat?.color,
        transactionCount: val.count
      });
    });
    return items.sort((a, b) => b.totalAmount - a.totalAmount);
  };

  const netSavings = totalIncome - totalExpense;
  const savingsRatePercentage = totalIncome > 0
    ? Number(((netSavings / totalIncome) * 100).toFixed(1))
    : 0;

  return {
    totalIncome,
    totalExpense,
    netSavings,
    savingsRatePercentage,
    expenseBreakdown: buildBreakdown(expenseCategorySums, totalExpense),
    incomeBreakdown: buildBreakdown(incomeCategorySums, totalIncome)
  };
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getTrailingMonthKeys(referenceYear: number, referenceMonth: number, monthsCount: number): string[] {
  const count = Math.max(1, Math.round(monthsCount));
  const keys: string[] = [];
  const baseTotalMonths = referenceYear * 12 + (referenceMonth - 1);

  for (let offset = count - 1; offset >= 0; offset--) {
    const total = baseTotalMonths - offset;
    const y = Math.floor(total / 12);
    const m = ((total % 12) + 12) % 12 + 1;
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return keys;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const name = SHORT_MONTHS[(m || 1) - 1] || 'Jan';
  return `${name} '${String(y).slice(-2)}`;
}

/**
 * Aggregates monthly income, expense, and net cashflow over a trailing window (e.g., 6 or 12 months).
 */
export function computeMonthlyTrend(
  transactions: Transaction[],
  referenceYear: number,
  referenceMonth: number,
  monthsCount: number = 6
): MonthlyTrendPoint[] {
  const keys = getTrailingMonthKeys(referenceYear, referenceMonth, monthsCount);
  const buckets = new Map<string, { income: number; expense: number }>();
  for (const key of keys) {
    buckets.set(key, { income: 0, expense: 0 });
  }

  for (const txn of transactions) {
    if (!txn.date || txn.date.length < 7) continue;
    const monthKey = txn.date.slice(0, 7);
    const bucket = buckets.get(monthKey);
    if (!bucket) continue;
    if (txn.type === 'income') {
      bucket.income += roundTaka(txn.amount);
    } else if (txn.type === 'expense') {
      bucket.expense += roundTaka(txn.amount);
    }
  }

  return keys.map(monthKey => {
    const b = buckets.get(monthKey)!;
    return {
      monthKey,
      label: formatMonthLabel(monthKey),
      income: b.income,
      expense: b.expense,
      net: b.income - b.expense,
    };
  });
}

/**
 * Reconstructs historical month-end Net Worth trend by walking backwards from `currentNetWorth`
 * using each month's net cashflow delta.
 */
export function computeNetWorthTrend(
  currentNetWorth: number,
  transactions: Transaction[],
  referenceYear: number,
  referenceMonth: number,
  monthsCount: number = 6
): NetWorthTrendPoint[] {
  const monthly = computeMonthlyTrend(transactions, referenceYear, referenceMonth, monthsCount);
  const points: NetWorthTrendPoint[] = new Array(monthly.length);

  let runningWorth = roundTaka(currentNetWorth);
  for (let i = monthly.length - 1; i >= 0; i--) {
    points[i] = {
      monthKey: monthly[i].monthKey,
      label: monthly[i].label,
      netWorth: runningWorth,
    };
    runningWorth = roundTaka(runningWorth - monthly[i].net);
  }

  return points;
}
