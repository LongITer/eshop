import prisma from '@packages/libs/prisma';
import { NotFoundError, ValidationError } from '@packages/error-handler';
import { analyticsOptions } from './commerce-analytics-options';
import { analyticsPipeline, productDetailPipeline } from './commerce-analytics-pipeline';
import { AnalyticsReport, AnalyticsPeriod, ProductPerformance, PerformanceGroup, ProductAnalyticsDetail, SalesPoint, changeMetric, fillAnalyticsTimeline, DAY_MS, vnDay } from './commerce-analytics';
import { csv } from './reporting';

type Raw = Record<string, any>;
const number = (value: any): number => Number(value?.$numberLong ?? value?.$numberDecimal ?? value ?? 0);
const money = (value: any) => number(value) / 100;
const percentage = (value: number, total: number) => total ? Math.round(value / total * 10000) / 100 : 0;
const catalogSelect = { id: true, title: true, category: true, brand: true, shopId: true, status: true, isDeleted: true, stock: true, sale_price: true,
  variants: { select: { id: true, sku: true, color: true, size: true, active: true, stock: true, price: true } },
  shop: { select: { name: true, sellers: { select: { suspendedAt: true, suspendedUntil: true } } } },
} as const;
type CatalogProduct = Awaited<ReturnType<typeof readCatalog>>[number];
async function readCatalog(shopId?: string) {
  const products = [];
  let after: string | undefined;
  while (true) {
    const batch = await prisma.products.findMany({ where: { ...(shopId ? { shopId } : {}), ...(after ? { id: { gt: after } } : {}) }, orderBy: { id: 'asc' }, take: 1000, select: catalogSelect });
    products.push(...batch);
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].id;
  }
  return products;
}
const rowKey = (row: { id: string; shopId: string }) => `${row.shopId}:${row.id}`;
const cache = new Map<string, { expires: number; value: Promise<BaseAnalytics> }>();
type BaseAnalytics = { report: Omit<AnalyticsReport, 'products'>; rows: ProductPerformance[]; catalog: CatalogProduct[] };
export function clearCommerceAnalyticsCache() { cache.clear(); }

