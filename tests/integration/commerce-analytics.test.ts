import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import { errorMiddleware } from '@packages/error-handler/error-middleware';

let replica: MongoMemoryReplSet, db: any, report: any, details: any, customerDetail: any, clearCache: any;
let sellerController: any, adminController: any;
let shop: any, otherShop: any, buyer: any, product: any, ram: any, unsold: any, otherProduct: any, variants: any[];
const query = { period: 'custom', from: '2026-10-10', to: '2026-10-10' };
function appFor(handler: any) {
  const app = express(); app.use((req: any, _res, next) => { req.seller = { id: shop.sellerId, shop }; next(); });
  app.get('/:id?', handler); app.use(errorMiddleware); return app;
}
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.DATABASE_URL = replica.getUri('commerce_analytics_tests');
  if (!process.env.DATABASE_URL.startsWith('mongodb://127.0.0.1:')) throw new Error('Disposable database required');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: { ...process.env }, windowsHide: true });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Schema setup timed out')); }, 90000);
    child.on('error', error => { clearTimeout(timer); reject(error); }); child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(output)); });
  });
  db = require('@packages/libs/prisma').default;
  ({ commerceAnalytics: report, productAnalyticsDetail: details, clearCommerceAnalyticsCache: clearCache } = require('@packages/utils/commerce-analytics-report'));
  customerDetail = require('@packages/utils/commerce-customer-analytics').customerAnalyticsDetail;
  sellerController = require('../../apps/product-service/src/controllers/statistics.controller');
  adminController = require('../../apps/admin-service/src/controllers/statistics.controller');
  const makeShop = async (name: string) => {
    const seller = await db.sellers.create({ data: { name, email: `${name}@example.test`, phone_number: 'private-phone', country: 'Vietnam' } });
    return db.shops.create({ data: { name, sellerId: seller.id } });
  };
  shop = await makeShop('Analytics One'); otherShop = await makeShop('Analytics Two');
  buyer = await db.users.create({ data: { name: 'PRIVATE BUYER', email: 'private-buyer@example.test', following: [] } });
  const makeProduct = (title: string, category: string, stock: number, price: number, overrides = {}) => db.products.create({ data: { title, slug: title.toLowerCase().replace(/ /g, '-'), category, subCategory: category, detailed_description: title, tags: [], colors: [], sizes: [], stock, sale_price: price, regular_price: price, warranty: '1 year', shopId: shop.id, discount_codes: [], ...overrides } });
  product = await makeProduct('Analytics CPU', 'CPU', 2, 1);
  ram = await makeProduct('Analytics RAM', 'RAM', 0, 1);
  unsold = await makeProduct('Unsold SSD', 'Storage', 9, 10);
  await makeProduct('Inactive cooler', 'Cooling', 4, 10, { status: 'Inactive' });
  otherProduct = await makeProduct('Other shop GPU', 'GPU', 12, 10, { shopId: otherShop.id });
  variants = await Promise.all([
    db.productVariant.create({ data: { productId: product.id, sku: 'CPU-A', color: 'A', size: '', stock: 2, price: 1 } }),
    db.productVariant.create({ data: { productId: product.id, sku: 'CPU-B', color: 'B', size: '', stock: 0, price: 1 } }),
    db.productVariant.create({ data: { productId: product.id, sku: 'CPU-OLD', color: 'Old', size: '', stock: 10, price: 1, active: false } }),
  ]);
  let sequence = 0;
  const line = (p: any, quantity: number, totalPrice: number, variant?: any) => ({ productId: p.id, title: p.title, quantity, totalPrice, unitPrice: totalPrice / quantity, ...(variant ? { variantId: variant.id, sku: variant.sku } : {}) });
  const purchase = (lines: any[], overrides = {}) => db.orders.create({ data: { orderNumber: `PRIVATE-ORDER-${++sequence}`, userId: buyer.id, shopId: shop.id, subTotal: lines.reduce((n, item) => n + item.totalPrice, 0), totalAmount: lines.reduce((n, item) => n + item.totalPrice, 0), paymentStatus: 'Paid', status: 'Delivered', shippingAddress: { street: 'PRIVATE ADDRESS', phone: 'PRIVATE PHONE' }, createdAt: new Date('2026-10-09T17:00:00Z'), items: { create: lines }, ...overrides } });
  await purchase([line(product, 1, 1, variants[0]), line(product, 1, 1, variants[1]), line(ram, 1, 1)], { discount: 0.01, shippingFee: 2, totalAmount: 4.99, platformFeeCents: 49 });
  await purchase([line(product, 2, 4, variants[0])], { discount: 0.5, totalAmount: 3.5, status: 'Confirmed', createdAt: new Date('2026-10-10T06:00:00Z') });
  await purchase([line(product, 1, 2, variants[0])], { discount: 0.2, shippingFee: 0.5, totalAmount: 2.3, status: 'Returned' });
  await purchase([line(product, 1, 2, variants[0])], { paymentStatus: 'Refunded', status: 'Refunded' });
  await purchase([line(ram, 3, 3)], { paymentStatus: 'Pending', status: 'Cancelled' });
  await purchase([line(ram, 1, 1)], { paymentStatus: 'Pending', status: 'Pending' });
  await purchase([line(product, 2, 4, variants[0])], { createdAt: new Date('2026-10-09T00:00:00Z') });
  await purchase([line(otherProduct, 5, 50)], { shopId: otherShop.id, discount: 5, shippingFee: 1, totalAmount: 46 });
  await purchase([line(product, 100, 100)], { currency: 'eur' });
  await db.productAnalytics.create({ data: { productId: product.id, views: 100, cartAdds: 20, wishListAdds: 2, lastViewedAt: new Date() } });
}, 180000);
beforeEach(() => clearCache());
afterAll(async () => { await db?.$disconnect(); await replica?.stop(); });

