import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { analyticsOptions } from '@packages/utils/commerce-analytics-options';
import { analyticsBucket, changeMetric, fillAnalyticsTimeline } from '@packages/utils/commerce-analytics';
import { analyticsCsv, clearCommerceAnalyticsCache, commerceAnalytics } from '@packages/utils/commerce-analytics-report';
import db, { resetDb } from './mocks/prisma';
import { userId, shopId, otherId } from './helpers';
import router from '../../apps/admin-service/src/routes/admin.route';
import { errorMiddleware } from '@packages/error-handler/error-middleware';

beforeEach(() => {
  resetDb(); clearCommerceAnalyticsCache();
  db.orders.aggregateRaw.mockResolvedValue([]); db.products.findMany.mockResolvedValue([]);
  db.productReport.count.mockResolvedValue(0); db.productViolation.groupBy.mockResolvedValue([]);
});
test('presets use Vietnam calendar days and equal contiguous previous intervals', () => {
  const now = new Date('2026-11-03T08:30:00Z');
  const { period } = analyticsOptions({ period: '7d' }, 'seller', now);
  expect(period.from).toBe('2026-10-27T17:00:00.000Z'); expect(period.to).toBe(now.toISOString());
  const length = now.getTime() - new Date(period.from!).getTime() + 1;
  expect(new Date(period.previous!.to).getTime()).toBe(new Date(period.from!).getTime() - 1);
  expect(new Date(period.previous!.to).getTime() - new Date(period.previous!.from).getTime() + 1).toBe(length);
  expect(analyticsOptions({ period: 'month' }, 'admin', now).period.from).toBe('2026-10-31T17:00:00.000Z');
  expect(analyticsOptions({ period: 'all' }, 'admin', now).period.previous).toBeNull();
});
test('day, week and month buckets share Vietnam boundaries and fill zero-activity gaps', () => {
  expect(analyticsBucket('2026-11-01T17:00:00Z', 'week')).toBe('2026-11-02');
  expect(analyticsBucket('2026-10-31T17:00:00Z', 'month')).toBe('2026-11');
  const data = fillAnalyticsTimeline([{ date: '2026-10-10', units: 2, grossSales: 10, discounts: 1, netSales: 9, refundedAmount: 0 }], '2026-10-09T17:00:00Z', '2026-10-12T16:59:59Z', 'day');
  expect(data.map(row => row.date)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
  expect(data.map(row => row.units)).toEqual([2, 0, 0]);
});
test('zero-baseline comparisons never claim infinite growth and preserve actual differences', () => {
  expect(changeMetric(12, 0)).toEqual({ current: 12, previous: 0, difference: 12, percent: null });
  expect(changeMetric(0, 0).percent).toBe(0);
  expect(changeMetric(0.3, 0.1)).toMatchObject({ difference: 0.2, percent: 200 });
});
test.each([
  { period: 'custom', from: '2026-02-30', to: '2026-03-01' },
  { period: 'custom', from: '2026-10-10' },
  { period: 'custom', from: '2026-10-11', to: '2026-10-10' },
  { period: 'custom', from: '2020-01-01', to: '2026-01-01' },
  { period: ['30d', 'all'] }, { period: 'unknown' }, { interval: {} }, { q: {} },
  { view: 'orders' }, { format: 'pdf' }, { sort: 'orders' }, { stock: 'unknown' },
  { from: '2026-10-10', to: '2026-10-11' },
])('invalid report inputs fail before any database query: %j', async query => {
  await expect(commerceAnalytics(query, 'admin')).rejects.toThrow();
  expect(db.orders.aggregateRaw).not.toHaveBeenCalled(); expect(db.products.findMany).not.toHaveBeenCalled();
});
test('cache scope separates seller shops and an explicit refresh reads new data', async () => {
  await commerceAnalytics({ period: 'all' }, 'seller', shopId);
  const firstReads = db.orders.aggregateRaw.mock.calls.length;
  await commerceAnalytics({ period: 'all', page: '2' }, 'seller', shopId);
  expect(db.orders.aggregateRaw.mock.calls).toHaveLength(firstReads);
  await commerceAnalytics({ period: 'all' }, 'seller', otherId);
  expect(db.orders.aggregateRaw.mock.calls.at(-1)[0].pipeline[0].$match.shopId).toEqual({ $oid: otherId });
  await commerceAnalytics({ period: 'all', refresh: 'force-a-new-snapshot' }, 'seller', shopId);
  expect(db.orders.aggregateRaw.mock.calls).toHaveLength(firstReads + 2);
});
test('CSV output has a header even when empty and escapes spreadsheet formulas', () => {
  expect(analyticsCsv(['name', 'amount'], [])).toBe('"name","amount"');
  expect(analyticsCsv(['name'], [{ name: '=1+1' }])).toContain("'=1+1");
});
test('admin endpoints require authentication; finance gets aggregates but no customer dimension or raw orders', async () => {
  const app = express(); app.use('/admin', router); app.use(errorMiddleware);
  expect((await request(app).get('/admin/analytics')).status).toBe(401);
  db.users.findUnique.mockResolvedValue({ id: userId, role: 'admin', adminRole: 'finance' });
  const token = jwt.sign({ id: userId, role: 'admin' }, process.env.ACCESS_TOKEN_JWT_SECRET!);
  const response = await request(app).get('/admin/analytics?period=all').set('Authorization', `Bearer ${token}`);
  expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store'); expect(response.body).not.toHaveProperty('seller');
  expect(db.orders.findMany).not.toHaveBeenCalled(); expect(db.orderItems.findMany).not.toHaveBeenCalled();
  for (const key of ['customerId', 'userId', 'orderId', 'email']) {
    expect((await request(app).get('/admin/analytics').query({ [key]: userId }).set('Authorization', `Bearer ${token}`)).status).toBe(403);
  }
  expect((await request(app).get('/admin/analytics/customers/' + userId).set('Authorization', `Bearer ${token}`)).status).toBe(404);
  expect((await request(app).get('/admin/orders').set('Authorization', `Bearer ${token}`)).status).toBe(403);
});
