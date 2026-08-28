export function formatDate(iso: string | null | undefined, fallback = '-'): string {
  if (!iso) return fallback;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return fallback; }
}

export function formatMoney(amount: number | string | null | undefined, symbol = '₹'): string {
  const n = Number(amount) || 0;
  return `${symbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function classNames(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('');
}

export function formatBytes(bytes: number | null | undefined): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatRelative(iso: string | null | undefined, fallback = 'never'): string {
  if (!iso) return fallback;
  // Server-side ISO may be missing the trailing 'Z' for UTC; tolerate both.
  const ts = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z').getTime();
  if (!Number.isFinite(ts)) return fallback;
  const delta = Date.now() - ts;
  const abs = Math.abs(delta);
  const future = delta < 0;
  const minute = 60_000, hour = 60 * minute, day = 24 * hour;
  const phrase = (n: number, unit: string) =>
    `${future ? 'in ' : ''}${n} ${unit}${n === 1 ? '' : 's'}${future ? '' : ' ago'}`;
  if (abs < 45_000) return future ? 'in a moment' : 'just now';
  if (abs < hour) return phrase(Math.round(abs / minute), 'min');
  if (abs < day) return phrase(Math.round(abs / hour), 'hour');
  if (abs < 30 * day) return phrase(Math.round(abs / day), 'day');
  return new Date(ts).toLocaleDateString();
}

export function formatDateTime(iso: string | null | undefined, fallback = '-'): string {
  if (!iso) return fallback;
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z');
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const timeAgo = (iso: string | null | undefined): string => formatRelative(iso);