test('sales metrics reconcile to cents, include the Vietnam boundary and compare the preceding equal-duration period', async () => {
  const data = await report(query, 'seller', shop.id);
  expect(data.summary).toMatchObject({ grossSales: 7, discounts: 0.51, netSales: 6.49, shipping: 2, paidAmount: 8.49, units: 5, refundedAmount: 2, awaitingRefundAmount: 2.3, platformFees: 0.49, feeCoveragePercent: 50, reconciliationDifference: 0, unallocatedDiscount: 0 });
  expect(data.seller).toMatchObject({ orders: 2, customers: 1, repeatCustomers: 1, repeatRate: 100, averageOrderValue: 4.25 });
  expect(data.comparison.netSales).toMatchObject({ previous: 4, current: 6.49, difference: 2.49, percent: 62.25 });
  expect(data.timeline).toEqual([{ date: '2026-10-10', grossSales: 7, discounts: 0.51, netSales: 6.49, units: 5, refundedAmount: 2 }]);
  expect(data.demand.find((row: any) => row.hour === 0)).toMatchObject({ weekday: 5, units: 3 });
  expect(data.products.rows.reduce((n: number, row: any) => n + Math.round(row.discounts * 100), 0)).toBe(51);
});

test('inventory includes unsold products and only available active SKU stock; listing prices never rewrite historical sales', async () => {
  const data = await report(query, 'seller', shop.id);
  expect(data.inventory).toMatchObject({ products: 4, activeProducts: 3, availableUnits: 11, recordedUnits: 15, retailValue: 92, lowStock: 1, outOfStock: 1, noSales: 1, activeSkus: 2, lowStockSkus: 1, outOfStockSkus: 1 });
  expect(data.products.rows.find((row: any) => row.id === unsold.id)).toMatchObject({ units: 0, netSales: 0, availableStock: 9, coverageDays: null });
  expect(data.products.rows.find((row: any) => row.id === product.id)).toMatchObject({ units: 4, grossSales: 6, discounts: 0.51, netSales: 5.49, previousNetSales: 4, availableStock: 2, coverageDays: 0.5 });
});

test('admin gets product/shop aggregates only, never order/customer fields, and forbidden personal filters fail before a response', async () => {
  const data = await report(query, 'admin');
  expect(data.summary).toMatchObject({ netSales: 51.49, units: 10 });
  expect(data.shops).toHaveLength(2);
  expect(data).not.toHaveProperty('seller');
  const body = JSON.stringify(data);
  for (const value of [buyer.id, buyer.email, 'PRIVATE BUYER', 'PRIVATE ADDRESS', 'PRIVATE-ORDER']) expect(body).not.toContain(value);
  expect(data.outcomes.every((row: any) => row.count === undefined)).toBe(true);
  await expect(report({ ...query, customerId: buyer.id }, 'admin')).rejects.toThrow('do not expose');
  await expect(report({ ...query, view: 'shops' }, 'seller', shop.id)).rejects.toThrow();
  const filtered = await report(query, 'admin', otherShop.id);
  expect(filtered.summary).toMatchObject({ netSales: 45, units: 5 });
});

