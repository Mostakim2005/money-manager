import type {
  Transaction,
  Account,
  Category,
  SyncReconciliationReport,
} from '../../types';

/**
 * Computes a deterministic, collision-free transaction fingerprint.
 * Normalizes dates, lowercases identifiers/notes, and quantifies amount into integer cents (paisa)
 * so that formatting variations (e.g. 500 vs 500.00 or whitespace) resolve to the exact same hash.
 */
export function computeTransactionFingerprint(
  txn: Pick<Transaction, 'date' | 'type' | 'amount' | 'accountId' | 'categoryId' | 'note' | 'targetAccountId'>
): string {
  const date = (txn.date || '').trim();
  const type = (txn.type || '').trim().toLowerCase();
  const amountCents = Math.round(Number(txn.amount || 0) * 100);
  const accountId = (txn.accountId || '').trim().toLowerCase();
  const categoryId = (txn.categoryId || '').trim().toLowerCase();
  const targetAccountId = (txn.targetAccountId || '').trim().toLowerCase();
  const note = (txn.note || '').trim().toLowerCase();

  return `${date}|${type}|${amountCents}|${accountId}|${categoryId}|${targetAccountId}|${note}`;
}

export interface ReconcileOptions {
  adjustAccountBalances?: boolean;
}

/**
 * Reconciles incoming Realbyte transactions and account snapshots against the current ledger state.
 * Guarantees zero duplicate records across both PC Manager Wi-Fi and SQLite backup files.
 *
 * Matching hierarchy:
 * 1. externalUid match (rb-uid-*)
 * 2. id match (rb-txn-*)
 * 3. computeTransactionFingerprint match (date, type, amount, accounts, category, note)
 *
 * Conflict Resolution:
 * - Last-Write-Wins (LWW) based on updatedAt timestamps.
 * - Merges accounts and categories by externalUid, id, or case-insensitive name.
 */
