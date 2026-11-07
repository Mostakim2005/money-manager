import { RecurringSchedule, SplitAllocation, Transaction } from '../../types';

/**
 * Advances a due date by a frequency interval with month-end date clamping.
 * Supports weekly, monthly, quarterly, and yearly intervals.
 */
export function advanceDueDate(
  dateISO: string,
  frequency: RecurringSchedule['frequency']
): string {
  const [year, month, day] = dateISO.split('-').map(Number);

  if (frequency === 'weekly') {
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  let newYear = year;
  let newMonth = month; // 1-indexed

  if (frequency === 'monthly') {
    newMonth += 1;
    if (newMonth > 12) {
      newYear += Math.floor((newMonth - 1) / 12);
      newMonth = ((newMonth - 1) % 12) + 1;
    }
  } else if (frequency === 'quarterly') {
    newMonth += 3;
    if (newMonth > 12) {
      newYear += Math.floor((newMonth - 1) / 12);
      newMonth = ((newMonth - 1) % 12) + 1;
    }
  } else if (frequency === 'yearly') {
    newYear += 1;
  }

  // Handle month-end clamping (e.g. Jan 31 + 1 month -> Feb 28)
  const maxDays = new Date(Date.UTC(newYear, newMonth, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDays);

  const mStr = String(newMonth).padStart(2, '0');
  const dStr = String(clampedDay).padStart(2, '0');
  return `${newYear}-${mStr}-${dStr}`;
}

/**
 * Splits a parent transaction into multiple distinct child transactions.
 * (Adapted from Actual Budget transaction merge/split mechanics).
 */
export function splitTransaction(
  parentTxn: Transaction,
  splits: SplitAllocation[]
): Transaction[] {
  if (!splits || splits.length < 2) {
    throw new Error('Split transaction requires at least 2 allocations');
  }

  const totalSplitAmount = splits.reduce((sum, s) => sum + s.amount, 0);
  if (Math.abs(totalSplitAmount - parentTxn.amount) > 0.01) {
    throw new Error(
      `Sum of splits (${totalSplitAmount.toFixed(2)}) must equal parent amount (${parentTxn.amount.toFixed(2)})`
    );
  }

  const now = Date.now();

  return splits.map((split, idx) => {
    const splitIndex = idx + 1;
    const splitId = `${parentTxn.id}-split-${splitIndex}`;
    const baseFingerprint = parentTxn.fingerprint || parentTxn.id;
    const splitFingerprint = `${baseFingerprint}-split-${splitIndex}`;

    return {
      id: splitId,
      externalUid: parentTxn.externalUid ? `${parentTxn.externalUid}-split-${splitIndex}` : undefined,
      fingerprint: splitFingerprint,
      syncSource: parentTxn.syncSource,
      date: parentTxn.date,
      time: parentTxn.time,
      amount: split.amount,
      type: parentTxn.type,
      categoryId: split.categoryId,
      subcategoryId: parentTxn.subcategoryId,
      accountId: parentTxn.accountId,
      targetAccountId: parentTxn.targetAccountId,
      description: parentTxn.description,
      note: split.note || parentTxn.note,
      createdAt: parentTxn.createdAt,
      updatedAt: now,
    };
  });
}

/**
 * Merges multiple transactions of the same type and account into a single consolidated transaction.
 * (Adapted from Actual Budget merge.ts).
 */
export function mergeTransactions(txnsToMerge: Transaction[]): Transaction {
  if (!txnsToMerge || txnsToMerge.length < 2) {
    throw new Error('Merging requires at least 2 transactions');
  }

  const firstType = txnsToMerge[0].type;
  const firstAccount = txnsToMerge[0].accountId;

  for (const t of txnsToMerge) {
    if (t.type !== firstType || t.accountId !== firstAccount) {
      throw new Error('Cannot merge transactions with different types or accounts');
    }
  }

  // Sort by date ascending (and createdAt ascending) to retain earliest base record
  const sorted = [...txnsToMerge].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt
  );
  const earliest = sorted[0];

  const totalAmount = txnsToMerge.reduce((sum, t) => sum + t.amount, 0);

  // Combine unique notes with " | "
  const uniqueNotes = Array.from(
    new Set(txnsToMerge.map((t) => t.note?.trim()).filter((n): n is string => Boolean(n)))
  );
  const combinedNote = uniqueNotes.length > 0 ? uniqueNotes.join(' | ') : undefined;

  // Combine unique descriptions if different
  const uniqueDescriptions = Array.from(
    new Set(txnsToMerge.map((t) => t.description?.trim()).filter((d): d is string => Boolean(d)))
  );
  const combinedDescription =
    uniqueDescriptions.length > 0 ? uniqueDescriptions.join(' | ') : earliest.description;

  const now = Date.now();

  return {
    ...earliest,
    amount: Math.round(totalAmount * 100) / 100,
    note: combinedNote,
    description: combinedDescription,
    updatedAt: now,
  };
}

/**
 * Recurring & Scheduled Transactions Engine.
 * Evaluates active schedules against an evaluation date, generates transaction payloads,
 * and advances schedules to their next due dates.
 */
export function processDueRecurringSchedules(
  schedules: RecurringSchedule[],
  asOfDateISO: string
): {
  updatedSchedules: RecurringSchedule[];
  generatedTransactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[];
} {
  const updatedSchedules: RecurringSchedule[] = [];
  const generatedTransactions: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  for (const schedule of schedules) {
    const schedCopy: RecurringSchedule = { ...schedule };
    let currentDueDate = schedCopy.nextDueDate;

    while (currentDueDate <= asOfDateISO) {
      generatedTransactions.push({
        externalUid: `rec-${schedCopy.id}-${currentDueDate}`,
        date: currentDueDate,
        time: '09:00',
        amount: schedCopy.amount,
        type: schedCopy.type,
        categoryId: schedCopy.categoryId,
        accountId: schedCopy.accountId,
        targetAccountId: schedCopy.targetAccountId,
        description: schedCopy.name,
        note: schedCopy.note || `Recurring ${schedCopy.frequency}: ${schedCopy.name}`,
        syncSource: 'local',
      });

      currentDueDate = advanceDueDate(currentDueDate, schedCopy.frequency);
    }

    schedCopy.nextDueDate = currentDueDate;
    updatedSchedules.push(schedCopy);
  }

  return {
    updatedSchedules,
    generatedTransactions,
  };
}
