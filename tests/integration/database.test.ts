import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { errorMiddleware } from '@packages/error-handler/error-middleware';

jest.mock('@packages/libs/imagekit', () => ({ imageKit: { upload: jest.fn() } }));
jest.mock('@packages/utils/logs/behavior-log', () => ({ sendBehaviorLog: jest.fn() }));
jest.mock('stripe', () => require('../implementation/mocks/stripe'));
jest.mock('../../apps/order-service/src/utils/send-email', () => ({ sendEmail: jest.fn() }));
let replica: MongoMemoryReplSet;
let db: any;
let account: any;
let product: any;
let ops: any;
let reports: any;
let recommend: any;
let transitionOrder: any;
let buyer: any; let buyer2: any; let seller: any; let shop: any; let item: any;

function appFor(handler: any, actor = buyer, role = 'user', method = 'post', route = '/') {
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { req.user = actor; req.seller = { ...seller, shop }; req.role = role; next(); });
  (app as any)[method](route, handler); app.use(errorMiddleware); return app;
}
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.DATABASE_URL = replica.getUri('implementation_tests');
  if (!process.env.DATABASE_URL.startsWith('mongodb://127.0.0.1:')) throw new Error('Integration tests must use local disposable MongoDB');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: { ...process.env }, windowsHide: true });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Prisma test schema timed out: ' + output)); }, 90000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(output)); });
  });
  db = require('@packages/libs/prisma').default;
  account = require('../../apps/auth-service/src/controllers/account.controller');
  product = require('../../apps/product-service/src/controllers/product-management.controller');
  ops = require('../../apps/admin-service/src/controllers/operations.controller');
  reports = require('../../apps/product-service/src/controllers/reports.controller');
  recommend = require('../../apps/recommendation-service/src/controllers/recommendation.controller');
  transitionOrder = require('@packages/utils/order-lifecycle').transitionOrder;
  buyer = await db.users.create({ data: { name: 'Buyer', email: 'buyer@example.test', following: [] } });
  buyer2 = await db.users.create({ data: { name: 'Buyer Two', email: 'buyer2@example.test', following: [] } });
  seller = await db.sellers.create({ data: { name: 'Seller', email: 'seller@example.test', phone_number: '123456789', country: 'Vietnam' } });
  shop = await db.shops.create({ data: { name: 'Test Shop', sellerId: seller.id } });
  item = await db.products.create({ data: { title: 'CPU', slug: 'test-cpu', category: 'PC', subCategory: 'CPU', detailed_description: 'Test CPU', tags: ['gaming'], colors: ['black'], sizes: [], stock: 10, sale_price: 80, regular_price: 100, warranty: '1 year', shopId: shop.id, discount_codes: [] } });
}, 180000);
afterAll(async () => { await db?.$disconnect(); await replica?.stop(); });

test('real MongoDB notification ownership and read-all isolation', async () => {
  const own = await db.notifications.create({ data: { userId: buyer.id, title: 'Own', message: 'Own', type: 'System' } });
  const foreign = await db.notifications.create({ data: { userId: buyer2.id, title: 'Other', message: 'Other', type: 'System' } });
  expect((await request(appFor(account.readNotification, buyer, 'user', 'patch', '/:id')).patch('/' + foreign.id)).status).toBe(404);
  expect((await request(appFor(account.readAllNotifications, buyer, 'user', 'patch')).patch('/')).status).toBe(200);
  expect((await db.notifications.findUnique({ where: { id: own.id } })).isRead).toBe(true);
  expect((await db.notifications.findUnique({ where: { id: foreign.id } })).isRead).toBe(false);
});
test('concurrent follows do not duplicate shop IDs', async () => {
  const app = appFor(account.followShop, buyer, 'user', 'post', '/:shopId');
  const responses = await Promise.all(Array.from({ length: 5 }, () => request(app).post('/' + shop.id)));
  expect(responses.every(r => r.status === 200)).toBe(true);
  expect((await db.users.findUnique({ where: { id: buyer.id } })).following).toEqual([shop.id]);
});

