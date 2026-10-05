import { transaction } from '@packages/utils/transaction';
import { Prisma } from '@prisma/client';
import prisma from '@packages/libs/prisma';
import { handle, objectId, pageArgs, textField } from '@packages/utils/api';
import { NotFoundError, ValidationError, ForbiddenError } from '@packages/error-handler';

export const getEditableProduct = handle(async (req: any, res) => {
  const product = await prisma.products.findFirst({ where: { id: objectId(req.params.id), shopId: req.seller.shop?.id, isDeleted: false }, include: { images: true } });
  if (!product || !req.seller.shop) throw new NotFoundError();
  res.json({ product });
});
export const updateProduct = handle(async (req: any, res) => {
  if (!req.seller.shop?.id) throw new ForbiddenError('Create a shop first');
  const id = objectId(req.params.id);
  const shopId = req.seller.shop.id;
  const data: Prisma.productsUpdateInput = {};
  for (const field of ['title', 'slug', 'category', 'subCategory', 'detailed_description', 'warranty'] as const) {
    if (req.body[field] !== undefined) data[field] = textField(req.body[field], field, field === 'detailed_description' ? 50000 : 200);
  }
  for (const field of ['short_description', 'brand', 'video_url', 'cash_on_delivery'] as const) {
    if (req.body[field] !== undefined) {
      if (req.body[field] !== null && (typeof req.body[field] !== 'string' || req.body[field].length > 5000)) throw new ValidationError(`Invalid ${field}`);
      data[field] = req.body[field];
    }
  }
  for (const field of ['sale_price', 'regular_price', 'stock'] as const) {
    if (req.body[field] !== undefined) {
      const value = req.body[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (field === 'stock' && !Number.isSafeInteger(value))) throw new ValidationError(`Invalid ${field}`);
      data[field] = value;
    }
  }
  for (const field of ['colors', 'sizes', 'tags', 'discount_codes'] as const) {
    if (req.body[field] !== undefined) {
      if (!Array.isArray(req.body[field]) || req.body[field].length > 100 || req.body[field].some((s: unknown) => typeof s !== 'string' || s.length > 200)) throw new ValidationError(`Invalid ${field}`);
      data[field] = req.body[field];
    }
  }
  if (req.body.discount_codes?.length) {
    req.body.discount_codes.forEach(objectId);
    const codes = await prisma.discountCodes.count({ where: { id: { in: req.body.discount_codes }, sellerId: req.seller.id } });
    if (codes !== new Set(req.body.discount_codes).size) throw new ValidationError('Invalid discount codes');
  }
  for (const key of ['custom_specification', 'custom_properties'] as const) {
    if (req.body[key] !== undefined) {
      if (req.body[key] === null) { data[key] = null; continue; }
      if (!req.body[key] || typeof req.body[key] !== 'object' || JSON.stringify(req.body[key]).length > 20000) throw new ValidationError(`Invalid ${key}`);
      data[key] = req.body[key];
    }
  }
  if (req.body.status !== undefined) {
    if (!['Active', 'Inactive', 'Draft'].includes(req.body.status)) throw new ValidationError('Invalid status');
    data.status = req.body.status;
  }
  if (req.body.images !== undefined) {
    const images = req.body.images;
    if (!Array.isArray(images) || images.length < 1 || images.length > 10 || images.some((img: any) => !img || typeof img.url !== 'string' || !img.url.startsWith('https://') || typeof img.file_id !== 'string' || !img.file_id)) throw new ValidationError('Provide 1–10 uploaded images');
    data.images = { deleteMany: {}, create: images.map((img: any) => ({ file_id: img.file_id, url: img.url })) };
  }
  const product = await transaction(async tx => {
    const current = await tx.products.findFirst({ where: { id, shopId, isDeleted: false } });
    if (!current) throw new NotFoundError();
    if ((req.body.sale_price ?? current.sale_price) > (req.body.regular_price ?? current.regular_price)) throw new ValidationError('Sale price cannot exceed regular price');
    const updated = await tx.products.update({ where: { id, shopId }, data, include: { images: true } });
    if (updated.stock !== current.stock) {
      await tx.inventoryHistory.create({ data: { productId: id, shopId, delta: updated.stock - current.stock, stockAfter: updated.stock, reason: 'Seller adjustment', actorId: req.seller.id } });
      if (updated.stock < 5 && current.stock >= 5) await tx.notifications.create({ data: { sellerId: req.seller.id, type: 'LowStock', title: 'Low stock', message: `${updated.title}: ${updated.stock} remaining`, redirectUrl: '/dashboard/inventory' } });
    }
    return updated;
  });
  res.json({ success: true, product });
});
export const getInventory = handle(async (req: any, res) => {
  const shopId = req.seller.shop?.id;
  if (!shopId) throw new NotFoundError('Shop not found');
  const threshold = Math.max(1, Math.min(1000, Number(req.query.threshold) || 5));
  const [products, history] = await Promise.all([
    prisma.products.findMany({ where: { shopId, isDeleted: false, ...(req.query.low === 'true' ? { stock: { lt: threshold } } : {}) }, orderBy: { stock: 'asc' }, include: { images: true } }),
    prisma.inventoryHistory.findMany({ where: { shopId }, ...pageArgs(req.query), orderBy: { createdAt: 'desc' }, include: { product: { select: { title: true } } } }),
  ]);
  res.json({ products, history, threshold });
});
export const createReview = handle(async (req, res) => {
  const productId = objectId(req.body.productId);
  const userId = req.user.id;
  const rating = req.body.rating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ValidationError('Rating must be 1–5');
  const comment = textField(req.body.comment, 'comment', 3000);
  const review = await transaction(async tx => {
    const purchase = await tx.orderItems.findFirst({ where: { productId, order: { userId, status: 'Delivered' } } });
    if (!purchase) throw new ForbiddenError('Only buyers with a delivered order can review this product');
    const result = await tx.productReviews.upsert({ where: { productId_userId: { productId, userId } }, create: { productId, userId, rating, comment }, update: { rating, comment } });
    const average = await tx.productReviews.aggregate({ where: { productId }, _avg: { rating: true } });
    const product = await tx.products.update({ where: { id: productId }, data: { rating: average._avg.rating ?? 0 }, include: { shop: true } });
    await tx.notifications.create({ data: { sellerId: product.shop.sellerId, type: 'NewReview', title: 'Product review', message: `${product.title} received a ${rating}/5 review`, redirectUrl: `/dashboard/all-products` } });
    return result;
  });
  res.status(201).json({ review });
});
export const getReviews = handle(async (req, res) => {
  const productId = objectId(req.params.productId);
  const [reviews, total, stats] = await Promise.all([
    prisma.productReviews.findMany({ where: { productId }, ...pageArgs(req.query), orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } }),
    prisma.productReviews.count({ where: { productId } }),
    prisma.productReviews.aggregate({ where: { productId }, _avg: { rating: true } }),
  ]);
  res.json({ reviews, total, rating: stats._avg.rating ?? 0 });
});
