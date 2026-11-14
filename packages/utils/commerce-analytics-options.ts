import { ForbiddenError, ValidationError } from '@packages/error-handler';
import { pageArgs } from './api';
import { AnalyticsInterval, AnalyticsPeriod, AnalyticsPreset, AnalyticsView, DAY_MS, vnDay } from './commerce-analytics';

export function analyticsOptions(query: Record<string, unknown>, audience: 'seller' | 'admin', now = new Date()) {
  if (audience === 'admin' && ['customerId', 'userId', 'orderId', 'email'].some(key => query[key] !== undefined)) throw new ForbiddenError('Administrator analytics do not expose customer or order records');
  const allowed = ['period', 'from', 'to', 'interval', 'q', 'sort', 'stock', 'category', 'page', 'limit', 'refresh', 'view', 'format', 'shopId'];
  if (Object.keys(query).some(key => !allowed.includes(key))) throw new ValidationError('Unsupported analytics filter');
  const preset = (query.period ?? '30d') as AnalyticsPreset;
  if (!['7d', '30d', '90d', 'month', 'year', 'all', 'custom'].includes(preset)) throw new ValidationError('Invalid analytics period');
  const interval = query.interval ?? 'auto';
  if (!['auto', 'day', 'week', 'month'].includes(interval as string)) throw new ValidationError('Invalid grouping interval');
  const parseDate = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError('Choose both reporting dates');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new ValidationError('Invalid reporting date');
    return new Date(`${value}T00:00:00+07:00`);
  };
  const today = parseDate(vnDay(now));
  let from: Date | null = null, to = now;
  if (preset === 'custom') {
    from = parseDate(query.from);
    const end = new Date(parseDate(query.to).getTime() + DAY_MS - 1);
    if (end < from || end.getTime() - from.getTime() >= 366 * DAY_MS) throw new ValidationError('Choose a valid range of at most 366 days');
    to = new Date(Math.min(end.getTime(), now.getTime()));
    if (from > to) throw new ValidationError('The reporting period must start on or before today');
  } else {
    if (query.from !== undefined || query.to !== undefined) throw new ValidationError('Use Custom dates for a date range');
    if (['7d', '30d', '90d'].includes(preset)) from = new Date(today.getTime() - (Number(preset.slice(0, -1)) - 1) * DAY_MS);
    if (preset === 'month') from = parseDate(vnDay(now).slice(0, 7) + '-01');
    if (preset === 'year') from = parseDate(vnDay(now).slice(0, 4) + '-01-01');
  }
  const days = from ? (to.getTime() - from.getTime() + 1) / DAY_MS : 0;
  const grouping: AnalyticsInterval = interval === 'auto' ? !from || days > 93 ? 'month' : days > 31 ? 'week' : 'day' : interval as AnalyticsInterval;
  const previous = from ? { from: new Date(from.getTime() - (to.getTime() - from.getTime() + 1)).toISOString(), to: new Date(from.getTime() - 1).toISOString() } : null;
  const period: AnalyticsPeriod = { preset, from: from?.toISOString() ?? null, to: to.toISOString(), interval: grouping, days, previous };
  const sort = query.sort ?? 'netSales';
  if (!['netSales', 'units', 'stock', 'coverage', 'refunds', 'lastSale'].includes(sort as string)) throw new ValidationError('Invalid analytics sort');
  const stock = query.stock ?? 'all';
  if (!['all', 'low', 'out', 'noSales', 'active', 'archived'].includes(stock as string)) throw new ValidationError('Invalid inventory filter');
  for (const key of ['q', 'category', 'refresh']) if (query[key] !== undefined && (typeof query[key] !== 'string' || String(query[key]).length > 200)) throw new ValidationError('Invalid analytics search');
  const view = (query.view ?? 'products') as AnalyticsView;
  if (!['products', 'inventory', 'shops', 'categories', 'timeline', 'outcomes', 'demand', 'summary'].includes(view) || (audience === 'seller' && view === 'shops')) throw new ValidationError('Invalid report export');
  if (query.format !== undefined && query.format !== 'csv') throw new ValidationError('Invalid report format');
  return { period, sort: sort as 'netSales' | 'units' | 'stock' | 'coverage' | 'refunds' | 'lastSale', stock: stock as string, search: String(query.q ?? '').trim().toLowerCase(), category: String(query.category ?? ''), refresh: String(query.refresh ?? ''), view, exportCsv: query.format === 'csv', ...pageArgs(query) };
}
