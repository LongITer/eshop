import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, userId, productId, shopId, otherId } from './helpers';
import { transitionOrder } from '@packages/utils/order-lifecycle';
import { cancelOrder } from '../../apps/order-service/src/routes/order-management.controller';
import { refund } from '../../apps/admin-service/src/controllers/operations.controller';
import { stripe } from './mocks/stripe';
const order = { id: otherId, orderNumber: 'ORD-1', userId, shopId, status: 'Pending', paymentStatus: 'Paid', totalAmount: 25.5, stripePaymentId: 'pi_1', items: [{ productId, quantity: 2 }] };
beforeEach(() => { resetDb(); stripe.refunds.create.mockReset(); stripe.refunds.retrieve.mockReset(); stripe.refunds.list.mockImplementation(() => ({ async *[Symbol.asyncIterator]() {} })); });
test.each(['Shipped', 'Delivered', 'Refunded'])('pending order cannot jump directly to %s', async status => {
  db.orders.findFirst.mockResolvedValue(order);
  await expect(transitionOrder(otherId, status, {}, userId)).rejects.toThrow('Cannot change');
  expect(db.orders.update).not.toHaveBeenCalled();
});
test('cancellation restocks once and records the reason', async () => {
  db.orders.findFirst.mockResolvedValue(order); db.products.update.mockResolvedValue({ id: productId, stock: 12 }); db.orders.update.mockResolvedValue({ ...order, status: 'Cancelled' });
  await transitionOrder(otherId, 'Cancelled', { userId }, userId, { reason: 'Changed mind' });
  expect(db.products.update.mock.calls[0][0].data.stock).toEqual({ increment: 2 });
  expect(db.inventoryHistory.create.mock.calls[0][0].data.stockAfter).toBe(12);
  expect(db.orders.update.mock.calls[0][0].where).toEqual({ id: otherId, status: 'Pending' });
  db.orders.findFirst.mockResolvedValue({ ...order, status: 'Cancelled' });
  await transitionOrder(otherId, 'Cancelled', {}, userId);
  expect(db.products.update).toHaveBeenCalledTimes(1);
});
test('buyer cancellation lookup requires both buyer ownership and Pending', async () => {
  db.orders.findFirst.mockResolvedValue(null);
  expect((await request(appFor('post', '/:orderId', cancelOrder)).post('/' + otherId)).status).toBe(404);
  expect(db.orders.findFirst.mock.calls[0][0].where).toEqual({ id: otherId, userId, status: 'Pending' });
});
test('shipment persists tracking and ETA and notifies buyer', async () => {
  db.orders.findFirst.mockResolvedValue({ ...order, status: 'Processing' }); db.orders.update.mockResolvedValue(order);
  await transitionOrder(otherId, 'Shipped', { shopId }, userId, { trackingNumber: 'TRACK123', estimatedDelivery: '2026-10-15' });
  expect(db.orders.update.mock.calls[0][0].data).toEqual(expect.objectContaining({ trackingNumber: 'TRACK123', estimatedDelivery: new Date('2026-10-15') }));
  expect(db.notifications.create.mock.calls[0][0].data.userId).toBe(userId);
});
test('refund validates that payment belongs to selected order', async () => {
  db.orders.findUnique.mockResolvedValue(order);
  expect((await request(appFor('post', '/:paymentId', refund, 'admin')).post('/pi_other').send({ orderId: otherId })).status).toBe(404);
  expect(stripe.refunds.create).not.toHaveBeenCalled();
});
test('refund requires a cancelled or returned paid order', async () => {
  db.orders.findUnique.mockResolvedValue(order);
  expect((await request(appFor('post', '/:paymentId', refund, 'admin')).post('/pi_1').send({ orderId: otherId })).status).toBe(400);
});
test('refund is order-sized and idempotent, not the full shared payment', async () => {
  db.orders.findUnique.mockResolvedValue({ ...order, status: 'Cancelled' }); stripe.paymentIntents.retrieve.mockResolvedValue({ transfer_data: null }); stripe.refunds.create.mockResolvedValue({ id: 're_1', status: 'succeeded' }); db.orders.updateMany.mockResolvedValue({ count: 1 });
  expect((await request(appFor('post', '/:paymentId', refund, 'admin')).post('/pi_1').send({ orderId: otherId })).status).toBe(200);
  expect(stripe.refunds.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 2550, payment_intent: 'pi_1', metadata: { orderId: otherId } }), { idempotencyKey: `order-refund-${otherId}` });
  expect(db.orders.updateMany.mock.calls[0][0].data.paymentStatus).toBe('Refunded');
});
test('pending Stripe refunds are not reported as completed', async () => {
  db.orders.findUnique.mockResolvedValue({ ...order, status: 'Returned', stripeRefundId: 're_pending' }); stripe.paymentIntents.retrieve.mockResolvedValue({}); stripe.refunds.retrieve.mockResolvedValue({ id: 're_pending', status: 'pending' }); db.orders.updateMany.mockResolvedValue({ count: 1 });
  await request(appFor('post', '/:paymentId', refund, 'admin')).post('/pi_1').send({ orderId: otherId });
  expect(stripe.refunds.create).not.toHaveBeenCalled(); expect(db.orders.updateMany.mock.calls[0][0].data.paymentStatus).toBeUndefined();
});
