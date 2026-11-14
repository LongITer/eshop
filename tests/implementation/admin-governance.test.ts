import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import db, { resetDb } from './mocks/prisma';
import { appFor, userId, otherId, productId, shopId } from './helpers';
import { adminPermission } from '@packages/middleware/adminPermission';
import isAuthenticated from '@packages/middleware/isAuthenticated';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
import { addAdmin, getAllAdmin, getAllUsers, getAllProducts, updateSiteConfig } from '../../apps/admin-service/src/controllers/admin.controller';
import { suspendAccount, moderateProduct, reviewReturn } from '../../apps/admin-service/src/controllers/governance.controller';
import { updateProduct } from '../../apps/product-service/src/controllers/product-management.controller';
import { adminDateRange, reportDay } from '../../apps/admin-service/src/lib/reporting';
import { isSuspended } from '@packages/utils/admin-access';
import { queueNotification } from '../../apps/admin-service/src/controllers/notification-jobs.controller';
import { updateStatus, logs, payments } from '../../apps/admin-service/src/controllers/operations.controller';
import { trustedCartItems } from '../../apps/order-service/src/routes/checkout-quote';
import { stripe } from './mocks/stripe';
beforeEach(resetDb);
test('Stripe outage does not hide the refund queue or database revenue', async () => {
  stripe.paymentIntents.list.mockRejectedValue(new Error('Unavailable'));
  db.orders.findMany.mockResolvedValue([{ id: otherId, status: 'Cancelled', paymentStatus: 'Paid' }]);
  db.orders.count.mockResolvedValue(1); db.orders.groupBy.mockResolvedValue([]); db.orders.aggregateRaw.mockResolvedValue([]); db.shops.findMany.mockResolvedValue([]);
  const response = await request(appFor('get', '/', payments, 'admin')).get('/');
  expect(response.status).toBe(200); expect(response.body.stripeUnavailable).toBe(true); expect(response.body.orders).toHaveLength(1);
});
test('admin cannot bypass return inspection through generic status changes', async () => {
  expect((await request(appFor('patch', '/:orderId', updateStatus, 'admin')).patch('/' + otherId).send({ status: 'Returned', reason: 'test' })).status).toBe(400);
  expect(db.orders.update).not.toHaveBeenCalled();
});
test('suspended sellers cannot receive new checkout orders', async () => {
  db.products.findMany.mockResolvedValue([{ id: productId, shop: { sellers: { suspendedAt: new Date(), suspendedUntil: null } } }]);
  await expect(trustedCartItems([{ id: productId, quantity: 1 }])).rejects.toThrow('unavailable');
});
test('activity chart aggregates all matched events in Vietnam time', async () => {
  db.behaviorLog.findMany.mockResolvedValue([]); db.behaviorLog.count.mockResolvedValue(60000);
  db.behaviorLog.aggregateRaw.mockResolvedValue([{ _id: '2026-10-12', views: 60000, cartAdds: 0, purchases: 0 }]);
  const response = await request(appFor('get', '/', logs, 'admin')).get('/?from=2026-10-12&to=2026-10-12');
  expect(response.body.timeline[0].views).toBe(60000); expect(response.body.chartTruncated).toBe(false);
  expect(db.behaviorLog.aggregateRaw.mock.calls[0][0].pipeline[1].$group._id.$dateToString.timezone).toBe('Asia/Ho_Chi_Minh');
});
const owner = { id: userId, role: 'admin', adminRole: 'owner' };
test('admin listing selects public account fields only', async () => {
  db.users.findMany.mockResolvedValue([]);
  expect((await request(appFor('get', '/', getAllAdmin, 'admin')).get('/')).status).toBe(200);
  expect(db.users.findMany.mock.calls[0][0].select.password).toBeUndefined();
  expect(db.users.findMany.mock.calls[0][0].select.email).toBe(true);
});
test('owner cannot revoke own access, preserving the last owner', async () => {
  db.users.findUnique.mockResolvedValue(owner); db.users.findFirst.mockResolvedValue({ ...owner, email: 'owner@example.test' });
  const result = await request(appFor('post', '/', addAdmin, 'admin')).post('/').send({ email: 'owner@example.test', role: 'user', reason: 'test' });
  expect(result.status).toBe(400); expect(db.users.update).not.toHaveBeenCalled();
});
test('role change rechecks owner privilege inside the transaction', async () => {
  db.users.findUnique.mockResolvedValue({ ...owner, adminRole: 'support' });
  expect((await request(appFor('post', '/', addAdmin, 'admin')).post('/').send({ email: 'other@example.test', role: 'admin', reason: 'test' })).status).toBe(403);
  expect(db.users.update).not.toHaveBeenCalled();
});
test('seller cannot be assigned through administrator promotion', async () => {
  expect((await request(appFor('post', '/', addAdmin, 'admin')).post('/').send({ email: 'other@example.test', role: 'seller', reason: 'test' })).status).toBe(400);
});
test.each(['team', 'fulfillment', 'settings', 'catalog'] as const)('finance cannot access %s', async permission => {
  const app = express(); app.use((req: any, _res, next) => { req.user = { ...owner, adminRole: 'finance' }; req.role = 'admin'; next(); });
  app.get('/', adminPermission(permission), (_req, res) => res.json({ ok: true })); app.use(errorMiddleware);
  expect((await request(app).get('/')).status).toBe(403);
});
test('unknown explicit admin role fails closed', async () => {
  const app = express(); app.use((req: any, _res, next) => { req.user = { ...owner, adminRole: 'typo' }; req.role = 'admin'; next(); });
  app.get('/', adminPermission('payments'), (_req, res) => res.sendStatus(200)); app.use(errorMiddleware);
  expect((await request(app).get('/')).status).toBe(403);
});
test('active suspension invalidates an already issued session', async () => {
  db.users.findUnique.mockResolvedValue({ ...owner, suspendedAt: new Date(), suspendedUntil: null });
  const app = express(); app.get('/', isAuthenticated, (_req, res) => res.sendStatus(200));
  const token = jwt.sign({ id: userId, role: 'admin' }, process.env.ACCESS_TOKEN_JWT_SECRET!);
  expect((await request(app).get('/').set('Authorization', `Bearer ${token}`)).status).toBe(403);
});
test('expired suspension stops blocking accounts', () => {
  expect(isSuspended({ suspendedAt: new Date(0), suspendedUntil: new Date(100) }, 101)).toBe(false);
  expect(isSuspended({ suspendedAt: new Date(0), suspendedUntil: null }, 101)).toBe(true);
});
test('administrators cannot be suspended through customer management', async () => {
  db.users.findUnique.mockResolvedValue({ id: otherId, role: 'admin' });
  const result = await request(appFor('patch', '/:kind/:id', suspendAccount, 'admin')).patch(`/users/${otherId}`).send({ suspended: true, reason: 'test' });
  expect(result.status).toBe(400); expect(db.users.update).not.toHaveBeenCalled();
});
test('account suspension stores reason and audit in its transaction', async () => {
  db.users.findUnique.mockResolvedValue({ id: otherId, role: 'user' });
  const result = await request(appFor('patch', '/:kind/:id', suspendAccount, 'admin')).patch(`/users/${otherId}`).send({ suspended: true, reason: 'Abuse report' });
  expect(result.status).toBe(200); expect(db.users.update.mock.calls[0][0].data.suspensionReason).toBe('Abuse report');
  expect(db.adminAudit.create.mock.calls[0][0].data.action).toBe('users.suspend');
});
test('mixed user/admin list uses one server-side filter and bounded pagination', async () => {
  db.users.findMany.mockResolvedValue([]); db.users.count.mockResolvedValue(0);
  const response = await request(appFor('get', '/', getAllUsers, 'admin')).get('/?role=all&page=-10&limit=999999&search=abc');
  expect(response.status).toBe(200); expect(response.body.totalPages).toBe(1);
  expect(db.users.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 100, where: { role: { in: ['user', 'admin'] }, OR: expect.any(Array) } });
});
test('product CSV exports past one batch and escapes formulas and quotes', async () => {
  const rows = Array.from({ length: 501 }, (_, i) => ({ id: String(i).padStart(24, '0'), title: i === 500 ? '=SUM(1,2)' : 'A "quoted" title', sale_price: 25.5, stock: 1, category: 'PC', rating: 4, shop: { name: 'Shop' }, status: 'Active', isDeleted: false }));
  db.products.findMany.mockResolvedValueOnce(rows.slice(0, 500)).mockResolvedValueOnce(rows.slice(500));
  const result = await request(appFor('get', '/', getAllProducts, 'admin')).get('/?format=csv&search=PC');
  expect(result.status).toBe(200); expect(result.text).toContain("'=SUM(1,2)"); expect(result.text).toContain('A ""quoted"" title');
  expect(db.products.findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: rows[499].id }, skip: 1 });
});
test('moderation restores to Inactive and informs the seller', async () => {
  db.products.findUnique.mockResolvedValue({ id: productId, title: 'CPU', status: 'Suspended', shop: { sellerId: otherId } });
  db.products.update.mockResolvedValue({ id: productId, status: 'Inactive' });
  const response = await request(appFor('patch', '/:id', moderateProduct, 'admin')).patch('/' + productId).send({ hidden: false, reason: 'Corrected listing' });
  expect(response.status).toBe(200); expect(response.body.product.status).toBe('Inactive'); expect(db.notifications.create.mock.calls[0][0].data.sellerId).toBe(otherId);
});
test('seller cannot reactivate a suspended product', async () => {
  db.products.findFirst.mockResolvedValue({ id: productId, status: 'Suspended' });
  expect((await request(appFor('put', '/:id', updateProduct, 'seller')).put('/' + productId).send({ status: 'Active' })).status).toBe(400);
  expect(db.products.update).not.toHaveBeenCalled();
});
test('admin cannot mark a requested return as received without approval', async () => {
  db.returnRequest.findUnique.mockResolvedValue({ id: productId, status: 'Requested' }); db.orders.findUnique.mockResolvedValue({ id: otherId, status: 'Delivered', paymentStatus: 'Paid' });
  expect((await request(appFor('patch', '/:orderId', reviewReturn, 'admin')).patch('/' + otherId).send({ status: 'Received', reason: 'test' })).status).toBe(400);
  expect(db.orders.update).not.toHaveBeenCalled();
});
test('receiving an approved return makes it refundable but does not restock unchecked goods', async () => {
  db.returnRequest.findUnique.mockResolvedValue({ id: productId, status: 'Approved' }); db.orders.findUnique.mockResolvedValue({ id: otherId, userId, shopId, status: 'Delivered', paymentStatus: 'Paid' });
  db.shops.findUniqueOrThrow.mockResolvedValue({ sellerId: userId });
  const result = await request(appFor('patch', '/:orderId', reviewReturn, 'admin')).patch('/' + otherId).send({ status: 'Received', reason: 'Inspected receipt' });
  expect(result.status).toBe(200); expect(db.orders.update.mock.calls[0][0].data.status).toBe('Returned'); expect(db.products.update).not.toHaveBeenCalled();
});
test('date filters use Vietnam midnight boundaries', () => {
  const range = adminDateRange({ from: '2026-10-12', to: '2026-10-12' });
  expect(range.gte.toISOString()).toBe('2026-10-11T17:00:00.000Z'); expect(range.lte.toISOString()).toBe('2026-10-12T16:59:59.999Z');
  expect(reportDay(new Date('2026-10-11T17:00:00Z'))).toBe('2026-10-12');
});
test('site config rejects embedded base64 images', async () => {
  expect((await request(appFor('patch', '/', updateSiteConfig, 'admin')).patch('/').send({ logo: 'data:image/png;base64,abc' })).status).toBe(400);
});
test('broadcast requires confirmation before queuing', async () => {
  expect((await request(appFor('post', '/', queueNotification, 'admin')).post('/').send({ title: 'Title', message: 'Message', audience: 'users', requestKey: 'key' })).status).toBe(400);
  expect(db.notificationJob.upsert).not.toHaveBeenCalled();
});
