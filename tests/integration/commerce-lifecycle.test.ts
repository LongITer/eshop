import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { errorMiddleware } from '@packages/error-handler/error-middleware';

// HTTP handlers, Prisma transactions and Stripe signatures are real. Only provider
// API calls and outbound email/logging are isolated from external accounts.
jest.mock('stripe', () => require('../implementation/mocks/stripe'));
jest.mock('@packages/utils/logs/behavior-log', () => ({ sendBehaviorLog: jest.fn() }));
jest.mock('../../apps/order-service/src/utils/send-email', () => ({ sendEmail: jest.fn() }));

let replica: MongoMemoryReplSet;
let db: any;
let checkout: any; let payments: any; let returns: any; let lifecycle: any; let operations: any;
let buyer: any; let stranger: any; let seller: any; let otherSeller: any; let shop: any; let otherShop: any; let address: any;
let nextId = 0;
let stripe: any;
let signingStripe: any;
const intents = new Map<string, any>();
const createdIntents = new Map<string, any>();
const refunds = new Map<string, any>();
const createdRefunds = new Map<string, any>();
const webhookSecret = 'whsec_disposable_lifecycle_test';

function appFor(handler: any, actor = buyer, role = 'user', method = 'post', route = '/') {
  const app = express();
  app.use(express.json({ verify(req, _res, body) { (req as any).rawBody = body; } }));
  app.use((req: any, _res, next) => {
    req.user = actor; req.role = role;
    req.seller = { ...actor, shop: actor.id === otherSeller.id ? otherShop : shop };
    next();
  });
  (app as any)[method](route, handler);
  app.use(errorMiddleware);
  return app;
}

async function webhook(type: string, object: any, valid = true) {
  const payload = JSON.stringify({ id: `evt_${++nextId}`, object: 'event', type, data: { object } });
  const signature = signingStripe.webhooks.generateTestHeaderString({ payload, secret: valid ? webhookSecret : 'wrong_secret' });
  return request(appFor(payments.paymentWebhook)).post('/').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload);
}

async function newProduct(shopId = shop.id, price = 25.5, stock = 5) {
  return db.products.create({ data: {
    title: 'Lifecycle RAM', slug: `lifecycle-${++nextId}`, category: 'PC', subCategory: 'RAM',
    detailed_description: 'Disposable test product', tags: [], colors: [], sizes: [],
    stock, sale_price: price, regular_price: price, warranty: '1 year', shopId, discount_codes: [],
  } });
}

async function startCheckout(items: any[]) {
  const session = await request(appFor(checkout.createPaymentSession)).post('/').send({
    cart: items.map(item => ({ id: item.id, quantity: item.quantity || 1, price: 0.01, shopId: otherShop.id })),
    selectedAddressId: address.id,
  });
  expect(session.status).toBe(200);
  const sessionId = session.body.sessionId;
  const result = await request(appFor(checkout.createPaymentIntent)).post('/').send({ sessionId, amount: 1 });
  expect(result.status).toBe(200);
  const saved = await db.paymentSession.findUnique({ where: { id: sessionId } });
  return { sessionId, snapshot: saved.payload, intent: intents.get(saved.payload.paymentIntentId) };
}

