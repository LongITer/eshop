import cron from 'node-cron';
import prisma from '@packages/libs/prisma';
import { transitionOrder } from '@packages/utils/order-lifecycle';
import { isSuspended } from '@packages/utils/admin-access';

const stages: Record<string, string> = {
  Pending: 'Confirmed',
  Confirmed: 'Processing',
  Processing: 'Shipped',
  Shipped: 'Delivered',
};

/** Advance opted-in shops' paid orders according to their configured schedule. */
cron.schedule('* * * * *', async () => {
  try {
    const shops = await prisma.shops.findMany({ select: { id: true, orderAutomation: true, sellers: { select: { suspendedAt: true, suspendedUntil: true } } } });
    const enabled = shops.filter(shop => {
      const config = shop.orderAutomation as any;
      return config?.enabled === true && config.delaysMinutes && !isSuspended(shop.sellers);
    });
    if (!enabled.length) return;

    const configByShop = new Map(enabled.map(shop => [shop.id, shop.orderAutomation as any]));
    const orders = await prisma.orders.findMany({
      where: { shopId: { in: enabled.map(shop => shop.id) }, status: { in: Object.keys(stages) as any }, paymentStatus: 'Paid', moderationHold: false },
      select: { id: true, shopId: true, status: true, createdAt: true },
      orderBy: { updatedAt: 'asc' },
      take: 500,
    });

    for (const order of orders) {
      const next = stages[order.status];
      const config = configByShop.get(order.shopId);
      const delayMinutes = Number(config?.delaysMinutes?.[order.status]);
      if (!next || !Number.isInteger(delayMinutes) || delayMinutes < 5 || delayMinutes > 10080) continue;

      const lastEvent = await prisma.orderEvent.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
      const enteredStatusAt = lastEvent?.createdAt || order.createdAt;
      if (Date.now() - enteredStatusAt.getTime() < delayMinutes * 60_000) continue;

      try {
        await transitionOrder(order.id, next, { shopId: order.shopId, paymentStatus: 'Paid', moderationHold: false }, 'system:auto-advance', { reason: 'Automatically advanced according to the shop schedule.' });
      } catch (error) {
        console.warn(`[order-auto-advance] Could not advance order ${order.id}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  } catch (error) {
    console.error('[order-auto-advance] Scheduled check failed:', error);
  }
}, { noOverlap: true });