function timeRows(rows: Raw[]): SalesPoint[] {
  return rows.map(row => ({ date: String(row.date), grossSales: money(row.grossCents), discounts: money(row.discountCents), netSales: money(row.netCents), units: number(row.units), refundedAmount: money(row.refundedCents) }));
}
function summary(raw: Raw) {
  const totals = raw.totals?.[0] ?? {};
  return { grossSales: money(totals.grossCents), discounts: money(totals.discountCents), netSales: money(totals.netCents), shipping: money(totals.shippingCents), paidAmount: money(totals.paidCents), refundedAmount: money(totals.refundedCents), awaitingRefundAmount: money(totals.awaitingCents), platformFees: money(totals.feesCents), feeCoveragePercent: percentage(number(totals.feeKnown), number(totals.retainedCount)), units: number(totals.units), productsSold: (raw.products ?? []).filter((row: Raw) => number(row.units) > 0).length,
    averageUnitPrice: number(totals.units) ? Math.round(number(totals.netCents) / number(totals.units)) / 100 : 0,
    reconciliationDifference: money(number(totals.paidCents) - (number(totals.netCents) + number(totals.shippingCents))), unallocatedDiscount: money(totals.unallocatedCents),
  };
}
function productRows(catalog: CatalogProduct[], rawRows: Raw[], previousRows: Raw[], days: number, netTotal: number, asOf: Date) {
  const metadata = new Map(catalog.map(product => [product.id, product]));
  const raw = new Map(rawRows.map(row => [rowKey(row as any), row]));
  for (const product of catalog) if (!raw.has(rowKey(product))) raw.set(rowKey(product), { id: product.id, shopId: product.shopId });
  for (const row of previousRows) if (!raw.has(rowKey(row as any))) raw.set(rowKey(row as any), { id: row.id, shopId: row.shopId, name: row.name });
  const previous = new Map(previousRows.map(row => [rowKey(row as any), row]));
  return [...raw.values()].map((row): ProductPerformance => {
    const candidate = metadata.get(row.id), product = candidate?.shopId === row.shopId ? candidate : undefined, owner = product?.shop.sellers;
    const shopSuspended = !!owner?.suspendedAt && (!owner.suspendedUntil || owner.suspendedUntil > asOf);
    const active = !!product && !product.isDeleted && product.status === 'Active' && !shopSuspended;
    const activeVariants = product?.variants.filter(variant => variant.active) ?? [];
    const rawStock = product ? Math.max(0, product.stock) : 0;
    const stock = product?.variants.length ? Math.min(rawStock, activeVariants.reduce((n, variant) => n + Math.max(0, variant.stock), 0)) : rawStock;
    const availableStock = active ? stock : 0;
    const units = number(row.units), netSales = money(row.netCents), previousNetSales = money(previous.get(rowKey(row as any))?.netCents);
    return { id: row.id, shopId: row.shopId, name: product?.title ?? row.name ?? 'Archived product', shopName: product?.shop.name ?? 'Archived shop', category: product?.category ?? 'Archived / unknown category', brand: product?.brand ?? '', status: product?.status ?? 'Archived', archived: !product || product.isDeleted, shopSuspended, units, grossSales: money(row.grossCents), discounts: money(row.discountCents), netSales, previousNetSales, changePercent: changeMetric(netSales, previousNetSales).percent, sharePercent: percentage(netSales, netTotal), averageUnitPrice: units ? Math.round(number(row.netCents) / units) / 100 : 0,
      stock: product ? rawStock : null, availableStock, stockValue: product ? Math.round(availableStock * product.sale_price * 100) / 100 : 0,
      coverageDays: units && days > 0 && active ? Math.round(availableStock / (units / Math.max(1, days)) * 10) / 10 : null,
      lastSaleAt: row.lastSaleAt ?? null, cancelledUnits: number(row.cancelledUnits), returnedUnits: number(row.returnedUnits), refundedUnits: number(row.refundedUnits),
    };
  });
}
function groups(rows: ProductPerformance[], by: 'category' | 'shopId', total: number): PerformanceGroup[] {
  const result = new Map<string, PerformanceGroup & { netCents: number; grossCents: number }>();
  for (const row of rows) {
    // Historical sales remain visible, but archived zero-sale records do not inflate catalog counts.
    if (row.archived && !row.units && !row.cancelledUnits && !row.returnedUnits && !row.refundedUnits) continue;
    const id = row[by];
    const group = result.get(id) ?? { id, name: by === 'category' ? row.category : row.shopName, units: 0, netSales: 0, grossSales: 0, products: 0, availableStock: 0, sharePercent: 0, netCents: 0, grossCents: 0 };
    group.units += row.units; group.netCents += Math.round(row.netSales * 100); group.grossCents += Math.round(row.grossSales * 100); group.products++; group.availableStock += row.availableStock;
    result.set(id, group);
  }
  return [...result.values()].map(({ netCents, grossCents, ...row }) => ({ ...row, netSales: netCents / 100, grossSales: grossCents / 100, sharePercent: percentage(netCents / 100, total) })).sort((a, b) => b.netSales - a.netSales || a.name.localeCompare(b.name));
}

