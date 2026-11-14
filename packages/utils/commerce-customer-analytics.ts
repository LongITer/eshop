import prisma from '@packages/libs/prisma';
import { NotFoundError } from '@packages/error-handler';
import { purchaseStatistics } from './commerce-statistics';
import { analyticsOptions } from './commerce-analytics-options';
import { CustomerAnalyticsDetail, analyticsBucket, fillAnalyticsTimeline } from './commerce-analytics';
import { analyticsCsv } from './commerce-analytics-report';

/** Customer history is queried with BOTH the authenticated shop and requested customer. */
export async function customerAnalyticsDetail(customerId: string, query: Record<string, unknown>, shopId: string): Promise<CustomerAnalyticsDetail | { csv: string }> {
  if (!shopId) throw new NotFoundError();
  const now = new Date(), options = analyticsOptions(query, 'seller', now);
  const where = { shopId, userId: customerId, currency: 'usd', paymentStatus: 'Paid' as const, status: { notIn: ['Cancelled', 'Returned', 'Refunded'] as ('Cancelled' | 'Returned' | 'Refunded')[] }, createdAt: { lte: now } };
  const all = purchaseStatistics(), selected = purchaseStatistics();
  const timeline = new Map<string, { amountCents: number; units: number; orders: number }>();
  let first: string | null = null, last: string | null = null, periodFirst: string | null = null, periodLast: string | null = null;
  let customer: CustomerAnalyticsDetail['customer'] | undefined;
  const earliest = (a: string | null, b: string): string => a === null || b.localeCompare(a) < 0 ? b : a;
  const latest = (a: string | null, b: string): string => a === null || b.localeCompare(a) > 0 ? b : a;
  let after: string | undefined;
  while (true) {
    const batch = await prisma.orders.findMany({ where: { ...where, ...(after ? { id: { gt: after } } : {}) }, orderBy: { id: 'asc' }, take: 1000,
      select: { id: true, userId: true, totalAmount: true, createdAt: true, user: { select: { name: true, email: true } }, items: { select: { productId: true, title: true, quantity: true, totalPrice: true } } },
    });
    for (const order of batch) {
      const date = order.createdAt.toISOString();
      customer ??= { id: customerId, name: order.user?.name ?? 'Deleted customer', email: order.user?.email ?? '' };
      first = earliest(first, date); last = latest(last, date);
      all.add(order);
      if ((!options.period.from || date >= options.period.from) && date <= options.period.to) {
        selected.add(order); periodFirst = earliest(periodFirst, date); periodLast = latest(periodLast, date);
        const key = analyticsBucket(date, options.period.interval), point = timeline.get(key) ?? { amountCents: 0, units: 0, orders: 0 };
        point.amountCents += Math.round(order.totalAmount * 100); point.units += order.items.reduce((n, item) => n + item.quantity, 0); point.orders++; timeline.set(key, point);
      }
    }
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].id;
  }
  if (!customer) throw new NotFoundError('This customer has no qualifying purchases in your shop');
  const lifetime = all.result('customers').summary, inPeriod = selected.result('customers').summary;
  const products = selected.result('products').rows.map(row => ({ id: row.id, name: row.name, units: row.units, orders: row.orders, grossSales: row.amount })).sort((a, b) => b.grossSales - a.grossSales || a.id.localeCompare(b.id));
  if (options.exportCsv) return { csv: analyticsCsv(['product', 'unitsPurchased', 'paidOrders', 'grossProductSpendUSD'], products.map(row => ({ product: row.name, unitsPurchased: row.units, paidOrders: row.orders, grossProductSpendUSD: row.grossSales }))) };
  const purchases = await prisma.orders.findMany({ where: { ...where, createdAt: { ...(options.period.from ? { gte: new Date(options.period.from) } : {}), lte: new Date(options.period.to) } }, skip: options.skip, take: options.take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, orderNumber: true, createdAt: true, status: true, totalAmount: true, items: { select: { title: true, quantity: true, totalPrice: true } } },
  });
  const emptyTimeline = fillAnalyticsTimeline([], options.period.from ?? first, options.period.to, options.period.interval);
  return { customer, generatedAt: now.toISOString(), period: options.period,
    summary: { orders: inPeriod.orders, units: inPeriod.units, products: inPeriod.products, totalSpent: inPeriod.totalSpent, averageOrderValue: inPeriod.averageOrderValue, firstPurchase: periodFirst, lastPurchase: periodLast },
    lifetime: { orders: lifetime.orders, units: lifetime.units, products: lifetime.products, totalSpent: lifetime.totalSpent, firstPurchase: first, lastPurchase: last }, products,
    timeline: emptyTimeline.map(point => ({ date: point.date, amount: (timeline.get(point.date)?.amountCents ?? 0) / 100, units: timeline.get(point.date)?.units ?? 0, orders: timeline.get(point.date)?.orders ?? 0 })),
    purchases: purchases.map(order => ({ ...order, createdAt: order.createdAt.toISOString(), units: order.items.reduce((n, item) => n + item.quantity, 0) })),
    pagination: { page: options.skip / options.take + 1, total: inPeriod.orders, totalPages: Math.max(1, Math.ceil(inPeriod.orders / options.take)) },
  };
}
