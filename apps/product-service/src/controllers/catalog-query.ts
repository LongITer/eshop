import prisma from '@packages/libs/prisma';
import { Prisma } from '@prisma/client';
import { handle, pageArgs, objectId } from '@packages/utils/api';
import { ValidationError } from '@packages/error-handler';

export const filteredCatalog = handle(async (req, res) => {
  const where: Prisma.productsWhereInput = { status: 'Active', isDeleted: false };
  const list = (key: string) => {
    const raw = req.query[key];
    const values = (Array.isArray(raw) ? raw : raw ? String(raw).split(',') : []).map(String).map(v => v.trim()).filter(Boolean);
    if (values.length > 30 || values.some(v => v.length > 100)) throw new ValidationError('Too many filter values');
    return values;
  };
  for (const key of ['categories', 'subCategories', 'colors', 'sizes']) {
    const values = list(key); if (!values.length) continue;
    if (key === 'categories') where.category = { in: values };
    if (key === 'subCategories') where.subCategory = { in: values };
    if (key === 'colors') where.colors = { hasSome: values };
    if (key === 'sizes') where.sizes = { hasSome: values };
  }
  if (req.query.priceRange) {
    const range = String(req.query.priceRange).split(',').map(Number);
    if (range.length !== 2 || range.some(n => !Number.isFinite(n) || n < 0) || range[0] > range[1]) throw new ValidationError('Invalid price range');
    where.sale_price = { gte: range[0], lte: range[1] };
  } else {
    const price: Prisma.FloatFilter = {};
    for (const [key, op] of [['minPrice', 'gte'], ['maxPrice', 'lte']] as const) if (req.query[key] !== undefined && req.query[key] !== '') {
      const value = Number(req.query[key]); if (!Number.isFinite(value) || value < 0) throw new ValidationError('Invalid price'); price[op] = value;
    }
    if (typeof price.gte === 'number' && typeof price.lte === 'number' && price.gte > price.lte) throw new ValidationError('Invalid price range');
    if (Object.keys(price).length) where.sale_price = price;
  }
  if (req.query.excludeId) where.id = { not: objectId(req.query.excludeId) };
  const search = String(req.query.q ?? '').trim().slice(0, 150);
  if (search) where.OR = [{ title: { contains: search, mode: 'insensitive' } }, { brand: { contains: search, mode: 'insensitive' } }];
  if (req.query.inStock === 'true') where.stock = { gt: 0 };
  const sorts: Record<string, Prisma.productsOrderByWithRelationInput> = { newest: { createdAt: 'desc' }, priceAsc: { sale_price: 'asc' }, priceDesc: { sale_price: 'desc' }, popular: { totalSales: 'desc' }, rating: { rating: 'desc' } };
  const sort = String(req.query.sort ?? 'newest'); if (!sorts[sort]) throw new ValidationError('Invalid sort');
  const { skip, take } = pageArgs(req.query);
  const [products, total, bounds] = await Promise.all([
    prisma.products.findMany({ where, skip, take, orderBy: [sorts[sort], { id: 'asc' }], include: { images: true, shop: { select: { id: true, name: true } } } }),
    prisma.products.count({ where }),
    prisma.products.aggregate({ where: { status: 'Active', isDeleted: false }, _min: { sale_price: true }, _max: { sale_price: true } }),
  ]);
  res.json({ products, priceBounds: { min: bounds._min.sale_price ?? 0, max: bounds._max.sale_price ?? 0 }, pagination: { total, page: skip / take + 1, totalPages: Math.max(1, Math.ceil(total / take)) } });
});
