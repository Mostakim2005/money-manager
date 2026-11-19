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
 * Rounds any currency amount to the nearest whole Taka (BDT integer).
 */
export function roundTaka(amount: number): number {
  return Math.round(Number(amount || 0));
}

/**
 * Computes the signed balance delta for a single account given its AccountType,
 * the TransactionType (or transfer role), and the positive amount.
 * - Asset accounts: income/transfer_in adds (+amount); expense/transfer_out subtracts (-amount).
 * - Liability accounts (debt owed): expense/transfer_out increases debt (+amount); income/transfer_in reduces debt (-amount).
 */
export function computeAccountBalanceDelta(
  accountType: AccountType,
  role: 'income' | 'expense' | 'transfer_out' | 'transfer_in',
  amount: number
): number {
  const wholeAmount = roundTaka(Math.abs(amount));
  const isLiability = isLiabilityAccount(accountType);

  if (role === 'income' || role === 'transfer_in') {
    return isLiability ? -wholeAmount : wholeAmount;
  }
  // role === 'expense' || role === 'transfer_out'
  return isLiability ? wholeAmount : -wholeAmount;
}

/**
 * Applies or reverses a transaction's balance impact across an accounts array in place.
 * factor = 1 to apply, factor = -1 to reverse.
 */
export function applyTransactionToAccounts(
  accounts: Account[],
  txn: Pick<Transaction, 'type' | 'amount' | 'accountId' | 'targetAccountId'>,
  factor: 1 | -1 = 1
): void {
  const sourceAcc = accounts.find((a) => a.id === txn.accountId);
  if (sourceAcc) {
    const role = txn.type === 'transfer' ? 'transfer_out' : txn.type;
    sourceAcc.balance = roundTaka(
      sourceAcc.balance + computeAccountBalanceDelta(sourceAcc.type, role, txn.amount) * factor
    );
  }

  if (txn.type === 'transfer' && txn.targetAccountId) {
    const targetAcc = accounts.find((a) => a.id === txn.targetAccountId);
    if (targetAcc) {
      targetAcc.balance = roundTaka(
        targetAcc.balance + computeAccountBalanceDelta(targetAcc.type, 'transfer_in', txn.amount) * factor
      );
    }
  }
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

  // 2. Compute balance adjustments using canonical helper
  const wholeAmount = roundTaka(amount);
  const sourceNewBalance = roundTaka(
    sourceAccount.balance + computeAccountBalanceDelta(sourceAccount.type, 'transfer_out', wholeAmount)
  );
  const targetNewBalance = roundTaka(
    targetAccount.balance + computeAccountBalanceDelta(targetAccount.type, 'transfer_in', wholeAmount)
  );

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
    amount: wholeAmount,
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
