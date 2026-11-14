import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { errorMiddleware } from '@packages/error-handler/error-middleware';

jest.mock('@packages/libs/imagekit', () => ({ imageKit: { upload: jest.fn(), deleteFile: jest.fn() } }));
jest.mock('@packages/utils/logs/behavior-log', () => ({ sendBehaviorLog: jest.fn() }));

let replica: MongoMemoryReplSet;
let db: any;
let controller: any;
let assignment: any;
let seller: any;
let otherSeller: any;
let shop: any;
let otherShop: any;
let sequence = 0;

function waitForSnapshot(snapshot: Promise<void>) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Deletion did not reach the expected transaction snapshot')), 10000);
    snapshot.then(() => { clearTimeout(timeout); resolve(); }, error => { clearTimeout(timeout); reject(error); });
  });
}

function appFor(actor = seller) {
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { req.seller = { ...actor, shop: actor.id === seller.id ? shop : otherShop }; req.role = 'seller'; next(); });
  app.delete('/:id', controller.deleteDiscountCodes); app.patch('/:id', assignment.updateDiscountProducts); app.use(errorMiddleware); return app;
}

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.DATABASE_URL = replica.getUri('discount_deletion_tests');
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
  controller = require('../../apps/product-service/src/controllers/product.controller');
  assignment = require('../../apps/product-service/src/controllers/discount-products.controller');
  seller = await db.sellers.create({ data: { name: 'Discount Seller', email: 'discount-seller@example.test', phone_number: '123456789', country: 'Vietnam' } });
  otherSeller = await db.sellers.create({ data: { name: 'Other Discount Seller', email: 'other-discount-seller@example.test', phone_number: '123456789', country: 'Vietnam' } });
  shop = await db.shops.create({ data: { name: 'Discount Shop', sellerId: seller.id } });
  otherShop = await db.shops.create({ data: { name: 'Other Discount Shop', sellerId: otherSeller.id } });
}, 180000);

afterEach(() => jest.restoreAllMocks());
afterAll(async () => { await db?.$disconnect(); await replica?.stop(); });

async function fixture() {
  const suffix = ++sequence;
  const makeCode = (name: string) => db.discountCodes.create({ data: { public_name: name, discountType: 'percentage', discountValue: 10, discountCode: `${name}-${suffix}`, sellerId: seller.id } });
  const [code, keep] = await Promise.all([makeCode('Remove'), makeCode('Keep')]);
  const createProduct = (name: string, shopId: string, isDeleted = false) => db.products.create({ data: {
    title: name, slug: `${name.toLowerCase().replace(/ /g, '-')}-${suffix}`, category: 'PC', subCategory: 'CPU', detailed_description: name,
    tags: [], colors: [], sizes: [], stock: 2, sale_price: 80, regular_price: 100, warranty: '1 year', shopId, isDeleted, discount_codes: [keep.id, code.id],
  } });
  const [item, archived, foreign] = await Promise.all([createProduct('Discount Item', shop.id), createProduct('Archived Discount Item', shop.id, true), createProduct('Foreign Discount Item', otherShop.id)]);
  return { code, keep, item, archived, foreign };
}

test('deleting a code atomically cleans live and archived own products and leaves another seller unchanged', async () => {
  const { code, keep, item, archived, foreign } = await fixture();
  expect((await request(appFor()).delete('/' + code.id)).status).toBe(200);
  expect(await db.discountCodes.findUnique({ where: { id: code.id } })).toBeNull();
  for (const product of [item, archived]) expect((await db.products.findUnique({ where: { id: product.id } })).discount_codes).toEqual([keep.id]);
  expect((await db.products.findUnique({ where: { id: foreign.id } })).discount_codes).toEqual([keep.id, code.id]);
});

test('another seller cannot delete the code or alter any assignments', async () => {
  const { code, keep, item } = await fixture();
  expect((await request(appFor(otherSeller)).delete('/' + code.id)).status).toBe(403);
  expect(await db.discountCodes.findUnique({ where: { id: code.id } })).not.toBeNull();
  expect((await db.products.findUnique({ where: { id: item.id } })).discount_codes).toEqual([keep.id, code.id]);
});

