import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import db, { resetDb } from './mocks/prisma';
import { appFor, userId, otherId, shopId, productId } from './helpers';
import { canAdmin, adminRoles } from '@packages/utils/admin-access';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
import adminRouter from '../../apps/admin-service/src/routes/admin.route';
import orderRouter from '../../apps/order-service/src/routes/order.route';
import { submitProductReport, decideProductReport, processViolationFollowups } from '@packages/utils/product-moderation';
import { reportProduct, sellerViolations, resolveModerationTask } from '../../apps/product-service/src/controllers/product-reports.controller';
import { sellerRefund } from '../../apps/order-service/src/routes/seller-refund.controller';
import { reports, violations } from '../../apps/admin-service/src/controllers/product-reports.controller';
import { sellerRemediationRequest } from '@packages/utils/seller-remediation-access';
import { transitionOrder } from '@packages/utils/order-lifecycle';
import { stripe } from './mocks/stripe';
import { mayReadInternalLogs } from '@packages/utils/internal-logger-access';
import { notifications } from '../../apps/admin-service/src/controllers/operations.controller';

const listing = { id: productId, shopId, title: 'Listing', category: 'CPU', detailed_description: '<p>Listing text</p>', status: 'Active', isDeleted: false, shop: { sellerId: otherId } };
const pending = { id: userId, productId, shopId, category: 'Misleading', status: 'Pending' };
const decision = { decision: 'Confirm', severity: 'High', productAction: 'Hide', sellerAction: 'Warn', reason: 'Confirmed misleading listing' };
beforeEach(() => { resetDb(); db.products.findUnique.mockResolvedValue(listing); });

test.each(adminRoles)('no admin role, including %s, can grant itself order/payment/return or fulfillment access', role => {
  for (const permission of ['orders', 'payments', 'returns', 'fulfillment', 'logs'] as const) expect(canAdmin({ role: 'admin', adminRole: role }, permission)).toBe(false);
});

test.each(adminRoles)('%s sessions are blocked at every order disclosure route, including CSV and legacy endpoints', async adminRole => {
  db.users.findUnique.mockResolvedValue({ id: userId, role: 'admin', adminRole });
  const token = jwt.sign({ id: userId, role: 'admin' }, process.env.ACCESS_TOKEN_JWT_SECRET!);
  const app = express(); app.use(express.json()); app.use('/admin', adminRouter); app.use('/order', orderRouter); app.use(errorMiddleware);
  for (const path of ['/admin/orders', `/admin/orders/${otherId}`, '/admin/orders?format=csv', '/admin/payments', '/admin/returns', '/admin/logs?format=json', '/order/get-admin-orders']) {
    expect((await request(app).get(path).set('Authorization', `Bearer ${token}`)).status).toBe(403);
  }
  expect((await request(app).post(`/admin/refund/${otherId}`).set('Authorization', `Bearer ${token}`).send({ orderId: productId, reason: 'test' })).status).toBe(403);
  expect((await request(app).patch(`/admin/update-order-status/${otherId}`).set('Authorization', `Bearer ${token}`).send({ status: 'Cancelled', reason: 'test' })).status).toBe(403);
  expect(db.orders.findMany).not.toHaveBeenCalled(); expect(db.orders.findUnique).not.toHaveBeenCalled(); expect(stripe.refunds.create).not.toHaveBeenCalled();
});

test('customer source and identity are server-owned; submitted reports never enforce a product action', async () => {
  db.productReport.count.mockResolvedValue(0); db.productReport.upsert.mockImplementation(async ({ create }: any) => ({ id: userId, status: 'Pending', ...create }));
  const result = await request(appFor('post', '/:id', reportProduct)).post('/' + productId).send({ source: 'Admin', reporterId: otherId, category: 'Unsafe', reason: 'Description has unsafe claims' });
  expect(result.status).toBe(201);
  expect(db.productReport.upsert.mock.calls[0][0].create).toMatchObject({ source: 'Customer', reporterId: userId });
  expect(result.body).not.toHaveProperty('reporterId');
  expect(db.products.update).not.toHaveBeenCalled(); expect(db.sellers.update).not.toHaveBeenCalled();
});

