import type { RealbyteEndpointOverrides, RealbyteProbeEndpointResult } from '../types';

const DEFAULT_PATHS = {
  accountPath: '/moneyBook/account/select.do',
  categoryPath: '/moneyBook/category/select.do',
  ledgerPath: '/moneyBook/ledger/select.do',
} as const;

function sanitizeHostAndPort(phoneIp: string, port: number): { host: string; port: number } {
  const trimmed = String(phoneIp || '').trim();
  if (!trimmed || /[\s/?#@]/.test(trimmed)) {
    throw new Error(`Invalid Realbyte phone IP/host: "${phoneIp}"`);
  }
  const numericPort = Number(port);
  if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
    throw new Error(`Invalid Realbyte port: "${port}"`);
  }
  return { host: trimmed, port: numericPort };
}

function normalizeEndpointPath(rawPath: string | undefined, fallbackPath: string): string {
  const val = String(rawPath || '').trim() || fallbackPath;
  return val.startsWith('/') ? val : `/${val}`;
}

function isHtmlPayload(contentType: string, text: string): boolean {
  const lowerCt = contentType.toLowerCase();
  const trimmed = text.trim().toLowerCase();
  return (
    lowerCt.includes('text/html') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<head') ||
    trimmed.startsWith('<body')
  );
}

function unwrapArrayCount(parsed: unknown): { topLevelKeys: string[]; sampleCount: number } {
  if (Array.isArray(parsed)) {
    return { topLevelKeys: ['[array]'], sampleCount: parsed.length };
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const topLevelKeys = Object.keys(obj);
    for (const key of ['data', 'list', 'rows', 'result', 'inoutcome', 'assets', 'categories', 'ledger']) {
      if (Array.isArray(obj[key])) {
        return { topLevelKeys, sampleCount: (obj[key] as unknown[]).length };
      }
    }
    return { topLevelKeys, sampleCount: 0 };
  }
  return { topLevelKeys: [], sampleCount: 0 };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTextWithTimeoutAndRetry(
  url: string,
  timeoutMs: number,
  maxRetries: number = 2
): Promise<{ status: number; ok: boolean; contentType: string; text: string; elapsedMs: number }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      });
      const text = await response.text();
      return {
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type') || '',
        text,
        elapsedMs: Date.now() - started,
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(300 * (attempt + 1));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchRealbyteJson(url: string, timeoutMs: number): Promise<unknown> {
  const res = await fetchTextWithTimeoutAndRetry(url, timeoutMs, 2);
  if (!res.ok) {
    throw new Error(`Realbyte server responded HTTP ${res.status} for ${url}`);
  }
  if (isHtmlPayload(res.contentType, res.text)) {
    throw new Error(
      'REALBYTE_SESSION_INACTIVE: Realbyte PC Manager returned an HTML page instead of JSON. Re-open PC Manager on your phone.'
    );
  }
  if (!res.text.trim()) {
    return [];
  }
  try {
    return JSON.parse(res.text);
  } catch {
    throw new Error(`Realbyte server returned non-JSON payload from ${url}`);
  }
}

export async function checkRealbyteConnection(phoneIp: string, port: number = 10000): Promise<boolean> {
  try {
    const { host, port: safePort } = sanitizeHostAndPort(phoneIp, port);
    const res = await fetchTextWithTimeoutAndRetry(`http://${host}:${safePort}/moneyBook/`, 4000, 1);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchRealbyteAccounts(
  phoneIp: string,
  port: number = 10000,
  overrides?: RealbyteEndpointOverrides
): Promise<unknown> {
  const { host, port: safePort } = sanitizeHostAndPort(phoneIp, port);
  const endpoint = normalizeEndpointPath(overrides?.accountPath, DEFAULT_PATHS.accountPath);
  return fetchRealbyteJson(`http://${host}:${safePort}${endpoint}`, 10000);
}

export async function fetchRealbyteCategories(
  phoneIp: string,
  port: number = 10000,
  overrides?: RealbyteEndpointOverrides
): Promise<unknown> {
  const { host, port: safePort } = sanitizeHostAndPort(phoneIp, port);
  const endpoint = normalizeEndpointPath(overrides?.categoryPath, DEFAULT_PATHS.categoryPath);
  return fetchRealbyteJson(`http://${host}:${safePort}${endpoint}`, 10000);
}

export async function fetchRealbyteTransactions(
  phoneIp: string,
  port: number = 10000,
  startDate: string,
  endDate: string,
  overrides?: RealbyteEndpointOverrides
): Promise<unknown> {
  const { host, port: safePort } = sanitizeHostAndPort(phoneIp, port);
  const endpoint = normalizeEndpointPath(overrides?.ledgerPath, DEFAULT_PATHS.ledgerPath);
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `http://${host}:${safePort}${endpoint}${sep}start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
  return fetchRealbyteJson(url, 15000);
}

export async function probeRealbyteEndpoints(
  phoneIp: string,
  port: number = 10000,
  overrides?: RealbyteEndpointOverrides
): Promise<RealbyteProbeEndpointResult[]> {
  const { host, port: safePort } = sanitizeHostAndPort(phoneIp, port);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;

  const targets = [
    { label: 'Root Server', path: '/moneyBook/' },
    {
      label: 'Accounts',
      path: normalizeEndpointPath(overrides?.accountPath, DEFAULT_PATHS.accountPath),
    },
    {
      label: 'Categories',
      path: normalizeEndpointPath(overrides?.categoryPath, DEFAULT_PATHS.categoryPath),
    },
    {
      label: 'Ledger (Current Month)',
      path: `${normalizeEndpointPath(overrides?.ledgerPath, DEFAULT_PATHS.ledgerPath)}?start=${monthStart}&end=${today}`,
    },
  ];

  const results: RealbyteProbeEndpointResult[] = [];
  for (const target of targets) {
    const url = `http://${host}:${safePort}${target.path}`;
    try {
      const res = await fetchTextWithTimeoutAndRetry(url, 4000, 0);
      const html = isHtmlPayload(res.contentType, res.text);
      let topLevelKeys: string[] = [];
      let sampleCount = 0;

      if (!html && res.text.trim()) {
        try {
          const parsed = JSON.parse(res.text);
          const info = unwrapArrayCount(parsed);
          topLevelKeys = info.topLevelKeys;
          sampleCount = info.sampleCount;
        } catch {
          // Plain text / non-JSON
        }
      }

      results.push({
        label: target.label,
        path: target.path,
        url,
        status: res.status,
        ok: res.ok,
        contentType: res.contentType,
        isHtml: html,
        topLevelKeys,
        sampleCount,
        elapsedMs: res.elapsedMs,
        previewSnippet: res.text.slice(0, 180),
      });
    } catch (err) {
      results.push({
        label: target.label,
        path: target.path,
        url,
        status: 0,
        ok: false,
        contentType: '',
        isHtml: false,
        topLevelKeys: [],
        sampleCount: 0,
        elapsedMs: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
