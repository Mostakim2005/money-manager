import { Transaction, Rule } from '../../types';

/**
 * Evaluates auto-categorization rules against a transaction (borrowed from Actual Budget's rule logic).
 */
export function applyRulesToTransaction(
  transaction: Transaction,
  rules: Rule[]
): Transaction {
  const updated = { ...transaction };

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const matchesAllConditions = rule.conditions.every(cond => {
      let fieldValue: string | number | undefined;

      if (cond.field === 'note') fieldValue = updated.note;
      else if (cond.field === 'amount') fieldValue = updated.amount;
      else if (cond.field === 'accountId') fieldValue = updated.accountId;
      else if (cond.field === 'payee') fieldValue = updated.description;

      if (fieldValue === undefined || fieldValue === null) return false;

      if (cond.operator === 'contains') {
        return String(fieldValue).toLowerCase().includes(String(cond.value).toLowerCase());
      } else if (cond.operator === 'equals') {
        return String(fieldValue).toLowerCase() === String(cond.value).toLowerCase();
      } else if (cond.operator === 'greater_than') {
        return Number(fieldValue) > Number(cond.value);
      } else if (cond.operator === 'less_than') {
        return Number(fieldValue) < Number(cond.value);
      }

      return false;
    });

    if (matchesAllConditions) {
      for (const action of rule.actions) {
        if (action.field === 'categoryId') updated.categoryId = action.value;
        else if (action.field === 'subcategoryId') updated.subcategoryId = action.value;
        else if (action.field === 'accountId') updated.accountId = action.value;
      }
    }
  }

  return updated;
}
