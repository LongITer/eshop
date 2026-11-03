import { adminDateRange, orderTotals, registrations, reportDay, REPORT_TIMEZONE } from '../lib/reporting';
import { audit } from '@packages/utils/admin-audit';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import prisma from '@packages/libs/prisma';
import { handle, objectId, pageArgs, textField } from '@packages/utils/api';
import { csv } from '@packages/utils/reporting';
import { transitionOrder } from '@packages/utils/order-lifecycle';
import { NotFoundError, ValidationError } from '@packages/error-handler';

export const getOrders = handle(async (req, res) => {
  const where: Prisma.ordersWhereInput = req.query.overdue === 'true' ? { status: { in: ['Pending', 'Confirmed', 'Processing'] }, createdAt: { lt: new Date(Date.now() - 48 * 3600000) } } : { createdAt: adminDateRange(req.query, 90) };
  if (req.query.search) { const search = String(req.query.search).trim().slice(0, 200); where.OR = [{ orderNumber: { contains: search, mode: 'insensitive' } }, { stripePaymentId: { contains: search } }, { user: { email: { contains: search, mode: 'insensitive' } } }]; }
  if (req.query.status) { if (!['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refunded'].includes(String(req.query.status))) throw new ValidationError('Invalid status'); where.status = req.query.status as any; }
  if (req.query.shopId) where.shopId = objectId(req.query.shopId);
  const [orders, total] = await Promise.all([prisma.orders.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: 'desc' }, include: { items: true, shop: { select: { id: true, name: true } }, user: { select: { id: true, name: true, email: true } } } }), prisma.orders.count({ where })]);
  res.json({ orders, total });
});
export const orderDetail = handle(async (req, res) => {
  const order = await prisma.orders.findUnique({ where: { id: objectId(req.params.orderId) }, include: { items: true, shop: { select: { id: true, name: true } }, user: { select: { name: true, email: true } } } });
  if (!order) throw new NotFoundError();
  const [events, request] = await Promise.all([prisma.orderEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } }), prisma.returnRequest.findUnique({ where: { orderId: order.id } })]);
  res.json({ order: { ...order, events, request } });
});
export const updateStatus = handle(async (req, res) => {
  textField(req.body.reason, 'reason', 1000);
  if (req.body.status === 'Returned') throw new ValidationError('Review and receive the return through Returns first');
  const order = await transitionOrder(objectId(req.params.orderId), req.body.status, {}, req.user!.id, req.body, true);
  res.json({ order });
});
export const dashboard = handle(async (req, res) => {
  const createdAt = adminDateRange(req.query);
  const [totals, users, sellers, totalUsers, totalSellers, totalProducts, top] = await Promise.all([
    orderTotals(createdAt), registrations('users', createdAt), registrations('sellers', createdAt),
    prisma.users.count({ where: { role: 'user' } }), prisma.sellers.count(), prisma.products.count({ where: { isDeleted: false } }),
    prisma.orderItems.groupBy({ by: ['productId'], where: { order: { createdAt, paymentStatus: 'Paid', status: { notIn: ['Cancelled', 'Returned', 'Refunded'] } } }, _sum: { quantity: true, totalPrice: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 10 }),
  ]);
  const timeline: Record<string, any> = {};
  for (let day = new Date(reportDay(createdAt.gte) + 'T00:00:00+07:00'); reportDay(day) <= reportDay(createdAt.lte); day.setUTCDate(day.getUTCDate() + 1)) { const date = reportDay(day); timeline[date] = { date, revenue: 0, earnings: 0, users: 0, sellers: 0, orders: 0 }; }
  totals.forEach(row => { timeline[row.date] = { ...timeline[row.date], ...row }; });
  users.forEach(row => { if (timeline[row._id]) timeline[row._id].users = row.count; });
  sellers.forEach(row => { if (timeline[row._id]) timeline[row._id].sellers = row.count; });
  const products = await prisma.products.findMany({ where: { id: { in: top.map(p => p.productId) } }, select: { id: true, title: true } });
  res.json({ stats: { totalUsers, totalSellers, totalProducts, totalOrders: totals.reduce((n, r) => n + r.orders, 0), revenue: totals.reduce((n, r) => n + Math.round(r.revenue * 100), 0) / 100, earnings: totals.reduce((n, r) => n + Math.round(r.earnings * 100), 0) / 100, estimatedOrders: totals.reduce((n, r) => n + r.estimatedOrders, 0) }, timeline: Object.values(timeline), topProducts: top.map(p => ({ ...p._sum, id: p.productId, title: products.find(product => product.id === p.productId)?.title ?? 'Deleted product' })) });
});
export const notifications = handle(async (req, res) => {
  const where: Prisma.notificationsWhereInput = { type: { in: ['System', 'Promotion'] }, NOT: { title: 'New platform order' }, AND: [{ OR: [{ orderId: null }, { orderId: { isSet: false } }] }], OR: [{ userId: req.user!.id }, { AND: [{ OR: [{ userId: null }, { userId: { isSet: false } }] }, { OR: [{ sellerId: null }, { sellerId: { isSet: false } }] }] }] };
  const [notifications, total] = await Promise.all([prisma.notifications.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: 'desc' } }), prisma.notifications.count({ where })]);
  res.json({ notifications, total });
});
export const payments = handle(async (req, res) => {
  const createdAt = adminDateRange(req.query, 30);
  const shopId = req.query.shopId ? objectId(req.query.shopId) : undefined;
  const refundWhere: Prisma.ordersWhereInput = { paymentStatus: 'Paid', status: { in: ['Cancelled', 'Returned'] }, ...(shopId ? { shopId } : {}) };
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 10000, maxNetworkRetries: 1 });
  let stripeUnavailable = false;
  const [result, orders, total, shops, timeline] = await Promise.all([
    stripe.paymentIntents.list({ limit: 50, created: { gte: Math.floor(createdAt.gte.getTime() / 1000), lte: Math.floor(createdAt.lte.getTime() / 1000) }, ...(req.query.after ? { starting_after: String(req.query.after) } : {}) }).catch(() => { stripeUnavailable = true; return { data: [] as Stripe.PaymentIntent[], has_more: false }; }),
    prisma.orders.findMany({ where: refundWhere, ...pageArgs(req.query), include: { shop: { select: { name: true } }, user: { select: { name: true, email: true } }, items: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    prisma.orders.count({ where: refundWhere }),
    prisma.orders.groupBy({ by: ['shopId'], where: { createdAt, ...(shopId ? { shopId } : {}), paymentStatus: 'Paid', status: { notIn: ['Cancelled', 'Returned', 'Refunded'] } }, _sum: { totalAmount: true }, _count: { _all: true }, orderBy: { _sum: { totalAmount: 'desc' } }, take: 20 }),
    orderTotals(createdAt, shopId),
  ]);
  const names = await prisma.shops.findMany({ where: { id: { in: shops.map(s => s.shopId) } }, select: { id: true, name: true } });
  res.json({ stripeUnavailable, payments: result.data.map(p => ({ id: p.id, amount: p.amount / 100, currency: p.currency, status: p.status, created: p.created })), hasMore: result.has_more, nextCursor: result.data.at(-1)?.id, orders, total, byShop: shops.map(s => ({ name: names.find(n => n.id === s.shopId)?.name ?? s.shopId, revenue: s._sum.totalAmount ?? 0, orders: s._count._all })), timeline });
});
export const refund = handle(async (req, res) => {
  const orderId = objectId(req.body.orderId);
  const reason = textField(req.body.reason, 'refund reason', 1000);
  const order = await prisma.orders.findUnique({ where: { id: orderId } });
  if (!order || order.stripePaymentId !== req.params.paymentId) throw new NotFoundError('Payment/order not found');
  if (order.paymentStatus === 'Refunded') { res.json({ success: true, refundId: order.stripeRefundId }); return; }
  if (order.paymentStatus !== 'Paid' || !['Cancelled', 'Returned'].includes(order.status)) throw new ValidationError('Cancel or return the paid order before refunding');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const intent = await stripe.paymentIntents.retrieve(order.stripePaymentId!);
  let existing: Stripe.Refund | undefined;
  if (order.stripeRefundId) existing = await stripe.refunds.retrieve(order.stripeRefundId);
  else for await (const candidate of stripe.refunds.list({ payment_intent: order.stripePaymentId!, limit: 100 })) { if (candidate.metadata?.orderId === order.id) { existing = candidate; break; } }
  const result = existing || await stripe.refunds.create({ payment_intent: order.stripePaymentId!, amount: Math.round(order.totalAmount * 100), ...(intent.transfer_data?.destination ? { reverse_transfer: true, refund_application_fee: true } : {}), metadata: { orderId } }, { idempotencyKey: `order-refund-${order.id}` });
  if (result.status === 'failed' || result.status === 'canceled') throw new ValidationError('Stripe refund failed');
  await prisma.$transaction(async tx => {
    const updated = await tx.orders.updateMany({ where: { id: orderId, paymentStatus: 'Paid' }, data: { stripeRefundId: result.id, refundState: result.status, ...(result.status === 'succeeded' ? { paymentStatus: 'Refunded', status: 'Refunded' } : {}) } });
    if (updated.count) await audit(tx, req.user!.id, 'payment.refund', orderId, reason, { paymentStatus: order.paymentStatus }, { refundId: result.id, status: result.status, amount: order.totalAmount });
    if (updated.count && result.status === 'succeeded') await tx.notifications.create({ data: { userId: order.userId, orderId, type: 'OrderRefunded', title: 'Order refunded', message: `${order.orderNumber} has been refunded.`, redirectUrl: `/order/${orderId}` } });
  });
  res.json({ success: true, refundId: result.id, status: result.status });
});
export const logs = handle(async (req, res) => {
  const range = adminDateRange(req.query);
  const where: Prisma.behaviorLogWhereInput = { createdAt: range };
  if (req.query.action) where.action = String(req.query.action);
  if (req.query.userId) where.userId = String(req.query.userId);
  const exporting = req.query.format === 'csv' || req.query.format === 'json';
  if (exporting) {
    // Cursor batches export the complete filtered result without loading it all
    // into memory. A disconnect stops further database reads.
    const format = req.query.format;
    res.attachment(`logs.${format}`);
    res.type(format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('X-Export-Truncated', 'false');
    let cursor: string | undefined;
    let first = true;
    if (format === 'json') res.write('[');
    do {
      const batch = await prisma.behaviorLog.findMany({ where, take: 1000, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
      if (!batch.length || res.destroyed) break;
      let output: string;
      if (format === 'json') output = `${first ? '' : ','}${batch.map(log => JSON.stringify(log)).join(',')}`;
      else {
        const encoded = csv(batch.map(log => ({ ...log, metadata: JSON.stringify(log.metadata), createdAt: log.createdAt.toISOString() })));
        output = first ? encoded : encoded.slice(encoded.indexOf('\n') + 1);
        output += '\n';
      }
      if (!res.write(output)) await new Promise<void>(resolve => {
        const done = () => { res.off('drain', done); res.off('close', done); resolve(); };
        res.once('drain', done); res.once('close', done);
      });
      first = false;
      cursor = batch.length === 1000 ? batch[batch.length - 1].id : undefined;
    } while (cursor && !res.destroyed);
    if (!res.destroyed) res.end(format === 'json' ? ']' : '');
    return;
  }
  const [logs, total, events] = await Promise.all([
    prisma.behaviorLog.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }), prisma.behaviorLog.count({ where }),
    prisma.behaviorLog.aggregateRaw({ pipeline: [
      { $match: { createdAt: { $gte: { $date: range.gte.toISOString() }, $lte: { $date: range.lte.toISOString() } }, ...(req.query.action ? { action: String(req.query.action) } : {}), ...(req.query.userId ? { userId: String(req.query.userId) } : {}) } },
      { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m-%d', timezone: REPORT_TIMEZONE } }, views: { $sum: { $cond: [{ $in: ['$action', ['productView', 'product_view']] }, 1, 0] } }, cartAdds: { $sum: { $cond: [{ $in: ['$action', ['addToCart', 'add_to_cart']] }, 1, 0] } }, purchases: { $sum: { $cond: [{ $in: ['$action', ['paymentSuccess', 'purchase']] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
    ] }),
  ]);
  res.json({ logs, total, timeline: (events as unknown as { _id: string; views: number; cartAdds: number; purchases: number }[]).map(row => ({ date: row._id, views: row.views, cartAdds: row.cartAdds, purchases: row.purchases })), chartTruncated: false });
});