test('customer reports are deduplicated by listing version and limited per day', async () => {
  db.productReport.upsert.mockResolvedValue({ id: userId });
  await submitProductReport(productId, userId, 'Customer', 'Unsafe', 'Unsafe claim');
  await submitProductReport(productId, userId, 'Customer', 'Unsafe', 'Duplicate claim');
  expect(db.productReport.upsert.mock.calls[0][0].where).toEqual(db.productReport.upsert.mock.calls[1][0].where);
  db.productReport.count.mockResolvedValue(10);
  expect((await request(appFor('post', '/:id', reportProduct)).post('/' + productId).send({ category: 'Other', reason: 'Another report' })).status).toBe(429);
});

test('confirming a report stores the decision, notifies seller and queues private follow-up without exposing orders', async () => {
  db.productReport.findUnique.mockResolvedValue(pending); db.sellers.update.mockResolvedValue({ id: otherId });
  db.productViolation.count.mockResolvedValue(2); db.productReport.findMany.mockResolvedValue([{ id: userId, source: 'Customer', reason: 'Evidence' }]);
  db.productViolation.create.mockImplementation(async ({ data }: any) => ({ id: shopId, ...data, affectedOrders: 0, followupStatus: 'Queued' }));
  const result = await decideProductReport(userId, otherId, decision);
  expect(db.products.update.mock.calls[0][0].data.status).toBe('Suspended');
  expect(db.productViolation.create.mock.calls[0][0].data).toMatchObject({ occurrence: 3, sellerId: otherId, productAction: 'Hide', sellerAction: 'Warn' });
  expect(db.notifications.create.mock.calls[0][0].data).toMatchObject({ sellerId: otherId, redirectUrl: '/dashboard/violations' });
  expect(JSON.stringify(result)).not.toContain('Evidence'); expect(result).not.toHaveProperty('orders');
  expect(db.orders.findMany).not.toHaveBeenCalled();
});

test('removal preserves a suspended tombstone, and suspension cannot be shortened by another decision', async () => {
  db.productReport.findUnique.mockResolvedValue(pending); db.sellers.update.mockResolvedValue({ id: otherId, suspendedAt: new Date(), suspendedUntil: null });
  db.productViolation.count.mockResolvedValue(0); db.productReport.findMany.mockResolvedValue([]); db.productViolation.create.mockResolvedValue({ id: shopId });
  await decideProductReport(userId, otherId, { ...decision, productAction: 'Remove', sellerAction: 'Suspend', until: '2099-01-01' });
  expect(db.products.update.mock.calls[0][0].data).toMatchObject({ status: 'Suspended', isDeleted: true, deleteAt: null });
  expect(db.sellers.update.mock.calls[1][0].data.suspendedUntil).toBeNull();
});

test('dismissal creates no violation and cannot hide or suspend; reviewed reports cannot be confirmed again', async () => {
  db.productReport.findUnique.mockResolvedValue(pending);
  await decideProductReport(userId, otherId, { decision: 'Dismiss', reason: 'No supporting evidence' });
  expect(db.productViolation.create).not.toHaveBeenCalled(); expect(db.products.update).not.toHaveBeenCalled();
  db.productReport.findUnique.mockResolvedValue({ ...pending, status: 'Confirmed' });
  await expect(decideProductReport(userId, otherId, decision)).rejects.toThrow('already been reviewed');
});

test('private follow-up holds only unshipped orders and admin history fields exclude order identifiers and reporter identity', async () => {
  db.productViolation.findFirst.mockResolvedValue({ id: userId, productId, shopId, sellerId: otherId, productTitle: 'Listing', reason: 'Unsafe', createdAt: new Date(), followupRevision: 0 });
  db.orders.findMany.mockResolvedValue([{ id: productId, userId, status: 'Processing' }, { id: otherId, userId, status: 'Delivered' }]);
  expect(await processViolationFollowups()).toBe(2);
  expect(db.orders.updateMany).toHaveBeenCalledTimes(1);
  expect(db.orders.updateMany.mock.calls[0][0].data.moderationHold).toBe(true);
  expect(db.moderationOrderTask.create).toHaveBeenCalledTimes(2);
  expect(db.productViolation.update.mock.calls.at(-1)[0].data).toMatchObject({ followupStatus: 'Complete', affectedOrders: { increment: 2 } });
  db.productReport.findMany.mockResolvedValue([]); db.productReport.count.mockResolvedValue(0); db.productViolation.findMany.mockResolvedValue([]); db.productViolation.count.mockResolvedValue(0);
  await request(appFor('get', '/', reports, 'admin')).get('/');
  await request(appFor('get', '/', violations, 'admin')).get('/');
  expect(db.productReport.findMany.mock.calls.at(-1)[0].select.reporterId).toBeUndefined();
  expect(db.productViolation.findMany.mock.calls.at(-1)[0].select.followupCursor).toBeUndefined();
  expect(db.productViolation.findMany.mock.calls.at(-1)[0].select.reports).toBeUndefined();
});

