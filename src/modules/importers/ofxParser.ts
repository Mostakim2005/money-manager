import { Transaction } from '../../types';

export interface ParsedOfxTransaction {
  fitId: string;
  date: string; // Normalized YYYY-MM-DD
  amount: number; // Positive magnitude
  type: 'income' | 'expense';
  payee: string;
  memo?: string;
  trnType?: string;
}

/**
 * Normalizes an OFX date string (e.g. "20261105", "20261105120000", "20261105120000[0:GMT]")
 * into standard ISO "YYYY-MM-DD" format.
 */
export function normalizeOfxDate(rawDate?: string): string {
  if (!rawDate) {
    return new Date().toISOString().slice(0, 10);
  }
  const trimmed = rawDate.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Decodes standard XML/SGML entities.
 */
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .trim();
}

/**
 * Extracts the value of a tag from a block supporting both XML (<TAG>val</TAG>)
 * and SGML (<TAG>val\n or <TAG>val<NEXTTAG>).
 */
function extractTagValue(block: string, tagName: string): string | undefined {
  // XML closed tag check: <TAG>...</TAG>
  const xmlRegex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const xmlMatch = block.match(xmlRegex);
  if (xmlMatch && xmlMatch[1] !== undefined) {
    return decodeEntities(xmlMatch[1]);
  }

  // SGML unclosed tag check: <TAG>val (until newline or next tag)
  const sgmlRegex = new RegExp(`<${tagName}\\b[^>]*>([^<\r\n]*)`, 'i');
  const sgmlMatch = block.match(sgmlRegex);
  if (sgmlMatch && sgmlMatch[1] !== undefined) {
    return decodeEntities(sgmlMatch[1]);
  }

  return undefined;
}

/**
 * Parses OFX / QFX statement content supporting both SGML-style OFX 1.x and XML-style OFX 2.x.
 */
export function parseOfxStatement(ofxContent: string): ParsedOfxTransaction[] {
  if (!ofxContent || typeof ofxContent !== 'string') {
    return [];
  }

  // Match each <STMTTRN> block. In XML it ends with </STMTTRN>. In SGML it may end
  // with </STMTTRN>, before the next <STMTTRN>, or before a closing list tag.
  const stmttrnRegex = /<STMTTRN\b[^>]*>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN\b)|(?=<\/(?:BANKTRANLIST|CCSTMTTRNRS|STMTRS)>)|$)/gi;
  const results: ParsedOfxTransaction[] = [];

  let match: RegExpExecArray | null;
  while ((match = stmttrnRegex.exec(ofxContent)) !== null) {
    const block = match[1];
    if (!block || !block.trim()) continue;

    const trnType = (extractTagValue(block, 'TRNTYPE') || '').toUpperCase();
    const dtPostedRaw = extractTagValue(block, 'DTPOSTED');
    const trnAmtRaw = extractTagValue(block, 'TRNAMT');
    const fitIdRaw = extractTagValue(block, 'FITID');
    const memo = extractTagValue(block, 'MEMO');

    let payee = extractTagValue(block, 'NAME');
    if (!payee) {
      payee = extractTagValue(block, 'PAYEE');
    }
    if (!payee) {
      const nestedName = block.match(/<PAYEE>[\s\S]*?<NAME>([^<\r\n]+)/i);
      if (nestedName) {
        payee = decodeEntities(nestedName[1]);
      }
    }
    payee = payee || 'Unknown Payee';

    let amount = 0;
    let type: 'income' | 'expense' = 'expense';

    if (trnAmtRaw !== undefined) {
      const parsedAmt = parseFloat(trnAmtRaw.replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsedAmt)) {
        if (parsedAmt < 0) {
          amount = Math.abs(parsedAmt);
          type = 'expense';
        } else if (parsedAmt > 0) {
          // If amount is positive but TRNTYPE explicitly signals a debit/withdrawal
          if (['DEBIT', 'CHECK', 'PAYMENT', 'FEE', 'POS', 'ATM', 'BILLPAY'].includes(trnType)) {
            amount = parsedAmt;
            type = 'expense';
          } else {
            amount = parsedAmt;
            type = 'income';
          }
        } else {
          amount = 0;
          type = ['CREDIT', 'DEP', 'INT', 'DIV'].includes(trnType) ? 'income' : 'expense';
        }
      }
    } else {
      type = ['CREDIT', 'DEP', 'INT', 'DIV'].includes(trnType) ? 'income' : 'expense';
    }

    const date = normalizeOfxDate(dtPostedRaw);
    const fitId = fitIdRaw || `ofx_${date}_${Math.abs(amount)}_${Math.random().toString(36).slice(2, 8)}`;

    results.push({
      fitId,
      date,
      amount,
      type,
      payee,
      memo: memo || undefined,
      trnType: trnType || undefined,
    });
  }

  return results;
}

/**
 * Maps parsed statement items into full Transaction objects.
 * Generates deterministic externalUid and fingerprint so re-importing the same statement
 * never creates duplicate records.
 */
export function mapParsedStatementToTransactions(
  items: {
    date: string;
    payee: string;
    amount: number;
    type: 'income' | 'expense';
    fitId?: string;
    memo?: string;
  }[],
  accountId: string,
  defaultExpenseCategoryId: string,
  defaultIncomeCategoryId: string
): Transaction[] {
  return items.map((item) => {
    const normalizedDate = normalizeOfxDate(item.date);
    const cleanPayee = item.payee.trim();
    const positiveAmount = Math.abs(item.amount);

    // Deterministic fingerprint calculation
    const fingerprint = item.fitId
      ? `ofx:${accountId}:${item.fitId}`
      : `bank:${accountId}:${normalizedDate}:${positiveAmount.toFixed(2)}:${item.type}:${cleanPayee.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    const externalUid = item.fitId || fingerprint;
    const deterministicId = `tx_${fingerprint.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    // Deterministic timestamp anchored to statement date at 12:00 UTC
    const deterministicCreatedAt = new Date(`${normalizedDate}T12:00:00Z`).getTime() || Date.now();

    return {
      id: deterministicId,
      externalUid,
      fingerprint,
      syncSource: 'bank_import',
      date: normalizedDate,
      time: '12:00',
      amount: positiveAmount,
      type: item.type,
      categoryId: item.type === 'expense' ? defaultExpenseCategoryId : defaultIncomeCategoryId,
      accountId,
      description: cleanPayee,
      note: item.memo || cleanPayee,
      createdAt: deterministicCreatedAt,
      updatedAt: deterministicCreatedAt,
    };
  });
}