test('a failure deleting the code rolls back product array cleanup in real MongoDB', async () => {
  const { code, keep, item, archived } = await fixture();
  const runTransaction = db.$transaction.bind(db);
  jest.spyOn(db, '$transaction').mockImplementationOnce((work: any, options: any) => runTransaction(async (tx: any) => work({
    ...tx,
    discountCodes: { findUnique: tx.discountCodes.findUnique, delete: async () => { throw new Error('Injected failure after product updates'); } },
  }), options));
  expect((await request(appFor()).delete('/' + code.id)).status).toBe(500);
  expect(await db.discountCodes.findUnique({ where: { id: code.id } })).not.toBeNull();
  for (const product of [item, archived]) expect((await db.products.findUnique({ where: { id: product.id } })).discount_codes).toEqual([keep.id, code.id]);
});

test('a conflicting product update retries cleanup without losing the newly assigned code', async () => {
  const { code, keep, item } = await fixture();
  const added = await db.discountCodes.create({ data: { public_name: 'Concurrent', discountType: 'fixed', discountValue: 5, discountCode: `Concurrent-${sequence}`, sellerId: seller.id } });
  let captured!: () => void; let release!: () => void;
  const snapshotCaptured = new Promise<void>(resolve => { captured = resolve; });
  const releaseSnapshot = new Promise<void>(resolve => { release = resolve; });
  const runTransaction = db.$transaction.bind(db);
  const spy = jest.spyOn(db, '$transaction').mockImplementationOnce((work: any, options: any) => runTransaction(async (tx: any) => work({
    ...tx,
    products: { findMany: async (args: any) => { const products = await tx.products.findMany(args); captured(); await releaseSnapshot; return products; }, update: tx.products.update },
  }), options));
  const pending = request(appFor()).delete('/' + code.id).then(response => response);
  try {
    await waitForSnapshot(snapshotCaptured);
    await db.products.update({ where: { id: item.id }, data: { discount_codes: { push: added.id } } });
  } finally { release(); }
  expect((await pending).status).toBe(200);
  expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect((await db.products.findUnique({ where: { id: item.id } })).discount_codes).toEqual([keep.id, added.id]);
  expect(await db.discountCodes.findUnique({ where: { id: code.id } })).toBeNull();
});

test('a concurrent assignment to a previously unlinked product cannot survive code deletion', async () => {
  const { code, keep, item, archived } = await fixture();
  await db.products.updateMany({ where: { id: { in: [item.id, archived.id] } }, data: { discount_codes: { set: [keep.id] } } });
  let captured!: () => void; let release!: () => void;
  const snapshotCaptured = new Promise<void>(resolve => { captured = resolve; });
  const releaseSnapshot = new Promise<void>(resolve => { release = resolve; });
  const runTransaction = db.$transaction.bind(db);
  const spy = jest.spyOn(db, '$transaction').mockImplementationOnce((work: any, options: any) => runTransaction(async (tx: any) => work({
    ...tx,
    products: { findMany: async (args: any) => { const products = await tx.products.findMany(args); expect(products).toEqual([]); captured(); await releaseSnapshot; return products; }, update: tx.products.update },
  }), options));
  const pendingDeletion = request(appFor()).delete('/' + code.id).then(response => response);
  try {
    await waitForSnapshot(snapshotCaptured);
    expect((await request(appFor()).patch('/' + code.id).send({ productIds: [item.id] })).status).toBe(200);
  } finally { release(); }
  expect((await pendingDeletion).status).toBe(200);
  expect(spy.mock.calls.length).toBeGreaterThanOrEqual(3);
  expect(await db.discountCodes.findUnique({ where: { id: code.id } })).toBeNull();
  expect((await db.products.findUnique({ where: { id: item.id } })).discount_codes).toEqual([keep.id]);
  expect(await db.products.count({ where: { shopId: shop.id, discount_codes: { has: code.id } } })).toBe(0);
});
