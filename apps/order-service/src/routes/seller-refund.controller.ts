import { handle, objectId, textField } from '@packages/utils/api';
import { refundSellerOrder } from '@packages/utils/seller-order-refund';
import { ForbiddenError } from '@packages/error-handler';
export const sellerRefund = handle(async (req, res) => {
  if (!req.seller?.shop?.id) throw new ForbiddenError();
  const result = await refundSellerOrder(objectId(req.params.orderId), req.seller.shop.id, req.seller.id, textField(req.body.reason, 'refund reason', 1000));
  res.json(result);
});
