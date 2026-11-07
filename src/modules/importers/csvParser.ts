export interface ParsedCsvTransaction {
  date: string;
  payee: string;
  amount: number;
  type: 'income' | 'expense';
  notes?: string;
}

/**
 * Universal CSV Bank Statement Parser supporting Debit/Credit columns or single Amount column.
 */
export function parseCsvStatement(csvText: string): ParsedCsvTransaction[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const dateIdx = header.findIndex(h => h.includes('date'));
  const descIdx = header.findIndex(h => h.includes('desc') || h.includes('particular') || h.includes('narration') || h.includes('payee'));
  const debitIdx = header.findIndex(h => h.includes('debit') || h.includes('withdrawal') || h.includes('expense'));
  const creditIdx = header.findIndex(h => h.includes('credit') || h.includes('deposit') || h.includes('income'));
  const amountIdx = header.findIndex(h => h === 'amount');

  const results: ParsedCsvTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    const rawDate = dateIdx !== -1 ? row[dateIdx] : '';
    const payee = descIdx !== -1 ? row[descIdx] : 'Unknown';

    let amount = 0;
    let type: 'income' | 'expense' = 'expense';

    if (debitIdx !== -1 && creditIdx !== -1) {
      const debitVal = parseFloat(row[debitIdx]?.replace(/[^0-9.-]/g, '') || '0');
      const creditVal = parseFloat(row[creditIdx]?.replace(/[^0-9.-]/g, '') || '0');

      if (creditVal > 0) {
        amount = creditVal;
        type = 'income';
      } else if (debitVal > 0) {
        amount = debitVal;
        type = 'expense';
      }
    } else if (amountIdx !== -1) {
      const parsed = parseFloat(row[amountIdx]?.replace(/[^0-9.-]/g, '') || '0');
      if (parsed >= 0) {
        amount = parsed;
        type = 'income';
      } else {
        amount = Math.abs(parsed);
        type = 'expense';
      }
    }

    if (amount > 0 && rawDate) {
      results.push({
        date: rawDate,
        payee,
        amount,
        type
      });
    }
  }

  return results;
}
