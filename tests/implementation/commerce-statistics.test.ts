import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { purchaseStatistics } from '@packages/utils/commerce-statistics';
import { commerceStatistics, statisticsOptions } from '@packages/utils/commerce-statistics-report';
import db, { resetDb } from './mocks/prisma';
import { appFor, userId, shopId, otherId, productId } from './helpers';
import { sellerStatistics } from '../../apps/product-service/src/controllers/statistics.controller';
import { adminStatistics } from '../../apps/admin-service/src/controllers/statistics.controller';
import adminRouter from '../../apps/admin-service/src/routes/admin.route';
import { errorMiddleware } from '@packages/error-handler/error-middleware';

const secondProduct = '555555555555555555555555';
const item = (id: string, quantity: number, totalPrice: number) => ({ productId: id, title: `Item ${id}`, quantity, totalPrice });
const order = (id: string, items = [item(productId, 2, 20)], overrides = {}) => ({ id, userId, user: { name: 'Buyer', email: 'buyer@example.test' }, items, totalAmount: 18, createdAt: new Date('2026-10-10T10:00:00Z'), ...overrides });

beforeEach(() => { resetDb(); db.orders.findMany.mockResolvedValue([]); db.orders.aggregateRaw.mockResolvedValue([]); db.products.findMany.mockResolvedValue([]); });

test('counts quantities, unique products, orders and buyers without counting SKU rows as orders', () => {
  const stats = purchaseStatistics();
  stats.add(order('o1', [item(productId, 2, 20), item(productId, 1, 10), item(secondProduct, 1, 5)], { totalAmount: 32 }));
  stats.add(order('o2', [item(productId, 1, 12)], { totalAmount: 15, createdAt: new Date('2026-10-12T10:00:00Z') }));
  stats.add(order('o3', [item(productId, 3, 33)], { userId: otherId, totalAmount: 30 }));
  const buyers = stats.result('customers');
  expect(buyers.summary).toEqual({ orders: 3, units: 8, customers: 2, products: 2, totalSpent: 77, productSales: 80, averageOrderValue: 25.67 });
  expect(buyers.rows.find(row => row.id === userId)).toMatchObject({ orders: 2, units: 5, distinctCount: 2, amount: 47, average: 23.5, lastPurchasedAt: '2026-10-12T10:00:00.000Z' });
  expect(stats.result('products').rows.find(row => row.id === productId)).toMatchObject({ orders: 3, units: 7, distinctCount: 2, amount: 75, average: 10.71 });
});

test('adds money in integer cents and handles an empty period', () => {
  const stats = purchaseStatistics();
  expect(stats.result('customers').summary.averageOrderValue).toBe(0);
  stats.add(order('a', [item(productId, 1, 0.1)], { totalAmount: 0.1 }));
  stats.add(order('b', [item(productId, 1, 0.2)], { totalAmount: 0.2 }));
  expect(stats.result('products').summary).toMatchObject({ totalSpent: 0.3, productSales: 0.3 });
});

test('seller scope comes only from the authenticated shop, even in CSV requests', async () => {
  db.orders.findMany.mockResolvedValue([order('o1')]);
  const response = await request(appFor('get', '/', sellerStatistics, 'seller')).get(`/?shopId=${otherId}&format=csv`);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.text).toContain('buyer@example.test');
  expect(db.orders.findMany.mock.calls[0][0].where).toMatchObject({ shopId, currency: 'usd', paymentStatus: 'Paid', status: { notIn: ['Cancelled', 'Returned', 'Refunded'] } });
  const select = db.orders.findMany.mock.calls[0][0].select;
  expect(select.user.select).toEqual({ name: true, email: true });
});

test('seller without a shop cannot fall back to a marketplace report', async () => {
  const app = express(); app.use((req: any, _res, next) => { req.seller = { id: userId }; next(); });
  app.get('/', sellerStatistics); app.use(errorMiddleware);
  expect((await request(app).get('/')).status).toBe(404);
  expect(db.orders.findMany).not.toHaveBeenCalled();
});

test('admin sees aggregated product totals or one shop, without loading customer orders', async () => {
  const app = appFor('get', '/', adminStatistics, 'admin');
  expect((await request(app).get('/')).status).toBe(200);
  expect(db.orders.aggregateRaw.mock.calls[0][0].pipeline[0].$match.shopId).toBeUndefined();
  expect(db.orders.findMany).not.toHaveBeenCalled();
  expect((await request(app).get(`/?shopId=${shopId}`)).status).toBe(200);
  expect(db.orders.aggregateRaw.mock.calls[1][0].pipeline[0].$match.shopId).toEqual({ $oid: shopId });
  expect((await request(app).get('/?kind=customers')).status).toBe(403);
  expect((await request(app).get('/?shopId=invalid')).status).toBe(400);
});

