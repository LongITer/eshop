import prisma from '@packages/libs/prisma';
import { transaction } from '@packages/utils/transaction';
import { handle, objectId, textField } from '@packages/utils/api';
import { NotFoundError, ValidationError, ForbiddenError } from '@packages/error-handler';
import { usdCents } from '@packages/utils/money';
import { priceReviewReasons } from '@packages/utils/product-listing-rules';
import { listingSnapshot, submitProductReport } from '@packages/utils/product-moderation';

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
  const result = await transaction(async tx => {
    const product = await tx.products.findFirst({ where: { id: productId, shopId, isDeleted: false }, include: { variants: true, images: true } });
    if (!product) throw new NotFoundError();
    if (['Suspended', 'Rejected'].includes(product.status)) throw new ValidationError('Administrator review is required before changing variants on this listing');
    if (id && !product.variants.some(v => v.id === id)) throw new NotFoundError();
    if (!id && product.variants.length >= 100) throw new ValidationError('Maximum 100 variants');
    if (product.variants.some(v => v.id !== id && (v.sku === sku || (v.color === color.trim() && v.size === size.trim())))) throw new ValidationError('SKU or option combination already exists');
    const data = { sku, color: color.trim(), size: size.trim(), price: usdCents(price) / 100, stock, active: req.body.active ?? true };
    const result = id ? await tx.productVariant.update({ where: { id, productId }, data }) : await tx.productVariant.create({ data: { productId, ...data } });
    const all = [...product.variants.filter(v => v.id !== id), result];
    const available = all.filter(v => v.active);
    const total = available.reduce((sum, v) => sum + v.stock, 0);
    const minimum = available.length ? Math.min(...available.map(v => v.price)) : product.sale_price;
    const regularPrice = Math.max(product.regular_price, minimum);
    const peerRows = await tx.products.findMany({ where: { category: product.category, subCategory: product.subCategory, status: 'Active', isDeleted: false, sale_price: { gt: 0 }, id: { not: productId } }, orderBy: { createdAt: 'desc' }, take: 101, select: { sale_price: true } });
    const priceReasons = await priceReviewReasons({ category: product.category, subCategory: product.subCategory, salePrice: minimum, regularPrice, peerPrices: peerRows.map(row => row.sale_price) });
    const reviewReason = priceReasons.join(' ');
    const updatedProduct = await tx.products.update({ where: { id: productId }, data: {
      stock: total, sale_price: minimum, regular_price: regularPrice,
      colors: [...new Set(available.map(v => v.color).filter(Boolean))], sizes: [...new Set(available.map(v => v.size).filter(Boolean))],
      ...(priceReasons.length ? { status: 'PendingReview', moderationReason: reviewReason } : {}),
    }, include: { images: true } });
    if (product.stock !== total) await tx.inventoryHistory.create({ data: { productId, shopId, delta: total - product.stock, stockAfter: total, reason: `SKU ${sku} adjustment`, actorId: req.seller.id } });
    return { variant: result, priceReasons, reviewReason, snapshot: priceReasons.length ? listingSnapshot(updatedProduct) : null };
  });
  if (result.priceReasons.length && result.snapshot) await submitProductReport(productId, req.seller.id, 'AI', 'Misleading', result.reviewReason, result.snapshot).catch(error => console.error('Could not persist automated price review:', error));
  res.json({ variant: result.variant });
});
