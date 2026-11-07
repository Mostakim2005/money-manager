import { Account, Category, DoubleEntryJournalEntry, JournalPosting, Transaction } from '../../types';

/**
 * Sanitizes and formats an account name into a valid double-entry / Beancount identifier.
 */
export function toLedgerAccount(
  prefix: 'Assets' | 'Liabilities' | 'Income' | 'Expenses',
  rawName: string
): string {
  const clean = rawName
    .replace(/[&]/g, 'And')
    .replace(/[^a-zA-Z0-9:_-]/g, '')
    .trim();

  if (
    clean.startsWith('Assets:') ||
    clean.startsWith('Liabilities:') ||
    clean.startsWith('Income:') ||
    clean.startsWith('Expenses:')
  ) {
    return clean;
  }

  return `${prefix}:${clean || 'General'}`;
}

/**
 * Generates double-entry journal entries from single-entry transactions.
 * Enforces fundamental accounting equation:
 * - Expense: Debit Expenses:<CategoryName>, Credit Assets:<AccountName> (or Liabilities:<AccountName> for credit card)
 * - Income: Debit Assets:<AccountName>, Credit Income:<CategoryName>
 * - Transfer: Debit Assets:<TargetAccountName> (or Liabilities:<TargetAccountName>), Credit Assets:<SourceAccountName>
 */
export function generateDoubleEntryJournal(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[]
): DoubleEntryJournalEntry[] {
  const accountMap = new Map<string, Account>(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map<string, Category>(categories.map((c) => [c.id, c]));

  return transactions.map((tx) => {
    const postings: JournalPosting[] = [];
    const sourceAccount = accountMap.get(tx.accountId);
    const category = categoryMap.get(tx.categoryId);

    if (tx.type === 'expense') {
      const expenseAcct = toLedgerAccount('Expenses', category?.name || tx.categoryId || 'General');
      const isCreditSource = sourceAccount && (sourceAccount.type === 'credit_card' || sourceAccount.type === 'liability');
      const creditAcct = toLedgerAccount(
        isCreditSource ? 'Liabilities' : 'Assets',
        sourceAccount?.name || tx.accountId
      );

      postings.push(
        { accountName: expenseAcct, debitBDT: tx.amount, creditBDT: 0 },
        { accountName: creditAcct, debitBDT: 0, creditBDT: tx.amount }
      );
    } else if (tx.type === 'income') {
      const incomeCategoryAcct = toLedgerAccount('Income', category?.name || tx.categoryId || 'General');
      const isSourceLiability = sourceAccount && (sourceAccount.type === 'credit_card' || sourceAccount.type === 'liability');
      const debitAcct = toLedgerAccount(
        isSourceLiability ? 'Liabilities' : 'Assets',
        sourceAccount?.name || tx.accountId
      );

      postings.push(
        { accountName: debitAcct, debitBDT: tx.amount, creditBDT: 0 },
        { accountName: incomeCategoryAcct, debitBDT: 0, creditBDT: tx.amount }
      );
    } else if (tx.type === 'transfer') {
      const targetAccount = tx.targetAccountId ? accountMap.get(tx.targetAccountId) : undefined;
      const isTargetLiability = targetAccount && (targetAccount.type === 'credit_card' || targetAccount.type === 'liability');
      const debitAcct = toLedgerAccount(
        isTargetLiability ? 'Liabilities' : 'Assets',
        targetAccount?.name || tx.targetAccountId || 'Target'
      );

      const isSourceLiability = sourceAccount && (sourceAccount.type === 'credit_card' || sourceAccount.type === 'liability');
      const creditAcct = toLedgerAccount(
        isSourceLiability ? 'Liabilities' : 'Assets',
        sourceAccount?.name || tx.accountId
      );

      postings.push(
        { accountName: debitAcct, debitBDT: tx.amount, creditBDT: 0 },
        { accountName: creditAcct, debitBDT: 0, creditBDT: tx.amount }
      );
    }

    const totalDebits = postings.reduce((sum, p) => sum + p.debitBDT, 0);
    const totalCredits = postings.reduce((sum, p) => sum + p.creditBDT, 0);
    const balanced = Math.abs(totalDebits - totalCredits) < 0.005;

    return {
      id: `journal_${tx.id}`,
      transactionId: tx.id,
      date: tx.date,
      narration: tx.description || tx.note || `${tx.type} transaction`,
      postings,
      balanced,
    };
  });
}

/**
 * Computes trial balance across all journal entries and validates that total debits equal total credits.
 */
export function verifyLedgerTrialBalance(
  entries: DoubleEntryJournalEntry[]
): { totalDebits: number; totalCredits: number; isBalanced: boolean } {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const entry of entries) {
    for (const posting of entry.postings) {
      totalDebits += posting.debitBDT;
      totalCredits += posting.creditBDT;
    }
  }

  const roundedDebits = Math.round(totalDebits * 100) / 100;
  const roundedCredits = Math.round(totalCredits * 100) / 100;
  const isBalanced = Math.abs(roundedDebits - roundedCredits) < 0.005;

  return {
    totalDebits: roundedDebits,
    totalCredits: roundedCredits,
    isBalanced,
  };
}

/**
 * Exports double-entry journal entries to plain-text Beancount format.
 * Format:
 * YYYY-MM-DD * "Narration"
 *   Account  Amount BDT
 *   Account  -Amount BDT
 */
export function exportJournalToBeancount(
  entries: DoubleEntryJournalEntry[],
  currency: string = 'BDT'
): string {
  const blocks = entries.map((entry) => {
    const escapedNarration = (entry.narration || 'Transaction').replace(/"/g, '\\"');
    const header = `${entry.date} * "${escapedNarration}"`;

    const postingLines = entry.postings.map((p) => {
      const acct = p.accountName.replace(/\s+/g, '');
      if (p.debitBDT > 0 && p.creditBDT === 0) {
        return `  ${acct}  ${p.debitBDT.toFixed(2)} ${currency}`;
      } else if (p.creditBDT > 0 && p.debitBDT === 0) {
        return `  ${acct}  -${p.creditBDT.toFixed(2)} ${currency}`;
      } else {
        const net = p.debitBDT - p.creditBDT;
        const sign = net < 0 ? '-' : '';
        return `  ${acct}  ${sign}${Math.abs(net).toFixed(2)} ${currency}`;
      }
    });

    return [header, ...postingLines].join('\n');
  });

  return blocks.join('\n\n');
}