test('held or suspended-product orders cannot be shipped even before the worker reaches them', async () => {
  db.orders.findFirst.mockResolvedValue({ id: productId, status: 'Processing', items: [{ productId }], moderationHold: false }); db.products.count.mockResolvedValue(1);
  await expect(transitionOrder(productId, 'Shipped', { shopId }, userId)).rejects.toThrow('fulfillment is blocked');
  expect(db.orders.update).not.toHaveBeenCalled();
});

test('seller follow-up scopes and resolution block other shops and unfinished refunds', async () => {
  db.productViolation.findMany.mockResolvedValue([]); db.productViolation.count.mockResolvedValue(0);
  expect((await request(appFor('get', '/', sellerViolations, 'seller')).get(`/?sellerId=${otherId}`)).status).toBe(200);
  expect(db.productViolation.findMany.mock.calls[0][0].where).toEqual({ sellerId: userId });
  db.moderationOrderTask.findFirst.mockResolvedValue({ id: userId, shopId, orderId: productId });
  db.orders.findFirst.mockResolvedValue({ id: productId, moderationHold: true, status: 'Processing', paymentStatus: 'Paid' });
  const app = appFor('patch', '/:id', resolveModerationTask, 'seller');
  expect((await request(app).patch('/' + userId).send({ resolution: 'Ignore the hold' })).status).toBe(400);
  db.orders.findFirst.mockResolvedValue({ id: productId, moderationHold: true, status: 'Cancelled', paymentStatus: 'Paid' });
  expect((await request(app).patch('/' + userId).send({ resolution: 'Refund not done yet' })).status).toBe(400);
  expect(db.moderationOrderTask.update).not.toHaveBeenCalled();
});

test('seller refunds are bound to the authenticated shop before any provider call', async () => {
  db.orders.findUnique.mockResolvedValue(null);
  const result = await request(appFor('post', '/:orderId', sellerRefund, 'seller')).post('/' + productId).send({ reason: 'Refund related purchase' });
  expect(result.status).toBe(404);
  expect(db.orders.findUnique.mock.calls[0][0].where).toEqual({ id: productId, shopId });
  expect(stripe.refunds.create).not.toHaveBeenCalled();
});

test('suspended-seller exceptions cover remediation only, never publishing or unrelated APIs', () => {
  expect(sellerRemediationRequest('/seller-refund/' + productId, 'POST')).toBe(true);
  expect(sellerRemediationRequest('/api/seller-moderation-tasks', 'GET')).toBe(true);
  expect(sellerRemediationRequest('/api/create-product', 'POST')).toBe(false);
  expect(sellerRemediationRequest('/api/update-product/' + productId, 'PUT')).toBe(false);
  expect(sellerRemediationRequest('/admin/orders', 'GET')).toBe(false);
});

test('raw logger connections require a server-only credential, never an admin bearer token', () => {
  const internal = 'x'.repeat(32);
  expect(mayReadInternalLogs(undefined, internal)).toBe(false);
  expect(mayReadInternalLogs('Bearer admin-jwt', internal)).toBe(false);
  expect(mayReadInternalLogs('Bearer ' + internal, internal)).toBe(true);
  expect(mayReadInternalLogs('Bearer short', 'short')).toBe(false);
});

test('admin notification lists exclude linked order records and legacy platform-order messages', async () => {
  db.notifications.findMany.mockResolvedValue([]); db.notifications.count.mockResolvedValue(0);
  const result = await request(appFor('get', '/', notifications, 'admin')).get('/');
  expect(result.status).toBe(200);
  expect(db.notifications.findMany.mock.calls[0][0].where).toMatchObject({ NOT: { title: 'New platform order' }, AND: [{ OR: [{ orderId: null }, { orderId: { isSet: false } }] }] });
});
