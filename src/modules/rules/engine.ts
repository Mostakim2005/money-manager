import { Transaction, Rule } from '../../types';

/**
 * Evaluates auto-categorization rules against a transaction (borrowed from Actual Budget's rule logic).
 * Supports:
 * - matchMode: 'ALL' (default AND) or 'ANY' (OR)
 * - Empty conditions guard (`rule.conditions.length === 0` never matches)
 * - Comma/pipe-separated multi-keyword lists in `contains` / `matches_any` (e.g. "unimart, shwapno, meena")
 */
export function applyRulesToTransaction(
  transaction: Transaction,
  rules: Rule[]
): Transaction {
  const updated = { ...transaction };

  for (const rule of rules) {
    if (!rule.enabled || !Array.isArray(rule.conditions) || rule.conditions.length === 0) {
      continue;
    }

    const evaluateCondition = (cond: Rule['conditions'][number]): boolean => {
      let fieldValue: string | number | undefined;

      if (cond.field === 'note') fieldValue = `${updated.note || ''} ${updated.description || ''}`.trim();
      else if (cond.field === 'amount') fieldValue = updated.amount;
      else if (cond.field === 'accountId') fieldValue = updated.accountId;
      else if (cond.field === 'payee') fieldValue = updated.description || updated.note;

      if (fieldValue === undefined || fieldValue === null || fieldValue === '') return false;

      if (cond.operator === 'contains' || cond.operator === 'matches_any') {
        const haystack = String(fieldValue).toLowerCase();
        const rawPattern = String(cond.value).toLowerCase();
        const keywords = rawPattern
          .split(/[,|]/)
          .map(k => k.trim())
          .filter(Boolean);
        if (keywords.length === 0) return false;
        return keywords.some(kw => haystack.includes(kw));
      } else if (cond.operator === 'equals') {
        return String(fieldValue).toLowerCase() === String(cond.value).toLowerCase();
      } else if (cond.operator === 'greater_than') {
        return Number(fieldValue) > Number(cond.value);
      } else if (cond.operator === 'less_than') {
        return Number(fieldValue) < Number(cond.value);
      }

      return false;
    };

    const isMatch =
      rule.matchMode === 'ANY'
        ? rule.conditions.some(evaluateCondition)
        : rule.conditions.every(evaluateCondition);

    if (isMatch) {
      for (const action of rule.actions) {
        if (action.field === 'categoryId') updated.categoryId = action.value;
        else if (action.field === 'subcategoryId') updated.subcategoryId = action.value;
        else if (action.field === 'accountId') updated.accountId = action.value;
      }
    }
  }

  return updated;
}
