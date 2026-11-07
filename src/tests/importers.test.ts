import { describe, it, expect } from 'vitest';
import { parseQifContent } from '../modules/importers/qifParser';
import { parseCsvStatement } from '../modules/importers/csvParser';

describe('Bank Statement Importers', () => {
  it('correctly parses QIF bank statements ported from Actual Budget', () => {
    const sampleQif = `!Type:Bank
D11/05/2026
T-1250.00
PCarrefour Supermarket
LGroceries:Food
^
D11/07/2026
T8640.00
PSonali Bank Sanchaypatra
LInvestment:Returns
^`;

    const result = parseQifContent(sampleQif);
    expect(result.type).toBe('Bank');
    expect(result.transactions.length).toBe(2);

    expect(result.transactions[0].payee).toBe('Carrefour Supermarket');
    expect(result.transactions[0].amount).toBe('-1250.00');
    expect(result.transactions[0].category).toBe('Groceries');
    expect(result.transactions[0].subcategory).toBe('Food');

    expect(result.transactions[1].payee).toBe('Sonali Bank Sanchaypatra');
    expect(result.transactions[1].amount).toBe('8640.00');
  });

  it('correctly parses CSV statements with Debit and Credit columns', () => {
    const sampleCsv = `Date,Particulars,Debit,Credit,Balance
2026-11-01,Monthly Salary,,50000.00,50000.00
2026-11-03,Grocery Shopping,3500.00,,46500.00
2026-11-04,bKash Transfer,1200.00,,45300.00`;

    const result = parseCsvStatement(sampleCsv);
    expect(result.length).toBe(3);

    expect(result[0].payee).toBe('Monthly Salary');
    expect(result[0].amount).toBe(50000);
    expect(result[0].type).toBe('income');

    expect(result[1].payee).toBe('Grocery Shopping');
    expect(result[1].amount).toBe(3500);
    expect(result[1].type).toBe('expense');
  });
});