async function paidOrder() {
  const product = await newProduct();
  const started = await startCheckout([product]);
  Object.assign(started.intent, { status: 'succeeded', amount_received: started.intent.amount });
  expect((await webhook('payment_intent.succeeded', started.intent)).status).toBe(200);
  const order = await db.orders.findFirst({ where: { stripePaymentId: started.intent.id } });
  return { ...started, product, order };
}

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_disposable';
  process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  process.env.SHIPPING_FEE_USD = '2.50';
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.DATABASE_URL = replica.getUri('commerce_lifecycle_tests');
  if (!process.env.DATABASE_URL.startsWith('mongodb://127.0.0.1:')) throw new Error('Only a disposable local MongoDB is allowed');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: { ...process.env }, windowsHide: true });
    let output = '';
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Test schema timed out: ' + output)); }, 90000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(output)); });
  });
  db = require('@packages/libs/prisma').default;
  checkout = require('../../apps/order-service/src/routes/order.controller');
  payments = require('../../apps/order-service/src/routes/payment-webhook.controller');
  returns = require('../../apps/order-service/src/routes/returns.controller');
  lifecycle = require('../../apps/order-service/src/routes/order-management.controller');
  operations = require('../../apps/admin-service/src/controllers/operations.controller');
  stripe = require('../implementation/mocks/stripe').stripe;
  const ActualStripe = jest.requireActual('stripe');
  signingStripe = new ActualStripe('sk_test_disposable');
  buyer = await db.users.create({ data: { name: 'Buyer', email: 'lifecycle-buyer@example.test', following: [] } });
  stranger = await db.users.create({ data: { name: 'Other buyer', email: 'lifecycle-other@example.test', following: [] } });
  seller = await db.sellers.create({ data: { name: 'Seller', email: 'lifecycle-seller@example.test', phone_number: '123456789', country: 'Vietnam' } });
  otherSeller = await db.sellers.create({ data: { name: 'Other seller', email: 'lifecycle-other-seller@example.test', phone_number: '123456789', country: 'Vietnam' } });
  shop = await db.shops.create({ data: { name: 'Shop', sellerId: seller.id } });
  otherShop = await db.shops.create({ data: { name: 'Other shop', sellerId: otherSeller.id } });
  address = await db.address.create({ data: { userId: buyer.id, label: 'Home', name: 'Buyer', street: '12 Nguyen Hue', city: 'Ho Chi Minh', zip: '70000', country: 'Vietnam', isDefault: true } });
}, 180000);

beforeEach(() => {
  jest.clearAllMocks(); intents.clear(); createdIntents.clear(); refunds.clear(); createdRefunds.clear();
  stripe.webhooks.constructEvent.mockImplementation((...args: any[]) => signingStripe.webhooks.constructEvent(...args));
  stripe.paymentIntents.create.mockImplementation(async (data: any, options: any) => {
    if (createdIntents.has(options.idempotencyKey)) return createdIntents.get(options.idempotencyKey);
    const intent = { ...data, id: `pi_test${++nextId}`, status: 'requires_payment_method', amount_received: 0, client_secret: `test_secret_${nextId}` };
    intents.set(intent.id, intent); createdIntents.set(options.idempotencyKey, intent); return intent;
  });
  stripe.paymentIntents.retrieve.mockImplementation(async (id: string) => {
    if (!intents.has(id)) throw new Error('Unknown disposable payment');
    return intents.get(id);
  });
  stripe.refunds.create.mockImplementation(async (data: any, options: any) => {
    if (createdRefunds.has(options.idempotencyKey)) return createdRefunds.get(options.idempotencyKey);
    const refund = { ...data, id: `re_test${++nextId}`, currency: 'usd', status: 'pending' };
    refunds.set(refund.id, refund); createdRefunds.set(options.idempotencyKey, refund); return refund;
  });
  stripe.refunds.retrieve.mockImplementation(async (id: string) => refunds.get(id));
  stripe.refunds.list.mockImplementation(({ payment_intent }: any) => ({ async *[Symbol.asyncIterator]() {
    for (const refund of refunds.values()) if (refund.payment_intent === payment_intent) yield refund;
  } }));
});

afterAll(async () => { await db?.$disconnect(); await replica?.stop(); });

