import { generateMetadata as productMetadata } from '../../apps/user-ui/src/app/product/[slug]/page';
import { generateMetadata as shopMetadata } from '../../apps/user-ui/src/app/shop/[id]/page';

jest.mock('@/utils/axioInstance', () => ({ __esModule: true, default: { get: jest.fn() } }), { virtual: true });
jest.mock('@/shared/modules/product/product-detail', () => ({ __esModule: true, default: () => null }), { virtual: true });
jest.mock('@/shared/modules/seller/seller-profile', () => ({ __esModule: true, default: () => null }), { virtual: true });
jest.mock('@/shared/components/product-reviews', () => ({ __esModule: true, default: () => null }), { virtual: true });
jest.mock('@/shared/components/recommendations', () => ({ __esModule: true, default: () => null }), { virtual: true });
const api = require('@/utils/axioInstance').default;

test.each([429, 500, 404])('metadata resolves plain fallback data on API error %s', async status => {
  api.get.mockRejectedValue(Object.assign(new Error('API failed'), { response: { status } }));
  const product = await productMetadata({ params: Promise.resolve({ slug: 'example' }) });
  const shop = await shopMetadata({ params: Promise.resolve({ id: '111111111111111111111111' }) });
  expect(product).toEqual({ title: 'Product | Eshop', robots: { index: false, follow: false } });
  expect(shop).toEqual({ title: 'Shop | Eshop', robots: { index: false, follow: false } });
  expect(JSON.parse(JSON.stringify(product))).toEqual(product);
});

test('successful product metadata retains the product title and image', async () => {
  api.get.mockResolvedValue({ data: { product: { title: 'Test product', images: [{ url: 'https://example.com/image.jpg' }] } } });
  const metadata = await productMetadata({ params: Promise.resolve({ slug: 'test-product' }) });
  expect(metadata.title).toBe('Test product | Eshop');
  expect(metadata.openGraph).toMatchObject({ images: ['https://example.com/image.jpg'] });
});
