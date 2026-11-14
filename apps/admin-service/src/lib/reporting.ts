import prisma from '@packages/libs/prisma';
import { ValidationError } from '@packages/error-handler';
export const REPORT_TIMEZONE = 'Asia/Ho_Chi_Minh';
export function adminDateRange(query: Record<string, unknown>, days = 30) {
  const parse = (value: unknown, end: boolean) => {
    const text = String(value);
    return new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T${end ? '23:59:59.999' : '00:00:00.000'}+07:00` : text);
  };
  const lte = query.to ? parse(query.to, true) : new Date();
  const gte = query.from ? parse(query.from, false) : new Date(lte.getTime() - days * 86400000);
  if (!Number.isFinite(gte.getTime()) || !Number.isFinite(lte.getTime()) || gte > lte || lte.getTime() - gte.getTime() > 366 * 86400000) throw new ValidationError('Choose a valid date range of at most one year');
  return { gte, lte };
}
export const reportDay = (date: Date) => new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10);
export async function orderTotals(range: { gte: Date; lte: Date }, shopId?: string) {
  const paid = { $and: [{ $eq: ['$paymentStatus', 'Paid'] }, { $not: [{ $in: ['$status', ['Cancelled', 'Returned', 'Refunded']] }] }] };
  const cents = { $round: [{ $multiply: ['$totalAmount', 100] }, 0] };
  const data = await prisma.orders.aggregateRaw({ pipeline: [
    { $match: { createdAt: { $gte: { $date: range.gte.toISOString() }, $lte: { $date: range.lte.toISOString() } }, ...(shopId ? { shopId: { $oid: shopId } } : {}) } },
    { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: REPORT_TIMEZONE } }, orders: { $sum: 1 }, revenueCents: { $sum: { $cond: [paid, cents, 0] } }, earningsCents: { $sum: { $cond: [paid, { $ifNull: ['$platformFeeCents', { $floor: { $multiply: [cents, 0.1] } }] }, 0] } }, estimatedOrders: { $sum: { $cond: [{ $and: [paid, { $eq: [{ $ifNull: ['$platformFeeCents', null] }, null] }] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ] });
  return (data as unknown as { _id: string; orders: number; revenueCents: number; earningsCents: number; estimatedOrders: number }[]).map(row => ({ date: row._id, orders: row.orders, revenue: row.revenueCents / 100, earnings: row.earningsCents / 100, estimatedOrders: row.estimatedOrders }));
}
export async function registrations(model: 'users' | 'sellers', range: { gte: Date; lte: Date }) {
  const args = { pipeline: [{ $match: { createdAt: { $gte: { $date: range.gte.toISOString() }, $lte: { $date: range.lte.toISOString() } }, ...(model === 'users' ? { role: 'user' } : {}) } }, { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: REPORT_TIMEZONE } }, count: { $sum: 1 } } }] };
  return (await prisma[model].aggregateRaw(args)) as unknown as { _id: string; count: number }[];
}