test('actual checkout routes use database prices, enforce ownership/expiry and reuse one payment', async () => {
  const product = await newProduct();
  const { sessionId, snapshot, intent } = await startCheckout([{ ...product, quantity: 2 }]);
  expect(snapshot).toMatchObject({ subTotal: 51, shippingFee: 2.5, totalAmount: 53.5, currency: 'usd' });
  expect(intent).toMatchObject({ amount: 5350, currency: 'usd', metadata: { sessionId, userId: buyer.id } });
  const verify = await request(appFor(checkout.verifyPaymentSession, buyer, 'user', 'get')).get('/?sessionId=' + sessionId);
  expect(verify.status).toBe(200); expect(verify.headers['cache-control']).toBe('no-store');
  expect((await request(appFor(checkout.verifyPaymentSession, stranger, 'user', 'get')).get('/?sessionId=' + sessionId)).status).toBe(403);
  expect((await request(appFor(checkout.createPaymentIntent, stranger)).post('/').send({ sessionId })).status).toBe(400);
  expect((await request(appFor(checkout.createPaymentIntent)).post('/').send({ sessionId })).body.clientSecret).toBe(intent.client_secret);
  expect(createdIntents.size).toBe(1);
  await db.paymentSession.update({ where: { id: sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await request(appFor(checkout.createPaymentIntent)).post('/').send({ sessionId })).status).toBe(400);
  expect((await request(appFor(checkout.verifyPaymentSession, buyer, 'user', 'get')).get('/?sessionId=' + sessionId)).status).toBe(404);
});

test('checkout → signed payment → shipment → return → refund works across real database handlers', async () => {
  const { product, intent, order, sessionId } = await paidOrder();
  expect(order).toMatchObject({ totalAmount: 28, shippingFee: 2.5, status: 'Pending', paymentStatus: 'Paid' });
  expect((await db.products.findUnique({ where: { id: product.id } })).stock).toBe(4);
  const statusApp = appFor(lifecycle.sellerOrderStatus, seller, 'seller', 'patch', '/:orderId');
  expect((await request(appFor(lifecycle.sellerOrderStatus, otherSeller, 'seller', 'patch', '/:orderId')).patch('/' + order.id).send({ status: 'Confirmed' })).status).toBe(404);
  expect((await request(statusApp).patch('/' + order.id).send({ status: 'Delivered' })).status).toBe(400);
  for (const status of ['Confirmed', 'Processing', 'Shipped', 'Delivered']) {
    expect((await request(statusApp).patch('/' + order.id).send({ status, trackingNumber: 'TEST-TRACK' })).status).toBe(200);
  }
  expect((await request(appFor(returns.requestReturn, stranger, 'user', 'post', '/:orderId')).post('/' + order.id).send({ reason: 'Not my order' })).status).toBe(404);
  expect((await request(appFor(returns.requestReturn, buyer, 'user', 'post', '/:orderId')).post('/' + order.id).send({ reason: 'Faulty item', evidence: ['https://example.test/damage.png'] })).status).toBe(201);
  const reviewApp = appFor(returns.reviewReturn, seller, 'seller', 'patch', '/:orderId');
  for (const status of ['Approved', 'Received']) expect((await request(reviewApp).patch('/' + order.id).send({ status, sellerNote: 'Reviewed return' })).status).toBe(200);
  const refundApp = appFor(operations.refund, buyer, 'admin', 'post', '/:paymentId');
  const refunded = await request(refundApp).post('/' + intent.id).send({ orderId: order.id, reason: 'Received damaged item' });
  expect(refunded.status).toBe(200); expect(refunded.body.status).toBe('pending');
  expect((await db.orders.findUnique({ where: { id: order.id } })).paymentStatus).toBe('Paid');
  const refund = refunds.get(refunded.body.refundId);
  expect(refund.amount).toBe(2800);
  refund.status = 'succeeded';
  expect((await webhook('refund.updated', refund)).status).toBe(200);
  expect((await webhook('refund.updated', refund)).status).toBe(200);
  expect((await db.orders.findUnique({ where: { id: order.id } }))).toMatchObject({ status: 'Refunded', paymentStatus: 'Refunded' });
  expect(await db.notifications.count({ where: { orderId: order.id, type: 'OrderRefunded' } })).toBe(1);
  // Receipt recovery must not fulfill the refunded payment or restock uninspected goods.
  const result = await request(appFor(returns.paymentResult, buyer, 'user', 'get')).get('/?sessionId=' + sessionId);
  expect(result.body).toMatchObject({ complete: true, orderIds: [order.id] });
  expect((await db.products.findUnique({ where: { id: product.id } })).stock).toBe(4);
});

test('concurrent signed webhook delivery commits one receipt, one deduction and one confirmation', async () => {
  const product = await newProduct(); const { intent } = await startCheckout([product]);
  Object.assign(intent, { status: 'succeeded', amount_received: intent.amount });
  const responses = await Promise.all([webhook('payment_intent.succeeded', intent), webhook('payment_intent.succeeded', intent)]);
  expect(responses.map(result => result.status)).toEqual([200, 200]);
  expect(await db.orders.count({ where: { stripePaymentId: intent.id } })).toBe(1);
  expect(await db.paymentReceipt.count({ where: { id: intent.id } })).toBe(1);
  expect(await db.inventoryHistory.count({ where: { productId: product.id, delta: -1 } })).toBe(1);
  expect(require('../../apps/order-service/src/utils/send-email').sendEmail).toHaveBeenCalledTimes(1);
});

test.each(['signature', 'owner', 'amount', 'currency', 'intent'])('mismatched %s cannot fulfill an order', async mismatch => {
  const product = await newProduct(); const { intent } = await startCheckout([product]);
  const paid = { ...intent, metadata: { ...intent.metadata }, status: 'succeeded', amount_received: intent.amount };
  if (mismatch === 'owner') paid.metadata.userId = stranger.id;
  if (mismatch === 'amount') paid.amount_received--;
  if (mismatch === 'currency') paid.currency = 'eur';
  if (mismatch === 'intent') paid.id = 'pi_otherpayment';
  const result = await webhook('payment_intent.succeeded', paid, mismatch !== 'signature');
  expect(result.status).toBe(mismatch === 'signature' ? 400 : 503);
  expect(await db.orders.count({ where: { stripePaymentId: paid.id } })).toBe(0);
  expect((await db.products.findUnique({ where: { id: product.id } })).stock).toBe(5);
});

test('two different paid intents cannot fulfill the same legacy session concurrently', async () => {
  const product = await newProduct(); const { intent, sessionId, snapshot } = await startCheckout([product]);
  delete snapshot.paymentIntentId;
  await db.paymentSession.update({ where: { id: sessionId }, data: { payload: snapshot } });
  const paid = { ...intent, status: 'succeeded', amount_received: intent.amount };
  const results = await Promise.all([webhook('payment_intent.succeeded', paid), webhook('payment_intent.succeeded', { ...paid, id: 'pi_anotherlegacy' })]);
  expect(results.map(result => result.status).sort()).toEqual([200, 503]);
  expect(await db.paymentReceipt.count({ where: { sessionId } })).toBe(1);
  expect((await db.products.findUnique({ where: { id: product.id } })).stock).toBe(4);
});

test('one shared payment refunds only the canceled shop order and replay is harmless', async () => {
  const first = await newProduct(); const second = await newProduct(otherShop.id, 10);
  const { intent } = await startCheckout([first, second]);
  Object.assign(intent, { status: 'succeeded', amount_received: intent.amount });
  expect(intent.amount).toBe(4050);
  expect((await webhook('payment_intent.succeeded', intent)).status).toBe(200);
  const orders = await db.orders.findMany({ where: { stripePaymentId: intent.id }, orderBy: { totalAmount: 'desc' } });
  expect(orders.map((order: any) => order.totalAmount)).toEqual([28, 12.5]);
  const order = orders[0];
  expect((await request(appFor(lifecycle.cancelOrder, buyer, 'user', 'post', '/:orderId')).post('/' + order.id).send({ reason: 'Changed mind' })).status).toBe(200);
  const app = appFor(operations.refund, buyer, 'admin', 'post', '/:paymentId');
  expect((await request(app).post('/pi_wrong').send({ orderId: order.id, reason: 'Cancel order' })).status).toBe(404);
  const payload = { orderId: order.id, reason: 'Canceled order' };
  const result = await request(app).post('/' + intent.id).send(payload);
  expect(result.status).toBe(200);
  const refund = refunds.get(result.body.refundId); expect(refund.amount).toBe(2800);
  refund.status = 'succeeded';
  const replay = await Promise.all([request(app).post('/' + intent.id).send(payload), webhook('refund.updated', refund)]);
  expect(replay.map(result => result.status)).toEqual([200, 200]);
  expect((await request(app).post('/' + intent.id).send(payload)).status).toBe(200);
  expect(createdRefunds.size).toBe(1);
  expect((await db.orders.findUnique({ where: { id: orders[1].id } })).paymentStatus).toBe('Paid');
  expect((await db.products.findUnique({ where: { id: first.id } })).stock).toBe(5);
  expect((await db.products.findUnique({ where: { id: second.id } })).stock).toBe(4);
  expect(await db.notifications.count({ where: { orderId: order.id, type: 'OrderRefunded' } })).toBe(1);
});

test.each(['failed', 'canceled'])('a %s refund retries once under concurrency and old webhooks cannot replace it', async status => {
  const { order, intent } = await paidOrder();
  await db.orders.update({ where: { id: order.id }, data: { status: 'Cancelled' } });
  const app = appFor(operations.refund, buyer, 'admin', 'post', '/:paymentId');
  const payload = { orderId: order.id, reason: 'Retry provider failure' };
  const first = await request(app).post('/' + intent.id).send(payload);
  const old = refunds.get(first.body.refundId);
  old.status = status;
  expect((await webhook('refund.updated', old)).status).toBe(200);

  const retry = await Promise.all([request(app).post('/' + intent.id).send(payload), request(app).post('/' + intent.id).send(payload)]);
  expect(retry.map(response => response.status)).toEqual([200, 200]);
  expect(retry[0].body.refundId).toBe(retry[1].body.refundId);
  expect(retry[0].body.refundId).not.toBe(old.id);
  expect(createdRefunds.size).toBe(2);
  const replacement = refunds.get(retry[0].body.refundId);
  expect(replacement).toMatchObject({ amount: 2800, metadata: { orderId: order.id, previousRefundId: old.id } });
  expect(createdRefunds.get(`order-refund-${order.id}-retry-${old.id}`)).toBe(replacement);

  for (const delayedStatus of ['pending', status]) {
    expect((await webhook('refund.updated', { ...old, status: delayedStatus })).status).toBe(200);
    expect(await db.orders.findUnique({ where: { id: order.id } })).toMatchObject({ stripeRefundId: replacement.id, refundState: 'pending', paymentStatus: 'Paid' });
  }
  expect((await webhook('refund.failed', { ...old, id: 're_unrelated' })).status).toBe(503);
  expect(await db.orders.findUnique({ where: { id: order.id } })).toMatchObject({ stripeRefundId: replacement.id, refundState: 'pending' });
  replacement.status = 'succeeded';
  expect((await webhook('refund.updated', replacement)).status).toBe(200);
  expect((await webhook('refund.updated', old)).status).toBe(200);
  expect(await db.orders.findUnique({ where: { id: order.id } })).toMatchObject({ stripeRefundId: replacement.id, refundState: 'succeeded', paymentStatus: 'Refunded' });
  expect(await db.notifications.count({ where: { orderId: order.id, type: 'OrderRefunded' } })).toBe(1);
});

test('retry recovers a provider-created replacement after the database response was lost', async () => {
  const { order, intent } = await paidOrder();
  await db.orders.update({ where: { id: order.id }, data: { status: 'Cancelled' } });
  const app = appFor(operations.refund, buyer, 'admin', 'post', '/:paymentId');
  const payload = { orderId: order.id, reason: 'Recover interrupted refund' };
  const first = await request(app).post('/' + intent.id).send(payload);
  const old = refunds.get(first.body.refundId);
  old.status = 'failed';
  expect((await webhook('refund.failed', old)).status).toBe(200);
  const replacement = await stripe.refunds.create({ payment_intent: intent.id, amount: 2800, metadata: { orderId: order.id, previousRefundId: old.id } }, { idempotencyKey: `order-refund-${order.id}-retry-${old.id}` });
  const calls = stripe.refunds.create.mock.calls.length;
  // The provider idempotency cache can expire; listing the existing attempt must still recover it.
  createdRefunds.clear();
  const recovered = await request(app).post('/' + intent.id).send(payload);
  expect(recovered.status).toBe(200);
  expect(recovered.body).toMatchObject({ refundId: replacement.id, status: 'pending' });
  expect(stripe.refunds.create).toHaveBeenCalledTimes(calls);

  replacement.status = 'failed';
  expect((await webhook('refund.failed', replacement)).status).toBe(200);
  const next = await request(app).post('/' + intent.id).send(payload);
  expect(next.status).toBe(200);
  expect(refunds.get(next.body.refundId).metadata.previousRefundId).toBe(replacement.id);
  expect((await webhook('refund.failed', old)).status).toBe(200);
  expect(await db.orders.findUnique({ where: { id: order.id } })).toMatchObject({ stripeRefundId: next.body.refundId, refundState: 'pending' });
});

test('a replacement pending webhook recovers an interrupted admin response', async () => {
  const { order, intent } = await paidOrder();
  await db.orders.update({ where: { id: order.id }, data: { status: 'Cancelled' } });
  const first = await request(appFor(operations.refund, buyer, 'admin', 'post', '/:paymentId')).post('/' + intent.id).send({ orderId: order.id, reason: 'Initial refund' });
  const old = refunds.get(first.body.refundId);
  old.status = 'failed';
  expect((await webhook('refund.failed', old)).status).toBe(200);
  const replacement = await stripe.refunds.create({ payment_intent: intent.id, amount: 2800, metadata: { orderId: order.id, previousRefundId: old.id } }, { idempotencyKey: `order-refund-${order.id}-retry-${old.id}` });
  expect((await webhook('refund.created', replacement)).status).toBe(200);
  expect(await db.orders.findUnique({ where: { id: order.id } })).toMatchObject({ stripeRefundId: replacement.id, refundState: 'pending', paymentStatus: 'Paid' });
  expect((await webhook('refund.failed', old)).status).toBe(200);
  expect(await db.orders.findUnique({ where: { id: order.id } })).toMatchObject({ stripeRefundId: replacement.id, refundState: 'pending' });
});

test('replacement completion arriving before the admin response cannot regress to pending', async () => {
  const { order, intent } = await paidOrder();
  await db.orders.update({ where: { id: order.id }, data: { status: 'Cancelled' } });
  const app = appFor(operations.refund, buyer, 'admin', 'post', '/:paymentId');
  const payload = { orderId: order.id, reason: 'Retry with immediate completion' };
  const first = await request(app).post('/' + intent.id).send(payload);
  const old = refunds.get(first.body.refundId);
  old.status = 'failed';
  expect((await webhook('refund.failed', old)).status).toBe(200);
  const create = stripe.refunds.create.getMockImplementation();
  stripe.refunds.create.mockImplementationOnce(async (...args: any[]) => {
    const replacement = await create(...args);
    const staleResponse = { ...replacement };
    replacement.status = 'succeeded';
    expect((await webhook('refund.updated', replacement)).status).toBe(200);
    return staleResponse;
  });
  const response = await request(app).post('/' + intent.id).send(payload);
  expect(response.status).toBe(200);
  expect(response.body.status).toBe('succeeded');
  expect(await db.orders.findUnique({ where: { id: order.id } })).toMatchObject({ stripeRefundId: response.body.refundId, refundState: 'succeeded', paymentStatus: 'Refunded' });
  expect(await db.notifications.count({ where: { orderId: order.id, type: 'OrderRefunded' } })).toBe(1);
});

test('an immediately failed provider response is saved so the next request uses a new attempt', async () => {
  const { order, intent } = await paidOrder();
  await db.orders.update({ where: { id: order.id }, data: { status: 'Cancelled' } });
  const create = stripe.refunds.create.getMockImplementation();
  stripe.refunds.create.mockImplementationOnce(async (...args: any[]) => {
    const result = await create(...args);
    result.status = 'failed';
    return result;
  });
  const app = appFor(operations.refund, buyer, 'admin', 'post', '/:paymentId');
  const payload = { orderId: order.id, reason: 'Retry an immediate rejection' };
  expect((await request(app).post('/' + intent.id).send(payload)).status).toBe(400);
  const saved = await db.orders.findUnique({ where: { id: order.id } });
  expect(saved).toMatchObject({ refundState: 'failed', paymentStatus: 'Paid' });
  expect(saved.stripeRefundId).toBeTruthy();
  const retried = await request(app).post('/' + intent.id).send(payload);
  expect(retried.status).toBe(200);
  expect(retried.body.refundId).not.toBe(saved.stripeRefundId);
  expect(refunds.get(retried.body.refundId).metadata.previousRefundId).toBe(saved.stripeRefundId);
});

test('a claimed replacement cannot supersede a refund that is still pending', async () => {
  const { order, intent } = await paidOrder();
  await db.orders.update({ where: { id: order.id }, data: { status: 'Cancelled' } });
  const result = await request(appFor(operations.refund, buyer, 'admin', 'post', '/:paymentId')).post('/' + intent.id).send({ orderId: order.id, reason: 'First refund' });
  const pending = refunds.get(result.body.refundId);
  const foreign = { ...pending, id: 're_foreignreplacement', metadata: { orderId: order.id, previousRefundId: pending.id } };
  expect((await webhook('refund.created', foreign)).status).toBe(503);
  expect(await db.orders.findUnique({ where: { id: order.id } })).toMatchObject({ stripeRefundId: pending.id, refundState: 'pending', paymentStatus: 'Paid' });
});

test.each(['payment', 'amount', 'currency', 'owner'])('a failed refund with a foreign %s cannot authorize a new attempt', async mismatch => {
  const { order, intent } = await paidOrder();
  const refund = { id: 're_foreign', payment_intent: intent.id, amount: 2800, currency: 'usd', status: 'failed', metadata: { orderId: order.id } };
  if (mismatch === 'payment') refund.payment_intent = 'pi_another';
  if (mismatch === 'amount') refund.amount = 100;
  if (mismatch === 'currency') refund.currency = 'eur';
  if (mismatch === 'owner') refund.metadata.orderId = stranger.id;
  refunds.set(refund.id, refund);
  await db.orders.update({ where: { id: order.id }, data: { status: 'Cancelled', stripeRefundId: refund.id, refundState: 'failed' } });
  const response = await request(appFor(operations.refund, buyer, 'admin', 'post', '/:paymentId')).post('/' + intent.id).send({ orderId: order.id, reason: 'Reject invalid retry' });
  expect(response.status).toBe(400);
  expect(stripe.refunds.create).not.toHaveBeenCalled();
  expect(await db.orders.findUnique({ where: { id: order.id } })).toMatchObject({ stripeRefundId: refund.id, paymentStatus: 'Paid' });
});

test.each(['amount', 'currency', 'identity'])('refund %s mismatch never marks the whole order refunded', async mismatch => {
  const { order, intent } = await paidOrder();
  await db.orders.update({ where: { id: order.id }, data: { status: 'Cancelled', stripeRefundId: 're_expected' } });
  const refund = { id: 're_expected', status: 'succeeded', amount: 2800, currency: 'usd', payment_intent: intent.id, metadata: { orderId: order.id } };
  if (mismatch === 'amount') refund.amount = 100;
  if (mismatch === 'currency') refund.currency = 'eur';
  if (mismatch === 'identity') refund.id = 're_other';
  expect((await webhook('refund.updated', refund)).status).toBe(503);
  expect((await db.orders.findUnique({ where: { id: order.id } })).paymentStatus).toBe('Paid');
  expect(await db.notifications.count({ where: { orderId: order.id, type: 'OrderRefunded' } })).toBe(0);
});

test('paid stock conflict rolls back all shops and succeeds exactly once after stock is restored', async () => {
  const first = await newProduct(); const second = await newProduct(otherShop.id);
  const { intent } = await startCheckout([first, second]);
  Object.assign(intent, { status: 'succeeded', amount_received: intent.amount });
  await db.products.update({ where: { id: second.id }, data: { stock: 0 } });
  expect((await webhook('payment_intent.succeeded', intent)).status).toBe(503);
  expect(await db.paymentReceipt.count({ where: { id: intent.id } })).toBe(0);
  expect(await db.orders.count({ where: { stripePaymentId: intent.id } })).toBe(0);
  expect((await db.products.findUnique({ where: { id: first.id } })).stock).toBe(5);
  await db.products.update({ where: { id: second.id }, data: { stock: 1 } });
  expect((await webhook('payment_intent.succeeded', intent)).status).toBe(200);
  expect((await webhook('payment_intent.succeeded', intent)).body.duplicate).toBe(true);
  expect(await db.orders.count({ where: { stripePaymentId: intent.id } })).toBe(2);
  expect((await db.products.findUnique({ where: { id: first.id } })).stock).toBe(4);
  expect((await db.products.findUnique({ where: { id: second.id } })).stock).toBe(0);
});
