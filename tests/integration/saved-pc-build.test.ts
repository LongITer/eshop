import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { errorMiddleware } from '@packages/error-handler/error-middleware';

let replica: MongoMemoryReplSet;
let db: any;
let controller: any;
let buyer: any;
let otherBuyer: any;
let seller: any;
let product: any;

function appFor(handler: any, method = 'get', actor = buyer) {
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { req.user = actor; req.role = 'user'; next(); });
  (app as any)[method]('/', handler); app.use(errorMiddleware); return app;
}

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.DATABASE_URL = replica.getUri('saved_pc_build_tests');
  if (!process.env.DATABASE_URL.startsWith('mongodb://127.0.0.1:')) throw new Error('Tests require disposable local MongoDB');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: { ...process.env }, windowsHide: true });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Test schema setup timed out: ' + output)); }, 90000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(new Error(output)); });
  });
  db = require('@packages/libs/prisma').default;
  controller = require('../../apps/product-service/src/controllers/pc-builder.controller');
  buyer = await db.users.create({ data: { name: 'PC Buyer', email: 'pc-buyer@example.test', following: [] } });
  otherBuyer = await db.users.create({ data: { name: 'Other Buyer', email: 'other-pc-buyer@example.test', following: [] } });
  seller = await db.sellers.create({ data: { name: 'PC Seller', email: 'pc-seller@example.test', phone_number: '123456789', country: 'Vietnam' } });
  const shop = await db.shops.create({ data: { name: 'PC Shop', sellerId: seller.id } });
  product = await db.products.create({ data: { title: 'Saved Build CPU', slug: 'saved-build-cpu', category: 'PC', subCategory: 'CPU', detailed_description: 'CPU', tags: [], colors: [], sizes: [], stock: 2, sale_price: 80, regular_price: 100, warranty: '1 year', shopId: shop.id, discount_codes: [] } });
}, 180000);

afterAll(async () => { await db?.$disconnect(); await replica?.stop(); });

test('two devices cannot overwrite the same saved-build revision and another account cannot access it', async () => {
  const initial = await request(appFor(controller.getSavedBuild)).get('/?ownerId=' + buyer.id);
  expect(initial.status).toBe(200);
  expect(initial.body.revision).toBe(0);
  const app = appFor(controller.saveBuild, 'put');
  const body = { ownerId: buyer.id, revision: 0, parts: [{ slot: 'cpu', id: product.id }] };
  const writes = await Promise.all([request(app).put('/').send(body), request(app).put('/').send(body)]);
  expect(writes.map(result => result.status).sort()).toEqual([200, 409]);
  expect(await db.savedPcBuild.findUnique({ where: { id: buyer.id } })).toMatchObject({ revision: 1 });

  const reopened = await request(appFor(controller.getSavedBuild)).get('/?ownerId=' + buyer.id);
  expect(reopened.body).toMatchObject({ revision: 1, parts: [{ slot: 'cpu', id: product.id }] });
  expect((await request(appFor(controller.getSavedBuild, 'get', otherBuyer)).get('/?ownerId=' + buyer.id)).status).toBe(403);
  expect((await request(appFor(controller.saveBuild, 'put', otherBuyer)).put('/').send({ ...body, revision: 1 })).status).toBe(403);
  expect((await request(appFor(controller.getSavedBuild, 'get', otherBuyer)).get('/?ownerId=' + otherBuyer.id)).body.parts).toEqual([]);
});

test('saved references use live prices and stock; suspended sellers vanish until suspension expires', async () => {
  const catalog = appFor(controller.buildCatalog);
  const quote = appFor(controller.quoteBuild, 'post');
  const body = { parts: [{ slot: 'cpu', id: product.id, sale_price: 1, stock: 99 }] };
  expect((await request(catalog).get('/?slot=cpu')).body.products.map((p: any) => p.id)).toContain(product.id);
  expect((await request(quote).post('/').send(body)).body).toMatchObject({ total: 80, canAddToCart: true });

  await db.products.update({ where: { id: product.id }, data: { sale_price: 95, stock: 0 } });
  expect((await request(quote).post('/').send(body)).body).toMatchObject({ total: 95, canAddToCart: false });
  await db.products.update({ where: { id: product.id }, data: { stock: 2 } });
  await db.sellers.update({ where: { id: seller.id }, data: { suspendedAt: new Date(), suspendedUntil: null } });
  expect((await request(catalog).get('/?slot=cpu')).body.products).toEqual([]);
  expect((await request(quote).post('/').send(body)).status).toBe(400);

  await db.sellers.update({ where: { id: seller.id }, data: { suspendedUntil: new Date(Date.now() - 1000) } });
  expect((await request(catalog).get('/?slot=cpu')).body.products.map((p: any) => p.id)).toContain(product.id);
  expect((await request(quote).post('/').send(body)).body).toMatchObject({ total: 95, canAddToCart: true });
});

test('PC catalog price sort and pagination agree with live filtered database totals', async () => {
  const createPart = (title: string, price: number, overrides = {}) => db.products.create({ data: {
    title, slug: title.toLowerCase().replace(/ /g, '-'), category: 'PC', subCategory: 'CPU', detailed_description: title,
    tags: [], colors: [], sizes: [], stock: 2, sale_price: price, regular_price: price, warranty: '1 year', shopId: product.shopId, discount_codes: [], ...overrides,
  } });
  const parts = await Promise.all([
    createPart('Catalog Sort CPU A', 50), createPart('Catalog Sort CPU B', 100),
    createPart('Catalog Sort CPU C', 50), createPart('Catalog Sort CPU D', 150),
  ]);
  await Promise.all([
    createPart('Catalog Sort CPU Out', 5, { stock: 0 }),
    createPart('Catalog Sort CPU Deleted', 10, { isDeleted: true }),
    createPart('Catalog Sort GPU', 20, { subCategory: 'GPU' }),
    createPart('Other CPU', 30),
  ]);
  const ascending = [...parts].sort((a, b) => a.sale_price - b.sale_price || a.id.localeCompare(b.id));
  const catalog = appFor(controller.buildCatalog);
  const firstPage = await request(catalog).get('/?slot=cpu&q=Catalog%20Sort&limit=2');
  expect(firstPage.status).toBe(200);
  expect(firstPage.body.pagination).toEqual({ page: 1, total: 4, totalPages: 2 });
  expect(firstPage.body.products.map((p: any) => p.id)).toEqual(ascending.slice(0, 2).map(p => p.id));
  const descending = [...parts].sort((a, b) => b.sale_price - a.sale_price || a.id.localeCompare(b.id));
  const secondPage = await request(catalog).get('/?slot=cpu&q=Catalog%20Sort&sort=priceDesc&limit=2&page=2');
  expect(secondPage.body.pagination).toEqual({ page: 2, total: 4, totalPages: 2 });
  expect(secondPage.body.products.map((p: any) => p.id)).toEqual(descending.slice(2, 4).map(p => p.id));
});
