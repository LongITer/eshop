import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { errorMiddleware } from '@packages/error-handler/error-middleware';
jest.mock('stripe', () => require('../implementation/mocks/stripe'));
jest.mock('@packages/libs/redis', () => ({ __esModule: true, default: {} }));
jest.mock('@packages/utils/logs/behavior-log', () => ({ sendBehaviorLog: jest.fn() }));

let replica: MongoMemoryReplSet, db: any, moderation: any, sellerController: any, refund: any;
let product: any, shop: any, seller: any, buyer: any, held: any, delivered: any;
const secret = 'isolated-moderation-secret';
function appFor(handler: any, method = 'get', withShop = true) {
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { req.seller = { ...seller, shop: withShop ? shop : { id: '111111111111111111111111' } }; next(); });
  (app as any)[method]('/:id?', handler); app.use(errorMiddleware); return app;
}
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.DATABASE_URL = replica.getUri('product_moderation_tests');
  process.env.ACCESS_TOKEN_JWT_SECRET = secret;
  if (!process.env.DATABASE_URL.startsWith('mongodb://127.0.0.1:')) throw new Error('Disposable local database required');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: { ...process.env }, windowsHide: true });
    let out = ''; child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { out += chunk; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Schema setup timed out')); }, 90000);
    child.on('error', error => { clearTimeout(timer); reject(error); }); child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(out)); });
  });
  db = require('@packages/libs/prisma').default;
  moderation = require('@packages/utils/product-moderation');
  sellerController = require('../../apps/product-service/src/controllers/product-reports.controller');
  refund = require('@packages/utils/seller-order-refund');
  seller = await db.sellers.create({ data: { name: 'Moderation Seller', email: 'moderation-seller@example.test', phone_number: '123', country: 'Vietnam' } });
  shop = await db.shops.create({ data: { name: 'Moderation Shop', sellerId: seller.id } });
  buyer = await db.users.create({ data: { name: 'Private buyer', email: 'private-buyer@example.test', following: [] } });
  product = await db.products.create({ data: { title: 'Moderation CPU', slug: 'moderation-cpu', category: 'CPU', subCategory: 'CPU', detailed_description: 'Original listing text', tags: [], colors: [], sizes: [], stock: 8, sale_price: 20, regular_price: 20, totalSales: 2, warranty: '1 year', shopId: shop.id, discount_codes: [] } });
  const purchase = (orderNumber: string, status: string) => db.orders.create({ data: { orderNumber, userId: buyer.id, shopId: shop.id, subTotal: 20, totalAmount: 20, status, paymentStatus: 'Paid', stripePaymentId: 'pi_moderation', shippingAddress: { name: 'Private buyer', street: 'Private address' }, items: { create: [{ productId: product.id, title: product.title, quantity: 1, unitPrice: 20, totalPrice: 20 }] } } });
  held = await purchase('PRIVATE-PENDING', 'Pending'); delivered = await purchase('PRIVATE-DELIVERED', 'Delivered');
}, 180000);
afterAll(async () => { await db?.$disconnect(); await replica?.stop(); });

test('a customer report is pending, cannot hide a product, and repeats are deduplicated', async () => {
  const first = await moderation.submitProductReport(product.id, buyer.id, 'Customer', 'Misleading', 'Listing evidence');
  const duplicate = await moderation.submitProductReport(product.id, buyer.id, 'Customer', 'Misleading', 'Repeated evidence');
  expect(first.id).toBe(duplicate.id);
  expect((await db.products.findUnique({ where: { id: product.id } })).status).toBe('Active');
});

test('confirmation and concurrent follow-up hide the listing, retain history and hold only unshipped orders', async () => {
  const pending = await db.productReport.findFirst({ where: { productId: product.id } });
  const result = await moderation.decideProductReport(pending.id, buyer.id, { decision: 'Confirm', reason: 'Confirmed misleading claims', severity: 'High', productAction: 'Hide', sellerAction: 'Warn' });
  expect(result.violation.occurrence).toBe(1);
  expect(result.violation).not.toHaveProperty('reports');
  expect(result.violation).not.toHaveProperty('followupCursor');
  await Promise.all([moderation.processViolationFollowups(), moderation.processViolationFollowups()]);
  expect(await db.moderationOrderTask.count()).toBe(2);
  expect((await db.orders.findUnique({ where: { id: held.id } })).moderationHold).toBe(true);
  expect((await db.orders.findUnique({ where: { id: delivered.id } })).moderationHold).toBe(false);
  expect((await db.productViolation.findUnique({ where: { id: result.violation.id } }))).toMatchObject({ affectedOrders: 2, followupStatus: 'Complete' });
  expect(await db.notifications.count({ where: { sellerId: seller.id } })).toBe(3);
  await expect(moderation.decideProductReport(pending.id, buyer.id, { decision: 'Confirm', reason: 'Duplicate', severity: 'High', productAction: 'Hide', sellerAction: 'Warn' })).rejects.toThrow('already been reviewed');
});

