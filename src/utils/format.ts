/**
 * Shared formatting and native Electron / Browser file export helpers.
 */

export function formatBDT(amount: number, privacyMode: boolean = false): string {
  if (privacyMode) {
    return '৳ •••••';
  }
  return '৳' + Math.round(Number(amount || 0)).toLocaleString('en-US');
}

export function formatSignedBDT(
  amount: number,
  type: 'income' | 'expense' | 'transfer',
  privacyMode: boolean = false
): string {
  if (privacyMode) {
    return '৳ ••••';
  }
  const formatted = formatBDT(Math.abs(amount), false);
  if (type === 'income') return `+${formatted}`;
  if (type === 'expense') return `-${formatted}`;
  return formatted;
}

export function formatCompactBDT(amount: number, privacyMode: boolean = false): string {
  if (privacyMode) {
    return '•••';
  }
  const whole = Math.round(Number(amount || 0));
  if (whole >= 100000) return (whole / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  if (whole >= 1000) return (whole / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(whole);
}

export async function saveExportFile(options: {
  defaultName: string;
  content: string;
  mimeType: string;
  filterLabel: string;
  extensions: string[];
}): Promise<{ saved: boolean; filePath?: string }> {
  const fsApi = typeof window !== 'undefined' ? window.moneyApi?.fs : undefined;
  if (fsApi?.saveFile) {
    const res = await fsApi.saveFile({
      defaultName: options.defaultName,
      content: options.content,
      filters: [{ name: options.filterLabel, extensions: options.extensions }],
    });
    return { saved: !res.canceled, filePath: res.filePath };
  }

  // Browser fallback
  if (typeof document !== 'undefined') {
    const blob = new Blob([options.content], { type: options.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', options.defaultName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { saved: true };
  }

  return { saved: false };
}
