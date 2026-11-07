import { Transaction, Category } from '../../types';

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
