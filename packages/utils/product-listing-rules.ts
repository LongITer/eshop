import prisma from '@packages/libs/prisma';
import { ValidationError } from '@packages/error-handler';

const defaultProhibitedKeywords = [
  'ma tuy', 'cocaine', 'heroin', 'methamphetamine', 'amphetamine',
  'sung quan dung', 'vu khi quan dung', 'illegal firearm', 'gunpowder',
  'luu dan', 'chat no', 'thuoc no', 'explosive device', 'hang gia', 'hang nhai',
  'counterfeit', 'fake goods', 'stolen goods',
];

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

export function prohibitedKeywordMatches(listing: { title: string; category: string; description: string }) {
  const configured = (process.env.PRODUCT_PROHIBITED_KEYWORDS || '').split(/[;,\n]/).map(value => value.trim()).filter(Boolean);
  const keywords = [...new Set([...defaultProhibitedKeywords, ...configured].map(normalize).filter(Boolean))];
  const text = normalize(`${listing.title} ${listing.category} ${listing.description}`);
  return keywords.filter(keyword => (` ${text} `).includes(` ${keyword} `));
}

export async function validateProductCategory(category: string, subCategory: string) {
  const config = await prisma.site_config.findFirst();
  if (!config) throw new ValidationError('Product categories are unavailable. Please retry later.');
  if (!config.categories.includes(category)) throw new ValidationError('Choose a category from the current catalog.');
  const subcategories = config.subCategories && typeof config.subCategories === 'object' && !Array.isArray(config.subCategories)
    ? config.subCategories as Record<string, unknown> : {};
  const allowed = Array.isArray(subcategories?.[category]) ? subcategories[category] : [];
  if (!allowed.includes(subCategory)) throw new ValidationError('Choose a subcategory from the selected category.');
}

export async function priceReviewReasons(input: { category: string; subCategory: string; salePrice: number; regularPrice: number; excludeProductId?: string; allowInvalidForModeration?: boolean; peerPrices?: number[] }) {
  const { category, subCategory, salePrice, regularPrice } = input;
  if (!Number.isFinite(salePrice) || !Number.isFinite(regularPrice) || salePrice <= 0 || regularPrice <= 0 || salePrice > 10_000_000 || regularPrice > 10_000_000) {
    if (input.allowInvalidForModeration) return ['The stored sale or regular price is outside the allowed range.'];
    throw new ValidationError('Enter valid product prices between $0.01 and $10,000,000.');
  }
  if (salePrice > regularPrice) {
    if (!input.allowInvalidForModeration) throw new ValidationError('Sale price cannot exceed regular price.');
    return ['The sale price exceeds the listed regular price.'];
  }

  const reasons: string[] = [];
  if (regularPrice >= salePrice * 20) reasons.push('The sale price is at least 95% below the listed regular price.');

  const peerPrices = input.peerPrices ?? (await prisma.products.findMany({
    where: { category, subCategory, status: 'Active', isDeleted: false, sale_price: { gt: 0 }, ...(input.excludeProductId ? { id: { not: input.excludeProductId } } : {}) },
    orderBy: { createdAt: 'desc' }, take: 101, select: { sale_price: true },
  })).map(row => row.sale_price);
  if (peerPrices.length >= 10) {
    const prices = peerPrices.filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    if (median > 0 && (salePrice < median / 10 || salePrice > median * 10)) reasons.push('The sale price is more than 10× away from recent active listings in this subcategory.');
  }
  return reasons;
}
