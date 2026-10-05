import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, shopId } from './helpers';
import { revenueReport } from '../../apps/product-service/src/controllers/reports.controller';

beforeEach(resetDb);
const app = () => appFor('get', '/', revenueReport, 'seller');
const order = (createdAt: string, totalAmount: number) => ({ createdAt: new Date(createdAt), totalAmount, discount: 0, items: [] });

test('year report includes twelve months, aggregates boundaries and fills empty months', async () => {
  db.orders.findMany.mockResolvedValue([
    order('2024-01-31T23:59:59.999Z', 10),
    order('2024-02-01T00:00:00Z', 20),
    order('2024-02-29T23:59:59.999Z', 30),
    order('2024-12-31T23:59:59.999Z', 40),
  ]);
  db.discountCodes.findMany.mockResolvedValue([]);
  const response = await request(app()).get('/?from=2024-01-01&to=2024-12-31&interval=month');
  expect(response.status).toBe(200);
  expect(response.body.timeline).toHaveLength(12);
  expect(response.body.timeline[1]).toMatchObject({ date: '2024-02', revenue: 50, orders: 2 });
  expect(response.body.timeline[2]).toMatchObject({ date: '2024-03', revenue: 0, orders: 0 });
  expect(response.body.totalRevenue).toBe(100);
  expect(response.body.totalOrders).toBe(4);
  expect(db.orders.findMany.mock.calls[0][0].where).toEqual({ shopId, paymentStatus: 'Paid', status: { notIn: ['Cancelled', 'Returned', 'Refunded'] }, createdAt: { gte: new Date('2024-01-01'), lte: new Date('2024-12-31T23:59:59.999Z') } });
});

test('selected leap-year February includes all 29 days and exports the same totals', async () => {
  db.orders.findMany.mockResolvedValue([order('2024-02-29T23:59:59.999Z', 75)]);
  db.discountCodes.findMany.mockResolvedValue([]);
  const query = '/?from=2024-02-01&to=2024-02-29&interval=day';
  const response = await request(app()).get(query);
  expect(response.status).toBe(200);
  expect(response.body.timeline).toHaveLength(29);
  expect(response.body.timeline[28]).toMatchObject({ date: '2024-02-29', revenue: 75, orders: 1 });
  const exported = await request(app()).get(query + '&format=csv');
  expect(exported.status).toBe(200);
  expect(exported.text).toContain('"2024-02-29","75","1","0"');
});
