import { assessCompatibility, PcSlot } from './pc-build';

/** Availability must respect both the product total and its active SKUs. */
export function pcAvailableStock(product: any): number {
  const variants = (product.variants || []).filter((variant: any) => variant.active !== false);
  const total = Math.max(0, Number(product.stock) || 0);
  return variants.length ? Math.min(total, variants.reduce((sum: number, variant: any) => sum + Math.max(0, Number(variant.stock) || 0), 0)) : total;
}

export function recommendPcProducts<T extends { id: string; sale_price: number }>(products: T[], slot: PcSlot, selected: Partial<Record<PcSlot, any>>, sort: 'recommended' | 'priceAsc' | 'priceDesc') {
  return products.flatMap(product => {
    const stock = pcAvailableStock(product);
    if (!stock) return [];
    // Replacing a component must not compare it against the old part in that slot.
    const checks = assessCompatibility({ ...selected, [slot]: product }).checks.filter(check => check.slots.includes(slot));
    if (checks.some(check => check.status === 'conflict')) return [];
    const status: 'unchecked' | 'unknown' | 'matched' = checks.length === 0 ? 'unchecked' : checks.some(check => check.status === 'unknown') ? 'unknown' : 'matched';
    return [{ ...product, recommendation: { status, stock, checks } }];
  }).sort((a, b) => {
    if (sort === 'recommended') {
      const rank = { matched: 0, unchecked: 1, unknown: 2 };
      const compatibility = rank[a.recommendation.status] - rank[b.recommendation.status];
      if (compatibility) return compatibility;
      const stock = b.recommendation.stock - a.recommendation.stock;
      if (stock) return stock;
    }
    return (sort === 'priceDesc' ? b.sale_price - a.sale_price : a.sale_price - b.sale_price) || a.id.localeCompare(b.id);
  });
}
