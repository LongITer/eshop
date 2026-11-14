import type Stripe from 'stripe';
import { ValidationError } from '@packages/error-handler';
import { STORE_CURRENCY, usdCents } from './money';

type RefundOrder = {
  id: string;
  stripePaymentId: string | null;
  stripeRefundId?: string | null;
  totalAmount: number;
  currency?: string;
};

/** This application refunds a whole shop order, which can be part of a shared payment. */
export function validateOrderRefund(order: RefundOrder, refund: Stripe.Refund, expectedId: string | null = order.stripeRefundId || null) {
  const paymentId = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id;
  if (paymentId !== order.stripePaymentId || refund.metadata?.orderId !== order.id ||
    refund.amount !== usdCents(order.totalAmount) || refund.currency !== (order.currency || STORE_CURRENCY) ||
    (expectedId && expectedId !== refund.id)) {
    throw new ValidationError('Refund does not match this order. Review its payment, amount and currency.');
  }
}

export const failedOrderRefund = (refund: Pick<Stripe.Refund, 'status'>) => refund.status === 'failed' || refund.status === 'canceled';

/** Only a verified failed predecessor permits a replacement; arbitrary IDs stay invalid. */
export async function orderRefundRelation(order: RefundOrder, refund: Stripe.Refund, retrieve: (id: string) => Promise<Stripe.Refund>): Promise<'current' | 'replacement' | 'stale'> {
  validateOrderRefund(order, refund, null);
  if (order.stripeRefundId === refund.id) return 'current';
  const descendsFrom = async (attempt: Stripe.Refund, ancestor: string | null) => {
    const seen = new Set([attempt.id]);
    for (let depth = 0; depth < 50; depth++) {
      const parentId = attempt.metadata?.previousRefundId;
      if (!parentId) return ancestor === null;
      if (seen.has(parentId)) throw new ValidationError('Invalid refund retry history.');
      seen.add(parentId);
      const parent = await retrieve(parentId);
      validateOrderRefund(order, parent, parentId);
      if (!failedOrderRefund(parent)) throw new ValidationError('Only failed or canceled refunds can be retried.');
      if (parent.id === ancestor) return true;
      attempt = parent;
    }
    throw new ValidationError('Refund retry history requires review.');
  };
  if (await descendsFrom(refund, order.stripeRefundId || null)) return order.stripeRefundId ? 'replacement' : 'current';
  const head = await retrieve(order.stripeRefundId!);
  validateOrderRefund(order, head);
  if (await descendsFrom(head, refund.id)) return 'stale';
  throw new ValidationError('Refund does not match the current order refund.');
}
