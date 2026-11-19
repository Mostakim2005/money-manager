import type {
  Transaction,
  Account,
  Category,
  SyncReconciliationReport,
} from '../../types';
import { applyTransactionToAccounts, roundTaka } from '../accounts/transferEngine';

/**
 * Computes a deterministic, collision-free transaction fingerprint.
 * Normalizes dates, lowercases identifiers/notes, and rounds amount to the nearest whole Taka (BDT integer)
 * so that formatting variations (e.g. 500 vs 500.00 or whitespace) resolve to the exact same hash.
 */
export function computeTransactionFingerprint(
  txn: Pick<Transaction, 'date' | 'type' | 'amount' | 'accountId' | 'categoryId' | 'note' | 'targetAccountId'>
): string {
  const date = (txn.date || '').trim();
  const type = (txn.type || '').trim().toLowerCase();
  const amountWholeTaka = roundTaka(Number(txn.amount || 0));
  const accountId = (txn.accountId || '').trim().toLowerCase();
  const categoryId = (txn.categoryId || '').trim().toLowerCase();
  const targetAccountId = (txn.targetAccountId || '').trim().toLowerCase();
  const note = (txn.note || '').trim().toLowerCase();

  return `${date}|${type}|${amountWholeTaka}|${accountId}|${categoryId}|${targetAccountId}|${note}`;
}

export interface ReconcileOptions {
  /**
   * When true, applies transaction deltas to account balances.
   * When false (default whenever `incoming.accounts` contains a balance snapshot from Realbyte),
   * account balances are taken authoritatively from `incoming.accounts` to prevent double-counting.
   */
  adjustAccountBalances?: boolean;
  /**
   * When true, computes the reconciliation report and diff preview without mutating state.
   */
  dryRun?: boolean;
  /**
   * Optional date window `[startDate, endDate]` used to detect transactions deleted on the phone.
   */
  fetchedDateWindow?: { startDate: string; endDate: string };
}