test('aggregation reads beyond a database batch and paginates sorted customer totals afterwards', async () => {
  db.orders.findMany.mockResolvedValueOnce(Array.from({ length: 1000 }, (_, i) => order(`order-${i}`, [item(productId, 1, 1)], { totalAmount: 1 })))
    .mockResolvedValueOnce([order('last-order', [item(productId, 1, 2000)], { userId: otherId, totalAmount: 2000 })]);
  const report = await commerceStatistics({ limit: '1', page: '2' });
  expect(report).toMatchObject({ summary: { orders: 1001, units: 1001, totalSpent: 3000 }, rows: [{ id: userId, orders: 1000, amount: 1000 }], pagination: { page: 2, total: 2, totalPages: 2 } });
  expect(db.orders.findMany.mock.calls[1][0].where.id).toEqual({ gt: 'order-999' });
});

test('product metadata search, sorting, deleted-product snapshots and current stock are available', async () => {
  db.orders.findMany.mockResolvedValue([order('o', [item(productId, 3, 30), item(secondProduct, 1, 80)])]);
  db.products.findMany.mockResolvedValue([{ id: productId, title: 'Current product title', stock: 7, shop: { name: 'Shop A' } }]);
  const report = await commerceStatistics({ kind: 'products', q: 'Shop A', sort: 'units' }, shopId);
  expect(report).toMatchObject({ rows: [{ id: productId, name: 'Current product title', stock: 7, shopName: 'Shop A', units: 3, amount: 30 }], pagination: { total: 1 }, summary: { products: 2 } });
  expect(db.products.findMany.mock.calls[0][0].where.shopId).toBe(shopId);
  const all = await commerceStatistics({ kind: 'products' });
  expect('rows' in all && all.rows[0]).toMatchObject({ id: secondProduct, name: `Item ${secondProduct}`, amount: 80 });
});

test('CSV exports all filtered rows across pages and escapes spreadsheet formulas', async () => {
  db.orders.findMany.mockResolvedValue([order('a', undefined, { user: { name: '=DANGEROUS()', email: 'a@example.test' } }), order('b', undefined, { userId: otherId, user: { name: 'Other buyer', email: 'b@example.test' } })]);
  const exported = await commerceStatistics({ format: 'csv', limit: '1', page: '99' });
  expect('csv' in exported && exported.csv).toContain("'=DANGEROUS()");
  expect('csv' in exported && exported.csv).toContain('a@example.test');
  expect('csv' in exported && exported.csv).toContain('b@example.test');
});

test('date-only filters include both full days in Vietnam time', () => {
  const options = statisticsOptions({ from: '2026-10-10', to: '2026-10-11' }, new Date('2026-11-01T00:00:00Z'));
  expect(options.createdAt).toEqual({ gte: new Date('2026-10-09T17:00:00Z'), lte: new Date('2026-10-11T16:59:59.999Z') });
});

test.each([
  { from: '2026-10-10' }, { to: '2026-10-10' }, { from: '2026-02-30', to: '2026-03-01' },
  { from: '2026-10-11', to: '2026-10-10' }, { from: '2020-01-01', to: '2026-01-01' },
  { kind: 'users' }, { sort: ['amount', 'units'] }, { q: {} }, { format: 'pdf' },
])('invalid statistics input is rejected before querying orders: %j', async query => {
  await expect(commerceStatistics(query)).rejects.toThrow();
  expect(db.orders.findMany).not.toHaveBeenCalled();
});

test.each(['user', 'seller', 'unknown-admin'])('admin statistics route rejects %s sessions', async role => {
  const app = express(); app.use('/admin', adminRouter); app.use(errorMiddleware);
  db.users.findUnique.mockResolvedValue({ id: userId, role: 'admin', adminRole: 'unknown' });
  db.sellers.findUnique.mockResolvedValue({ id: userId, shop: { id: shopId } });
  const token = jwt.sign({ id: userId, role: role === 'unknown-admin' ? 'admin' : role }, process.env.ACCESS_TOKEN_JWT_SECRET!);
  const response = await request(app).get('/admin/statistics').set('Authorization', `Bearer ${token}`);
  expect([401, 403]).toContain(response.status);
  expect(db.orders.findMany).not.toHaveBeenCalled();
});

test('admin statistics route requires authentication and accepts a finance session with aggregate overview access', async () => {
  const app = express(); app.use('/admin', adminRouter); app.use(errorMiddleware);
  expect((await request(app).get('/admin/statistics')).status).toBe(401);
  db.users.findUnique.mockResolvedValue({ id: userId, role: 'admin', adminRole: 'finance' });
  const token = jwt.sign({ id: userId, role: 'admin' }, process.env.ACCESS_TOKEN_JWT_SECRET!);
  expect((await request(app).get('/admin/statistics').set('Authorization', `Bearer ${token}`)).status).toBe(200);
});