test('pagination and table-only filters do not truncate summary totals or full CSV exports', async () => {
  const data = await report({ ...query, limit: '1', page: '2' }, 'seller', shop.id);
  expect(data.products.rows).toHaveLength(1); expect(data.products.total).toBe(4); expect(data.summary.netSales).toBe(6.49);
  const noSales = await report({ ...query, stock: 'noSales' }, 'seller', shop.id);
  expect(noSales.products.rows.map((row: any) => row.id)).toEqual([unsold.id]);
  const exported = await report({ ...query, format: 'csv', page: '99', limit: '1' }, 'admin');
  expect(exported.csv).toContain('Other shop GPU'); expect(exported.csv).toContain('Unsold SSD'); expect(exported.csv).not.toContain(buyer.email);
  const empty = await report({ ...query, q: 'no match', format: 'csv' }, 'admin');
  expect(empty.csv).toContain('netProductSalesUSD'); expect(empty.csv.split('\r\n')).toHaveLength(1);
});

test('product details reconcile SKU allocations, retain zero-sale/retired SKUs and reject another shop', async () => {
  const data = await details(product.id, query, 'admin', shop.id);
  expect(data.variants).toHaveLength(3);
  expect(data.variants.reduce((n: number, row: any) => n + Math.round(row.netSales * 100), 0)).toBe(549);
  expect(data.variants.find((row: any) => row.sku === 'CPU-OLD')).toMatchObject({ active: false, units: 0, stock: 10 });
  expect(data.engagement).toMatchObject({ views: 100, cartAdds: 20, wishListAdds: 2, reviews: 0, averageRating: null });
  await expect(details(otherProduct.id, query, 'seller', shop.id)).rejects.toThrow('not part');
});

test('seller customer profiles contain only that shop history with scoped pagination and exports', async () => {
  const data = await customerDetail(buyer.id, { ...query, limit: '1', page: '2' }, shop.id);
  expect(data.summary).toMatchObject({ orders: 2, units: 5, totalSpent: 8.49 });
  expect(data.lifetime).toMatchObject({ orders: 3, units: 7, totalSpent: 12.49 });
  expect(data.purchases).toHaveLength(1); expect(data.pagination).toMatchObject({ page: 2, total: 2, totalPages: 2 });
  expect(data.products).toHaveLength(2); expect(JSON.stringify(data)).not.toContain('Other shop GPU');
  await expect(customerDetail('111111111111111111111111', query, shop.id)).rejects.toThrow('no qualifying');
});

test('empty periods have zero-filled charts, all-time has no artificial comparison, and refresh updates inventory', async () => {
  const empty = await report({ period: 'custom', from: '2019-01-01', to: '2019-01-03' }, 'seller', shop.id);
  expect(empty.summary.netSales).toBe(0); expect(empty.timeline).toHaveLength(3); expect(empty.comparison.netSales.percent).toBe(0);
  const all = await report({ period: 'all' }, 'admin');
  expect(all.comparison).toBeNull(); expect(all.period.from).toBeTruthy(); expect(all.timeline.length).toBeGreaterThan(0);
  await db.products.update({ where: { id: unsold.id }, data: { stock: 8 } });
  const fresh = await report({ ...query, refresh: 'after-stock-change' }, 'seller', shop.id);
  expect(fresh.inventory.availableUnits).toBe(10);
});

test('HTTP seller scope cannot be overridden and admin personal-history requests are forbidden', async () => {
  const result = await request(appFor(sellerController.sellerAnalytics)).get('/').query({ ...query, shopId: otherShop.id });
  expect(result.status).toBe(200); expect(result.body.summary.netSales).toBe(6.49); expect(result.headers['cache-control']).toBe('no-store');
  const denied = await request(appFor(adminController.adminAnalytics)).get('/').query({ ...query, userId: buyer.id });
  expect(denied.status).toBe(403);
});
