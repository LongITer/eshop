import { ValidationError } from '@packages/error-handler';
export function dateRange(query: Record<string, unknown>, defaultDays = 30) {
  const to = query.to ? new Date(String(query.to)) : new Date();
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(String(query.to))) to.setUTCHours(23, 59, 59, 999);
  const from = query.from ? new Date(String(query.from)) : new Date(to.getTime() - defaultDays * 86400000);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to || to.getTime() - from.getTime() > 366 * 86400000) throw new ValidationError('Choose a valid date range of at most one year');
  return { gte: from, lte: to };
}
export function bucket(date: Date, interval: string) {
  const d = new Date(date);
  if (interval === 'month') return d.toISOString().slice(0, 7);
  if (interval === 'week') d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  return [keys.map(escape).join(','), ...rows.map(row => keys.map(k => escape(row[k])).join(','))].join('\r\n');
}
