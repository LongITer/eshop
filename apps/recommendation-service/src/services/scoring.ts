export type ProductFeatures = { id: string; category: string; subCategory: string; brand?: string | null; tags: string[]; sale_price: number };
export function similarity(a: ProductFeatures, b: ProductFeatures): number {
  if (a.id === b.id) return 0;
  const tags = new Set(a.tags.map(tag => tag.toLowerCase()));
  const overlap = b.tags.filter(tag => tags.has(tag.toLowerCase())).length;
  const union = new Set([...a.tags, ...b.tags].map(tag => tag.toLowerCase())).size;
  return (a.category === b.category ? 4 : 0) + (a.subCategory === b.subCategory ? 3 : 0) + (a.brand && a.brand === b.brand ? 2 : 0) + (union ? overlap / union * 2 : 0) + Math.max(0, 1 - Math.abs(a.sale_price - b.sale_price) / Math.max(1, a.sale_price, b.sale_price));
}
export function popularity(analytics: { views: number; cartAdds: number; wishListAdds: number; purchases: number; lastViewedAt: Date }, now = Date.now()): number {
  const days = Math.max(0, (now - new Date(analytics.lastViewedAt).getTime()) / 86400000);
  return Math.log1p(Math.max(0, analytics.views) + Math.max(0, analytics.cartAdds) * 3 + Math.max(0, analytics.wishListAdds) * 2 + Math.max(0, analytics.purchases) * 8) / (1 + days / 14);
}
export function actionWeight(action: string): number { return ({ product_view: 1, add_to_wishlist: 3, add_to_cart: 4, purchase: 6 } as Record<string, number>)[action] ?? 0; }
