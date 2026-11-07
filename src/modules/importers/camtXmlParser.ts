/**
 * ISO 20022 CAMT.052 / CAMT.053 XML Bank Statement Parser
 * Adapted from Actual Budget (packages/loot-core/src/server/transactions/import/xmlcamt2json.ts)
 * Licensed under MIT (Copyright (c) 2018-2024 Actual Budget Contributors).
 */

export interface ParsedCamtTransaction {
  amount: number;
  currency: string;
  type: 'income' | 'expense';
  date: string; // ISO YYYY-MM-DD
  payee: string;
  notes?: string;
  acctSvcrRef?: string;
}

/**
 * Decodes standard XML entities.
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .trim();
}

/**
 * Extracts inner text of an XML tag.
 */
function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXmlEntities(match[1]) : undefined;
}

/**
 * Extracts all matching tag values.
 */
function extractAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    results.push(decodeXmlEntities(m[1]));
  }
  return results;
}

/**
 * Extracts amount and currency attribute from <Amt Ccy="...">value</Amt>.
 */
function extractAmt(block: string): { amount: number; currency: string } {
  const match = block.match(/<Amt\b([^>]*)>([\s\S]*?)<\/Amt>/i);
  if (!match) return { amount: 0, currency: 'BDT' };

  const attrs = match[1];
  const value = match[2];

  let currency = 'BDT';
  const ccyMatch = attrs.match(/Ccy=["']([^"']+)["']/i);
  if (ccyMatch) {
    currency = ccyMatch[1].trim();
  }

  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return {
    amount: isNaN(num) ? 0 : Math.abs(num),
    currency,
  };
}

/**
 * Extracts ISO date (YYYY-MM-DD) from <BookgDt> or <ValDt>.
 */
function extractDate(block: string): string {
  const bookgDt = block.match(/<BookgDt\b[^>]*>([\s\S]*?)<\/BookgDt>/i);
  const valDt = block.match(/<ValDt\b[^>]*>([\s\S]*?)<\/ValDt>/i);

  const container = (bookgDt ? bookgDt[1] : '') || (valDt ? valDt[1] : '') || block;

  const dtMatch = container.match(/<Dt\b[^>]*>([\s\S]*?)<\/Dt>/i);
  if (dtMatch) {
    const raw = dtMatch[1].trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return raw.slice(0, 10);
  }

  const dtTmMatch = container.match(/<DtTm\b[^>]*>([\s\S]*?)<\/DtTm>/i);
  if (dtTmMatch) {
    return dtTmMatch[1].trim().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Extracts payee name following CAMT rules:
 * - For DBIT (expense), Payee is Creditor (<Cdtr><Nm>)
 * - For CRDT (income), Payee is Debtor (<Dbtr><Nm>)
 * - Fallbacks to <AddtlNtryInf>
 */
function extractPayee(block: string, isExpense: boolean): string {
  const rltdPtiesMatch = block.match(/<RltdPties\b[^>]*>([\s\S]*?)<\/RltdPties>/i);
  const rltdPties = rltdPtiesMatch ? rltdPtiesMatch[1] : block;

  const primaryRole = isExpense ? 'Cdtr' : 'Dbtr';
  const secondaryRole = isExpense ? 'Dbtr' : 'Cdtr';

  const primaryMatch = rltdPties.match(new RegExp(`<${primaryRole}\\b[^>]*>[\\s\\S]*?<Nm\\b[^>]*>([\\s\\S]*?)<\\/Nm>`, 'i'));
  if (primaryMatch && primaryMatch[1].trim()) {
    return decodeXmlEntities(primaryMatch[1]);
  }

  const secondaryMatch = rltdPties.match(new RegExp(`<${secondaryRole}\\b[^>]*>[\\s\\S]*?<Nm\\b[^>]*>([\\s\\S]*?)<\\/Nm>`, 'i'));
  if (secondaryMatch && secondaryMatch[1].trim()) {
    return decodeXmlEntities(secondaryMatch[1]);
  }

  const addtl = extractTag(block, 'AddtlNtryInf');
  if (addtl) {
    return addtl;
  }

  return 'Unknown Payee';
}

/**
 * Extracts notes/remittance information from <RmtInf><Ustrd> or <AddtlNtryInf>.
 */
function extractNotes(block: string, payeeName?: string): string | undefined {
  const rmtInf = block.match(/<RmtInf\b[^>]*>([\s\S]*?)<\/RmtInf>/i);
  if (rmtInf) {
    const ustrdList = extractAllTags(rmtInf[1], 'Ustrd');
    if (ustrdList.length > 0) {
      return ustrdList.join(' ');
    }
  }

  const addtl = extractTag(block, 'AddtlNtryInf');
  if (addtl && addtl !== payeeName) {
    return addtl;
  }

  const ntryRef = extractTag(block, 'NtryRef');
  if (ntryRef && ntryRef !== payeeName) {
    return ntryRef;
  }

  return undefined;
}

/**
 * Pure browser/Node-compatible ISO 20022 CAMT XML Statement Parser.
 * Supports CAMT.052 and CAMT.053 bank statement feeds.
 */
export function parseCamtXmlStatement(xmlContent: string): ParsedCamtTransaction[] {
  if (!xmlContent || typeof xmlContent !== 'string') {
    return [];
  }

  const ntryRegex = /<Ntry\b[^>]*>([\s\S]*?)<\/Ntry>/gi;
  const transactions: ParsedCamtTransaction[] = [];
  let match: RegExpExecArray | null;

  while ((match = ntryRegex.exec(xmlContent)) !== null) {
    const ntryBlock = match[1];

    const cdtDbtInd = (extractTag(ntryBlock, 'CdtDbtInd') || '').toUpperCase();
    const type: 'income' | 'expense' = cdtDbtInd === 'CRDT' ? 'income' : 'expense';
    const isExpense = type === 'expense';

    const acctSvcrRef = extractTag(ntryBlock, 'AcctSvcrRef');
    const date = extractDate(ntryBlock);

    // Check if there are multiple TxDtls inside NtryDtls (subtransactions)
    const txDtlsRegex = /<TxDtls\b[^>]*>([\s\S]*?)<\/TxDtls>/gi;
    const txDtlsMatches: string[] = [];
    let txMatch: RegExpExecArray | null;
    while ((txMatch = txDtlsRegex.exec(ntryBlock)) !== null) {
      txDtlsMatches.push(txMatch[1]);
    }

    if (txDtlsMatches.length > 1) {
      for (const txBlock of txDtlsMatches) {
        const amtInfo = extractAmt(txBlock);
        const finalAmt = amtInfo.amount > 0 ? amtInfo : extractAmt(ntryBlock);
        const payee = extractPayee(txBlock, isExpense);
        const notes = extractNotes(txBlock, payee) || extractNotes(ntryBlock, payee);

        transactions.push({
          amount: finalAmt.amount,
          currency: finalAmt.currency,
          type,
          date,
          payee: payee !== 'Unknown Payee' ? payee : extractPayee(ntryBlock, isExpense),
          notes,
          acctSvcrRef,
        });
      }
    } else {
      const targetBlock = txDtlsMatches.length === 1 ? txDtlsMatches[0] : ntryBlock;
      const amtInfo = extractAmt(ntryBlock);
      const payee = extractPayee(targetBlock, isExpense);
      const notes = extractNotes(targetBlock, payee) || extractNotes(ntryBlock, payee);

      transactions.push({
        amount: amtInfo.amount,
        currency: amtInfo.currency,
        type,
        date,
        payee,
        notes,
        acctSvcrRef,
      });
    }
  }

  return transactions;
}
