import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, productId, otherId, shopId } from './helpers';
import { createDiscountCode } from '../../apps/product-service/src/controllers/product.controller';
import { trustedDiscount } from '../../apps/order-service/src/routes/checkout-quote';
const app = appFor('post', '/discount', createDiscountCode, 'seller');
const payload = { public_name: 'RAM sale', discountType: 'percentage', discountValue: 10, discountCode: 'RAM10', productIds: [productId] };
beforeEach(() => { resetDb(); db.discountCodes.create.mockResolvedValue({ id: otherId }); });
test('creates code and attaches it to selected owned products in one transaction', async () => {
  db.products.count.mockResolvedValue(1);
  db.products.updateMany.mockResolvedValue({ count: 1 });
  expect((await request(app).post('/discount').send(payload)).status).toBe(201);
  expect(db.$transaction).toHaveBeenCalled();
  expect(db.products.updateMany).toHaveBeenCalledWith({ where: { id: { in: [productId] }, shopId, isDeleted: false }, data: { discount_codes: { push: otherId } } });
});
test('rejects unowned or deleted products before creating a code', async () => {
  db.products.count.mockResolvedValue(0);
  expect((await request(app).post('/discount').send(payload)).status).toBe(400);
  expect(db.discountCodes.create).not.toHaveBeenCalled();
});
test('allows unassigned codes and normalizes legacy flat discounts', async () => {
  expect((await request(app).post('/discount').send({ ...payload, productIds: [], discountType: 'flat' })).status).toBe(201);
  expect(db.products.updateMany).not.toHaveBeenCalled();
  expect(db.discountCodes.create.mock.calls[0][0].data.discountType).toBe('fixed');
});
test.each([{ productIds: ['invalid'] }, { discountValue: 101 }, { discountValue: -1 }])('rejects malformed selection or value %j', async override => {
  expect((await request(app).post('/discount').send({ ...payload, ...override })).status).toBe(400);
  expect(db.discountCodes.create).not.toHaveBeenCalled();
});
test('checkout accepts selected products and rejects an unselected product', async () => {
  db.discountCodes.findFirst.mockResolvedValue({ id: otherId, discountType: 'percentage', discountValue: 10 });
  const item: any = { id: productId, quantity: 1, sale_price: 50, discount_codes: [otherId] };
  expect(await trustedDiscount([item], 'RAM10')).toMatchObject({ discountAmount: 5 });
  await expect(trustedDiscount([{ ...item, discount_codes: [] }], 'RAM10')).rejects.toThrow('does not apply');
});
