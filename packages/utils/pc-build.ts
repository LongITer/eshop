export const PC_SLOTS = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooler'] as const;
export type PcSlot = typeof PC_SLOTS[number];
export const COMPONENT_TERMS: Record<PcSlot, string[]> = {
  cpu: ['cpu', 'processor', 'bộ xử lý'], motherboard: ['motherboard', 'mainboard', 'bo mạch'],
  ram: ['ram', 'memory', 'bộ nhớ'], gpu: ['gpu', 'vga', 'graphics', 'card đồ họa'],
  storage: ['ssd', 'hdd', 'storage', 'ổ cứng'], psu: ['psu', 'power supply', 'nguồn'],
  case: ['case', 'vỏ máy'], cooler: ['cooler', 'tản nhiệt'],
};
export function componentMatches(product: any, slot: PcSlot) {
  const text = `${product.category || ''} ${product.subCategory || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
  return COMPONENT_TERMS[slot].some(term => text.includes(term));
}
export function specifications(raw: any): Record<string, string> {
  const entries = Array.isArray(raw) ? raw.map(item => [item?.name, item?.value]) : Object.entries(raw || {});
  return Object.fromEntries(entries.filter(([k, v]) => typeof k === 'string' && v != null).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ''), String(v).trim().toUpperCase()]));
}
export function checkCompatibility(parts: Partial<Record<PcSlot, any>>) {
  const issues: { level: 'error' | 'warning'; message: string }[] = [];
  const specs = Object.fromEntries(Object.entries(parts).map(([slot, p]) => [slot, specifications(p.custom_specification)]));
  const compare = (a: PcSlot, b: PcSlot, key: string, label: string) => {
    if (!parts[a] || !parts[b]) return;
    if (!specs[a]?.[key] || !specs[b]?.[key]) issues.push({ level: 'warning', message: `Cannot verify ${label}: specifications are missing.` });
    else if (specs[a][key] !== specs[b][key]) issues.push({ level: 'error', message: `${label} mismatch: ${specs[a][key]} / ${specs[b][key]}.` });
  };
  compare('cpu', 'motherboard', 'socket', 'CPU / motherboard socket');
  compare('ram', 'motherboard', 'memorytype', 'RAM / motherboard memory type');
  if (parts.psu && parts.gpu) {
    const supply = Number(specs.psu?.wattage); const recommended = Number(specs.gpu?.recommendedpsuwatts);
    if (!(supply > 0 && recommended > 0)) issues.push({ level: 'warning', message: 'Cannot verify PSU capacity: wattage or recommended PSU watts is missing.' });
    else if (supply < recommended) issues.push({ level: 'error', message: `GPU recommends at least ${recommended} W; selected PSU is ${supply} W.` });
  }
  issues.push({ level: 'warning', message: 'Also check BIOS support, case clearance, connectors and cooling with the product specifications. These checks are not exhaustive.' });
  return issues;
}
