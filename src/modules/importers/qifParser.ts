/**
 * QIF (Quicken Interchange Format) Statement Parser
 * Ported from Actual Budget (packages/loot-core/src/server/transactions/import/qif2json.ts)
 * Licensed under MIT (Copyright (c) 2018-2024 Actual Budget Contributors).
 */

export interface QifDivision {
  category?: string;
  subcategory?: string;
  description?: string;
  amount?: number;
}

export interface QifTransaction {
  date?: string;
  amount?: string;
  number?: string;
  memo?: string;
  address?: string[];
  clearedStatus?: string;
  category?: string;
  subcategory?: string;
  payee?: string;
  division?: QifDivision[];
}

export interface QifParseResult {
  type?: string;
  dateFormat?: string;
  transactions: QifTransaction[];
}

export function parseQifContent(qif: string, options: { dateFormat?: string } = {}): QifParseResult {
  const lines = qif.split('\n').filter(Boolean);
  let line = lines.shift();
  if (!line) {
    throw new Error('Empty QIF content.');
  }

  const type = /!Type:([^$]*)$/.exec(line.trim());
  if (!type || !type.length) {
    throw new Error('File does not appear to be a valid QIF file: ' + line);
  }

  const data: QifParseResult = {
    type: type[1],
    dateFormat: options.dateFormat,
    transactions: [],
  };

  const transactions = data.transactions;
  let transaction: QifTransaction = {};
  let division: QifDivision = {};

  while ((line = lines.shift())) {
    line = line.trim();
    if (!line) continue;
    if (line === '^') {
      if (Object.keys(transaction).length > 0) {
        transactions.push(transaction);
        transaction = {};
      }
      continue;
    }

    const code = line[0];
    const value = line.substring(1);

    switch (code) {
      case 'D':
        transaction.date = value;
        break;
      case 'T':
        transaction.amount = value;
        break;
      case 'N':
        transaction.number = value;
        break;
      case 'M':
        transaction.memo = value;
        break;
      case 'A':
        transaction.address = (transaction.address || []).concat(value);
        break;
      case 'P':
        transaction.payee = value.replace(/&amp;/g, '&');
        break;
      case 'L': {
        const parts = value.split(':');
        transaction.category = parts[0];
        if (parts[1] !== undefined) {
          transaction.subcategory = parts[1];
        }
        break;
      }
      case 'C':
        transaction.clearedStatus = value;
        break;
      case 'S': {
        const sParts = value.split(':');
        division.category = sParts[0];
        if (sParts[1] !== undefined) {
          division.subcategory = sParts[1];
        }
        break;
      }
      case 'E':
        division.description = value;
        break;
      case '$':
        division.amount = parseFloat(value);
        if (!Array.isArray(transaction.division)) {
          transaction.division = [];
        }
        transaction.division.push(division);
        division = {};
        break;
      default:
        // Ignore unrecognized fields gracefully without crashing
        break;
    }
  }

  if (Object.keys(transaction).length > 0) {
    transactions.push(transaction);
  }

  return data;
}