async function buildAnalytics(period: AnalyticsPeriod, audience: 'seller' | 'admin', shopId: string | undefined, asOf: Date): Promise<BaseAnalytics> {
  const seller = audience === 'seller';
  const [currentResult, previousResult, catalog, pendingReports, severities] = await Promise.all([
    prisma.orders.aggregateRaw({ pipeline: analyticsPipeline(period, shopId, seller) }),
    period.previous ? prisma.orders.aggregateRaw({ pipeline: analyticsPipeline({ ...period.previous, interval: period.interval }, shopId, seller) }) : Promise.resolve([]),
    readCatalog(shopId),
    prisma.productReport.count({ where: { status: 'Pending', ...(shopId ? { shopId } : {}) } }),
    prisma.productViolation.groupBy({ by: ['severity'], where: { ...(shopId ? { shopId } : {}), createdAt: { ...(period.from ? { gte: new Date(period.from) } : {}), lte: new Date(period.to) } }, _count: { _all: true } }),
  ]);
  const raw = (currentResult as unknown as Raw[])[0] ?? {}, previous = (previousResult as unknown as Raw[])[0] ?? {};
  const firstActivity = raw.totals?.[0]?.firstActivity;
  const firstDate = firstActivity?.$date ?? firstActivity;
  const effectivePeriod = { ...period, ...(!period.from && firstDate ? { from: new Date(firstDate).toISOString(), days: Math.max(1, (new Date(period.to).getTime() - new Date(firstDate).getTime() + 1) / DAY_MS) } : {}) };
  if ((period.interval === 'day' && effectivePeriod.days > 366) || (period.interval === 'week' && effectivePeriod.days > 366 * 7)) throw new ValidationError('Choose monthly grouping for this long reporting period');
  const totals = summary(raw), previousTotals = summary(previous);
  const rows = productRows(catalog, raw.products ?? [], previous.products ?? [], effectivePeriod.days, totals.netSales, asOf);
  const comparison = period.previous ? Object.fromEntries(['netSales', 'units', 'paidAmount', 'refundedAmount'].map(key => [key, changeMetric(totals[key as keyof typeof totals], previousTotals[key as keyof typeof previousTotals])])) : null;
  const activeRows = rows.filter(row => !row.archived && row.status === 'Active' && !row.shopSuspended);
  const activeIds = new Set(activeRows.map(row => row.id));
  const activeSkus = catalog.filter(product => activeIds.has(product.id)).flatMap(product => product.variants.filter(variant => variant.active));
  const inventory = {
    products: catalog.filter(product => !product.isDeleted).length, activeProducts: activeRows.length,
    availableUnits: rows.reduce((n, row) => n + row.availableStock, 0), recordedUnits: catalog.filter(product => !product.isDeleted).reduce((n, product) => n + Math.max(0, product.stock), 0),
    retailValue: rows.reduce((n, row) => n + Math.round(row.stockValue * 100), 0) / 100,
    lowStock: activeRows.filter(row => row.availableStock > 0 && row.availableStock <= 5).length,
    outOfStock: activeRows.filter(row => !row.availableStock).length, noSales: activeRows.filter(row => !row.units).length,
    activeSkus: activeSkus.length, lowStockSkus: activeSkus.filter(variant => variant.stock > 0 && variant.stock <= 5).length,
    outOfStockSkus: activeSkus.filter(variant => variant.stock <= 0).length,
    inconsistentStock: catalog.filter(product => !product.isDeleted && product.variants.length && product.stock !== product.variants.filter(variant => variant.active).reduce((n, variant) => n + Math.max(0, variant.stock), 0)).length,
  };
  const customers = raw.customers?.[0] ?? {}, previousCustomers = previous.customers?.[0] ?? {};
  const sellerMetrics = seller ? { orders: number(raw.totals?.[0]?.retainedCount), customers: number(customers.customers), repeatCustomers: number(customers.repeatCustomers), repeatRate: percentage(number(customers.repeatCustomers), number(customers.customers)), averageOrderValue: number(raw.totals?.[0]?.retainedCount) ? Math.round(number(raw.totals?.[0]?.paidCents) / number(raw.totals?.[0]?.retainedCount)) / 100 : 0, payments: (raw.payments ?? []).map((row: Raw) => ({ status: String(row.status), count: number(row.count), amount: money(row.cents) })) } : undefined;
  if (comparison && sellerMetrics) { comparison.orders = changeMetric(sellerMetrics.orders, number(previous.totals?.[0]?.retainedCount)); comparison.customers = changeMetric(sellerMetrics.customers, number(previousCustomers.customers)); }
  const statusCounts = new Map((raw.statuses ?? []).map((row: Raw) => [row.status, number(row.count)]));
  const report: Omit<AnalyticsReport, 'products'> = {
    audience, currency: 'usd', generatedAt: asOf.toISOString(), period: effectivePeriod, summary: totals, comparison, inventory,
    timeline: fillAnalyticsTimeline(timeRows(raw.timeline ?? []), effectivePeriod.from, effectivePeriod.to, effectivePeriod.interval),
    outcomes: [...new Set([...(raw.outcomes ?? []).map((row: Raw) => row.status), ...(seller ? [...statusCounts.keys()] : [])])].map(status => { const row = (raw.outcomes ?? []).find((row: Raw) => row.status === status) ?? {}; return { status: String(status), units: number(row.units), grossSales: money(row.grossCents), netSales: money(row.netCents), ...(seller ? { count: number(statusCounts.get(status)) } : {}) }; }),
    demand: (raw.demand ?? []).map((row: Raw) => ({ weekday: number(row.weekday), hour: number(row.hour), units: number(row.units), netSales: money(row.netCents) })),
    categories: groups(rows, 'category', totals.netSales), ...(audience === 'admin' ? { shops: groups(rows, 'shopId', totals.netSales) } : {}),
    ...(sellerMetrics ? { seller: sellerMetrics } : {}),
    governance: { pendingReports, violations: severities.reduce((n, row) => n + row._count._all, 0), bySeverity: severities.map(row => ({ severity: row.severity, count: row._count._all })) },
  };
  return { report, rows, catalog };
}

