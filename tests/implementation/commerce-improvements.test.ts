import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, userId, productId, shopId, otherId } from './helpers';
import { cartLineKey } from '@packages/utils/cart';
import { trustedCartItems, trustedDiscount, shippingQuote } from '../../apps/order-service/src/routes/checkout-quote';
import { requestReturn, reviewReturn, paymentResult } from '../../apps/order-service/src/routes/returns.controller';
import { checkCompatibility } from '@packages/utils/pc-build';
import { saveVariant } from '../../apps/product-service/src/controllers/variants.controller';
import { useStore } from '../../apps/user-ui/src/store';
const product = { id: productId, title: 'RAM', shopId, stock: 5, sale_price: 20, colors: ['red', 'blue'], sizes: [], images: [], discount_codes: [], variants: [] };
beforeEach(() => { resetDb(); delete process.env.SHIPPING_FEE_USD; });
test('different options have different line keys, including legacy cart data', () => {
  expect(cartLineKey({ id: productId, selectedOptions: { color: 'red' } })).not.toBe(cartLineKey({ id: productId, selectedOptions: { color: 'blue' } }));
  expect(cartLineKey({ id: productId, variantId: otherId, selectedOptions: { color: 'red' } })).toBe(cartLineKey({ id: productId, selectedOptions: { color: 'red' } }));
});
test('adding and removing cart variants preserves the other option and accumulates quantity', () => {
  useStore.setState({ cart: [], wishlist: [] });
  const red = { id: productId, title: 'RAM', price: 20, quantity: 1, selectedOptions: { color: 'red' } };
  const blue = { ...red, selectedOptions: { color: 'blue' } };
  useStore.getState().addToCart(red, null, null, '');
  useStore.getState().addToCart(blue, null, null, '');
  useStore.getState().addToCart(red, null, null, '');
  expect(useStore.getState().cart.map(item => item.quantity)).toEqual([2, 1]);
  useStore.getState().removeFromCart(cartLineKey(red), null, null, '');
  expect(useStore.getState().cart).toEqual([blue]);
});
test('checkout supports different options but enforces combined product stock', async () => {
  db.products.findMany.mockResolvedValue([product]);
  const cart = [{ id: productId, quantity: 3, selectedOptions: { color: 'red' }, sale_price: 0.01 }, { id: productId, quantity: 2, selectedOptions: { color: 'blue' } }];
  expect((await trustedCartItems(cart)).map(p => p.sale_price)).toEqual([20, 20]);
  await expect(trustedCartItems([{ ...cart[0], quantity: 4 }, cart[1]])).rejects.toThrow('out of stock');
  await expect(trustedCartItems([cart[0], cart[0]])).rejects.toThrow('duplicate');
});
test('SKU price, options and availability come from the database', async () => {
  db.products.findMany.mockResolvedValue([{ ...product, variants: [{ id: otherId, color: 'blue', size: '', sku: 'B', price: 35, stock: 2, active: true }] }]);
  const [item] = await trustedCartItems([{ id: productId, variantId: otherId, quantity: 1, selectedOptions: { color: 'red' }, sale_price: 1 }]);
  expect(item).toEqual(expect.objectContaining({ sale_price: 35, sku: 'B', selectedOptions: { color: 'blue', size: '' } }));
  await expect(trustedCartItems([{ id: productId, variantId: otherId, quantity: 3 }])).rejects.toThrow('out of stock');
});
test('coupon eligibility ignores client supplied discount lists and prices', async () => {
  db.products.findMany.mockResolvedValue([product]); db.discountCodes.findFirst.mockResolvedValue({ id: otherId, discountValue: 50, discountType: 'percentage' });
  const cart = await trustedCartItems([{ id: productId, quantity: 1, selectedOptions: { color: 'red' }, discount_codes: [otherId] }]);
  await expect(trustedDiscount(cart, 'SAVE')).rejects.toThrow('does not apply');
});
test('shipping is charged once per shop and rejects invalid configuration', () => {
  process.env.SHIPPING_FEE_USD = '2.50';
  expect(shippingQuote([shopId, shopId, otherId])).toEqual({ [shopId]: 2.5, [otherId]: 2.5 });
  process.env.SHIPPING_FEE_USD = '-1'; expect(() => shippingQuote([shopId])).toThrow();
});
test('return request requires a paid delivered order owned by buyer', async () => {
  db.orders.findFirst.mockResolvedValue(null);
  const res = await request(appFor('post', '/:orderId', requestReturn)).post('/' + otherId).send({ reason: 'Damaged' });
  expect(res.status).toBe(404); expect(db.returnRequest.create).not.toHaveBeenCalled();
  expect(db.orders.findFirst.mock.calls[0][0].where).toEqual({ id: otherId, userId, status: 'Delivered', paymentStatus: 'Paid' });
});
test('return evidence rejects executable links', async () => {
  expect((await request(appFor('post', '/:orderId', requestReturn)).post('/' + otherId).send({ reason: 'Damaged', evidence: ['javascript:alert(1)'] })).status).toBe(400);
});
test('received return changes order status but does not restock uninspected goods', async () => {
  db.orders.findFirst.mockResolvedValue({ id: otherId, shopId, userId, status: 'Delivered', items: [] });
  db.returnRequest.findUnique.mockResolvedValue({ id: productId, status: 'Approved' });
  db.returnRequest.update.mockResolvedValue({ status: 'Received' });
  const res = await request(appFor('patch', '/:orderId', reviewReturn, 'seller')).patch('/' + otherId).send({ status: 'Received', sellerNote: 'Received for inspection' });
  expect(res.status).toBe(200); expect(db.orders.update.mock.calls[0][0].data.status).toBe('Returned');
  expect(db.products.update).not.toHaveBeenCalled();
});
test('payment result checks session ownership and committed receipt', async () => {
  db.paymentSession.findUnique.mockResolvedValue({ userId: otherId });
  expect((await request(appFor('get', '/', paymentResult)).get('/?sessionId=test')).status).toBe(404);
  db.paymentSession.findUnique.mockResolvedValue({ userId, payload: { cart: [] } }); db.paymentReceipt.findFirst.mockResolvedValue(null);
  expect((await request(appFor('get', '/', paymentResult)).get('/?sessionId=test')).body.complete).toBe(false);
  db.paymentReceipt.findFirst.mockResolvedValue({ orderIds: [otherId] });
  expect((await request(appFor('get', '/', paymentResult)).get('/?sessionId=test')).body.complete).toBe(true);
});
test('SKU edits require product ownership', async () => {
  db.products.findFirst.mockResolvedValue(null);
  const res = await request(appFor('put', '/:id', saveVariant, 'seller')).put('/' + productId).send({ sku: 'A', price: 12, stock: 2 });
  expect(res.status).toBe(404); expect(db.productVariant.create).not.toHaveBeenCalled();
});
test('PC checks detect socket, memory and power conflicts without declaring unknown builds safe', () => {
  const issues = checkCompatibility({ cpu: { custom_specification: { socket: 'AM5' } }, motherboard: { custom_specification: { socket: 'LGA1700', memoryType: 'DDR5' } }, ram: { custom_specification: [{ name: 'memoryType', value: 'DDR4' }] }, psu: { custom_specification: { wattage: 400 } }, gpu: { custom_specification: { recommendedPsuWatts: 650 } } });
  expect(issues.filter(i => i.level === 'error')).toHaveLength(3);
  expect(checkCompatibility({ cpu: {}, motherboard: {} }).some(i => i.message.includes('missing'))).toBe(true);
});