test('concurrent default-address edits and creation keep one default', async () => {
  const fields = { label: 'Home', name: 'Buyer', street: '1 Street', city: 'Saigon', zip: '70000', country: 'Vietnam', isDefault: false };
  const a = await db.address.create({ data: { ...fields, userId: buyer.id } });
  const b = await db.address.create({ data: { ...fields, userId: buyer.id } });
  const app = appFor(account.updateAddress, buyer, 'user', 'put', '/:addressId');
  const results = await Promise.all([
    request(app).put('/' + a.id).send({ ...fields, isDefault: true }),
    request(app).put('/' + b.id).send({ ...fields, isDefault: true }),
    request(appFor(account.addAddress)).post('/').send({ ...fields, isDefault: true }),
  ]);
  expect(results.map(r => r.status)).toEqual([200, 200, 201]);
  expect(await db.address.count({ where: { userId: buyer.id, isDefault: true } })).toBe(1);
});
test('profile avatar relation is replaced correctly', async () => {
  const app = appFor(account.updateUser, buyer, 'user', 'put');
  expect((await request(app).put('/').send({ name: 'Renamed', avatar: { url: 'https://ik.imagekit.io/test/one.png', file_id: 'one' } })).status).toBe(200);
  expect((await request(app).put('/').send({ name: 'Renamed', avatar: { url: 'https://ik.imagekit.io/test/two.png', file_id: 'two' } })).status).toBe(200);
  const saved = await db.users.findUnique({ where: { id: buyer.id }, include: { avatar: true } });
  expect(saved.avatar.map((a: any) => a.file_id)).toEqual(['two']);
});
test('product update persists variants, images, stock history and low-stock notification', async () => {
  const response = await request(appFor(product.updateProduct, seller, 'seller', 'put', '/:id')).put('/' + item.id).send({ stock: 3, colors: ['black', 'white'], sizes: ['Large'], images: [{ url: 'https://ik.imagekit.io/test/product.png', file_id: 'product-image' }] });
  expect(response.status).toBe(200); expect(response.body.product.stock).toBe(3);
  expect(await db.inventoryHistory.count({ where: { productId: item.id, delta: -7 } })).toBe(1);
  expect(await db.notifications.count({ where: { sellerId: seller.id, type: 'LowStock' } })).toBe(1);
});

test('a full prefilled product payload can save nullable optional fields', async () => {
  const current = await db.products.findUnique({ where: { id: item.id }, include: { images: true } });
  const response = await request(appFor(product.updateProduct, seller, 'seller', 'put', '/:id')).put('/' + item.id).send({ ...current, brand: null, video_url: null, custom_specification: null, custom_properties: null, colors: ['Black', 'White'] });
  expect(response.status).toBe(200);
  expect(response.body.product.colors).toEqual(['Black', 'White']);
});

test('shop settings accepts untouched optional nulls and persists social links', async () => {
  const current = await db.shops.findUnique({ where: { id: shop.id } });
  const response = await request(appFor(account.updateShop, seller, 'seller', 'put', '/:shopId')).put('/' + shop.id).send({ ...current, bio: 'Updated shop', socialLinks: [{ name: 'website', url: 'https://example.test' }] });
  expect(response.status).toBe(200);
  expect(response.body.shop.bio).toBe('Updated shop');
  expect(response.body.shop.socialLinks).toEqual([{ name: 'website', url: 'https://example.test' }]);
});
async function orderFor(userId: string, status: string, number: string) {
  return db.orders.create({ data: { userId, shopId: shop.id, orderNumber: number, status, paymentStatus: 'Paid', subTotal: 160, totalAmount: 160, shippingAddress: { name: 'Buyer', street: 'Street' }, items: { create: { productId: item.id, title: item.title, quantity: 2, unitPrice: 80, totalPrice: 160 } } } });
}
test('concurrent delivered-buyer reviews keep the correct aggregate rating', async () => {
  await orderFor(buyer.id, 'Delivered', 'REVIEW-1'); await orderFor(buyer2.id, 'Delivered', 'REVIEW-2');
  const results = await Promise.all([request(appFor(product.createReview, buyer)).post('/').send({ productId: item.id, rating: 5, comment: 'Great' }), request(appFor(product.createReview, buyer2)).post('/').send({ productId: item.id, rating: 3, comment: 'Okay' })]);
  expect(results.map(r => r.status)).toEqual([201, 201]);
  expect(await db.productReviews.count({ where: { productId: item.id } })).toBe(2);
  expect((await db.products.findUnique({ where: { id: item.id } })).rating).toBe(4);
});
test('concurrent cancellation restores inventory exactly once', async () => {
  const order = await orderFor(buyer.id, 'Pending', 'CANCEL-1');
  const before = await db.products.findUnique({ where: { id: item.id } });
  const results = await Promise.allSettled([transitionOrder(order.id, 'Cancelled', { userId: buyer.id, status: 'Pending' }, buyer.id), transitionOrder(order.id, 'Cancelled', { userId: buyer.id, status: 'Pending' }, buyer.id)]);
  expect(results.some(r => r.status === 'fulfilled')).toBe(true);
  expect((await db.products.findUnique({ where: { id: item.id } })).stock).toBe(before.stock + 2);
  expect(await db.inventoryHistory.count({ where: { reason: 'Cancellation CANCEL-1' } })).toBe(1);
});
test('revenue reports and admin charts exclude cancelled revenue', async () => {
  const result = await request(appFor(reports.revenueReport, seller, 'seller', 'get')).get('/');
  expect(result.status).toBe(200); expect(result.body.totalRevenue).toBe(320); expect(result.body.topProducts[0].quantity).toBe(4);
  const admin = await request(appFor(ops.dashboard, buyer, 'admin', 'get')).get('/');
  expect(admin.status).toBe(200); expect(admin.body.stats.revenue).toBe(320);
});
test('real content recommendations omit deleted and out-of-stock products', async () => {
  await db.products.create({ data: { ...Object.fromEntries(Object.entries(item).filter(([key]) => !['id','createdAt','updatedAt','deleteAt'].includes(key))), slug: 'hidden-cpu', stock: 0 } });
  const result = await request(appFor(recommend.trending, buyer, 'user', 'get')).get('/');
  expect(result.status).toBe(200); expect(result.body.products.map((p: any) => p.slug)).toEqual(['test-cpu']);
});

