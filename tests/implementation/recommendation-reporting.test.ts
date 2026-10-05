import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, userId, otherId } from './helpers';
import { similarity, popularity, actionWeight } from '../../apps/recommendation-service/src/services/scoring';
import { personalized, trending } from '../../apps/recommendation-service/src/controllers/recommendation.controller';
import { dateRange, bucket, csv } from '@packages/utils/reporting';
beforeEach(resetDb);
const cpu = { id: 'a', category: 'PC', subCategory: 'CPU', brand: 'AMD', tags: ['gaming'], sale_price: 200 };
test('same category and attributes rank above unrelated products', () => {
  expect(similarity(cpu, { ...cpu, id: 'b' })).toBeGreaterThan(similarity(cpu, { id: 'c', category: 'Home', subCategory: 'Chair', brand: 'Other', tags: [], sale_price: 25 }));
  expect(similarity(cpu, cpu)).toBe(0);
});
test('old engagement decays and purchases have stronger weight', () => {
  const now = Date.now(); const analytics = { views: 10, cartAdds: 1, wishListAdds: 1, purchases: 1, lastViewedAt: new Date(now) };
  expect(popularity(analytics, now)).toBeGreaterThan(popularity({ ...analytics, lastViewedAt: new Date(now - 30 * 86400000) }, now));
  expect(actionWeight('purchase')).toBeGreaterThan(actionWeight('product_view')); expect(actionWeight('remove_from_cart')).toBe(0);
});
test('recommendations cannot expose another user history', async () => {
  expect((await request(appFor('get', '/:userId', personalized)).get('/' + otherId)).status).toBe(403); expect(db.userAnalytics.findUnique).not.toHaveBeenCalled();
});
test('cold start falls back to trending available products', async () => {
  db.userAnalytics.findUnique.mockResolvedValue(null); db.products.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([cpu]); db.productAnalytics.findMany.mockResolvedValue([]);
  const response = await request(appFor('get', '/:userId', personalized)).get('/' + userId);
  expect(response.status).toBe(200); expect(response.body.strategy).toBe('cold-start-trending');
  expect(db.products.findMany.mock.calls[1][0].where).toEqual({ isDeleted: false, status: 'Active', stock: { gt: 0 } });
});
test('trending excludes unavailable products and clamps requested limit', async () => {
  db.products.findMany.mockResolvedValue([cpu]); db.productAnalytics.findMany.mockResolvedValue([]);
  expect((await request(appFor('get', '/', trending)).get('/?limit=999')).status).toBe(200);
  expect(db.products.findMany.mock.calls[0][0].where.stock).toEqual({ gt: 0 });
});
test.each([{ from: 'invalid' }, { from: '2026-12-01', to: '2026-01-01' }, { from: '2020-01-01', to: '2026-01-01' }])('invalid report ranges are rejected', input => { expect(() => dateRange(input)).toThrow(); });
test('to-date includes the entire day and weekly buckets start Monday', () => {
  expect(dateRange({ from: '2026-10-01', to: '2026-10-04' }).lte.toISOString()).toBe('2026-10-04T23:59:59.999Z');
  expect(bucket(new Date('2026-10-04'), 'week')).toBe('2026-09-28');
  expect(bucket(new Date('2026-10-04'), 'month')).toBe('2026-10');
});
test('CSV safely quotes commas/newlines and spreadsheet formulas', () => {
  const result = csv([{ title: '=1+1', value: 'a,"b"\nnext' }]);
  expect(result).toContain('"\'=1+1"'); expect(result).toContain('"a,""b""\nnext"'); expect(csv([])).toBe('');
});
