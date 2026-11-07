import { Account, AccountType, Transaction } from '../../types';

export interface ExecuteTransferParams {
  sourceAccountId: string;
  targetAccountId: string;
  amount: number;
  date: string;
  time?: string;
  note?: string;
}

export interface ExecuteTransferResult {
  updatedAccounts: Account[];
  transferTransaction: Transaction;
}

/**
 * Determines whether an account is classified as a liability (credit card or debt).
 * In this system, liability account balances represent the amount owed (debt).
 */
export function isLiabilityAccount(type: AccountType): boolean {
  return type === 'credit_card' || type === 'liability';
}

/**
 * Executes an atomic transfer between two accounts with proper balance updates
 * and validation across asset and liability accounts.
 */
export function executeAccountTransfer(
  accounts: Account[],
  params: {
    sourceAccountId: string;
    targetAccountId: string;
    amount: number;
    date: string;
    time?: string;
    note?: string;
  }
): ExecuteTransferResult {
  const { sourceAccountId, targetAccountId, amount, date, time = '12:00', note } = params;

  // 1. Validation
  if (sourceAccountId === targetAccountId) {
    throw new Error('Source and target accounts must be different');
  }

  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error('Transfer amount must be greater than zero');
  }

  const sourceAccount = accounts.find((a) => a.id === sourceAccountId);
  if (!sourceAccount) {
    throw new Error(`Source account '${sourceAccountId}' not found`);
  }

  const targetAccount = accounts.find((a) => a.id === targetAccountId);
  if (!targetAccount) {
    throw new Error(`Target account '${targetAccountId}' not found`);
  }

  // 2. Compute balance adjustments
  // For source account:
  // - Asset account: balance decreases (spending / sending money out)
  // - Liability account: debt balance increases (borrowing / cash advance)
  const sourceNewBalance = isLiabilityAccount(sourceAccount.type)
    ? sourceAccount.balance + amount
    : sourceAccount.balance - amount;

  // For target account:
  // - Asset account: balance increases (receiving funds)
  // - Liability account: debt balance decreases (bill payment reducing amount owed)
  const targetNewBalance = isLiabilityAccount(targetAccount.type)
    ? targetAccount.balance - amount
    : targetAccount.balance + amount;

  const now = Date.now();

  // 3. Create updated accounts list immutably
  const updatedAccounts = accounts.map((acc) => {
    if (acc.id === sourceAccountId) {
      return {
        ...acc,
        balance: sourceNewBalance,
        updatedAt: now,
      };
    }
    if (acc.id === targetAccountId) {
      return {
        ...acc,
        balance: targetNewBalance,
        updatedAt: now,
      };
    }
    return { ...acc };
  });

  // 4. Create transfer transaction record
  const description = note || `Transfer from ${sourceAccount.name} to ${targetAccount.name}`;
  const transferTransaction: Transaction = {
    id: `transfer_${now}_${Math.random().toString(36).slice(2, 8)}`,
    date,
    time,
    amount,
    type: 'transfer',
    categoryId: 'transfer',
    accountId: sourceAccountId,
    targetAccountId,
    description,
    note,
    createdAt: now,
    updatedAt: now,
  };

  return {
    updatedAccounts,
    transferTransaction,
  };
}
