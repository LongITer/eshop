import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import prisma from '@packages/libs/prisma';
import { handle, objectId, pageArgs, textField } from '@packages/utils/api';
import { dateRange, bucket, csv } from '@packages/utils/reporting';
import { transitionOrder } from '@packages/utils/order-lifecycle';
import { NotFoundError, ValidationError } from '@packages/error-handler';

export const getOrders = handle(async (req, res) => {
  const where: Prisma.ordersWhereInput = { createdAt: dateRange(req.query, 90) };
  if (req.query.status) { if (!['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refunded'].includes(String(req.query.status))) throw new ValidationError('Invalid status'); where.status = req.query.status as any; }
  if (req.query.shopId) where.shopId = objectId(req.query.shopId);
  const [orders, total] = await Promise.all([prisma.orders.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: 'desc' }, include: { items: true, shop: { select: { id: true, name: true } }, user: { select: { id: true, name: true, email: true } } } }), prisma.orders.count({ where })]);
  res.json({ orders, total });
});
export const orderDetail = handle(async (req, res) => {
  const order = await prisma.orders.findUnique({ where: { id: objectId(req.params.orderId) }, include: { items: true, shop: { select: { id: true, name: true } }, user: { select: { name: true, email: true } } } });
  if (!order) throw new NotFoundError();
  res.json({ order });
});
export const updateStatus = handle(async (req, res) => {
  const order = await transitionOrder(objectId(req.params.orderId), req.body.status, {}, req.user.id, req.body);
  res.json({ order });
});
export const dashboard = handle(async (req, res) => {
  const createdAt = dateRange(req.query);
  const [orders, users, sellers, totalUsers, totalSellers, totalProducts, top] = await Promise.all([
    prisma.orders.findMany({ where: { createdAt }, select: { totalAmount: true, paymentStatus: true, status: true, createdAt: true } }),
    prisma.users.findMany({ where: { createdAt, role: 'user' }, select: { createdAt: true } }),
    prisma.sellers.findMany({ where: { createdAt }, select: { createdAt: true } }),
    prisma.users.count({ where: { role: 'user' } }), prisma.sellers.count(), prisma.products.count({ where: { isDeleted: false } }),
    prisma.orderItems.groupBy({ by: ['productId'], where: { order: { createdAt, paymentStatus: 'Paid', status: { notIn: ['Cancelled', 'Returned', 'Refunded'] } } }, _sum: { quantity: true, totalPrice: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 10 }),
  ]);
  const timeline: Record<string, { date: string; revenue: number; users: number; sellers: number; orders: number }> = {};
  for (let day = new Date(createdAt.gte); day <= createdAt.lte; day.setUTCDate(day.getUTCDate() + 1)) { const date = bucket(day, 'day'); timeline[date] = { date, revenue: 0, users: 0, sellers: 0, orders: 0 }; }
  for (const order of orders) { const row = timeline[bucket(order.createdAt, 'day')]; if (row) { row.orders++; if (order.paymentStatus === 'Paid' && !['Cancelled', 'Returned', 'Refunded'].includes(order.status)) row.revenue += order.totalAmount; } }
  users.forEach(user => { const row = timeline[bucket(user.createdAt, 'day')]; if (row) row.users++; });
  sellers.forEach(seller => { const row = timeline[bucket(seller.createdAt, 'day')]; if (row) row.sellers++; });
  const products = await prisma.products.findMany({ where: { id: { in: top.map(p => p.productId) } }, select: { id: true, title: true } });
  res.json({ stats: { totalUsers, totalSellers, totalProducts, totalOrders: orders.length, revenue: Object.values(timeline).reduce((sum, r) => sum + r.revenue, 0) }, timeline: Object.values(timeline), topProducts: top.map(p => ({ ...p._sum, id: p.productId, title: products.find(product => product.id === p.productId)?.title ?? 'Deleted product' })) });
});
export const notifications = handle(async (req, res) => {
  const where: Prisma.notificationsWhereInput = { OR: [{ userId: req.user.id }, { AND: [{ OR: [{ userId: null }, { userId: { isSet: false } }] }, { OR: [{ sellerId: null }, { sellerId: { isSet: false } }] }] }] };
  const [notifications, total] = await Promise.all([prisma.notifications.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: 'desc' } }), prisma.notifications.count({ where })]);
  res.json({ notifications, total });
});
export const sendNotification = handle(async (req, res) => {
  const title = textField(req.body.title, 'title', 150);
  const message = textField(req.body.message, 'message', 3000);
  const audience = req.body.audience;
  if (!['users', 'sellers'].includes(audience)) throw new ValidationError('Choose users or sellers');
  const recipientId = req.body.recipientId ? objectId(req.body.recipientId) : undefined;
  if (!recipientId && req.body.confirmBroadcast !== true) throw new ValidationError('Confirm the broadcast');
  // Cursor batches keep large broadcasts within database limits.
  let cursor: string | undefined;
  let sent = 0;
  do {
    const args = { where: recipientId ? { id: recipientId } : {}, select: { id: true }, take: 500, orderBy: { id: 'asc' as const }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) };
    const recipients: { id: string }[] = audience === 'users' ? await prisma.users.findMany(args) : await prisma.sellers.findMany(args);
    if (!recipients.length) break;
    await prisma.notifications.createMany({ data: recipients.map(r => ({ title, message, type: 'System' as const, ...(audience === 'users' ? { userId: r.id } : { sellerId: r.id }) })) });
    sent += recipients.length;
    cursor = recipients.length === 500 ? recipients[recipients.length - 1].id : undefined;
  } while (cursor);
  if (!sent && recipientId) throw new NotFoundError('Recipient not found');
  res.status(201).json({ sent });
});
export const payments = handle(async (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const createdAt = dateRange(req.query, 30);
  const result = await stripe.paymentIntents.list({ limit: 50, created: { gte: Math.floor(createdAt.gte.getTime() / 1000), lte: Math.floor(createdAt.lte.getTime() / 1000) }, ...(req.query.after ? { starting_after: String(req.query.after) } : {}) });
  const orders = await prisma.orders.findMany({ where: { createdAt, ...(req.query.shopId ? { shopId: objectId(req.query.shopId) } : {}) }, include: { shop: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
  const byShop: Record<string, { name: string; revenue: number; orders: number }> = {};
  const byDate: Record<string, { date: string; revenue: number }> = {};
  for (const order of orders) {
    const row = byShop[order.shopId] ??= { name: order.shop.name, revenue: 0, orders: 0 }; row.orders++;
    const date = bucket(order.createdAt, 'day'); const day = byDate[date] ??= { date, revenue: 0 };
    if (order.paymentStatus === 'Paid' && !['Cancelled', 'Returned', 'Refunded'].includes(order.status)) { row.revenue += order.totalAmount; day.revenue += order.totalAmount; }
  }
  res.json({ payments: result.data.map(p => ({ id: p.id, amount: p.amount / 100, currency: p.currency, status: p.status, created: p.created })), hasMore: result.has_more, nextCursor: result.data.at(-1)?.id, orders, byShop: Object.values(byShop), timeline: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)) });
});
export const refund = handle(async (req, res) => {
  const orderId = objectId(req.body.orderId);
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
    if (updated.count && result.status === 'succeeded') await tx.notifications.create({ data: { userId: order.userId, orderId, type: 'OrderRefunded', title: 'Order refunded', message: `${order.orderNumber} has been refunded.`, redirectUrl: `/order/${orderId}` } });
  });
  res.json({ success: true, refundId: result.id, status: result.status });
});
export const logs = handle(async (req, res) => {
  const where: Prisma.behaviorLogWhereInput = { createdAt: dateRange(req.query) };
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
    prisma.behaviorLog.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: 'desc' } }), prisma.behaviorLog.count({ where }),
    prisma.behaviorLog.findMany({ where, select: { createdAt: true, action: true }, take: 50000 }),
  ]);
  const timeline: Record<string, { date: string; views: number; cartAdds: number; purchases: number }> = {};
  events.forEach(event => { const date = bucket(event.createdAt, 'day'); const row = timeline[date] ??= { date, views: 0, cartAdds: 0, purchases: 0 }; if (['productView', 'product_view'].includes(event.action)) row.views++; if (['addToCart', 'add_to_cart'].includes(event.action)) row.cartAdds++; if (['paymentSuccess', 'purchase'].includes(event.action)) row.purchases++; });
  res.json({ logs, total, timeline: Object.values(timeline).sort((a, b) => a.date.localeCompare(b.date)), chartTruncated: total > events.length });
});
