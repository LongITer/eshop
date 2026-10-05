import { transaction } from '@packages/utils/transaction';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import prisma from '@packages/libs/prisma';
import { sendBehaviorLog } from '@packages/utils/logs/behavior-log';
import { sendEmail } from '../utils/send-email';

export async function paymentWebhook(req: Request, res: Response) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent((req as any).rawBody, req.headers['stripe-signature']!, process.env.STRIPE_WEBHOOK_SECRET!); }
  catch { res.status(400).json({ message: 'Invalid webhook signature' }); return; }
  try {
    if (['refund.updated', 'refund.created', 'refund.failed'].includes(event.type)) {
      const refund = event.data.object as Stripe.Refund;
      if (refund.metadata?.orderId) await transaction(async tx => {
        const order = await tx.orders.findFirst({ where: { id: refund.metadata!.orderId, stripePaymentId: typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id } });
        if (!order || order.paymentStatus === 'Refunded') return;
        await tx.orders.update({ where: { id: order.id }, data: { stripeRefundId: refund.id, refundState: refund.status, ...(refund.status === 'succeeded' ? { paymentStatus: 'Refunded', status: 'Refunded' } : {}) } });
        if (refund.status === 'succeeded') await tx.notifications.create({ data: { userId: order.userId, orderId: order.id, type: 'OrderRefunded', title: 'Order refunded', message: `${order.orderNumber} has been refunded.`, redirectUrl: `/order/${order.id}` } });
      });
      res.json({ received: true }); return;
    }
    if (event.type !== 'payment_intent.succeeded') { res.json({ received: true }); return; }
    const payment = event.data.object;
    if (await prisma.paymentReceipt.findUnique({ where: { id: payment.id } })) { res.json({ received: true, duplicate: true }); return; }
    const session = await prisma.paymentSession.findUnique({ where: { id: payment.metadata.sessionId || '' } });
    if (!session) { res.status(503).json({ message: 'Payment session unavailable; retry required' }); return; }
    const payload = session.payload as any;
    if (session.userId !== payment.metadata.userId || payment.amount_received !== Math.round(payload.totalAmount * 100) || payment.currency !== 'usd') { res.status(400).json({ message: 'Payment does not match checkout session' }); return; }
    const ids = await transaction(async tx => {
      const receipt = await tx.paymentReceipt.findUnique({ where: { id: payment.id } });
      if (receipt) return receipt.orderIds;
      await tx.paymentReceipt.create({ data: { id: payment.id, userId: session.userId, orderIds: [] } });
      const grouped = new Map<string, any[]>();
      for (const item of payload.cart) grouped.set(item.shopId, [...(grouped.get(item.shopId) || []), item]);
      const orderIds: string[] = [];
      for (const [shopId, items] of grouped) {
        const shop = await tx.shops.findUniqueOrThrow({ where: { id: shopId } });
        const subTotal = items.reduce((sum, item) => sum + Math.round(item.sale_price * 100) * item.quantity, 0) / 100;
        const coupon = payload.coupon;
        const discount = coupon && items.some(item => item.id === coupon.discountedProductId) ? coupon.discountAmount : 0;
        const order = await tx.orders.create({ data: { orderNumber: `ORD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, userId: session.userId, shopId, subTotal, discount, discountCodeId: discount ? coupon.id : null, totalAmount: Math.round((subTotal - discount) * 100) / 100, paymentStatus: 'Paid', paymentMethod: 'card', stripePaymentId: payment.id, shippingAddress: payload.shippingAddress, items: { create: items.map(item => ({ productId: item.id, title: item.title, image: item.image, color: item.selectedOptions?.color || null, size: item.selectedOptions?.size || null, quantity: item.quantity, unitPrice: item.sale_price, totalPrice: Math.round(item.sale_price * 100) * item.quantity / 100 })) } } });
        orderIds.push(order.id);
        for (const item of items) {
          const changed = await tx.products.updateMany({ where: { id: item.id, stock: { gte: item.quantity }, isDeleted: false, status: 'Active' }, data: { stock: { decrement: item.quantity }, totalSales: { increment: item.quantity } } });
          if (!changed.count) throw new Error('Paid product is no longer available; fulfillment requires intervention');
          const product = await tx.products.findUniqueOrThrow({ where: { id: item.id } });
          await tx.inventoryHistory.create({ data: { productId: item.id, shopId, delta: -item.quantity, stockAfter: product.stock, reason: `Purchase ${order.orderNumber}`, actorId: session.userId } });
          if (product.stock < 5 && product.stock + item.quantity >= 5) await tx.notifications.create({ data: { sellerId: shop.sellerId, orderId: order.id, type: 'LowStock', title: 'Low stock', message: `${product.title}: ${product.stock} remaining`, redirectUrl: '/dashboard/inventory' } });
          await tx.productAnalytics.upsert({ where: { productId: item.id }, create: { productId: item.id, shopId, purchases: item.quantity, lastViewedAt: new Date() }, update: { purchases: { increment: item.quantity } } });
        }
        await tx.notifications.createMany({ data: [{ sellerId: shop.sellerId, orderId: order.id, type: 'NewOrder', title: 'New order', message: `${order.orderNumber} is ready to process.`, redirectUrl: '/dashboard/orders' }, { userId: session.userId, orderId: order.id, type: 'NewOrder', title: 'Order received', message: `${order.orderNumber} has been paid.`, redirectUrl: `/order/${order.id}` }, { type: 'System', title: 'New platform order', message: order.orderNumber, orderId: order.id, redirectUrl: '/dashboard/orders' }] });
      }
      const analytics = await tx.userAnalytics.findUnique({ where: { userId: session.userId } });
      const actions = [...(analytics?.actions || []), ...payload.cart.map((item: any) => ({ productId: item.id, shopId: item.shopId, action: 'purchase', timestamp: new Date().toISOString() }))].slice(-100);
      await tx.userAnalytics.upsert({ where: { userId: session.userId }, create: { userId: session.userId, actions, lastVisited: new Date() }, update: { actions, lastVisited: new Date() } });
      await tx.paymentReceipt.update({ where: { id: payment.id }, data: { orderIds } });
      return orderIds;
    }, { timeout: 30000 });
    await sendBehaviorLog('paymentSuccess', { type: 'success', source: 'order-service', message: 'Payment completed', metadata: { userId: session.userId, paymentIntentId: payment.id, orderIds: ids, amount: payload.totalAmount } });
    const user = await prisma.users.findUnique({ where: { id: session.userId }, select: { email: true, name: true } });
    if (user) await sendEmail(user.email, 'Your Eshop order confirmation', 'order.confirmation', { name: user.name, cart: payload.cart, totalAmount: payload.totalAmount, trackingUrl: `${process.env.USER_UI_URL || 'http://localhost:3000'}/order/${ids[0]}` });
    res.json({ received: true });
  } catch (error) {
    console.error('Payment fulfillment failed', error instanceof Error ? error.message : 'Unknown error');
    // A non-2xx response keeps Stripe retries active. The transaction rolls back all writes.
    res.status(503).json({ message: 'Payment processing failed; retry required' });
  }
}
