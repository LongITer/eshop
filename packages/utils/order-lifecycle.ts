import { audit } from './admin-audit';
import { transaction } from '@packages/utils/transaction';
import { Prisma, orderStatus, notificationType } from '@prisma/client';
import { NotFoundError, ValidationError } from '@packages/error-handler';
import { transitions } from './order-status';
export { transitions } from './order-status';
export async function transitionOrder(id: string, status: string, scope: Prisma.ordersWhereInput, actorId: string, input: any = {}, adminAction = false) {
  if (!Object.values(orderStatus).includes(status as orderStatus)) throw new ValidationError('Invalid order status');
  return transaction(async tx => {
    const order = await tx.orders.findFirst({ where: { ...scope, id }, include: { items: true } });
    if (!order) throw new NotFoundError();
    if (order.status === status) return order;
    if (!transitions[order.status]?.includes(status)) throw new ValidationError(`Cannot change ${order.status} to ${status}`);
    const data: Prisma.ordersUpdateInput = { status: status as orderStatus };
    if (input.trackingNumber !== undefined) {
      if (typeof input.trackingNumber !== 'string' || input.trackingNumber.length > 120) throw new ValidationError('Invalid tracking number');
      data.trackingNumber = input.trackingNumber;
    }
    if (input.estimatedDelivery) {
      const date = new Date(input.estimatedDelivery);
      if (!Number.isFinite(date.getTime())) throw new ValidationError('Invalid delivery date');
      data.estimatedDelivery = date;
    }
    if (status === 'Delivered') data.deliveredAt = new Date();
    if (status === 'Cancelled') {
      data.cancelledAt = new Date();
      data.cancelReason = typeof input.reason === 'string' ? input.reason.slice(0, 1000) : 'Cancelled by request';
      for (const item of order.items) {
        const variant = item.variantId ? await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } }) : null;
        const unassignedSku = !item.variantId && (await tx.productVariant.count({ where: { productId: item.productId } })) > 0;
        const stockDelta = unassignedSku || (variant && !variant.active) ? 0 : item.quantity;
        const product = await tx.products.update({ where: { id: item.productId }, data: { stock: { increment: stockDelta }, totalSales: { decrement: item.quantity } } });
        await tx.inventoryHistory.create({ data: { productId: product.id, shopId: order.shopId, delta: stockDelta, stockAfter: product.stock, reason: `Cancellation ${order.orderNumber}${unassignedSku ? ': legacy item requires manual SKU allocation' : ''}`, actorId } });
        if (unassignedSku) {
          const shop = await tx.shops.findUniqueOrThrow({ where: { id: order.shopId } });
          await tx.notifications.create({ data: { sellerId: shop.sellerId, orderId: id, type: 'System', title: 'Inventory allocation required', message: `${order.orderNumber}: allocate ${item.quantity} returned ${product.title} units to the correct SKU. This older order did not record a SKU.`, redirectUrl: '/dashboard/inventory' } });
        }
      }
    }
    const updated = await tx.orders.update({ where: { id, status: order.status }, data, include: { items: true, shop: { select: { name: true } }, user: { select: { name: true, email: true } } } });
    await tx.orderEvent.create({ data: { orderId: id, actorId, from: order.status, to: status, reason: typeof input.reason === 'string' ? input.reason.slice(0, 1000) : null } });
    if (adminAction) await audit(tx, actorId, 'order.status', id, input.reason, { status: order.status }, { status });
    const type = ({ Confirmed: 'OrderConfirmed', Shipped: 'OrderShipped', Delivered: 'OrderDelivered', Cancelled: 'OrderCancelled' } as Record<string, notificationType>)[status] ?? 'System';
    await tx.notifications.create({ data: { userId: order.userId, orderId: id, type, title: `Order ${status.toLowerCase()}`, message: `${order.orderNumber}: ${status}${status === 'Cancelled' && order.paymentStatus === 'Paid' ? '. Your payment refund is awaiting processing.' : ''}`, redirectUrl: `/order/${id}` } });
    return updated;
  });
}