async function cachedAnalytics(query: Record<string, unknown>, audience: 'seller' | 'admin', shopId?: string) {
  const now = new Date(), options = analyticsOptions(query, audience, now);
  const key = JSON.stringify([audience, shopId ?? 'all', options.period.preset, query.from, query.to, query.interval, options.refresh, vnDay(now)]);
  let entry = cache.get(key);
  if (!entry || entry.expires <= now.getTime()) {
    for (const [key, value] of cache) if (value.expires <= now.getTime()) cache.delete(key);
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    entry = { expires: now.getTime() + 20000, value: buildAnalytics(options.period, audience, shopId, now) };
    cache.set(key, entry);
    entry.value.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
  }
  return { ...await entry.value, options };
}
function filteredProducts(rows: ProductPerformance[], options: ReturnType<typeof analyticsOptions>) {
  return rows.filter(row => (!options.search || [row.name, row.shopName, row.brand].some(value => value.toLowerCase().includes(options.search))) && (!options.category || row.category === options.category) && (
    options.stock === 'all' ? !row.archived || row.units > 0 || row.previousNetSales !== 0 || row.cancelledUnits > 0 || row.returnedUnits > 0 || row.refundedUnits > 0 : options.stock === 'archived' ? row.archived : !row.archived && (options.stock === 'low' ? row.availableStock > 0 && row.availableStock <= 5 : options.stock === 'out' ? row.status === 'Active' && !row.shopSuspended && row.availableStock === 0 : options.stock === 'noSales' ? row.units === 0 && row.status === 'Active' && !row.shopSuspended : row.status === 'Active' && !row.shopSuspended)
  )).sort((a, b) => {
    const difference = options.sort === 'stock' ? b.availableStock - a.availableStock : options.sort === 'coverage' ? (a.coverageDays ?? Infinity) - (b.coverageDays ?? Infinity) : options.sort === 'refunds' ? b.refundedUnits - a.refundedUnits : options.sort === 'lastSale' ? (b.lastSaleAt ?? '').localeCompare(a.lastSaleAt ?? '') : b[options.sort] - a[options.sort];
    return difference || a.id.localeCompare(b.id) || a.shopId.localeCompare(b.shopId);
  });
}
export function analyticsCsv(headers: string[], rows: Record<string, unknown>[]) {
  return rows.length ? csv(rows) : csv([Object.fromEntries(headers.map(key => [key, '']))]).split('\r\n')[0];
}
export async function commerceAnalytics(query: Record<string, unknown>, audience: 'seller' | 'admin', shopId?: string): Promise<AnalyticsReport | { csv: string; view: string }> {
  if (audience === 'seller' && !shopId) throw new NotFoundError('No shop linked to this seller');
  const { report, rows, options } = await cachedAnalytics(query, audience, shopId);
  const filtered = filteredProducts(rows, options);
  if (options.exportCsv) {
    let exported: Record<string, unknown>[] = [], headers: string[] = [];
    if (options.view === 'products' || options.view === 'inventory') {
      headers = ['product', 'shop', 'category', 'brand', 'listingStatus', 'archived', 'unitsSold', 'grossSalesUSD', 'allocatedDiscountUSD', 'netProductSalesUSD', 'previousNetSalesUSD', 'changePercent', 'salesSharePercent', 'averageNetUnitPriceUSD', 'availableStock', 'recordedStock', 'estimatedStockRetailValueUSD', 'estimatedCoverageDays', 'cancelledUnits', 'returnedUnits', 'refundedUnits', 'lastSaleUTC'];
      exported = filtered.map(row => ({ product: row.name, shop: row.shopName, category: row.category, brand: row.brand, listingStatus: row.status, archived: row.archived, unitsSold: row.units, grossSalesUSD: row.grossSales, allocatedDiscountUSD: row.discounts, netProductSalesUSD: row.netSales, previousNetSalesUSD: row.previousNetSales, changePercent: report.comparison ? row.changePercent ?? '' : '', salesSharePercent: row.sharePercent, averageNetUnitPriceUSD: row.averageUnitPrice, availableStock: row.availableStock, recordedStock: row.stock ?? '', estimatedStockRetailValueUSD: row.stockValue, estimatedCoverageDays: row.coverageDays ?? '', cancelledUnits: row.cancelledUnits, returnedUnits: row.returnedUnits, refundedUnits: row.refundedUnits, lastSaleUTC: row.lastSaleAt ?? '' }));
    } else if (options.view === 'summary') {
      headers = ['metric', 'value', 'periodFromUTC', 'periodToUTC'];
      exported = Object.entries(report.summary).map(([metric, value]) => ({ metric, value, periodFromUTC: report.period.from ?? '', periodToUTC: report.period.to }));
    } else {
      const source = options.view === 'shops' ? report.shops ?? [] : report[options.view];
      headers = options.view === 'timeline' ? ['date', 'grossSalesUSD', 'discountUSD', 'netSalesUSD', 'units', 'refundedAmountUSD'] : options.view === 'demand' ? ['weekdayMondayZero', 'hourVietnamTime', 'units', 'netSalesUSD'] : options.view === 'outcomes' ? ['status', 'units', 'grossSalesUSD', 'netSalesUSD', ...(audience === 'seller' ? ['count'] : [])] : ['name', 'units', 'netSalesUSD', 'grossSalesUSD', 'products', 'availableStock', 'salesSharePercent'];
      exported = source.map((row: any) => options.view === 'timeline' ? { date: row.date, grossSalesUSD: row.grossSales, discountUSD: row.discounts, netSalesUSD: row.netSales, units: row.units, refundedAmountUSD: row.refundedAmount } : options.view === 'demand' ? { weekdayMondayZero: row.weekday, hourVietnamTime: row.hour, units: row.units, netSalesUSD: row.netSales } : options.view === 'outcomes' ? { status: row.status, units: row.units, grossSalesUSD: row.grossSales, netSalesUSD: row.netSales, ...(audience === 'seller' ? { count: row.count } : {}) } : { name: row.name, units: row.units, netSalesUSD: row.netSales, grossSalesUSD: row.grossSales, products: row.products, availableStock: row.availableStock, salesSharePercent: row.sharePercent });
    }
    return { csv: analyticsCsv(headers, exported), view: options.view };
  }
  return { ...report, products: { rows: filtered.slice(options.skip, options.skip + options.take), total: filtered.length, page: options.skip / options.take + 1, totalPages: Math.max(1, Math.ceil(filtered.length / options.take)) } };
}

