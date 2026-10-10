// Uses real Stripe test API, the running gateway and a dedicated development fixture.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const env = require('dotenv').parse(fs.readFileSync('.env'));
Object.assign(process.env, env);
if (!/^sk_test_/.test(env.STRIPE_SECRET_KEY || '')) throw new Error('Refusing non-test Stripe credentials');
if (!/\/development(?:\?|$)/.test(env.DATABASE_URL || '')) throw new Error('This runner is restricted to the development database');
if (!fs.existsSync('.tmp-stripe-listener-ready')) throw new Error('Start scripts/stripe-listen-test.cjs first');
const stripe = new (require('stripe'))(env.STRIPE_SECRET_KEY);
const db = new (require('@prisma/client').PrismaClient)();
const jwt = require('jsonwebtoken');
const base = 'http://localhost:8080';
const run = `stripe-verify-${Date.now()}`;
const report = { run, startedAt: new Date().toISOString(), mode: 'test', checks: [] };
let buyer, seller, admin, shop, product, address;
const sessions = [], intents = [];
const check = (name, details = {}) => { report.checks.push({ name, passed: true, ...details }); console.log('PASS ' + name); };
const token = user => jwt.sign({ id: user.id, role: user.role }, env.ACCESS_TOKEN_JWT_SECRET, { expiresIn: '10m' });
async function api(path, actor, data, method = 'POST') {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(actor ? { cookie: `access_token=${token(actor)}` } : {}) }, ...(method === 'GET' ? {} : { body: JSON.stringify(data || {}) }), signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${body.message || body.error || 'request failed'}`);
  return body;
}
async function waitFor(fn, label) {
  const until = Date.now() + 90000;
  while (Date.now() < until) { const value = await fn(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 1500)); }
  throw new Error('Timed out: ' + label);
}
async function checkout() {
  const session = await api('/order/create-payment-session', buyer, { cart: [{ id: product.id, variantId: product.variants[0].id, quantity: 1, selectedOptions: { color: 'Black' }, sale_price: 0.01 }], selectedAddressId: address.id });
  sessions.push(session.sessionId);
  const quote = (await api('/order/verify-payment-session?sessionId=' + session.sessionId, buyer, null, 'GET')).session;
  assert.equal(quote.currency, 'usd'); assert.equal(quote.cart[0].sale_price, 1);
  const intent = await api('/order/create-payment-intent', buyer, { sessionId: session.sessionId });
  const id = intent.clientSecret.split('_secret_')[0]; intents.push(id);
  const payment = await stripe.paymentIntents.retrieve(id);
  assert.equal(payment.livemode, false); assert.equal(payment.amount, Math.round(quote.totalAmount * 100));
  return { id, sessionId: session.sessionId, amount: payment.amount };
}
(async () => {
  try {
    buyer = await db.users.create({ data: { name: 'Stripe verification buyer', email: `${run}@verification.invalid`, following: [] } });
    admin = await db.users.create({ data: { name: 'Stripe verification admin', email: `${run}-admin@verification.invalid`, following: [], role: 'admin' } });
    seller = await db.sellers.create({ data: { name: 'Stripe verification seller', email: `${run}-seller@verification.invalid`, phone_number: '0000000000', country: 'Vietnam' } });
    shop = await db.shops.create({ data: { name: `[TEST] ${run}`, sellerId: seller.id } });
    product = await db.products.create({ data: { title: '[TEST] Stripe verification SKU', slug: run, category: 'PC', subCategory: 'CPU', detailed_description: 'Test-only development fixture', tags: [], colors: ['Black'], sizes: [], stock: 2, sale_price: 1, regular_price: 1, warranty: 'Test only', shopId: shop.id, discount_codes: [], variants: { create: { sku: run, color: 'Black', price: 1, stock: 2 } } }, include: { variants: true } });
    address = await db.address.create({ data: { userId: buyer.id, label: 'TEST', name: 'Verification fixture', street: 'Test fixture — no delivery', city: 'Ho Chi Minh City', zip: '70000', country: 'Vietnam', isDefault: true } });
    const invalid = await fetch(base + '/api/create-order', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 'invalid' }, body: '{}' });
    assert.equal(invalid.status, 400); check('invalid webhook signature rejected');
    const successful = await checkout();
    const payment = await stripe.paymentIntents.confirm(successful.id, { payment_method: 'pm_card_visa' });
    assert.equal(payment.status, 'succeeded'); check('real Stripe test payment succeeded', { paymentId: payment.id, amountCents: payment.amount, currency: payment.currency });
    const receipt = await waitFor(() => db.paymentReceipt.findUnique({ where: { id: payment.id } }), 'Stripe CLI webhook delivery and order commit');
    assert.equal(receipt.sessionId, successful.sessionId); assert.equal(receipt.orderIds.length, 1);
    const order = await db.orders.findUniqueOrThrow({ where: { id: receipt.orderIds[0] }, include: { items: true } });
    assert.equal(order.paymentStatus, 'Paid'); assert.equal(order.items[0].variantId, product.variants[0].id);
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock, 1);
    check('Stripe-delivered webhook creates order and deducts SKU exactly once', { orderId: order.id });
    const result = await api('/order/payment-result?sessionId=' + successful.sessionId, buyer, null, 'GET');
    assert.equal(result.complete, true); check('buyer payment confirmation reads committed receipt');
    const events = await stripe.events.list({ type: 'payment_intent.succeeded', limit: 20 });
    const event = events.data.find(event => event.data.object.id === payment.id);
    assert.ok(event, 'Stripe event was not found');
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET });
    const replay = await fetch(base + '/api/create-order', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': signature }, body: payload });
    assert.equal(replay.status, 200); assert.equal((await replay.json()).duplicate, true);
    assert.equal(await db.orders.count({ where: { stripePaymentId: payment.id } }), 1); check('signed replay is idempotent');
    const declined = await checkout();
    let declineCode;
    try { await stripe.paymentIntents.confirm(declined.id, { payment_method: 'pm_card_visa_chargeDeclined' }); }
    catch (error) { declineCode = error.code; }
    assert.equal(declineCode, 'card_declined');
    assert.equal(await db.orders.count({ where: { stripePaymentId: declined.id } }), 0);
    await stripe.paymentIntents.cancel(declined.id); check('declined card creates no order');
    await api('/order/cancel-order/' + order.id, buyer, { reason: 'Stripe test verification complete' });
    const refunded = await api('/admin/refund/' + payment.id, admin, { orderId: order.id });
    const refund = await stripe.refunds.retrieve(refunded.refundId);
    assert.equal(refund.status, 'succeeded'); assert.equal(refund.amount, payment.amount);
    assert.equal((await db.orders.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus, 'Refunded');
    assert.equal((await db.productVariant.findUniqueOrThrow({ where: { id: product.variants[0].id } })).stock, 2);
    check('admin test refund succeeds and cancellation restores SKU', { refundId: refund.id });
    report.completedAt = new Date().toISOString(); report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { type: error.type, code: error.code, message: error.message };
    console.error(JSON.stringify(report.error)); process.exitCode = 1;
  } finally {
    // Keep order/receipt evidence, but hide the fixture from storefront and remove test admin access.
    if (product) await db.products.update({ where: { id: product.id }, data: { status: 'Inactive', isDeleted: true } }).catch(() => {});
    if (admin) await db.users.update({ where: { id: admin.id }, data: { role: 'user' } }).catch(() => {});
    report.fixtures = { buyerId: buyer?.id, sellerId: seller?.id, shopId: shop?.id, productId: product?.id, sessionIds: sessions, paymentIds: intents };
    fs.mkdirSync('tmp', { recursive: true }); fs.writeFileSync('tmp/stripe-provider-verification.json', JSON.stringify(report, null, 2));
    await db.$disconnect();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
