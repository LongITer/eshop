import express from 'express';
import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, shopId } from './helpers';
import { getSellerPayments } from '../../apps/order-service/src/routes/seller-payments.controller';
import { errorMiddleware } from '@packages/error-handler/error-middleware';

beforeEach(() => {
  resetDb();
  db.orders.findMany.mockResolvedValue([]);
  db.orders.count.mockResolvedValue(0);
  db.orders.groupBy.mockResolvedValue([]);
});
const app = () => appFor('get', '/', getSellerPayments, 'seller');

test('payments and totals are scoped to the authenticated shop and month, including leap day', async () => {
  db.orders.count.mockResolvedValue(45);
  db.orders.groupBy.mockResolvedValue([{ paymentStatus: 'Paid', _sum: { totalAmount: 120 }, _count: { _all: 3 } }]);
  const response = await request(app()).get('/?month=2024-02&page=2&limit=20&search=ORD-12');
  expect(response.status).toBe(200);
  const where = db.orders.findMany.mock.calls[0][0].where;
  expect(where).toEqual({ shopId, createdAt: { gte: new Date('2024-02-01'), lt: new Date('2024-03-01') }, OR: [
    { orderNumber: { contains: 'ORD-12', mode: 'insensitive' } },
    { stripePaymentId: { contains: 'ORD-12', mode: 'insensitive' } },
  ] });
  expect(db.orders.findMany.mock.calls[0][0]).toMatchObject({ skip: 20, take: 20 });
  expect(db.orders.count).toHaveBeenCalledWith({ where });
  expect(db.orders.groupBy.mock.calls[0][0].where).toEqual(where);
  expect(response.body).toMatchObject({ total: 45, page: 2, totalPages: 3, summary: { Paid: { amount: 120, count: 3 }, Refunded: { amount: 0, count: 0 } } });
});

test('filters by payment status rather than delivery status and ignores supplied shop IDs', async () => {
  const response = await request(app()).get('/?status=Refunded&shopId=another-shop');
  expect(response.status).toBe(200);
  expect(db.orders.findMany.mock.calls[0][0].where).toEqual({ shopId, paymentStatus: 'Refunded' });
  expect(response.body.payments).toEqual([]);
  expect(response.body.totalPages).toBe(0);
});

test.each(['month=2024-13', 'month=invalid', 'month=0000-01', 'status=Delivered', `search=${'a'.repeat(101)}`])('rejects invalid payment filters: %s', async query => {
  expect((await request(app()).get('/?' + query)).status).toBe(400);
  expect(db.orders.findMany).not.toHaveBeenCalled();
});

test('missing shop cannot query payments', async () => {
  const server = express();
  server.get('/', getSellerPayments);
  server.use(errorMiddleware);
  expect((await request(server).get('/')).status).toBe(403);
  expect(db.orders.findMany).not.toHaveBeenCalled();
});
