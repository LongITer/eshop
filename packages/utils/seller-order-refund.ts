import Stripe from 'stripe';
import prisma from '@packages/libs/prisma';
import { audit } from './admin-audit';
import { transaction } from './transaction';
import { failedOrderRefund, orderRefundRelation, validateOrderRefund } from './order-refund';
import { NotFoundError, ValidationError } from '@packages/error-handler';

export async function refundSellerOrder(orderId: string, shopId: string, sellerId: string, reason: string) {
  const order = await prisma.orders.findUnique({ where: { id: orderId, shopId } });
  if (!order || !order.stripePaymentId) throw new NotFoundError('Payment/order not found');
  if (order.paymentStatus === 'Refunded') return { success: true, refundId: order.stripeRefundId, status: 'succeeded' };
  if (order.paymentStatus !== 'Paid' || !['Cancelled', 'Returned'].includes(order.status)) throw new ValidationError('Cancel or return the paid order before refunding');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const intent = await stripe.paymentIntents.retrieve(order.stripePaymentId!);
  const attempts = new Map<string, Stripe.Refund>();
  if (order.stripeRefundId) {
    const saved = await stripe.refunds.retrieve(order.stripeRefundId);
    validateOrderRefund(order, saved);
    attempts.set(saved.id, saved);
  }
  // Recover a provider success even if the previous request lost its database response.
  for await (const candidate of stripe.refunds.list({ payment_intent: order.stripePaymentId!, limit: 100 })) {
    if (candidate.metadata?.orderId !== order.id) continue;
    validateOrderRefund(order, candidate, null);
    attempts.set(candidate.id, candidate);
  }
  const parents = new Set([...attempts.values()].map(attempt => attempt.metadata?.previousRefundId).filter(Boolean));
  const latest = [...attempts.values()].filter(attempt => !parents.has(attempt.id));
  if (latest.length > 1) throw new ValidationError('Multiple refund attempts require review.');
  const retrieve = async (id: string) => attempts.get(id) || stripe.refunds.retrieve(id);
  const existing = latest[0];
  if (existing) await orderRefundRelation(order, existing, retrieve);
  const retry = existing && failedOrderRefund(existing);
  const result = existing && !retry ? existing : await stripe.refunds.create({ payment_intent: order.stripePaymentId!, amount: Math.round(order.totalAmount * 100), ...(intent.transfer_data?.destination ? { reverse_transfer: true, refund_application_fee: true } : {}), metadata: { orderId, ...(retry ? { previousRefundId: existing.id } : {}) } }, { idempotencyKey: retry ? `order-refund-${order.id}-retry-${existing.id}` : `order-refund-${order.id}` });
  validateOrderRefund(order, result, null);
  const saved = await transaction(async tx => {
    const current = await tx.orders.findUnique({ where: { id: orderId, shopId } });
    if (!current) throw new NotFoundError('Payment/order not found');
    if (current.paymentStatus === 'Refunded') return current;
    const relation = await orderRefundRelation(current, result, retrieve);
    if (relation === 'stale' || (current.stripeRefundId === result.id && (current.refundState === result.status || (['failed', 'canceled'].includes(current.refundState || '') && result.status !== 'succeeded')))) return current;
    const updated = await tx.orders.updateMany({ where: { id: orderId, shopId, paymentStatus: 'Paid' }, data: { stripeRefundId: result.id, refundState: result.status, ...(result.status === 'succeeded' ? { paymentStatus: 'Refunded', status: 'Refunded' } : {}) } });
    if (updated.count) await audit(tx, sellerId, 'seller.refund', orderId, reason, { paymentStatus: order.paymentStatus }, { refundId: result.id, status: result.status, amount: order.totalAmount });
    if (updated.count && result.status === 'succeeded') await tx.notifications.create({ data: { userId: order.userId, orderId, type: 'OrderRefunded', title: 'Order refunded', message: `${order.orderNumber} has been refunded.`, redirectUrl: `/order/${orderId}` } });
    return { ...current, stripeRefundId: result.id, refundState: result.status };
  });
  if (failedOrderRefund({ status: saved.refundState as Stripe.Refund['status'] })) throw new ValidationError('Stripe refund failed. You can retry this refund.');
  return { success: true, refundId: saved.stripeRefundId, status: saved.refundState };
}
