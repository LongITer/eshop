import prisma from '@packages/libs/prisma';
import { transaction } from '@packages/utils/transaction';
import { handle, objectId, textField } from '@packages/utils/api';
import { NotFoundError, ValidationError, ForbiddenError } from '@packages/error-handler';
import { usdCents } from '@packages/utils/money';

export const listVariants = handle(async (req, res) => {
  const product = await prisma.products.findFirst({ where: { id: objectId(req.params.id), isDeleted: false, status: 'Active' }, include: { variants: { where: { active: true } } } });
  if (!product) throw new NotFoundError();
  res.json({ variants: product.variants });
});

export const saveVariant = handle(async (req: any, res) => {
  const productId = objectId(req.params.id);
  const shopId = req.seller.shop?.id;
  if (!shopId) throw new ForbiddenError();
  const sku = textField(req.body.sku, 'SKU', 80);
  const color = req.body.color ?? ''; const size = req.body.size ?? '';
  if ([color, size].some(v => typeof v !== 'string' || v.length > 100)) throw new ValidationError('Invalid variant options');
  const stock = req.body.stock; const price = req.body.price;
  if (!Number.isSafeInteger(stock) || stock < 0 || typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > 10000000) throw new ValidationError('Invalid variant price or stock');
  if (req.body.active !== undefined && typeof req.body.active !== 'boolean') throw new ValidationError('Invalid availability');
  const id = req.body.id ? objectId(req.body.id) : null;
  const variant = await transaction(async tx => {
    const product = await tx.products.findFirst({ where: { id: productId, shopId, isDeleted: false }, include: { variants: true } });
    if (!product) throw new NotFoundError();
    if (id && !product.variants.some(v => v.id === id)) throw new NotFoundError();
    if (!id && product.variants.length >= 100) throw new ValidationError('Maximum 100 variants');
    if (product.variants.some(v => v.id !== id && (v.sku === sku || (v.color === color.trim() && v.size === size.trim())))) throw new ValidationError('SKU or option combination already exists');
    const data = { sku, color: color.trim(), size: size.trim(), price: usdCents(price) / 100, stock, active: req.body.active ?? true };
    const result = id ? await tx.productVariant.update({ where: { id, productId }, data }) : await tx.productVariant.create({ data: { productId, ...data } });
    const all = [...product.variants.filter(v => v.id !== id), result];
    const available = all.filter(v => v.active);
    const total = available.reduce((sum, v) => sum + v.stock, 0);
    const minimum = available.length ? Math.min(...available.map(v => v.price)) : product.sale_price;
    await tx.products.update({ where: { id: productId }, data: { stock: total, sale_price: minimum, regular_price: Math.max(product.regular_price, minimum), colors: [...new Set(available.map(v => v.color).filter(Boolean))], sizes: [...new Set(available.map(v => v.size).filter(Boolean))] } });
    if (product.stock !== total) await tx.inventoryHistory.create({ data: { productId, shopId, delta: total - product.stock, stockAfter: total, reason: `SKU ${sku} adjustment`, actorId: req.seller.id } });
    return result;
  });
  res.json({ variant });
});
