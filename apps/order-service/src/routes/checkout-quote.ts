import { isSuspended } from '@packages/utils/admin-access';
import prisma from '@packages/libs/prisma';
import { ValidationError } from '@packages/error-handler';
import { cartLineKey } from '@packages/utils/cart';
import { usdCents } from '@packages/utils/money';

export async function trustedCartItems(cart: any) {
  if (!Array.isArray(cart) || !cart.length || cart.length > 100) throw new ValidationError('Provide 1–100 cart items');
  const requested = cart.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-f\d]{24}$/i.test(item.id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10000) throw new ValidationError('Invalid cart item');
    const options = item.selectedOptions || {};
    if (['color', 'size'].some(key => options[key] !== undefined && (typeof options[key] !== 'string' || options[key].length > 200))) throw new ValidationError('Invalid product options');
    if (item.variantId != null && (typeof item.variantId !== 'string' || !/^[a-f\d]{24}$/i.test(item.variantId))) throw new ValidationError('Invalid variant ID');
    return { id: item.id, quantity: item.quantity, variantId: item.variantId || null, selectedOptions: { color: options.color || '', size: options.size || '' } };
  });
  const products = await prisma.products.findMany({ where: { id: { in: [...new Set(requested.map(item => item.id))] }, isDeleted: false, status: 'Active' }, include: { images: true, variants: true, shop: { select: { sellers: { select: { suspendedAt: true, suspendedUntil: true } } } } } });
  const productById = new Map(products.map(product => [product.id, product]));
  const totals = new Map<string, number>();
  const keys = new Set<string>();
  return requested.map(item => {
    const product = productById.get(item.id);
    if (!product || (product.shop?.sellers && isSuspended(product.shop.sellers))) throw new ValidationError('A product or seller is unavailable');
    const variants = product.variants || [];
    const variant = variants.find(v => item.variantId ? v.id === item.variantId : v.color === item.selectedOptions.color && v.size === item.selectedOptions.size);
    if (variants.length && (!variant || !variant.active)) throw new ValidationError(`Choose an available variant for ${product.title}`);
    if (!variants.length && item.variantId) throw new ValidationError('Variant does not belong to this product');
    if (!variants.length && ((item.selectedOptions.color && !product.colors.includes(item.selectedOptions.color)) || (item.selectedOptions.size && !product.sizes.includes(item.selectedOptions.size)))) throw new ValidationError('Invalid product variant');
    if (!variants.length && ((product.colors.length && !item.selectedOptions.color) || (product.sizes.length && !item.selectedOptions.size))) throw new ValidationError(`Choose options for ${product.title}`);
    const trusted = { ...item, variantId: variant?.id || null, sku: variant?.sku || null, selectedOptions: variant ? { color: variant.color, size: variant.size } : item.selectedOptions, sale_price: (variant ? usdCents(variant.price) : usdCents(product.sale_price)) / 100, title: product.title, shopId: product.shopId, image: product.images[0]?.url || null, discount_codes: product.discount_codes };
    const key = cartLineKey(trusted);
    if (keys.has(key)) throw new ValidationError('Cart contains duplicate variants');
    keys.add(key);
    const total = (totals.get(item.id) || 0) + item.quantity;
    totals.set(item.id, total);
    if (total > product.stock || (variant && item.quantity > variant.stock)) throw new ValidationError(`${product.title} is out of stock`);
    return trusted;
  });
}

export async function trustedDiscount(cart: Awaited<ReturnType<typeof trustedCartItems>>, code: unknown) {
  if (!code) return null;
  if (typeof code !== 'string' || code.length > 100) throw new ValidationError('Invalid coupon');
  const record = await prisma.discountCodes.findFirst({ where: { discountCode: code } });
  if (!record) throw new ValidationError('Coupon no longer exists');
  const eligible = cart.find(item => item.discount_codes.includes(record.id));
  if (!eligible) throw new ValidationError('Coupon does not apply to these products');
  if (!['percentage', 'fixed', 'flat'].includes(record.discountType) || !Number.isFinite(record.discountValue) || record.discountValue < 0) throw new ValidationError('Invalid coupon amount');
  const price = usdCents(eligible.sale_price) * eligible.quantity;
  const discount = Math.min(price, record.discountType === 'percentage' ? Math.round(price * record.discountValue / 100) : usdCents(record.discountValue));
  return { id: record.id, code, discountAmount: discount / 100, discountedProductId: eligible.id, discountedLineKey: cartLineKey(eligible), discountType: record.discountType, discountValue: record.discountValue };
}

export function shippingQuote(shopIds: string[]) {
  // A configured flat charge per shop; zero preserves existing free shipping.
  const perShop = Number(process.env.SHIPPING_FEE_USD ?? '0');
  if (!Number.isFinite(perShop) || perShop < 0) throw new ValidationError('Shipping configuration is invalid');
  const cents = usdCents(perShop);
  return Object.fromEntries([...new Set(shopIds)].map(id => [id, cents / 100]));
}
