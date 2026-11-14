import { handle, objectId } from '@packages/utils/api';
import { transitionOrder } from '@packages/utils/order-lifecycle';
import { ForbiddenError } from '@packages/error-handler';
import { isSuspended } from '@packages/utils/admin-access';
export const cancelOrder = handle(async (req, res) => {
  const order = await transitionOrder(objectId(req.params.orderId), 'Cancelled', { userId: req.user!.id, status: 'Pending' }, req.user!.id, req.body);
  res.json({ order });
});
export const sellerOrderStatus = handle(async (req: any, res) => {
  if (!req.seller.shop?.id) throw new ForbiddenError();
  if (isSuspended(req.seller) && !['Cancelled', 'Delivered'].includes(req.body.status)) throw new ForbiddenError('Suspended sellers can only remedy existing orders');
  const order = await transitionOrder(objectId(req.params.orderId), req.body.status, { shopId: req.seller.shop.id }, req.seller.id, req.body);
  res.json(order);
});