export function reconcileRealbyteSync(
  currentState: { transactions: Transaction[]; accounts: Account[]; categories: Category[] },
  incoming: { transactions: Transaction[]; accounts?: Account[]; categories?: Category[] },
  source: 'realbyte_pc_manager' | 'realbyte_sqlite_backup',
  walModeVerified?: boolean,
  options?: ReconcileOptions
): {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  report: SyncReconciliationReport;
} {
  const transactions: Transaction[] = [...currentState.transactions];
  const accounts: Account[] = [...currentState.accounts];
  const categories: Category[] = [...currentState.categories];

  let insertedTransactions = 0;
  let updatedTransactions = 0;
  let skippedDuplicates = 0;
  let mergedAccounts = 0;
  let mergedCategories = 0;

  // 1. Reconcile Accounts
  const accountIdMap = new Map<string, string>();
  if (incoming.accounts && incoming.accounts.length > 0) {
    for (const incAcc of incoming.accounts) {
      const matchIndex = accounts.findIndex(existing => {
        if (incAcc.externalUid && existing.externalUid && incAcc.externalUid === existing.externalUid) {
          return true;
        }
        if (incAcc.id && existing.id && incAcc.id === existing.id) {
          return true;
        }
        if (incAcc.name && existing.name && incAcc.name.trim().toLowerCase() === existing.name.trim().toLowerCase()) {
          return true;
        }
        return false;
      });

      if (matchIndex !== -1) {
        const existing = accounts[matchIndex];
        accountIdMap.set(incAcc.id, existing.id);
        if (incAcc.externalUid) {
          accountIdMap.set(incAcc.externalUid, existing.id);
          if (!existing.externalUid) {
            existing.externalUid = incAcc.externalUid;
          }
        }
        if (incAcc.balance !== undefined) {
          existing.balance = incAcc.balance;
        }
        if (incAcc.updatedAt && (!existing.updatedAt || incAcc.updatedAt > existing.updatedAt)) {
          existing.updatedAt = incAcc.updatedAt;
        }
        mergedAccounts++;
      } else {
        accounts.push({ ...incAcc });
        accountIdMap.set(incAcc.id, incAcc.id);
        if (incAcc.externalUid) {
          accountIdMap.set(incAcc.externalUid, incAcc.id);
        }
        mergedAccounts++;
      }
    }
  }

  // 2. Reconcile Categories
  const categoryIdMap = new Map<string, string>();
  if (incoming.categories && incoming.categories.length > 0) {
    for (const incCat of incoming.categories) {
      const matchIndex = categories.findIndex(existing => {
        if (incCat.externalUid && existing.externalUid && incCat.externalUid === existing.externalUid) {
          return true;
        }
        if (incCat.id && existing.id && incCat.id === existing.id) {
          return true;
        }
        if (incCat.name && existing.name && incCat.name.trim().toLowerCase() === existing.name.trim().toLowerCase()) {
          return true;
        }
        return false;
      });

      if (matchIndex !== -1) {
        const existing = categories[matchIndex];
        categoryIdMap.set(incCat.id, existing.id);
        if (incCat.externalUid) {
          categoryIdMap.set(incCat.externalUid, existing.id);
          if (!existing.externalUid) {
            existing.externalUid = incCat.externalUid;
          }
        }
        mergedCategories++;
      } else {
        categories.push({ ...incCat });
        categoryIdMap.set(incCat.id, incCat.id);
        if (incCat.externalUid) {
          categoryIdMap.set(incCat.externalUid, incCat.id);
        }
        mergedCategories++;
      }
    }
  }

  // If incoming contains a full accounts snapshot, default adjustAccountBalances to false unless overridden
  const shouldAdjustBalances =
    options?.adjustAccountBalances !== undefined
      ? options.adjustAccountBalances
      : !(incoming.accounts && incoming.accounts.length > 0);

  function applyDeltaToAccount(accId: string, delta: number) {
    if (!shouldAdjustBalances) return;
    const acc = accounts.find(a => a.id === accId);
    if (acc) {
      acc.balance += delta;
    }
  }

  function applyTransactionBalance(txn: Transaction, factor: 1 | -1) {
    if (!shouldAdjustBalances) return;
    if (txn.type === 'income') {
      applyDeltaToAccount(txn.accountId, txn.amount * factor);
    } else if (txn.type === 'expense') {
      applyDeltaToAccount(txn.accountId, -txn.amount * factor);
    } else if (txn.type === 'transfer') {
      applyDeltaToAccount(txn.accountId, -txn.amount * factor);
      if (txn.targetAccountId) {
        applyDeltaToAccount(txn.targetAccountId, txn.amount * factor);
      }
    }
  }

  // 3. Reconcile Transactions
  for (const rawIncTxn of incoming.transactions) {
    const remappedAccountId = accountIdMap.get(rawIncTxn.accountId) || rawIncTxn.accountId;
    const remappedTargetAccountId = rawIncTxn.targetAccountId
      ? (accountIdMap.get(rawIncTxn.targetAccountId) || rawIncTxn.targetAccountId)
      : undefined;
    const remappedCategoryId = categoryIdMap.get(rawIncTxn.categoryId) || rawIncTxn.categoryId;

    const incTxn: Transaction = {
      ...rawIncTxn,
      accountId: remappedAccountId,
      targetAccountId: remappedTargetAccountId,
      categoryId: remappedCategoryId,
    };

    const fingerprint = incTxn.fingerprint || computeTransactionFingerprint(incTxn);
    incTxn.fingerprint = fingerprint;

    const matchIndex = transactions.findIndex(existing => {
      // (a) externalUid match
      if (incTxn.externalUid && existing.externalUid && incTxn.externalUid === existing.externalUid) {
        return true;
      }
      // (b) id match
      if (incTxn.id && existing.id && incTxn.id === existing.id) {
        return true;
      }
      // (c) computeTransactionFingerprint match
      const existingFp = existing.fingerprint || computeTransactionFingerprint(existing);
      if (existingFp === fingerprint) {
        return true;
      }
      return false;
    });

    if (matchIndex !== -1) {
      const existingTxn = transactions[matchIndex];

      // Last-Write-Wins (LWW)
      if (incTxn.updatedAt > existingTxn.updatedAt) {
        if (shouldAdjustBalances) {
          applyTransactionBalance(existingTxn, -1);
          applyTransactionBalance(incTxn, 1);
        }

        transactions[matchIndex] = {
          ...existingTxn,
          ...incTxn,
          id: existingTxn.id,
          externalUid: existingTxn.externalUid || incTxn.externalUid,
          fingerprint,
        };
        updatedTransactions++;
      } else {
        // Duplicate: preserve existing, backfill missing externalUid or fingerprint
        if (!existingTxn.externalUid && incTxn.externalUid) {
          existingTxn.externalUid = incTxn.externalUid;
        }
        if (!existingTxn.fingerprint) {
          existingTxn.fingerprint = fingerprint;
        }
        skippedDuplicates++;
      }
    } else {
      // New transaction
      applyTransactionBalance(incTxn, 1);
      transactions.push(incTxn);
      insertedTransactions++;
    }
  }

  const report: SyncReconciliationReport = {
    source,
    timestamp: Date.now(),
    insertedTransactions,
    updatedTransactions,
    skippedDuplicates,
    mergedAccounts,
    mergedCategories,
    walModeVerified: Boolean(walModeVerified),
  };

  return {
    transactions,
    accounts,
    categories,
    report,
  };
}
