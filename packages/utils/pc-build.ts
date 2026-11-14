export const PC_SLOTS = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooler'] as const;
export type PcSlot = typeof PC_SLOTS[number];
export const COMPONENT_TERMS: Record<PcSlot, string[]> = {
  cpu: ['cpu', 'processor', 'bộ xử lý'], motherboard: ['motherboard', 'mainboard', 'bo mạch'],
  ram: ['ram', 'memory', 'bộ nhớ'], gpu: ['gpu', 'vga', 'graphics', 'card đồ họa'],
  storage: ['ssd', 'hdd', 'storage', 'ổ cứng'], psu: ['psu', 'power supply', 'nguồn'],
  case: ['case', 'vỏ máy'], cooler: ['cooler', 'cooling', 'tản nhiệt'],
};
export function componentMatches(product: any, slot: PcSlot) {
  const text = `${product.category || ''} ${product.subCategory || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
  return COMPONENT_TERMS[slot].some(term => text.includes(term));
}
function specificationKey(key: string) {
  return key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Read seller labels without guessing specifications from titles or model numbers. */
export function specifications(raw: unknown): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  const valueText = (value: unknown): string => {
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim().toUpperCase();
    if (Array.isArray(value)) return value.filter(item => typeof item === 'string' || typeof item === 'number').map(valueText).filter(Boolean).join(' / ');
    return '';
  };
  let count = 0;
  const add = (key: unknown, value: unknown) => {
    if (typeof key !== 'string' || count++ >= 200) return;
    const normalized = specificationKey(key);
    const text = valueText(value);
    if (!normalized || !text) return;
    // Keep contradictory duplicates visible to the checker instead of trusting the last row.
    result[normalized] = result[normalized] && result[normalized] !== text ? `${result[normalized]} / ${text}` : text;
  };
  const visit = (value: unknown, depth = 0) => {
    if (depth > 3 || count >= 200 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const row of value.slice(0, 200)) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
        add([row.name, row.key, row.label].find(label => typeof label === 'string' && label.trim()), row.value);
      }
    } else {
      for (const [key, item] of Object.entries(value).slice(0, 200)) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          if ('value' in item) add(key, item.value);
          else visit(item, depth + 1);
        } else add(key, item);
      }
    }
  };
  if (typeof raw === 'string' && raw.length <= 20000) {
    try { visit(JSON.parse(raw)); } catch { /* Malformed legacy data remains unknown. */ }
  } else visit(raw);
  return result;
}

const FIELD_ALIASES = {
  socket: ['socket', 'cpusocket', 'processorsocket', 'sockettype', 'socketcpu', 'socketboxuly', 'loaisocket', 'socketmainboard', 'socketmotherboard', 'socketbomachchu', 'socketbomach', 'sockethotro', 'supportedsocket', 'khecamcpu', 'chancamcpu'],
  memory: ['memorytype', 'ramtype', 'typeofmemory', 'typeofram', 'rammemorytype', 'memorytechnology', 'ramtechnology', 'supportedmemorytype', 'supportedmemory', 'memorysupport', 'ram', 'memory', 'loairam', 'chuanram', 'kieuram', 'loaibonho', 'loaibonhoram', 'loaibonhohotro', 'kieubonho', 'congnghebonho', 'loairamhotro', 'ramhotro', 'bonhohotro', 'hotrobonho'],
  wattage: ['wattage', 'wattagew', 'power', 'psuwattage', 'psupower', 'ratedpower', 'outputpower', 'poweroutput', 'powersupplywattage', 'congsuat', 'congsuatw', 'congsuatnguon', 'congsuatdinhmuc', 'congsuatthuc'],
  recommended: ['recommendedpsuwatts', 'recommendedpsuw', 'recommendedpsu', 'recommendedpowersupply', 'recommendedpsuwattage', 'minimumpsuwatts', 'minimumpsu', 'minimumpowersupply', 'psurequirement', 'requiredpsuwatts', 'nguondenghi', 'nguonkhuyennghi', 'congsuatnguonkhuyennghi', 'nguontoithieu', 'congsuatnguontoithieu'],
};

/** Shared with the seller editor so adding required fields respects existing labels. */
export function pcSpecificationFieldName(label: string): 'socket' | 'memoryType' | 'wattage' | 'recommendedPsuWatts' | undefined {
  const key = specificationKey(label);
  const names = { socket: 'socket', memory: 'memoryType', wattage: 'wattage', recommended: 'recommendedPsuWatts' } as const;
  for (const field of Object.keys(FIELD_ALIASES) as (keyof typeof FIELD_ALIASES)[]) {
    if (FIELD_ALIASES[field].some(alias => specificationKey(alias) === key)) return names[field];
  }
  return undefined;
}

function fieldValues(specs: Record<string, string>, field: keyof typeof FIELD_ALIASES): string[] {
  return [...new Set(FIELD_ALIASES[field].map(alias => specs[specificationKey(alias)]).filter(Boolean))];
}

function hardwareTokens(values: string[], kind: 'socket' | 'memory'): string[] {
  if (!values.length) return [];
  const result = new Set<string>();
  for (const value of values) {
    const text = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[‐‑–—]/g, '-').toUpperCase();
    // Negated and unrecognized entries need review, even if another alias is usable.
    if (/\b(NO|NOT|WITHOUT|UNSUPPORTED|EXCEPT|EXCLUDES|EXCLUDING|UNKNOWN|UNSPECIFIED|TBD|KHONG)\b/.test(text)) return [];
    const compact = text.replace(/\b(?:FC)?LGA\s*-?\s*(\d+)/g, 'LGA$1')
      .replace(/\b(LGA\d{3,4})\s*-\s*V?(\d+)\b/g, '$1V$2')
      .replace(/\b((?:LP)?DDR)\s*-?\s*(\d)/g, '$1$2').replace(/\b(AM|FM)\s*-?\s*(\d)/g, '$1$2');
    const matches = kind === 'socket'
      ? compact.match(/\b(?:LGA\d{3,4}(?:-?V\d)?|AM\d\+?|FM\d\+?|S?TRX?\d|TR4|SP\d)\b\+?/g)
      : compact.match(/\b(?:LP)?DDR[1-6]\b/g);
    // A numeric LGA socket is accepted only from an explicitly named socket field.
    const tokens = matches || (kind === 'socket' && /^\d{3,4}$/.test(compact.trim()) ? [`LGA${compact.trim()}`] : []);
    if (!tokens.length) return [];
    for (const token of tokens) result.add(token.replace(/-V/g, 'V'));
  }
  return [...result].sort();
}

function watts(values: string[]): number | undefined {
  const parsed = values.map(value => {
    // Do not mistake GPU consumption, ranges, efficiency ratings or kW for PSU watts.
    const match = /^(\d{1,4}|\d{1,2}[,.]\d{3})\s*(?:W|WATTS?)?$/.exec(value.trim());
    if (!match) return NaN;
    return Number(match[1].replace(/[,.]/g, ''));
  });
  return parsed.length && parsed.every(value => Number.isFinite(value) && value > 0 && value <= 10000 && value === parsed[0]) ? parsed[0] : undefined;
}

export type PcCompatibilityCheck = {
  id: 'socket' | 'memory' | 'psu';
  status: 'passed' | 'unknown' | 'conflict';
  label: string;
  field: string;
  slots: PcSlot[];
  values: Partial<Record<PcSlot, string>>;
  missing: PcSlot[];
  message: string;
};
export const PC_MANUAL_CHECK_NOTE = 'Also check BIOS support, case clearance, connectors and cooling with the product specifications. These checks are not exhaustive.';

export function assessCompatibility(parts: Partial<Record<PcSlot, any>>) {
  const checks: PcCompatibilityCheck[] = [];
  const specs = Object.fromEntries(Object.entries(parts).map(([slot, part]) => [slot, specifications(part?.custom_specification)]));
  const compare = (a: PcSlot, b: PcSlot, id: 'socket' | 'memory', label: string, field: string) => {
    if (!parts[a] || !parts[b]) return;
    const valuesA = hardwareTokens(fieldValues(specs[a], id), id);
    const valuesB = hardwareTokens(fieldValues(specs[b], id), id);
    const missing: PcSlot[] = [];
    if (valuesA.length !== 1) missing.push(a);
    // A family listing several sockets/DDR generations does not identify the selected model.
    if (valuesB.length !== 1) missing.push(b);
    if (id === 'socket' && valuesA.length === 1 && valuesB.length === 1 && valuesA[0] !== valuesB[0]) {
      const sameUnspecifiedRevision = valuesA[0].replace(/V\d+$/, '') === valuesB[0].replace(/V\d+$/, '') &&
        (!/V\d+$/.test(valuesA[0]) || !/V\d+$/.test(valuesB[0]));
      const differentPrefix = valuesA[0].replace(/^S(?=TR)/, '') === valuesB[0].replace(/^S(?=TR)/, '');
      if (sameUnspecifiedRevision || differentPrefix) missing.push(...[a, b].filter(slot => !missing.includes(slot)));
    }
    const left = valuesA.join(' / '), right = valuesB.join(' / ');
    const status = missing.length ? 'unknown' : valuesB.includes(valuesA[0]) ? 'passed' : 'conflict';
    checks.push({ id, label, field, slots: [a, b], values: { ...(left ? { [a]: left } : {}), ...(right ? { [b]: right } : {}) }, missing, status,
      message: status === 'unknown' ? `Cannot verify ${label}: specifications are missing.` : status === 'conflict' ? `${label} mismatch: ${left} / ${right}.` : '' });
  };
  compare('cpu', 'motherboard', 'socket', 'CPU / motherboard socket', 'Socket');
  compare('ram', 'motherboard', 'memory', 'RAM / motherboard memory type', 'Memory type');
  if (parts.psu && parts.gpu) {
    const supply = watts(fieldValues(specs.psu, 'wattage')), recommended = watts(fieldValues(specs.gpu, 'recommended'));
    const missing: PcSlot[] = [...(supply ? [] : ['psu' as const]), ...(recommended ? [] : ['gpu' as const])];
    const status = missing.length ? 'unknown' : supply! < recommended! ? 'conflict' : 'passed';
    checks.push({ id: 'psu', label: 'PSU capacity', field: 'Wattage / recommended PSU', slots: ['psu', 'gpu'], status, missing,
      values: { ...(supply ? { psu: `${supply} W` } : {}), ...(recommended ? { gpu: `${recommended} W` } : {}) },
      message: status === 'unknown' ? 'Cannot verify PSU capacity: wattage or recommended PSU watts is missing.' : status === 'conflict' ? `GPU recommends at least ${recommended} W; selected PSU is ${supply} W.` : '' });
  }
  const issues = checks.filter(check => check.status !== 'passed').map(check => ({ level: check.status === 'conflict' ? 'error' as const : 'warning' as const, message: check.message }));
  return { checks, issues, notes: [PC_MANUAL_CHECK_NOTE] };
}

export function checkCompatibility(parts: Partial<Record<PcSlot, any>>) {
  return assessCompatibility(parts).issues;
}
