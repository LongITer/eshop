import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'apps/seller-ui/src/utils/axioInstance';
import useSeller from 'apps/seller-ui/src/hooks/useSeller';
import SellerRevenue from '../../apps/seller-ui/src/shared/components/charts/seller-revenue';

jest.mock('react', () => ({ ...jest.requireActual('react'), useState: jest.fn(), useRef: jest.fn(), useEffect: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('apps/seller-ui/src/utils/axioInstance', () => ({ __esModule: true, default: { get: jest.fn() } }), { virtual: true });
jest.mock('apps/seller-ui/src/hooks/useSeller', () => ({ __esModule: true, default: jest.fn() }), { virtual: true });
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

const paidReport = {
  timeline: [{ date: '2026-10-16', revenue: 123, orders: 1 }],
  totalRevenue: 123, totalOrders: 1, topProducts: [], coupons: [],
};
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const createObjectURL = jest.fn(() => 'blob:seller-report');
const revokeObjectURL = jest.fn();
let anchor: { href: string; download: string; click: jest.Mock; remove: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-16T05:00:00.000Z'));
  (axios.get as jest.Mock).mockResolvedValue({ data: paidReport });
  (useSeller as jest.Mock).mockReturnValue({ seller: { id: 'seller-a' } });
  anchor = { href: '', download: '', click: jest.fn(), remove: jest.fn() };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: jest.fn(() => anchor), body: { appendChild: jest.fn() } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { print: jest.fn() } });
  jest.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL);
  jest.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else delete (globalThis as any).document;
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete (globalThis as any).window;
});

// Follow the lightweight controlled-input harness used by the seller specifications
// tests. The public component and its query/export boundary are exercised; no
// private date validator is exported. The query double deliberately retains the
// previous report even when disabled, so stale-data hiding is verified explicitly.
function reportEditor() {
  const hooks: any[] = [];
  const requested = new Set<string>();
  let cursor = 0;
  let dirty = false;
  let effects: { index: number; effect: () => void | (() => void); dependencies: unknown[] }[] = [];
  let queryOptions: any;
  let tree: any;

  (React.useState as jest.Mock).mockImplementation((initial: any) => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks[index], (next: any) => {
      const value = typeof next === 'function' ? next(hooks[index]) : next;
      if (!Object.is(hooks[index], value)) { hooks[index] = value; dirty = true; }
    }];
  });
  (React.useRef as jest.Mock).mockImplementation((initial: any) => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = { current: initial };
    return hooks[index];
  });
  (React.useEffect as jest.Mock).mockImplementation((effect: () => void, dependencies: unknown[]) => {
    const index = cursor++;
    const previous = hooks[index];
    if (!previous || dependencies.some((dependency, position) => !Object.is(dependency, previous.dependencies[position]))) {
      effects.push({ index, effect, dependencies });
    }
  });
  (useQuery as jest.Mock).mockImplementation(options => {
    queryOptions = options;
    const key = JSON.stringify(options.queryKey);
    if (options.enabled && !requested.has(key)) {
      requested.add(key);
      void options.queryFn({ signal: new AbortController().signal }).catch(() => undefined);
    }
    return { data: paidReport, isFetching: false, isError: false, errorUpdatedAt: 0 };
  });
  const render = () => {
    let attempts = 0;
    do {
      dirty = false; cursor = 0; effects = [];
      tree = SellerRevenue({ detailed: true });
      for (const { index, effect, dependencies } of effects) {
        hooks[index]?.cleanup?.();
        hooks[index] = { dependencies, cleanup: effect() };
      }
      if (++attempts > 10) throw new Error('Seller report did not settle');
    } while (dirty);
  };
  const all = (): any[] => {
    const nodes: any[] = [];
    const visit = (node: any) => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!React.isValidElement(node)) return;
      nodes.push(node);
      visit((node as any).props.children);
    };
    visit(tree);
    return nodes;
  };
  const text = (node: any): string => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  const button = (label: string) => all().find(node => node.type === 'button' && text(node).includes(label));
  const change = (label: string, value: string) => {
    const field = all().find(node => node.props['aria-label'] === label && ['select', 'input'].includes(node.type));
    expect(field).toBeDefined();
    field.props.onChange({ target: { value } });
    render();
  };
  render();
  return { render, change, button, text: () => text(tree), query: () => queryOptions };
}

