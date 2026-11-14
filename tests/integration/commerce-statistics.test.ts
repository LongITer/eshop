import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { errorMiddleware } from '@packages/error-handler/error-middleware';

let replica: MongoMemoryReplSet;
let db: any;
let sellerStatistics: any, adminStatistics: any;
let shop: any, otherShop: any, buyer: any, product: any;

function appFor(handler: any) {
  const app = express();
  app.use((req: any, _res, next) => { req.seller = { shop }; next(); });
  app.get('/', handler); app.use(errorMiddleware); return app;
}

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.DATABASE_URL = replica.getUri('commerce_statistics_tests');
  if (!process.env.DATABASE_URL.startsWith('mongodb://127.0.0.1:')) throw new Error('Disposable local MongoDB required');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: { ...process.env }, windowsHide: true });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Schema setup timed out')); }, 90000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(output)); });
  });
  db = require('@packages/libs/prisma').default;
  sellerStatistics = require('../../apps/product-service/src/controllers/statistics.controller').sellerStatistics;
  adminStatistics = require('../../apps/admin-service/src/controllers/statistics.controller').adminStatistics;
  buyer = await db.users.create({ data: { name: 'Analytics Buyer', email: 'analytics@example.test', following: [] } });
  const createShop = async (name: string) => {
    const seller = await db.sellers.create({ data: { name, email: `${name}@example.test`, phone_number: '123', country: 'Vietnam' } });
    return db.shops.create({ data: { name, sellerId: seller.id } });
  };
  shop = await createShop('First'); otherShop = await createShop('Second');
  product = await db.products.create({ data: { title: 'Statistics CPU', slug: 'statistics-cpu', category: 'CPU', subCategory: 'CPU', detailed_description: 'CPU', tags: [], colors: [], sizes: [], stock: 25, sale_price: 10, regular_price: 10, warranty: '1 year', shopId: shop.id, discount_codes: [] } });
  const secondProduct = await db.products.create({ data: { title: 'Other CPU', slug: 'other-statistics-cpu', category: 'CPU', subCategory: 'CPU', detailed_description: 'CPU', tags: [], colors: [], sizes: [], stock: 20, sale_price: 50, regular_price: 50, warranty: '1 year', shopId: otherShop.id, discount_codes: [] } });
  let sequence = 0;
  const purchase = (overrides = {}, other = false) => db.orders.create({ data: {
    orderNumber: `STAT-${++sequence}`, userId: buyer.id, shopId: other ? otherShop.id : shop.id,
    subTotal: other ? 50 : 30, shippingFee: 3, discount: 5, totalAmount: other ? 48 : 28,
    status: 'Delivered', paymentStatus: 'Paid', shippingAddress: {}, createdAt: new Date('2026-10-09T17:00:00Z'),
    items: { create: other ? [{ productId: secondProduct.id, title: 'Other CPU', quantity: 1, unitPrice: 50, totalPrice: 50 }] : [
      { productId: product.id, title: 'Original title', quantity: 2, unitPrice: 10, totalPrice: 20 },
      { productId: product.id, title: 'Original title', quantity: 1, unitPrice: 10, totalPrice: 10 },
    ] }, ...overrides,
  } });
  await purchase(); await purchase({}, true);
  await purchase({ status: 'Cancelled' }); await purchase({ status: 'Returned' });
  await purchase({ status: 'Refunded', paymentStatus: 'Refunded' }); await purchase({ paymentStatus: 'Pending' });
  await purchase({ currency: 'eur' });
  await purchase({ createdAt: new Date('2026-10-09T16:59:59.999Z') });
}, 180000);

afterAll(async () => { await db?.$disconnect(); await replica?.stop(); });

test('seller report excludes other shops, non-paid/refunded orders and the previous Vietnam day', async () => {
  const result = await request(appFor(sellerStatistics)).get(`/?from=2026-10-10&to=2026-10-10&shopId=${otherShop.id}`);
  expect(result.status).toBe(200);
  expect(result.body.summary).toMatchObject({ orders: 1, customers: 1, units: 3, products: 1, totalSpent: 28, productSales: 30 });
  expect(result.body.rows[0]).toMatchObject({ id: buyer.id, orders: 1, units: 3, distinctCount: 1, amount: 28, average: 28 });
});

test('admin exposes aggregate product sales only and can filter one shop', async () => {
  const app = appFor(adminStatistics);
  const result = await request(app).get('/?kind=products&from=2026-10-10&to=2026-10-10');
  expect(result.status).toBe(200);
  expect(result.body.summary).toMatchObject({ units: 4, products: 2, productSales: 80 });
  expect(JSON.stringify(result.body)).not.toContain(buyer.email);
  expect(result.body.rows[0]).not.toHaveProperty('orders');
  expect((await request(app).get('/?kind=customers')).status).toBe(403);
  const filtered = await request(app).get('/?kind=products&from=2026-10-10&to=2026-10-10&shopId=' + otherShop.id);
  expect(filtered.body.summary).toMatchObject({ units: 1, productSales: 50 });
});

test('product rows deduplicate orders, keep historical sales and use live stock; all-time includes older purchases', async () => {
  const app = appFor(sellerStatistics);
  const result = await request(app).get('/?kind=products');
  expect(result.body.rows[0]).toMatchObject({ name: 'Statistics CPU', orders: 2, units: 6, distinctCount: 1, amount: 60, average: 10, stock: 25 });
  await db.products.update({ where: { id: product.id }, data: { stock: 17, sale_price: 99, isDeleted: true } });
  const changed = await request(app).get('/?kind=products');
  expect(changed.body.rows[0]).toMatchObject({ stock: 17, amount: 60 });
  const exported = await request(app).get('/?kind=products&format=csv&page=999&limit=1');
  expect(exported.status).toBe(200); expect(exported.text).toContain('grossProductSalesUSD'); expect(exported.text).toContain('Statistics CPU');
});