test('seller can cancel a held order, restock once, refund it and resolve its private task', async () => {
  const { transitionOrder } = require('@packages/utils/order-lifecycle');
  await expect(transitionOrder(held.id, 'Confirmed', { shopId: shop.id }, seller.id)).rejects.toThrow('fulfillment is blocked');
  const task = await db.moderationOrderTask.findFirst({ where: { orderId: held.id } });
  const taskApp = appFor(sellerController.resolveModerationTask, 'patch');
  expect((await request(taskApp).patch('/' + task.id).send({ resolution: 'Tried to ignore hold' })).status).toBe(400);
  await transitionOrder(held.id, 'Cancelled', { shopId: shop.id }, seller.id, { reason: 'Product violation' });
  await transitionOrder(held.id, 'Cancelled', { shopId: shop.id }, seller.id, { reason: 'Retry cancellation' });
  expect((await db.products.findUnique({ where: { id: product.id } })).stock).toBe(9);
  expect((await request(taskApp).patch('/' + task.id).send({ resolution: 'Refund not complete' })).status).toBe(400);
  const { stripe } = require('../implementation/mocks/stripe');
  stripe.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_moderation' });
  stripe.refunds.list.mockReturnValue({ async *[Symbol.asyncIterator]() {} });
  stripe.refunds.create.mockResolvedValue({ id: 're_moderation', payment_intent: 'pi_moderation', amount: 2000, currency: 'usd', status: 'succeeded', metadata: { orderId: held.id } });
  await expect(refund.refundSellerOrder(held.id, '111111111111111111111111', seller.id, 'Wrong shop')).rejects.toThrow('not found');
  await refund.refundSellerOrder(held.id, shop.id, seller.id, 'Refund confirmed violation');
  expect(stripe.refunds.create).toHaveBeenCalledTimes(1);
  expect((await request(taskApp).patch('/' + task.id).send({ resolution: 'Cancelled and refunded' })).status).toBe(200);
});

test('repeat violations retain previous history and a suspended seller has remediation-only access', async () => {
  const report = await moderation.submitProductReport(product.id, buyer.id, 'Admin', 'Unsafe', 'New evidence');
  await moderation.decideProductReport(report.id, buyer.id, { decision: 'Confirm', reason: 'Repeat severe violation', severity: 'Critical', productAction: 'Remove', sellerAction: 'Suspend' });
  expect(await db.productViolation.count({ where: { sellerId: seller.id } })).toBe(2);
  expect((await db.productViolation.findFirst({ orderBy: { createdAt: 'desc' } })).occurrence).toBe(2);
  expect((await db.products.findUnique({ where: { id: product.id } }))).toMatchObject({ isDeleted: true, status: 'Suspended', deleteAt: null });
  const auth = require('@packages/middleware/isAuthenticated').default;
  const getSeller = require('../../apps/auth-service/src/controllers/auth.controller').getSeller;
  const app = express(); app.get('/api/seller-violations', auth, (_req, res) => res.json({ ok: true })); app.post('/api/create-product', auth, (_req, res) => res.json({ ok: true }));
  app.get('/api/logged-in-seller', auth, getSeller);
  const token = jwt.sign({ id: seller.id, role: 'seller' }, secret);
  expect((await request(app).get('/api/seller-violations').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  expect((await request(app).post('/api/create-product').set('Authorization', `Bearer ${token}`)).status).toBe(403);
  const account = await request(app).get('/api/logged-in-seller').set('Authorization', `Bearer ${token}`);
  expect(account.status).toBe(200);
  expect(account.body.seller.suspendedAt).toBeTruthy();
  expect(account.body.seller).not.toHaveProperty('password');
});
