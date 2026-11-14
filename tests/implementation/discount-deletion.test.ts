import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, otherId, productId, shopId, userId } from './helpers';
import { deleteDiscountCodes } from '../../apps/product-service/src/controllers/product.controller';
import { updateDiscountProducts } from '../../apps/product-service/src/controllers/discount-products.controller';

const discountId = '555555555555555555555555';
const deleteCode = (id = discountId) => request(appFor('delete', '/:id', deleteDiscountCodes, 'seller')).delete('/' + id);

beforeEach(() => {
  resetDb();
  db.discountCodes.findUnique.mockResolvedValue({ id: discountId, sellerId: userId });
  db.shops.findUnique.mockResolvedValue({ id: shopId });
  db.products.findMany.mockResolvedValue([]);
});

test('deletion removes every matching ID only from products in the authenticated seller shop', async () => {
  db.products.findMany.mockResolvedValue([
    { id: productId, discount_codes: [otherId, discountId, discountId] },
    { id: '666666666666666666666666', discount_codes: [discountId] },
  ]);
  const response = await deleteCode();
  expect(response.status).toBe(200);
  expect(db.shops.findUnique).toHaveBeenCalledWith({ where: { sellerId: userId }, select: { id: true } });
  expect(db.products.findMany).toHaveBeenCalledWith({ where: { shopId, discount_codes: { has: discountId } }, select: { id: true, discount_codes: true } });
  expect(db.products.update.mock.calls.map(([args]: any[]) => args)).toEqual([
    { where: { id: productId, shopId }, data: { discount_codes: { set: [otherId] } } },
    { where: { id: '666666666666666666666666', shopId }, data: { discount_codes: { set: [] } } },
  ]);
  expect(db.discountCodes.delete).toHaveBeenCalledWith({ where: { id: discountId, sellerId: userId } });
  expect(db.$transaction).toHaveBeenCalledTimes(1);
});

test.each([
  [null, 404],
  [{ id: discountId, sellerId: otherId }, 403],
])('missing or foreign discount %j does not mutate any product', async (discount, status) => {
  db.discountCodes.findUnique.mockResolvedValue(discount);
  expect((await deleteCode()).status).toBe(status);
  expect(db.products.findMany).not.toHaveBeenCalled();
  expect(db.products.update).not.toHaveBeenCalled();
  expect(db.discountCodes.delete).not.toHaveBeenCalled();
});

test('invalid ID is rejected before opening a transaction', async () => {
  expect((await deleteCode('invalid')).status).toBe(400);
  expect(db.$transaction).not.toHaveBeenCalled();
});

test('a seller with no shop can remove their code without searching or changing other products', async () => {
  db.shops.findUnique.mockResolvedValue(null);
  expect((await deleteCode()).status).toBe(200);
  expect(db.products.findMany).not.toHaveBeenCalled();
  expect(db.products.update).not.toHaveBeenCalled();
  expect(db.discountCodes.delete).toHaveBeenCalledWith({ where: { id: discountId, sellerId: userId } });
});

test('a serialization conflict retries product cleanup from the latest array', async () => {
  const addedId = '777777777777777777777777';
  db.products.findMany.mockResolvedValueOnce([{ id: productId, discount_codes: [discountId, otherId] }])
    .mockResolvedValueOnce([{ id: productId, discount_codes: [discountId, otherId, addedId] }]);
  db.products.update.mockRejectedValueOnce({ code: 'P2034' }).mockResolvedValueOnce({ id: productId });
  expect((await deleteCode()).status).toBe(200);
  expect(db.$transaction).toHaveBeenCalledTimes(2);
  expect(db.products.update.mock.calls[1][0].data.discount_codes.set).toEqual([otherId, addedId]);
  expect(db.discountCodes.delete).toHaveBeenCalledTimes(1);
});

test('cleanup failure never proceeds to deleting the code', async () => {
  db.products.findMany.mockResolvedValue([{ id: productId, discount_codes: [discountId] }]);
  db.products.update.mockRejectedValue(new Error('Database unavailable'));
  expect((await deleteCode()).status).toBe(500);
  expect(db.discountCodes.delete).not.toHaveBeenCalled();
  expect(db.$transaction).toHaveBeenCalledTimes(1);
});

test('assignment writes the owned code before product changes so deletion cannot miss a new link', async () => {
  const previous = new Date(Date.now() + 1000);
  db.discountCodes.findFirst.mockResolvedValue({ id: discountId, sellerId: userId, updatedAt: previous });
  const response = await request(appFor('patch', '/:id', updateDiscountProducts, 'seller')).patch('/' + discountId).send({ productIds: [] });
  expect(response.status).toBe(200);
  expect(db.discountCodes.update).toHaveBeenCalledWith({ where: { id: discountId, sellerId: userId }, data: { updatedAt: new Date(previous.getTime() + 1) } });
  expect(db.discountCodes.update.mock.invocationCallOrder[0]).toBeLessThan(db.products.findMany.mock.invocationCallOrder[0]);
});

test('assignment retries a conflicting deletion and cannot link the now missing code', async () => {
  db.discountCodes.findFirst.mockResolvedValueOnce({ id: discountId, sellerId: userId }).mockResolvedValueOnce(null);
  db.discountCodes.update.mockRejectedValueOnce({ code: 'P2034' });
  const response = await request(appFor('patch', '/:id', updateDiscountProducts, 'seller')).patch('/' + discountId).send({ productIds: [productId] });
  expect(response.status).toBe(404);
  expect(db.$transaction).toHaveBeenCalledTimes(2);
  expect(db.products.findMany).not.toHaveBeenCalled();
  expect(db.products.update).not.toHaveBeenCalled();
});
