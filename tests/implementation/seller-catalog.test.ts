import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, productId, shopId } from './helpers';
import { getShopProducts } from '../../apps/product-service/src/controllers/product.controller';
import { getInventory } from '../../apps/product-service/src/controllers/product-management.controller';

beforeEach(resetDb);

test('seller catalog supplies actual review counts instead of presenting the default five as a review', async () => {
  db.products.findMany.mockResolvedValue([{ id: productId, rating: 5, _count: { reviews: 0 } }]);
  const response = await request(appFor('get', '/', getShopProducts, 'seller')).get('/');
  expect(response.status).toBe(200);
  expect(response.body.products[0]._count.reviews).toBe(0);
  expect(db.products.findMany).toHaveBeenCalledWith({ where: { shopId }, include: { images: true, _count: { select: { reviews: true } } } });
});

test('inventory low-stock threshold includes the boundary shown by the seller overview', async () => {
  db.products.findMany.mockResolvedValue([]);
  db.inventoryHistory.findMany.mockResolvedValue([]);
  const response = await request(appFor('get', '/', getInventory, 'seller')).get('/?low=true&threshold=5');
  expect(response.status).toBe(200);
  expect(db.products.findMany.mock.calls[0][0].where).toEqual({ shopId, isDeleted: false, stock: { lte: 5 } });
});