test('paid webhook commits order, coupon usage, stock history and receipt atomically and is replay-safe', async () => {
  const { stripe } = require('../implementation/mocks/stripe');
  const { paymentWebhook } = require('../../apps/order-service/src/routes/payment-webhook.controller');
  const coupon = await db.discountCodes.create({ data: { public_name: 'Save 10', discountType: 'fixed', discountValue: 10, discountCode: 'SAVE10', sellerId: seller.id } });
  await db.products.update({ where: { id: item.id }, data: { stock: 10 } });
  await db.paymentSession.create({ data: { id: 'checkout-integration', userId: buyer.id, expiresAt: new Date(Date.now() + 600000), payload: { totalAmount: 70, shippingAddress: { name: buyer.name, street: 'Street' }, coupon: { id: coupon.id, discountAmount: 10, discountedProductId: item.id }, cart: [{ id: item.id, shopId: shop.id, title: item.title, sale_price: 80, quantity: 1, image: null, selectedOptions: {} }] } } });
  stripe.webhooks.constructEvent.mockReturnValue({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_integration', amount_received: 7000, currency: 'usd', metadata: { sessionId: 'checkout-integration', userId: buyer.id } } } });
  const app = appFor(paymentWebhook);
  expect((await request(app).post('/')).status).toBe(200);
  expect((await request(app).post('/')).body.duplicate).toBe(true);
  expect(await db.orders.count({ where: { stripePaymentId: 'pi_integration' } })).toBe(1);
  const saved = await db.orders.findFirst({ where: { stripePaymentId: 'pi_integration' } });
  expect(saved.totalAmount).toBe(70); expect(saved.discountCodeId).toBe(coupon.id);
  expect((await db.products.findUnique({ where: { id: item.id } })).stock).toBe(9);
  expect(await db.paymentReceipt.count({ where: { id: 'pi_integration' } })).toBe(1);
  const report = await request(appFor(reports.revenueReport, seller, 'seller', 'get')).get('/');
  expect(report.body.coupons).toEqual([expect.objectContaining({ code: 'SAVE10', uses: 1, discount: 10 })]);
});

test('stock failure rolls back paid fulfillment and leaves webhook eligible for retry', async () => {
  const { stripe } = require('../implementation/mocks/stripe');
  const { paymentWebhook } = require('../../apps/order-service/src/routes/payment-webhook.controller');
  await db.paymentSession.create({ data: { id: 'checkout-too-many', userId: buyer.id, expiresAt: new Date(Date.now() + 600000), payload: { totalAmount: 80000, shippingAddress: {}, cart: [{ id: item.id, shopId: shop.id, title: item.title, sale_price: 80, quantity: 1000, image: null }] } } });
  stripe.webhooks.constructEvent.mockReturnValue({ type: 'payment_intent.succeeded', data: { object: { id: 'pi_no_stock', amount_received: 8000000, currency: 'usd', metadata: { sessionId: 'checkout-too-many', userId: buyer.id } } } });
  const response = await request(appFor(paymentWebhook)).post('/'); expect(response.status).toBe(503);
  expect(await db.orders.count({ where: { stripePaymentId: 'pi_no_stock' } })).toBe(0);
  expect(await db.paymentReceipt.count({ where: { id: 'pi_no_stock' } })).toBe(0);
  expect((await db.products.findUnique({ where: { id: item.id } })).stock).toBe(9);
});
