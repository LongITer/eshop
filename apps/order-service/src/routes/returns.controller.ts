import prisma from '@packages/libs/prisma';
import Stripe from 'stripe';
import { fulfillPayment } from './payment-webhook.controller';
import { handle, objectId, textField } from '@packages/utils/api';
import { transaction } from '@packages/utils/transaction';
import { NotFoundError, ValidationError, ForbiddenError } from '@packages/error-handler';

export const requestReturn = handle(async (req, res) => {
  const orderId = objectId(req.params.orderId);
  const reason = textField(req.body.reason, 'return reason', 2000);
  const evidence = req.body.evidence || [];
  if (!Array.isArray(evidence) || evidence.length > 5 || evidence.some(url => {
    if (typeof url !== 'string' || url.length > 2000) return true;
    try { return new URL(url).protocol !== 'https:'; } catch { return true; }
  })) throw new ValidationError('Provide up to five HTTPS evidence links');
  const result = await transaction(async tx => {
    const order = await tx.orders.findFirst({ where: { id: orderId, userId: req.user.id, status: 'Delivered', paymentStatus: 'Paid' } });
    if (!order) throw new NotFoundError('Only your delivered, paid orders can be returned');
    const existing = await tx.returnRequest.findUnique({ where: { orderId } });
    if (existing) return existing;
    // Serialize with seller status updates and concurrent requests.
    await tx.orders.update({ where: { id: orderId, status: 'Delivered' }, data: { updatedAt: new Date() } });
    const result = await tx.returnRequest.create({ data: { orderId, userId: req.user.id, shopId: order.shopId, reason, evidence } });
    const shop = await tx.shops.findUniqueOrThrow({ where: { id: order.shopId } });
    await tx.notifications.create({ data: { sellerId: shop.sellerId, orderId, type: 'System', title: 'Return requested', message: `${order.orderNumber}: ${reason}`, redirectUrl: `/dashboard/orders/${orderId}` } });
    return result;
  });
  res.status(201).json({ request: result });
});

export const orderAftercare = handle(async (req: any, res) => {
  const orderId = objectId(req.params.orderId);
  const scope = req.role === 'seller' ? { shopId: req.seller?.shop?.id || '000000000000000000000000' } : { userId: req.user.id };
  if (!await prisma.orders.findFirst({ where: { id: orderId, ...scope } })) throw new NotFoundError();
  const [request, events] = await Promise.all([
    prisma.returnRequest.findUnique({ where: { orderId } }),
    prisma.orderEvent.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' }, take: 100 }),
  ]);
  res.json({ request, events });
});

export const reviewReturn = handle(async (req: any, res) => {
  const orderId = objectId(req.params.orderId); const status = req.body.status;
  if (!req.seller?.shop?.id) throw new ForbiddenError();
  if (!['Approved', 'Rejected', 'Received'].includes(status)) throw new ValidationError('Invalid return action');
  const sellerNote = textField(req.body.sellerNote, 'seller note', 2000);
  const result = await transaction(async tx => {
    const order = await tx.orders.findFirst({ where: { id: orderId, shopId: req.seller.shop.id }, include: { items: true } });
    const request = await tx.returnRequest.findUnique({ where: { orderId } });
    if (!order || !request) throw new NotFoundError();
    if (request.status === status) return request;
    if (!(request.status === 'Requested' && ['Approved', 'Rejected'].includes(status)) && !(request.status === 'Approved' && status === 'Received')) throw new ValidationError('Invalid return transition');
    if (order.status !== 'Delivered') throw new ValidationError('Order is no longer eligible for this return action');
    if (status === 'Received') {
      // Returned goods are not automatically sellable; stock is adjusted after inspection.
      await tx.orders.update({ where: { id: orderId, status: 'Delivered' }, data: { status: 'Returned' } });
    } else await tx.orders.update({ where: { id: orderId, status: 'Delivered' }, data: { updatedAt: new Date() } });
    const updated = await tx.returnRequest.update({ where: { id: request.id, status: request.status }, data: { status, sellerNote } });
    await tx.orderEvent.create({ data: { orderId, actorId: req.seller.id, from: `Return:${request.status}`, to: `Return:${status}`, reason: sellerNote } });
    await tx.notifications.create({ data: { userId: order.userId, orderId, type: 'System', title: `Return ${status.toLowerCase()}`, message: sellerNote, redirectUrl: `/order/${orderId}` } });
    return updated;
  });
  res.json({ request: result });
});

export const paymentResult = handle(async (req, res) => {
  const sessionId = req.query.sessionId;
  if (typeof sessionId !== 'string' || sessionId.length > 100) throw new ValidationError('Invalid session');
  const session = await prisma.paymentSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== req.user.id) throw new NotFoundError();
  res.setHeader('Cache-Control', 'no-store');
  let receipt = await prisma.paymentReceipt.findFirst({ where: { sessionId, userId: req.user.id } });
  const payload = session.payload as any;
  let status = 'pending';
  const paymentId = payload.paymentIntentId || req.query.paymentIntentId;
  if (!receipt && paymentId) {
    if (typeof paymentId !== 'string' || !/^pi_[A-Za-z0-9]+$/.test(paymentId)) throw new ValidationError('Invalid payment');
    const payment = await new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 10000, maxNetworkRetries: 1 }).paymentIntents.retrieve(paymentId);
    if (payment.metadata.sessionId !== sessionId || payment.metadata.userId !== req.user.id) throw new ForbiddenError();
    status = payment.status;
    if (payment.status === 'succeeded') {
      try { await fulfillPayment(payment, false); }
      catch { status = 'needs_review'; }
      receipt = await prisma.paymentReceipt.findFirst({ where: { sessionId, userId: req.user.id } });
    }
  } else if (!receipt && session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) status = 'expired';
  res.json({ complete: !!receipt?.orderIds.length, status: receipt?.orderIds.length ? 'complete' : status, orderIds: receipt?.orderIds || [], cart: receipt ? payload.cart : [] });
});
