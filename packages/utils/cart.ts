export type CartSelection = { id: string; variantId?: string | null; selectedOptions?: { color?: string; size?: string } };

/** Stable across reloads, including carts saved before variant support. */
export function cartLineKey(item: CartSelection): string {
  return JSON.stringify([item.id, item.selectedOptions?.color || '', item.selectedOptions?.size || '']);
}
