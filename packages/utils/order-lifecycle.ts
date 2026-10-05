import { transaction } from '@packages/utils/transaction';
import { Prisma, orderStatus, notificationType } from '@prisma/client';
import { NotFoundError, ValidationError } from '@packages/error-handler';
export const transitions: Record<string, string[]> = { Pending: ['Confirmed', 'Cancelled'], Confirmed: ['Processing', 'Cancelled'], Processing: ['Shipped'], Shipped: ['Delivered'], Delivered: ['Returned'], Returned: [], Cancelled: [], Refunded: [] };
export async function transitionOrder(id: string, status: string, scope: Prisma.ordersWhereInput, actorId: string, input: any = {}) {
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
        const product = await tx.products.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity }, totalSales: { decrement: item.quantity } } });
        await tx.inventoryHistory.create({ data: { productId: product.id, shopId: order.shopId, delta: item.quantity, stockAfter: product.stock, reason: `Cancellation ${order.orderNumber}`, actorId } });
      }
    }
    const updated = await tx.orders.update({ where: { id, status: order.status }, data, include: { items: true, shop: { select: { name: true } }, user: { select: { name: true, email: true } } } });
    const type = ({ Confirmed: 'OrderConfirmed', Shipped: 'OrderShipped', Delivered: 'OrderDelivered', Cancelled: 'OrderCancelled' } as Record<string, notificationType>)[status] ?? 'System';
    await tx.notifications.create({ data: { userId: order.userId, orderId: id, type, title: `Order ${status.toLowerCase()}`, message: `${order.orderNumber}: ${status}${status === 'Cancelled' && order.paymentStatus === 'Paid' ? '. Your payment refund is awaiting processing.' : ''}`, redirectUrl: `/order/${id}` } });
    return updated;
  });
}
