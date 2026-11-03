import prisma from '@packages/libs/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError } from '@packages/error-handler';
import { pageArgs } from './api';
import { purchaseStatistics, StatisticsKind } from './commerce-statistics';
import { csv } from './reporting';

export function statisticsOptions(query: Record<string, unknown>, asOf = new Date()) {
  const kind = query.kind ?? 'customers';
  if (kind !== 'customers' && kind !== 'products') throw new ValidationError('Invalid statistics type');
  const sort = query.sort ?? 'amount';
  if (!['amount', 'units', 'orders', 'lastPurchasedAt'].includes(sort as string)) throw new ValidationError('Invalid statistics sort');
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 200)) throw new ValidationError('Invalid search');
  if (query.format !== undefined && query.format !== 'csv') throw new ValidationError('Invalid export format');
  let createdAt: Prisma.DateTimeFilter = { lte: asOf };
  if (query.from !== undefined || query.to !== undefined) {
    const parse = (value: unknown, end: boolean) => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ValidationError('Choose both valid reporting dates');
      const calendar = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value) throw new ValidationError('Invalid reporting date');
      return new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}+07:00`);
    };
    const gte = parse(query.from, false), lte = parse(query.to, true);
    if (gte > lte || lte.getTime() - gte.getTime() > 366 * 86400000) throw new ValidationError('Choose a date range of at most 366 days');
    createdAt = { gte, lte: new Date(Math.min(lte.getTime(), asOf.getTime())) };
  }
  return { kind: kind as StatisticsKind, sort: sort as 'amount' | 'units' | 'orders' | 'lastPurchasedAt', search: String(query.q ?? '').trim().toLowerCase(), createdAt, exportCsv: query.format === 'csv', ...pageArgs(query) };
}

export async function commerceStatistics(query: Record<string, unknown>, shopId?: string) {
  const asOf = new Date();
  const options = statisticsOptions(query, asOf);
  const where: Prisma.ordersWhereInput = {
    ...(shopId ? { shopId } : {}), createdAt: options.createdAt, currency: 'usd',
    paymentStatus: 'Paid', status: { notIn: ['Cancelled', 'Returned', 'Refunded'] },
  };
  const accumulator = purchaseStatistics();
  let after: string | undefined;
  // Keyset batches keep order history out of memory; no page-sized analytics truncation.
  while (true) {
    const batch = await prisma.orders.findMany({
      where: { ...where, ...(after ? { id: { gt: after } } : {}) },
      take: 1000, orderBy: { id: 'asc' },
      select: { id: true, userId: true, totalAmount: true, createdAt: true,
        user: { select: { name: true, email: true } },
        items: { select: { productId: true, title: true, quantity: true, totalPrice: true } } },
    });
    batch.forEach(order => accumulator.add(order));
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].id;
  }
  const { rows, summary } = accumulator.result(options.kind);
  // Search and metadata cover the full aggregated result, before sorting/pagination.
  if (options.kind === 'products') {
    for (let offset = 0; offset < rows.length; offset += 1000) {
      const current = await prisma.products.findMany({ where: { id: { in: rows.slice(offset, offset + 1000).map(row => row.id) }, ...(shopId ? { shopId } : {}) }, select: { id: true, title: true, stock: true, shop: { select: { name: true } } } });
      const lookup = new Map(current.map(product => [product.id, product]));
      for (const row of rows.slice(offset, offset + 1000)) {
        const product = lookup.get(row.id);
        if (product) { row.name = product.title; row.stock = product.stock; row.shopName = product.shop?.name; }
      }
    }
  }
  const filtered = rows.filter(row => !options.search || [row.name, row.email, row.shopName, row.id].some(value => value?.toLowerCase().includes(options.search)));
  filtered.sort((a, b) => {
    const difference = options.sort === 'lastPurchasedAt' ? b.lastPurchasedAt.localeCompare(a.lastPurchasedAt) : b[options.sort] - a[options.sort];
    return difference || a.id.localeCompare(b.id);
  });
  if (options.exportCsv) {
    const exported = filtered.map(row => options.kind === 'customers' ? {
      customerId: row.id, customer: row.name, email: row.email ?? '', paidOrders: row.orders, unitsPurchased: row.units,
      distinctProducts: row.distinctCount, totalSpentUSD: row.amount, averageOrderUSD: row.average, lastPurchaseUTC: row.lastPurchasedAt,
    } : {
      productId: row.id, product: row.name, shop: row.shopName ?? '', paidOrders: row.orders, unitsSold: row.units,
      uniqueBuyers: row.distinctCount, grossProductSalesUSD: row.amount, averageUnitPriceUSD: row.average, currentStock: row.stock ?? '', lastSaleUTC: row.lastPurchasedAt,
    });
    const headers = options.kind === 'customers'
      ? ['customerId', 'customer', 'email', 'paidOrders', 'unitsPurchased', 'distinctProducts', 'totalSpentUSD', 'averageOrderUSD', 'lastPurchaseUTC']
      : ['productId', 'product', 'shop', 'paidOrders', 'unitsSold', 'uniqueBuyers', 'grossProductSalesUSD', 'averageUnitPriceUSD', 'currentStock', 'lastSaleUTC'];
    return { csv: exported.length ? csv(exported) : csv([Object.fromEntries(headers.map(key => [key, '']))]).split('\r\n')[0], kind: options.kind };
  }
  return { kind: options.kind, currency: 'usd' as const, asOf: asOf.toISOString(), summary, rows: filtered.slice(options.skip, options.skip + options.take),
    pagination: { page: options.skip / options.take + 1, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / options.take)) } };
}
