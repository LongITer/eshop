import prisma from '@packages/libs/prisma';
import { ForbiddenError } from '@packages/error-handler';
import { statisticsOptions } from '@packages/utils/commerce-statistics-report';
import { csv } from '@packages/utils/reporting';

/** Aggregate inside MongoDB: never load customer identities or order records into the admin response. */
export async function adminProductStatistics(query: Record<string, unknown>, shopId?: string) {
  if (query.kind !== undefined && query.kind !== 'products') throw new ForbiddenError('Administrator statistics do not expose customer purchases');
  const asOf = new Date(), options = statisticsOptions({ ...query, kind: 'products' }, asOf);
  const createdAt = options.createdAt as { gte?: Date; lte: Date };
  const rows = await prisma.orders.aggregateRaw({ pipeline: [
    { $match: { currency: 'usd', paymentStatus: 'Paid', status: { $nin: ['Cancelled', 'Returned', 'Refunded'] }, createdAt: { ...(createdAt.gte ? { $gte: { $date: createdAt.gte.toISOString() } } : {}), $lte: { $date: createdAt.lte.toISOString() } }, ...(shopId ? { shopId: { $oid: shopId } } : {}) } },
    { $lookup: { from: 'orderItems', localField: '_id', foreignField: 'orderId', as: 'lines' } },
    { $unwind: '$lines' },
    { $group: { _id: '$lines.productId', name: { $first: '$lines.title' }, units: { $sum: '$lines.quantity' }, cents: { $sum: { $round: [{ $multiply: ['$lines.totalPrice', 100] }, 0] } }, lastPurchasedAt: { $max: '$createdAt' } } },
    { $project: { _id: 0, id: { $toString: '$_id' }, name: 1, units: 1, cents: 1, lastPurchasedAt: { $dateToString: { date: '$lastPurchasedAt', format: '%Y-%m-%dT%H:%M:%S.%LZ', timezone: 'UTC' } } } },
  ] }) as unknown as { id: string; name: string; units: number; cents: number; lastPurchasedAt: string }[];
  const products = await prisma.products.findMany({ where: { id: { in: rows.map(row => row.id) } }, select: { id: true, title: true, stock: true, shop: { select: { name: true } } } });
  const metadata = new Map(products.map(product => [product.id, product]));
  const aggregated = rows.map(row => ({ id: row.id, name: metadata.get(row.id)?.title ?? row.name, shopName: metadata.get(row.id)?.shop?.name, stock: metadata.get(row.id)?.stock, units: row.units, amount: row.cents / 100, average: row.units ? Math.round(row.cents / row.units) / 100 : 0, lastPurchasedAt: row.lastPurchasedAt }));
  const filtered = aggregated.filter(row => !options.search || [row.name, row.shopName, row.id].some(value => value?.toLowerCase().includes(options.search)));
  if (options.sort === 'orders') throw new ForbiddenError('Order statistics are not available to administrators');
  const sort = options.sort;
  filtered.sort((a, b) => (sort === 'lastPurchasedAt' ? b.lastPurchasedAt.localeCompare(a.lastPurchasedAt) : b[sort] - a[sort]) || a.id.localeCompare(b.id));
  if (options.exportCsv) return { csv: csv(filtered.map(row => ({ product: row.name, shop: row.shopName ?? '', unitsSold: row.units, grossProductSalesUSD: row.amount, averageUnitPriceUSD: row.average, currentStock: row.stock ?? '', lastSaleUTC: row.lastPurchasedAt }))), kind: 'products' };
  return { kind: 'products', currency: 'usd', asOf: asOf.toISOString(), summary: { units: rows.reduce((n, row) => n + row.units, 0), products: rows.length, productSales: rows.reduce((n, row) => n + row.cents, 0) / 100 }, rows: filtered.slice(options.skip, options.skip + options.take), pagination: { page: options.skip / options.take + 1, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / options.take)) } };
}
