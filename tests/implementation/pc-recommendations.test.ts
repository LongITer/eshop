import request from 'supertest';
import { recommendPcProducts, pcAvailableStock } from '@packages/utils/pc-recommendations';
import { buildCatalog } from '../../apps/product-service/src/controllers/pc-builder.controller';
import db, { resetDb } from './mocks/prisma';
import { appFor, productId, otherId } from './helpers';

const product = (id: string, specs: any, stock = 10, price = 100) => ({ id, custom_specification: specs, stock, sale_price: price, variants: [] });
const motherboard = (id: string, socket: string, memoryType: string, stock = 10) => product(id, { socket, memoryType }, stock);
beforeEach(resetDb);

test('matches all selected parts before prioritizing stock, with unknowns last and conflicts excluded', () => {
  const result = recommendPcProducts([
    motherboard('wrong-socket', 'AM4', 'DDR5', 1000),
    motherboard('wrong-ram', 'AM5', 'DDR4', 1000),
    product('unknown', {}, 1000),
    motherboard('low-stock', 'AM5', 'DDR5', 2),
    motherboard('high-stock', 'AM5', 'DDR5', 20),
  ], 'motherboard', { cpu: product('cpu', { socket: 'AM5' }), ram: product('ram', { memoryType: 'DDR5' }) }, 'recommended');
  expect(result.map(p => p.id)).toEqual(['high-stock', 'low-stock', 'unknown']);
  expect(result.map(p => p.recommendation.status)).toEqual(['matched', 'matched', 'unknown']);
});

test('works in reverse order and when replacing a selected part', () => {
  const result = recommendPcProducts([product('ddr4', { memoryType: 'DDR4' }), product('ddr5', { memoryType: 'DDR5' })], 'ram', {
    motherboard: motherboard('board', 'AM5', 'DDR5'), ram: product('old', { memoryType: 'DDR4' }),
  }, 'recommended');
  expect(result.map(p => p.id)).toEqual(['ddr5']);
  expect(recommendPcProducts([product('am4', { socket: 'AM4' }), product('am5', { socket: 'AM5' })], 'cpu', { motherboard: motherboard('board', 'AM5', 'DDR5') }, 'recommended').map(p => p.id)).toEqual(['am5']);
});

test('GPU and PSU are checked in either direction', () => {
  expect(recommendPcProducts([product('weak', { wattage: 450 }), product('enough', { wattage: 750 })], 'psu', { gpu: product('gpu', { recommendedPsuWatts: 650 }) }, 'recommended').map(p => p.id)).toEqual(['enough']);
  expect(recommendPcProducts([product('hungry', { recommendedPsuWatts: 850 }), product('fits', { recommendedPsuWatts: 650 })], 'gpu', { psu: product('psu', { wattage: 750 }) }, 'recommended').map(p => p.id)).toEqual(['fits']);
});

test('stock ranking respects available variants and excludes unavailable SKUs', () => {
  const sku = (stock: number, active = true) => ({ stock, active });
  const variants = { ...product('variants', {}, 100), variants: [sku(2), sku(3), sku(900, false)] };
  expect(pcAvailableStock(variants)).toBe(5);
  expect(pcAvailableStock({ ...variants, stock: 1 })).toBe(1);
  expect(recommendPcProducts([variants, product('plain', {}, 6), { ...variants, id: 'sold-out', variants: [sku(0)] }], 'storage', {}, 'recommended').map(p => p.id)).toEqual(['plain', 'variants']);
});

test('explicit price sorting still excludes incompatible parts', () => {
  const candidates = [motherboard('a', 'AM5', 'DDR5', 20), { ...motherboard('b', 'AM5', 'DDR5'), sale_price: 50 }, { ...motherboard('wrong', 'AM4', 'DDR5'), sale_price: 1 }];
  const selected = { cpu: product('cpu', { socket: 'AM5' }) };
  expect(recommendPcProducts(candidates, 'motherboard', selected, 'priceAsc').map(p => p.id)).toEqual(['b', 'a']);
  expect(recommendPcProducts(candidates, 'motherboard', selected, 'priceDesc').map(p => p.id)).toEqual(['a', 'b']);
});

test('catalog uses database specs and ranks before paginating, with accurate totals', async () => {
  db.products.findMany.mockResolvedValueOnce([{ ...product(productId, { socket: 'AM5' }), category: 'CPU' }]).mockResolvedValueOnce([
    motherboard('bad', 'AM4', 'DDR5', 999), motherboard('low', 'AM5', 'DDR5', 1), motherboard('high', 'AM5', 'DDR5', 20),
  ]);
  const result = await request(appFor('get', '/', buildCatalog)).get('/').query({ slot: 'motherboard', limit: 1, page: 2, parts: JSON.stringify([{ slot: 'cpu', id: productId }]) });
  expect(result.status).toBe(200);
  expect(result.body.products.map((p: any) => p.id)).toEqual(['low']);
  expect(result.body.pagination).toEqual({ page: 2, total: 2, totalPages: 2 });
  expect(result.body.products[0].recommendation.status).toBe('matched');
  expect(db.products.findMany.mock.calls[0][0].where.id.in).toEqual([productId]);
});

test.each(['{', '{}', JSON.stringify([{ slot: 'cpu', id: 'bad-id' }]), JSON.stringify([{ slot: 'cpu', id: productId }, { slot: 'cpu', id: otherId }])])('catalog rejects malformed selections: %s', async parts => {
  const result = await request(appFor('get', '/', buildCatalog)).get('/').query({ slot: 'motherboard', parts });
  expect(result.status).toBe(400);
  expect(db.products.findMany).not.toHaveBeenCalled();
});

test('catalog rejects unavailable selected components instead of claiming a match', async () => {
  db.products.findMany.mockResolvedValueOnce([]);
  const result = await request(appFor('get', '/', buildCatalog)).get('/').query({ slot: 'motherboard', parts: JSON.stringify([{ slot: 'cpu', id: productId }]) });
  expect(result.status).toBe(400);
});