describe('seller revenue report date and export boundary', () => {
  test.each([
    ['', '', 'both a start date and an end date'],
    ['2026-10-16', '', 'both a start date and an end date'],
    ['', '2026-10-16', 'both a start date and an end date'],
    ['2026-10-16', '2026-10-15', 'on or before'],
    ['2026-02-30', '2026-03-01', 'valid calendar dates'],
    ['2024-01-01', '2025-01-01', 'at most 366 days'],
  ])('invalid custom range %s to %s cannot query, display stale totals or export', async (from, to, message) => {
    const ui = reportEditor();
    expect(ui.text()).toContain('Total revenue');
    expect(ui.text()).toContain('$123.00');
    (axios.get as jest.Mock).mockClear();

    ui.change('Revenue period', 'custom');
    if (from) ui.change('From', from);
    if (to) ui.change('To', to);

    expect(ui.query().enabled).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
    expect(ui.text()).toContain(message);
    expect(ui.text()).not.toContain('Total revenue');
    expect(ui.text()).not.toContain('$123.00');
    expect(ui.button('Export CSV').props.disabled).toBe(true);
    expect(ui.button('Print / PDF').props.disabled).toBe(true);
    // Even direct invocation of the handler cannot bypass the disabled button.
    await ui.button('Export CSV').props.onClick();
    ui.button('Print / PDF').props.onClick();
    expect(axios.get).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(window.print).not.toHaveBeenCalled();
  });

  test.each([
    ['2024-01-01', '2024-12-31'],
    ['2025-01-01', '2025-12-31'],
    ['2026-10-16', '2026-10-16'],
  ])('valid inclusive UTC range %s to %s enables the scoped abortable query', (from, to) => {
    const ui = reportEditor();
    ui.change('Revenue period', 'custom');
    (axios.get as jest.Mock).mockClear();
    ui.change('From', from);
    expect(axios.get).not.toHaveBeenCalled();
    ui.change('To', to);
    expect(ui.query()).toMatchObject({ enabled: true, queryKey: ['revenue-report', 'seller-a', `from=${from}&to=${to}&interval=day`] });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(`/product/api/seller-reports?from=${from}&to=${to}&interval=day`, { signal: expect.any(AbortSignal) });
    expect(ui.text()).toContain('Total revenue');
    expect(ui.button('Export CSV').props.disabled).toBe(false);
  });

  test('clearing a date hides a previously valid custom report and blocks a new request', () => {
    const ui = reportEditor();
    ui.change('Revenue period', 'custom');
    ui.change('From', '2026-10-01');
    ui.change('To', '2026-10-16');
    expect(ui.text()).toContain('Revenue trend');
    (axios.get as jest.Mock).mockClear();
    ui.change('From', '');
    expect(ui.query().enabled).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
    expect(ui.text()).not.toContain('Revenue trend');
    expect(ui.text()).not.toContain('Top products');
    expect(ui.button('Export CSV').props.disabled).toBe(true);
  });

  test('a missing seller cannot query or export a retained report', async () => {
    (useSeller as jest.Mock).mockReturnValue({ seller: null });
    const ui = reportEditor();
    expect(ui.query().enabled).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
    expect(ui.text()).not.toContain('Total revenue');
    expect(ui.button('Export CSV').props.disabled).toBe(true);
    await ui.button('Export CSV').props.onClick();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('a valid CSV export retains period parameters and uses an abortable blob request', async () => {
    const ui = reportEditor();
    (axios.get as jest.Mock).mockClear();
    (axios.get as jest.Mock).mockResolvedValueOnce({ data: new Blob(['date,revenue\n2026-10-16,123']) });
    await ui.button('Export CSV').props.onClick();
    expect(axios.get).toHaveBeenCalledWith('/product/api/seller-reports?from=2026-01-01&to=2026-12-31&interval=month&format=csv', { responseType: 'blob', signal: expect.any(AbortSignal) });
    expect(anchor.download).toBe('seller-revenue-2026.csv');
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.remove).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    jest.runOnlyPendingTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:seller-report');
  });

  test('invalidating a date aborts an in-flight CSV and discards its late response', async () => {
    const ui = reportEditor();
    ui.change('Revenue period', 'custom');
    ui.change('From', '2026-10-01');
    ui.change('To', '2026-10-16');
    let resolveExport!: (value: { data: Blob }) => void;
    let exportSignal!: AbortSignal;
    (axios.get as jest.Mock).mockImplementationOnce((_url, options) => {
      exportSignal = options.signal;
      return new Promise(resolve => { resolveExport = resolve; });
    });
    const downloading = ui.button('Export CSV').props.onClick();
    ui.render();
    expect(exportSignal.aborted).toBe(false);
    ui.change('To', '');
    expect(exportSignal.aborted).toBe(true);
    expect(ui.text()).not.toContain('Total revenue');
    resolveExport({ data: new Blob(['old report']) });
    await downloading;
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(anchor.click).not.toHaveBeenCalled();
  });
});
