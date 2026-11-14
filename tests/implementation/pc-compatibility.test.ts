import request from 'supertest';
import { assessCompatibility, checkCompatibility, specifications, pcSpecificationFieldName, PC_MANUAL_CHECK_NOTE } from '@packages/utils/pc-build';
import { quoteBuild } from '../../apps/product-service/src/controllers/pc-builder.controller';
import db, { resetDb } from './mocks/prisma';
import { appFor, productId, otherId, shopId } from './helpers';

const part = (custom_specification: unknown) => ({ custom_specification });
beforeEach(resetDb);

test('seller field suggestions recognize the same aliases as live compatibility checks', () => {
  expect(pcSpecificationFieldName('Socket CPU')).toBe('socket');
  expect(pcSpecificationFieldName('Loại bộ nhớ hỗ trợ')).toBe('memoryType');
  expect(pcSpecificationFieldName('Công suất (W)')).toBe('wattage');
  expect(pcSpecificationFieldName('Recommended PSU (W)')).toBe('recommendedPsuWatts');
  expect(pcSpecificationFieldName('GPU TDP')).toBeUndefined();
});

test('seller labels and legacy name/key/label entries produce the same hardware checks', () => {
  const report = assessCompatibility({
    cpu: part([{ key: 'CPU Socket', value: 'Intel FCLGA 1700' }]),
    motherboard: part({ 'Socket CPU': 'LGA1700', 'Loại bộ nhớ': 'DDR 5' }),
    ram: part([{ label: 'Loại RAM', value: 'DDR5 SDRAM 5600 MHz' }]),
    psu: part({ 'Công suất (W)': '750 W' }),
    gpu: part([{ name: 'Recommended Power Supply', value: '650 Watts' }]),
  });
  expect(report.checks.map(check => [check.id, check.status])).toEqual([['socket', 'passed'], ['memory', 'passed'], ['psu', 'passed']]);
  expect(report.issues).toEqual([]);
  expect(report.notes).toEqual([PC_MANUAL_CHECK_NOTE]);
  expect(report.checks[0].values).toEqual({ cpu: 'LGA1700', motherboard: 'LGA1700' });
});

test('flat, grouped and JSON legacy specs support numeric and list values', () => {
  expect(specifications({ 'Bo mạch': { 'Loại RAM': ['DDR4', 'DDR5'], socket: { value: 'AM5' } } })).toEqual({ loairam: 'DDR4 / DDR5', socket: 'AM5' });
  const report = assessCompatibility({
    cpu: part(JSON.stringify([{ name: 'Socket', value: '1700' }])),
    motherboard: part({ 'CPU specifications': { socket: 'LGA-1700' }, memoryType: ['DDR5'] }),
    ram: part({ ramType: 'DDR5' }),
  });
  expect(report.issues).toEqual([]);
  expect(report.checks.map(check => check.status)).toEqual(['passed', 'passed']);
});

test('unknown specs name only the missing components and never use title/model guesses', () => {
  const report = assessCompatibility({
    cpu: { title: 'Ryzen AM5 Processor', custom_specification: [] },
    motherboard: part({ socket: 'AM5' }),
    ram: part({ memoryType: 'DDR5' }),
  });
  expect(report.checks[0]).toMatchObject({ status: 'unknown', field: 'Socket', missing: ['cpu'], values: { motherboard: 'AM5' } });
  expect(report.checks[1]).toMatchObject({ status: 'unknown', field: 'Memory type', missing: ['motherboard'] });
  expect(report.issues).toHaveLength(2);
  expect(report.issues.every(issue => issue.level === 'warning')).toBe(true);
  expect(checkCompatibility({ cpu: {}, motherboard: {} }).some(issue => issue.message.includes('missing'))).toBe(true);
});

test.each([
  [{ socket: 'AM4 / AM5' }, { socket: 'AM5' }],
  [[{ name: 'socket', value: 'AM4' }, { name: 'socket', value: 'AM5' }], { socket: 'AM5' }],
  [{ socket: 'not AM5' }, { socket: 'AM5' }],
  [{ socket: 'unknown' }, { socket: 'unknown' }],
  [{ socket: 'AM5', 'CPU Socket': 'LGA1700' }, { socket: 'AM5' }],
])('ambiguous or unrecognized CPU specs remain unknown (%#)', (cpu, motherboard) => {
  const report = assessCompatibility({ cpu: part(cpu), motherboard: part(motherboard) });
  expect(report.checks[0].status).toBe('unknown');
  expect(report.issues[0].level).toBe('warning');
});

