import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, userId, productId, shopId } from './helpers';
import * as products from '../../apps/product-service/src/controllers/product-management.controller';
beforeEach(resetDb);
const product = { id: productId, shopId, stock: 10, sale_price: 50, regular_price: 100, title: 'CPU', shop: { sellerId: userId } };
test.each([{ stock: -1 }, { stock: 1.5 }, { sale_price: '10' }, { colors: 'red' }, { images: [] }, { status: 'Bogus' }])('invalid product changes cannot reach database mutation', async body => {
  expect((await request(appFor('put', '/:id', products.updateProduct, 'seller')).put('/' + productId).send(body)).status).toBe(400);
  expect(db.products.update).not.toHaveBeenCalled();
});
test('editing another shop product is forbidden by scoped lookup', async () => {
  db.products.findFirst.mockResolvedValue(null);
  expect((await request(appFor('put', '/:id', products.updateProduct, 'seller')).put('/' + productId).send({ title: 'New' })).status).toBe(404);
  expect(db.products.findFirst.mock.calls[0][0].where).toEqual({ id: productId, shopId, isDeleted: false });
});
test('sale price may not exceed regular price', async () => {
  db.products.findFirst.mockResolvedValue(product);
  expect((await request(appFor('put', '/:id', products.updateProduct, 'seller')).put('/' + productId).send({ sale_price: 101 })).status).toBe(400);
});
test('stock crossing threshold creates history and notification in transaction', async () => {
  db.products.findFirst.mockResolvedValue(product); db.products.update.mockResolvedValue({ ...product, stock: 3 });
  expect((await request(appFor('put', '/:id', products.updateProduct, 'seller')).put('/' + productId).send({ stock: 3 })).status).toBe(200);
  expect(db.inventoryHistory.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ delta: -7, stockAfter: 3, shopId }));
  expect(db.notifications.create.mock.calls[0][0].data.type).toBe('LowStock');
});
test('low-to-low stock adjustment does not spam notifications', async () => {
  db.products.findFirst.mockResolvedValue({ ...product, stock: 3 }); db.products.update.mockResolvedValue({ ...product, stock: 2 });
  await request(appFor('put', '/:id', products.updateProduct, 'seller')).put('/' + productId).send({ stock: 2 });
  expect(db.notifications.create).not.toHaveBeenCalled();
});
test('reviews require a delivered purchase', async () => {
  db.orderItems.findFirst.mockResolvedValue(null);
  expect((await request(appFor('post', '/', products.createReview)).post('/').send({ productId, rating: 5, comment: 'Great' })).status).toBe(403);
  expect(db.productReviews.upsert).not.toHaveBeenCalled();
  expect(db.orderItems.findFirst.mock.calls[0][0].where.order).toEqual({ userId, status: 'Delivered' });
});
test('review edits recalculate the product average and retain one review per buyer', async () => {
  db.orderItems.findFirst.mockResolvedValue({ id: 'purchase' }); db.productReviews.upsert.mockResolvedValue({ rating: 4 }); db.productReviews.aggregate.mockResolvedValue({ _avg: { rating: 3.5 } }); db.products.update.mockResolvedValue(product);
  expect((await request(appFor('post', '/', products.createReview)).post('/').send({ productId, rating: 4, comment: 'Good' })).status).toBe(201);
  expect(db.productReviews.upsert.mock.calls[0][0].where).toEqual({ productId_userId: { productId, userId } });
  expect(db.products.update.mock.calls[0][0].data.rating).toBe(3.5);
});
test.each([0, 6, 2.5, '5'])('invalid review rating %s is rejected', async rating => {
  expect((await request(appFor('post', '/', products.createReview)).post('/').send({ productId, rating, comment: 'Test' })).status).toBe(400);
});
