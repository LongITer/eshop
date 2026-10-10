import prisma from '@packages/libs/prisma';
import { handle, objectId, pageArgs } from '@packages/utils/api';
import { ValidationError } from '@packages/error-handler';
import { PC_SLOTS, PcSlot, COMPONENT_TERMS, componentMatches, checkCompatibility } from '@packages/utils/pc-build';
import { usdCents } from '@packages/utils/money';

const select = { id: true, title: true, slug: true, category: true, subCategory: true, tags: true, colors: true, sizes: true, sale_price: true, stock: true, custom_specification: true, images: { select: { url: true }, take: 1 }, variants: { where: { active: true }, select: { id: true, sku: true, color: true, size: true, price: true, stock: true } } };
export const buildCatalog = handle(async (req, res) => {
  const slot = req.query.slot as PcSlot;
  if (!PC_SLOTS.includes(slot)) throw new ValidationError('Invalid component type');
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  const products = await prisma.products.findMany({ where: { status: 'Active', isDeleted: false, stock: { gt: 0 }, AND: [
    { OR: COMPONENT_TERMS[slot].flatMap(term => [{ category: { contains: term, mode: 'insensitive' as const } }, { subCategory: { contains: term, mode: 'insensitive' as const } }, { tags: { has: term } }]) },
    ...(q ? [{ title: { contains: q, mode: 'insensitive' as const } }] : []),
  ] }, ...pageArgs(req.query), orderBy: [{ sale_price: 'asc' }, { id: 'asc' }], select });
  res.json({ products, currency: 'usd' });
});

export const quoteBuild = handle(async (req, res) => {
  const selections = req.body.parts;
  if (!Array.isArray(selections) || selections.length < 1 || selections.length > PC_SLOTS.length || selections.some(p => !p || !PC_SLOTS.includes(p.slot)) || new Set(selections.map(p => p.slot)).size !== selections.length) throw new ValidationError('Choose one product per component slot');
  const ids = selections.map(p => objectId(p.id));
  const products = await prisma.products.findMany({ where: { id: { in: ids }, status: 'Active', isDeleted: false }, select });
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
  const issues = checkCompatibility(Object.fromEntries(parts.map(p => [p.slot, p])));
  for (const part of parts) if (part.stock < 1) issues.push({ level: 'error', message: `${part.title} is out of stock.` });
  res.json({ parts, issues, total: parts.reduce((sum, p) => sum + usdCents(p.sale_price), 0) / 100, currency: 'usd', canAddToCart: !issues.some(i => i.level === 'error') });
});
