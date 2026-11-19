import Database from 'better-sqlite3';
import { closeSync, openSync, readSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SQLITE_HEADER = 'SQLite format 3\0';

function verifySqliteHeaderFromBuffer(buf: Uint8Array): void {
  if (buf.length < 16) {
    throw new Error('Invalid SQLite binary buffer: buffer too short');
  }
  const header = Buffer.from(buf.subarray(0, 16)).toString('ascii');
  if (header !== SQLITE_HEADER) {
    throw new Error('Invalid SQLite binary buffer: missing "SQLite format 3" header');
  }
}

function verifySqliteHeaderFromFile(filePath: string): void {
  const fd = openSync(filePath, 'r');
  try {
    const headerBuf = Buffer.alloc(16);
    const bytesRead = readSync(fd, headerBuf, 0, 16, 0);
    if (bytesRead < 16) {
      throw new Error('Invalid SQLite binary buffer: buffer too short');
    }
    verifySqliteHeaderFromBuffer(headerBuf);
  } finally {
    closeSync(fd);
  }
}

function pickTableName(tableNames: string[], candidates: string[]): string | undefined {
  const upperMap = new Map<string, string>();
  for (const name of tableNames) {
    upperMap.set(name.toUpperCase(), name);
  }
  for (const cand of candidates) {
    const match = upperMap.get(cand.toUpperCase());
    if (match) return match;
  }
  return undefined;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export interface RealbyteRawDumpResult {
  inoutcome: Record<string, unknown>[];
  assets: Record<string, unknown>[];
  categories: Record<string, unknown>[];
}

/**
 * Reads a real binary Realbyte `money_android.sqlite` file (from file path or raw bytes)
 * using better-sqlite3 in read-only mode and returns normalized table rows for `parseRealbyteSqliteVault`.
 */
export function readRealbyteBinarySqlite(
  filePathOrBuffer: string | Buffer | Uint8Array | ArrayBuffer
): RealbyteRawDumpResult {
  let targetPath: string;
  let tempFilePath: string | null = null;

  if (typeof filePathOrBuffer === 'string') {
    verifySqliteHeaderFromFile(filePathOrBuffer);
    targetPath = filePathOrBuffer;
  } else {
    const bytes =
      filePathOrBuffer instanceof ArrayBuffer
        ? new Uint8Array(filePathOrBuffer)
        : new Uint8Array(filePathOrBuffer);
    verifySqliteHeaderFromBuffer(bytes);
    tempFilePath = path.join(
      os.tmpdir(),
      `money-rb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`
    );
    writeFileSync(tempFilePath, bytes);
    targetPath = tempFilePath;
  }

  let db: Database.Database | null = null;
  try {
    db = new Database(targetPath, { readonly: true, fileMustExist: true });
    const tables = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]
    ).map((r) => r.name);

    const inoutcomeTable = pickTableName(tables, ['INOUTCOME', 'ZINOUTCOME']);
    const assetsTable = pickTableName(tables, ['ASSETS', 'ZASSETS', 'ASSET', 'ZASSET']);
    const categoryTable = pickTableName(tables, ['ZCATEGORY', 'CATEGORY', 'CATEGORIES']);

    const inoutcome = inoutcomeTable
      ? (db.prepare(`SELECT * FROM ${quoteIdent(inoutcomeTable)}`).all() as Record<string, unknown>[])
      : [];
    const assets = assetsTable
      ? (db.prepare(`SELECT * FROM ${quoteIdent(assetsTable)}`).all() as Record<string, unknown>[])
      : [];
    const categories = categoryTable
      ? (db.prepare(`SELECT * FROM ${quoteIdent(categoryTable)}`).all() as Record<string, unknown>[])
      : [];

    return { inoutcome, assets, categories };
  } finally {
    if (db && db.open) {
      db.close();
    }
    if (tempFilePath) {
      try {
        unlinkSync(tempFilePath);
      } catch {
        // Ignore temp file cleanup error
      }
    }
  }
}