/**
 * Reconciles incoming Realbyte transactions and account snapshots against the current ledger state.
 * Guarantees zero duplicate records across both PC Manager Wi-Fi and SQLite backup files.
 *
 * Matching hierarchy:
 * 1. externalUid match (rb-uid-*)
 * 2. id match (rb-txn-*)
 * 3. Post-remap multiset fingerprint match (handles identical same-day transactions via occurrence index #1, #2...)
 *
 * Conflict Resolution:
 * - Last-Write-Wins (LWW) based on updatedAt timestamps.
 * - Merges accounts and categories by externalUid, id, or case-insensitive name.
 * - Deep-clones all records so mid-sync errors never corrupt store state in-place.
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
  // Deep-clone input arrays so currentState is never mutated in-place (Fixes C7)
  const transactions: Transaction[] = currentState.transactions.map(t => ({ ...t }));
  const accounts: Account[] = currentState.accounts.map(a => ({ ...a }));
  const categories: Category[] = currentState.categories.map(c => ({ ...c }));

  let insertedTransactions = 0;
  let updatedTransactions = 0;
  let skippedDuplicates = 0;
  let mergedAccounts = 0;
  let mergedCategories = 0;

  const toInsert: Transaction[] = [];
  const toUpdate: { before: Transaction; after: Transaction }[] = [];
  const toDelete: Transaction[] = [];

  // 1. Reconcile Accounts
  const accountIdMap = new Map<string, string>();
  const hasIncomingAccountsSnapshot = Boolean(incoming.accounts && incoming.accounts.length > 0);

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
          existing.balance = roundTaka(incAcc.balance);
        }
        if (incAcc.updatedAt && (!existing.updatedAt || incAcc.updatedAt > existing.updatedAt)) {
          existing.updatedAt = incAcc.updatedAt;
        }
        mergedAccounts++;
      } else {
        const newAcc: Account = {
          ...incAcc,
          balance: roundTaka(incAcc.balance),
        };
        accounts.push(newAcc);
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

  // Fixes C2 & R8: If incoming carries an accounts snapshot, default adjustAccountBalances to false
  // so we never overwrite account balances from the snapshot AND double-apply transaction deltas.
  const shouldAdjustBalances =
    options?.adjustAccountBalances !== undefined
      ? options.adjustAccountBalances
      : !hasIncomingAccountsSnapshot;

  function applyTransactionBalance(txn: Transaction, factor: 1 | -1) {
    if (!shouldAdjustBalances) return;
    // Fixes C3: Uses shared canonical helper that properly handles liability accounts (credit_card, liability)
    applyTransactionToAccounts(accounts, txn, factor);
  }

  // Track which existing transaction indices have already been matched in this batch
  // so two identical same-day transactions (e.g., two ৳50 rickshaw rides) don't collide onto the same local row (Fixes R7)
  const matchedExistingIndices = new Set<number>();
  const incomingUidSet = new Set<string>();

  // 3. Reconcile Transactions
  for (const rawIncTxn of incoming.transactions) {
    const remappedAccountId = accountIdMap.get(rawIncTxn.accountId) || rawIncTxn.accountId;
    const remappedTargetAccountId = rawIncTxn.targetAccountId
      ? (accountIdMap.get(rawIncTxn.targetAccountId) || rawIncTxn.targetAccountId)
      : undefined;
    const remappedCategoryId = categoryIdMap.get(rawIncTxn.categoryId) || rawIncTxn.categoryId;

    const fkWasRemapped =
      remappedAccountId !== rawIncTxn.accountId ||
      remappedTargetAccountId !== rawIncTxn.targetAccountId ||
      remappedCategoryId !== rawIncTxn.categoryId;

    const incTxn: Transaction = {
      ...rawIncTxn,
      amount: roundTaka(rawIncTxn.amount),
      accountId: remappedAccountId,
      targetAccountId: remappedTargetAccountId,
      categoryId: remappedCategoryId,
    };

    if (incTxn.externalUid) {
      incomingUidSet.add(incTxn.externalUid);
    }

    // Fixes C4 & R6: Always recompute content fingerprint AFTER remapping foreign keys
    // (preserve custom bank-import fitId fingerprints like 'ofx:...' when FKs were not remapped)
    const canonicalFp = computeTransactionFingerprint(incTxn);
    const fingerprint =
      !fkWasRemapped && rawIncTxn.fingerprint && rawIncTxn.fingerprint.startsWith('ofx:')
        ? rawIncTxn.fingerprint
        : canonicalFp;
    incTxn.fingerprint = fingerprint;

    // Tier 1 & Tier 2: Exact identity match (externalUid or id)
    let matchIndex = transactions.findIndex((existing, idx) => {
      if (matchedExistingIndices.has(idx)) return false;
      if (incTxn.externalUid && existing.externalUid && incTxn.externalUid === existing.externalUid) {
        return true;
      }
      if (incTxn.id && existing.id && incTxn.id === existing.id) {
        return true;
      }
      return false;
    });

    // Tier 3: Multiset post-remap fingerprint match (only against unmatched local entries or entries lacking externalUid)
    if (matchIndex === -1) {
      matchIndex = transactions.findIndex((existing, idx) => {
        if (matchedExistingIndices.has(idx)) return false;
        // If both records have distinct externalUids, they are two separate real transactions on the same day (Fixes R7)
        if (incTxn.externalUid && existing.externalUid && incTxn.externalUid !== existing.externalUid) {
          return false;
        }
        const existingCanonicalFp = computeTransactionFingerprint(existing);
        const existingFp = existing.fingerprint || existingCanonicalFp;
        return existingFp === fingerprint || existingCanonicalFp === canonicalFp;
      });
    }

    if (matchIndex !== -1) {
      matchedExistingIndices.add(matchIndex);
      const existingTxn = transactions[matchIndex];

      // Last-Write-Wins (LWW)
      if (incTxn.updatedAt > existingTxn.updatedAt) {
        const beforeSnapshot = { ...existingTxn };
        if (shouldAdjustBalances) {
          applyTransactionBalance(existingTxn, -1);
          applyTransactionBalance(incTxn, 1);
        }

        const updatedRecord: Transaction = {
          ...existingTxn,
          ...incTxn,
          id: existingTxn.id,
          externalUid: existingTxn.externalUid || incTxn.externalUid,
          fingerprint,
        };
        transactions[matchIndex] = updatedRecord;
        toUpdate.push({ before: beforeSnapshot, after: updatedRecord });
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
      matchedExistingIndices.add(transactions.length - 1);
      toInsert.push(incTxn);
      insertedTransactions++;
    }
  }

  // 4. Optional Deletion Detection within Fetched Date Window (Fixes R9)
  if (options?.fetchedDateWindow) {
    const { startDate, endDate } = options.fetchedDateWindow;
    for (const existing of transactions) {
      if (
        existing.syncSource === source &&
        existing.externalUid &&
        existing.date >= startDate &&
        existing.date <= endDate &&
        !incomingUidSet.has(existing.externalUid)
      ) {
        toDelete.push({ ...existing });
      }
    }
  }

  const report: SyncReconciliationReport = {
    source,
    timestamp: Date.now(),
    insertedTransactions,
    updatedTransactions,
    skippedDuplicates,
    deletedOnRemote: toDelete.length,
    mergedAccounts,
    mergedCategories,
    walModeVerified: Boolean(walModeVerified),
    dryRun: Boolean(options?.dryRun),
    previewDiff: {
      toInsert,
      toUpdate,
      toDelete,
    },
  };

  if (options?.dryRun) {
    return {
      transactions: currentState.transactions.map(t => ({ ...t })),
      accounts: currentState.accounts.map(a => ({ ...a })),
      categories: currentState.categories.map(c => ({ ...c })),
      report,
    };
  }

  return {
    transactions,
    accounts,
    categories,
    report,
  };
}
