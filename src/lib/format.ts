const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const clock = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const fmtCompact = (n: number | null | undefined): string =>
  n == null || Number.isNaN(n) ? '—' : compact.format(n);

export const fmtNumber = (n: number | null | undefined): string =>
  n == null || Number.isNaN(n) ? '—' : plain.format(n);

export const fmtTime = (ms: number): string => clock.format(new Date(ms));

export function fmtAgo(ms: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export const fmtCoord = (lon: number, lat: number): string =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${
    lon >= 0 ? 'E' : 'W'
  }`;

export const fmtPct = (n: number | null | undefined, digits = 1): string =>
  n == null || Number.isNaN(n) ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;

export function severityLabel(severity: number): string {
  if (severity >= 0.85) return 'critical';
  if (severity >= 0.65) return 'high';
  if (severity >= 0.4) return 'elevated';
  return 'routine';
}