test('actual socket, memory and PSU conflicts still block and retain meaningful values', () => {
  const report = assessCompatibility({
    cpu: part({ 'Socket CPU': 'AM 5' }), motherboard: part({ socket: 'LGA 1700', 'Loại RAM': 'DDR 4' }),
    ram: part({ memoryType: 'DDR5' }), psu: part({ wattage: '550W' }), gpu: part({ recommendedPsuWatts: '750 W' }),
  });
  expect(report.checks.every(check => check.status === 'conflict')).toBe(true);
  expect(report.issues.map(issue => issue.level)).toEqual(['error', 'error', 'error']);
  expect(report.issues[0].message).toContain('AM5 / LGA1700');
  expect(report.issues[2].message).toBe('GPU recommends at least 750 W; selected PSU is 550 W.');
});

test.each(['', 'n/a', '650-750 W', '80 Plus Gold', '0.75 kW', '750 W / 650 W'])('PSU data cannot be guessed from ambiguous value %s', wattage => {
  expect(assessCompatibility({ psu: part({ wattage }), gpu: part({ recommendedPsuWatts: 650 }) }).checks[0]).toMatchObject({ status: 'unknown', missing: ['psu'] });
});

test('GPU consumption is not treated as a PSU recommendation and GDDR is not DDR RAM', () => {
  expect(assessCompatibility({ psu: part({ wattage: '1,000 W' }), gpu: part({ wattage: 250 }) }).checks[0]).toMatchObject({ status: 'unknown', missing: ['gpu'] });
  expect(assessCompatibility({ ram: part({ memoryType: 'GDDR6' }), motherboard: part({ memoryType: 'DDR6' }) }).checks[0].status).toBe('unknown');
});

test.each([
  { memoryType: 'DDR4', ramType: 'DDR5' },
  [{ name: 'memoryType', value: 'DDR4' }, { name: 'memoryType', value: 'DDR5' }],
  { memoryType: ['DDR4', 'DDR5'] },
  { memoryType: 'DDR4, no DDR5' },
  { memoryType: 'without DDR5 support' },
])('contradictory or negated board memory stays unknown (%#)', motherboard => {
  expect(assessCompatibility({ ram: part({ memoryType: 'DDR5' }), motherboard: part(motherboard) }).checks[0]).toMatchObject({ status: 'unknown', missing: ['motherboard'] });
});

test('empty legacy name falls through to a valid key and unspecified socket revision needs review', () => {
  expect(assessCompatibility({ cpu: part([{ name: '', key: 'Socket', value: 'AM5' }]), motherboard: part({ socket: 'AM5' }) }).checks[0].status).toBe('passed');
  expect(assessCompatibility({ cpu: part({ socket: 'LGA1151V2' }), motherboard: part({ socket: 'LGA1151' }) }).checks[0].status).toBe('unknown');
  expect(assessCompatibility({ cpu: part({ socket: 'LGA2011-3' }), motherboard: part({ socket: 'LGA2011-V3' }) }).checks[0].status).toBe('passed');
  expect(assessCompatibility({ cpu: part({ socket: 'LGA2011-3' }), motherboard: part({ socket: 'LGA2011-1' }) }).checks[0].status).toBe('conflict');
  expect(assessCompatibility({ cpu: part({ socket: 'TR5' }), motherboard: part({ socket: 'sTR5' }) }).checks[0].status).toBe('unknown');
});

test('a single component does not get a fake warning or a compatibility guarantee', () => {
  const report = assessCompatibility({ cpu: part({ socket: 'AM5' }) });
  expect(report.checks).toEqual([]);
  expect(report.issues).toEqual([]);
  expect(report.notes).toHaveLength(1);
});

test('quote exposes structured checks from database specifications and preserves cart blocking', async () => {
  const product = { title: 'CPU', category: 'CPU', subCategory: 'Processor', tags: [], sale_price: 99, stock: 5, colors: [], sizes: [], variants: [], shopId };
  const app = appFor('post', '/', quoteBuild);
  const body = { parts: [{ slot: 'cpu', id: productId }, { slot: 'motherboard', id: otherId }] };
  db.products.findMany.mockResolvedValue([
    { ...product, id: productId, custom_specification: [{ key: 'Socket CPU', value: 'AM5' }] },
    { ...product, id: otherId, category: 'Motherboard', custom_specification: { 'CPU Socket': 'AM 5' } },
  ]);
  const compatible = await request(app).post('/').send(body);
  expect(compatible.status).toBe(200);
  expect(compatible.body).toMatchObject({ canAddToCart: true, issues: [], compatibility: { checks: [{ id: 'socket', status: 'passed', missing: [] }], notes: [PC_MANUAL_CHECK_NOTE] } });
  db.products.findMany.mockResolvedValue([
    { ...product, id: productId, custom_specification: { socket: 'AM5' } },
    { ...product, id: otherId, category: 'Motherboard', custom_specification: { socket: 'LGA1700' } },
  ]);
  const incompatible = await request(app).post('/').send(body);
  expect(incompatible.body.canAddToCart).toBe(false);
  expect(incompatible.body.compatibility.checks[0].status).toBe('conflict');
});