export async function productAnalyticsDetail(productId: string, query: Record<string, unknown>, audience: 'seller' | 'admin', shopId?: string): Promise<ProductAnalyticsDetail> {
  if (audience === 'seller' && !shopId) throw new NotFoundError();
  const { report, rows, catalog } = await cachedAnalytics(query, audience, shopId);
  const product = rows.find(row => row.id === productId);
  if (!product) throw new NotFoundError('Product is not part of this shop or reporting history');
  const [result, engagement, reviews] = await Promise.all([
    prisma.orders.aggregateRaw({ pipeline: productDetailPipeline(report.period, productId, shopId) }),
    prisma.productAnalytics.findUnique({ where: { productId }, select: { views: true, cartAdds: true, wishListAdds: true } }),
    prisma.productReviews.aggregate({ where: { productId }, _count: { _all: true }, _avg: { rating: true } }),
  ]);
  const raw = (result as unknown as Raw[])[0] ?? {};
  const versions = new Map((raw.variants ?? []).map((row: Raw) => [row.id, row]));
  const current = catalog.find(row => row.id === productId);
  for (const variant of current?.variants ?? []) if (!versions.has(variant.id)) versions.set(variant.id, { id: variant.id });
  if (current && !current.variants.length && !versions.has('base')) versions.set('base', { id: 'base' });
  const variants = [...versions.values()].map((value): ProductAnalyticsDetail['variants'][number] => {
    const row = value as Raw, variant = current?.variants.find(variant => variant.id === row.id);
    return { id: String(row.id), sku: variant?.sku ?? row.sku ?? (row.id === 'base' ? 'Standard' : 'Archived SKU'), color: variant?.color ?? row.color ?? '', size: variant?.size ?? row.size ?? '', active: row.id === 'base' ? !!current && !current.variants.length : variant?.active ?? false, stock: variant ? Math.max(0, variant.stock) : row.id === 'base' && current && !current.variants.length ? current.stock : null, units: number(row.units), grossSales: money(row.grossCents), discounts: money(row.discountCents), netSales: money(row.netCents) };
  }).sort((a, b) => b.netSales - a.netSales || a.sku.localeCompare(b.sku));
  return { product, period: report.period, generatedAt: report.generatedAt, timeline: fillAnalyticsTimeline(timeRows(raw.timeline ?? []), report.period.from, report.period.to, report.period.interval), variants,
    engagement: { views: engagement?.views ?? 0, cartAdds: engagement?.cartAdds ?? 0, wishListAdds: engagement?.wishListAdds ?? 0, reviews: reviews._count._all, averageRating: reviews._avg.rating },
  };
}
