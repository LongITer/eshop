import { PC_SLOTS, PcSlot } from './pc-build';

export type PcSelection = {
  slot: PcSlot;
  id: string;
  variantId?: string;
  selectedOptions: { color: string; size: string };
};

/** Save references only: prices, stock and compatibility must come from a fresh quote. */
export function parsePcSelections(value: unknown): PcSelection[] {
  if (!Array.isArray(value) || value.length > PC_SLOTS.length) throw new Error('Invalid PC build');
  const slots = new Set<PcSlot>();
  const id = (input: unknown) => {
    if (typeof input !== 'string' || !/^[a-f\d]{24}$/i.test(input)) throw new Error('Invalid component ID');
    return input.toLowerCase();
  };
  const option = (input: unknown) => {
    if (input === undefined || input === null) return '';
    if (typeof input !== 'string' || input.length > 200) throw new Error('Invalid component option');
    return input;
  };
  return value.map(part => {
    if (!part || typeof part !== 'object' || Array.isArray(part) || !PC_SLOTS.includes(part.slot) || slots.has(part.slot)) throw new Error('Choose one product per component slot');
    slots.add(part.slot);
    const options = part.selectedOptions ?? {};
    if (typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(key => key !== 'color' && key !== 'size')) throw new Error('Invalid component options');
    return {
      slot: part.slot,
      id: id(part.id),
      ...(part.variantId == null ? {} : { variantId: id(part.variantId) }),
      selectedOptions: { color: option(options.color), size: option(options.size) },
    };
  });
}
