import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, productId, otherId, userId, shopId } from './helpers';
import { updateDiscountProducts } from '../../apps/product-service/src/controllers/discount-products.controller';
const app = appFor('patch', '/:id', updateDiscountProducts, 'seller');
beforeEach(() => { resetDb(); db.discountCodes.findFirst.mockResolvedValue({ id: otherId, sellerId: userId }); });
test('reassigns code while preserving other codes on each product', async () => {
  db.products.findMany.mockResolvedValue([{ id: productId, discount_codes: [userId], isDeleted: false }, { id: shopId, discount_codes: [otherId, userId], isDeleted: false }]);
  expect((await request(app).patch('/' + otherId).send({ productIds: [productId] })).status).toBe(200);
  expect(db.products.update).toHaveBeenCalledWith({ where: { id: productId, shopId }, data: { discount_codes: { set: [userId, otherId] } } });
  expect(db.products.update).toHaveBeenCalledWith({ where: { id: shopId, shopId }, data: { discount_codes: { set: [userId] } } });
});
test('empty selection removes assignments without deleting the code', async () => {
  db.products.findMany.mockResolvedValue([{ id: productId, discount_codes: [otherId], isDeleted: false }]);
  expect((await request(app).patch('/' + otherId).send({ productIds: [] })).status).toBe(200);
  expect(db.products.update.mock.calls[0][0].data.discount_codes.set).toEqual([]);
  expect(db.discountCodes.delete).not.toHaveBeenCalled();
});
test('rejects codes belonging to another seller', async () => {
  db.discountCodes.findFirst.mockResolvedValue(null);
  expect((await request(app).patch('/' + otherId).send({ productIds: [] })).status).toBe(404);
  expect(db.products.update).not.toHaveBeenCalled();
});
test('rejects unavailable or foreign products before changing assignments', async () => {
  db.products.findMany.mockResolvedValue([]);
  expect((await request(app).patch('/' + otherId).send({ productIds: [productId] })).status).toBe(400);
  expect(db.products.update).not.toHaveBeenCalled();
});
