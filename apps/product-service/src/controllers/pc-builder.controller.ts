import prisma from '@packages/libs/prisma';
import { handle, pageArgs } from '@packages/utils/api';
import { ForbiddenError, ValidationError } from '@packages/error-handler';
import { Prisma } from '@prisma/client';
import { PC_SLOTS, PcSlot, COMPONENT_TERMS, componentMatches, assessCompatibility } from '@packages/utils/pc-build';
import { parsePcSelections } from '@packages/utils/pc-build-selection';
import { usdCents } from '@packages/utils/money';
import { recommendPcProducts } from '@packages/utils/pc-recommendations';

const select = { id: true, title: true, slug: true, category: true, subCategory: true, tags: true, colors: true, sizes: true, sale_price: true, stock: true, custom_specification: true, warranty: true, images: { select: { url: true }, take: 1 }, variants: { where: { active: true }, select: { id: true, sku: true, color: true, size: true, price: true, stock: true } } };
const availableProducts = (): Prisma.productsWhereInput => ({
  status: 'Active', isDeleted: false,
  shop: { sellers: { OR: [{ suspendedAt: null }, { suspendedAt: { isSet: false } }, { suspendedUntil: { not: null, isSet: true, lte: new Date() } }] } },
});
function selectionsFrom(value: unknown) {
  try { return parsePcSelections(value); }
  catch (error) { throw new ValidationError(error instanceof Error ? error.message : 'Invalid PC build'); }
}

export const getSavedBuild = handle(async (req, res) => {
  if (req.query.ownerId !== req.user!.id) throw new ForbiddenError();
  res.setHeader('Cache-Control', 'no-store');
  const id = req.user!.id;
  let saved;
  try {
    saved = await prisma.savedPcBuild.upsert({ where: { id }, create: { id, parts: [] }, update: {} });
  } catch (error) {
    // Two devices may create the initial empty record at the same time.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    saved = await prisma.savedPcBuild.findUniqueOrThrow({ where: { id } });
  }
  res.json({ parts: saved.parts, revision: saved.revision, updatedAt: saved.updatedAt });
});

export const saveBuild = handle(async (req, res) => {
  if (req.body.ownerId !== req.user!.id) throw new ForbiddenError();
  res.setHeader('Cache-Control', 'no-store');
  const revision = req.body.revision;
  if (!Number.isInteger(revision) || revision < 0 || revision >= 2147483647) throw new ValidationError('Invalid revision');
  const parts = selectionsFrom(req.body.parts);
  if (!parts.length) throw new ValidationError('Choose at least one component');
  const result = await prisma.savedPcBuild.updateMany({
    where: { id: req.user!.id, revision },
    data: { parts, revision: { increment: 1 } },
  });
  if (!result.count) {
    res.status(409).json({ message: 'Saved PC build changed on another device', code: 'PC_BUILD_CONFLICT' });
    return;
  }
  res.json({ revision: revision + 1 });
});

export const buildCatalog = handle(async (req, res) => {
  const slot = req.query.slot as PcSlot;
  if (!PC_SLOTS.includes(slot)) throw new ValidationError('Invalid component type');
  const sort = req.query.sort ?? 'recommended';
  if (sort !== 'recommended' && sort !== 'priceAsc' && sort !== 'priceDesc') throw new ValidationError('Invalid sort option');
  let rawParts: unknown = [];
  if (req.query.parts !== undefined) {
    if (typeof req.query.parts !== 'string' || req.query.parts.length > 12000) throw new ValidationError('Invalid PC build');
    try { rawParts = JSON.parse(req.query.parts); } catch { throw new ValidationError('Invalid PC build'); }
  }
  const selections = selectionsFrom(rawParts).filter(part => part.slot !== slot);
  const selectedProducts = selections.length ? await prisma.products.findMany({ where: { ...availableProducts(), id: { in: selections.map(part => part.id) } }, select }) : [];
  const selected = Object.fromEntries(selections.map(selection => {
    const product = selectedProducts.find(product => product.id === selection.id);
    if (!product || !componentMatches(product, selection.slot)) throw new ValidationError('A selected component is unavailable or belongs to a different category');
    return [selection.slot, product];
  }));
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const where: Prisma.productsWhereInput = { ...availableProducts(), stock: { gt: 0 }, AND: [
    { OR: COMPONENT_TERMS[slot].flatMap(term => [{ category: { contains: term, mode: 'insensitive' as const } }, { subCategory: { contains: term, mode: 'insensitive' as const } }, { tags: { has: term } }]) },
    ...(q ? [{ title: { contains: q, mode: 'insensitive' as const } }] : []),
  ] };
  const { skip, take } = pageArgs(req.query);
  // Rank/filter the complete category before pagination so later pages cannot hide better matches.
  const candidates = await prisma.products.findMany({ where, select });
  const ranked = recommendPcProducts(candidates, slot, selected, sort);
  const total = ranked.length;
  res.setHeader('Cache-Control', 'no-store');
  res.json({ products: ranked.slice(skip, skip + take), currency: 'usd', pagination: { page: skip / take + 1, total, totalPages: Math.max(1, Math.ceil(total / take)) } });
});

export const quoteBuild = handle(async (req, res) => {
  const selections = selectionsFrom(req.body.parts);
  if (!selections.length) throw new ValidationError('Choose at least one component');
  const ids = selections.map(p => p.id);
  const products = await prisma.products.findMany({ where: { ...availableProducts(), id: { in: ids } }, select });
  const parts = selections.map(selection => {
    const product = products.find(p => p.id === selection.id);
    if (!product || !componentMatches(product, selection.slot)) throw new ValidationError('A selected component is unavailable or belongs to a different category');
    const variant = product.variants.find(v => v.id === selection.variantId);
    if ((product.variants.length && !variant) || (!product.variants.length && selection.variantId)) throw new ValidationError(`Select a variant for ${product.title}`);
    const options = selection.selectedOptions || {};
    if (!variant && ((product.colors.length && !product.colors.includes(options.color)) || (product.sizes.length && !product.sizes.includes(options.size)))) throw new ValidationError(`Select options for ${product.title}`);
    const stock = Math.min(product.stock, variant?.stock ?? product.stock);
    return { ...product, slot: selection.slot, stock, variantId: variant?.id || null, sale_price: variant?.price ?? product.sale_price, selectedOptions: variant ? { color: variant.color, size: variant.size } : { color: options.color || '', size: options.size || '' } };
  });
  const { issues, checks, notes } = assessCompatibility(Object.fromEntries(parts.map(p => [p.slot, p])));
  for (const part of parts) if (part.stock < 1) issues.push({ level: 'error', message: `${part.title} is out of stock.` });
  res.json({ parts, issues, compatibility: { checks, notes }, total: parts.reduce((sum, p) => sum + usdCents(p.sale_price), 0) / 100, currency: 'usd', canAddToCart: !issues.some(i => i.level === 'error') });
});
