export interface ParsedCsvTransaction {
  date: string;
  payee: string;
  amount: number;
  type: 'income' | 'expense';
  notes?: string;
}

/**
 * Parses a single RFC-4180 CSV line into unescaped cells, respecting quoted commas and escaped double quotes ("").
 */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }

  cells.push(current.trim());
  return cells.map((cell) => {
    // Strip leading single-quote formula escape if present from our own CSV exporter
    if (cell.startsWith("'") && /^[=+\-@\t\r]/.test(cell.slice(1))) {
      return cell.slice(1);
    }
    return cell;
  });
}

const MONTH_NAME_MAP: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

/**
 * Normalizes Bangladeshi & international bank date strings into ISO YYYY-MM-DD:
 * - YYYY-MM-DD or YYYY/MM/DD
 * - DD/MM/YYYY or DD-MM-YYYY (Bangladesh standard when first token > 12 or standard slash format)
 * - DD-MMM-YYYY or DD MMM YYYY (e.g. 05-Nov-2026)
 */
export function normalizeBankDate(rawDate: string): string {
  const trimmed = (rawDate || '').trim();
  if (!trimmed) return '';

  // 1. YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // 2. DD-MMM-YYYY or DD MMM YYYY (e.g. 07-Nov-2026)
  const namedMonthMatch = trimmed.match(/^(\d{1,2})[-/\s]([A-Za-z]{3})[A-Za-z]*[-/\s](\d{4})/);
  if (namedMonthMatch) {
    const day = namedMonthMatch[1].padStart(2, '0');
    const monthNum = MONTH_NAME_MAP[namedMonthMatch[2].toLowerCase()];
    const year = namedMonthMatch[3];
    if (monthNum) {
      return `${year}-${monthNum}-${day}`;
    }
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY (Bangladeshi bank default)
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const first = Number(dmyMatch[1]);
    const second = Number(dmyMatch[2]);
    const year = dmyMatch[3];
    // In Bangladesh bank statements, DD/MM/YYYY is standard unless second > 12 (explicit US MM/DD/YYYY)
    if (second > 12 && first <= 12) {
      return `${year}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`;
    }
    return `${year}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}`;
  }

  return trimmed;
}

/**
 * Universal CSV Bank Statement Parser supporting:
 * - RFC-4180 quoted fields with internal commas (e.g. `"1,500.00"` or `"Bazar, fish and spices"`)
 * - Debit/Credit columns, single signed Amount column, or Money Manager's own exported CSV (`Type` + `Amount`)
 * - Bangladeshi `DD/MM/YYYY` and `DD-MMM-YYYY` dates
 */
export function parseCsvStatement(csvText: string): ParsedCsvTransaction[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
  const dateIdx = header.findIndex(h => h.includes('date'));
  const descIdx = header.findIndex(
    h => h === 'description' || h.includes('desc') || h.includes('particular') || h.includes('narration') || h.includes('payee')
  );
  const noteIdx = header.findIndex(h => h === 'note' || h === 'notes' || h === 'memo');
  const typeIdx = header.findIndex(h => h === 'type');
  const debitIdx = header.findIndex(h => h.includes('debit') || h.includes('withdrawal') || h.includes('expense'));
  const creditIdx = header.findIndex(h => h.includes('credit') || h.includes('deposit') || h.includes('income'));
  const amountIdx = header.findIndex(h => h === 'amount' || h.includes('amount'));

  const results: ParsedCsvTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const rawDate = dateIdx !== -1 ? (row[dateIdx] || '') : '';
    const normalizedDate = normalizeBankDate(rawDate);
    const descCell = descIdx !== -1 ? (row[descIdx] || '') : '';
    const noteCell = noteIdx !== -1 ? (row[noteIdx] || '') : '';
    const payee = descCell || noteCell || 'Unknown';

    let amount = 0;
    let type: 'income' | 'expense' = 'expense';

    if (debitIdx !== -1 && creditIdx !== -1) {
      const debitVal = parseFloat((row[debitIdx] || '').replace(/[^0-9.-]/g, '') || '0');
      const creditVal = parseFloat((row[creditIdx] || '').replace(/[^0-9.-]/g, '') || '0');

      if (creditVal > 0) {
        amount = creditVal;
        type = 'income';
      } else if (debitVal > 0) {
        amount = debitVal;
        type = 'expense';
      }
    } else if (amountIdx !== -1) {
      const parsed = parseFloat((row[amountIdx] || '').replace(/[^0-9.-]/g, '') || '0');
      const explicitType = typeIdx !== -1 ? (row[typeIdx] || '').toLowerCase().trim() : '';

      if (explicitType === 'expense' || explicitType === 'debit') {
        amount = Math.abs(parsed);
        type = 'expense';
      } else if (explicitType === 'income' || explicitType === 'credit') {
        amount = Math.abs(parsed);
        type = 'income';
      } else if (explicitType === 'transfer') {
        // Skip transfer rows in single-account statement parser or treat as expense if needed
        continue;
      } else if (parsed >= 0) {
        amount = parsed;
        type = 'income';
      } else {
        amount = Math.abs(parsed);
        type = 'expense';
      }
    }

    if (amount > 0 && normalizedDate) {
      results.push({
        date: normalizedDate,
        payee,
        amount: Math.round(amount),
        type,
        notes: noteCell || descCell || undefined,
      });
    }
  }

  return results;
}
