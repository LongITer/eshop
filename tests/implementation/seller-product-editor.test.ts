import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import EditProduct from '../../apps/seller-ui/src/app/dashboard/edit-product/[id]/page';

jest.mock('react', () => ({ ...jest.requireActual('react'), useState: jest.fn(), useRef: jest.fn(), useEffect: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn(), useMutation: jest.fn(), useQueryClient: jest.fn() }));
jest.mock('next/navigation', () => ({ useParams: () => ({ id: 'product-1' }), useRouter: () => ({ push: jest.fn() }) }));
jest.mock('next/link', () => ({ __esModule: true, default: 'a' }));
jest.mock('next/dynamic', () => () => 'rich-text-editor');
jest.mock('lucide-react', () => ({ AlertCircle: 'svg', ArrowLeft: 'svg', ImagePlus: 'svg', Info: 'svg', Loader2: 'svg', Save: 'svg', Trash2: 'svg' }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn(), success: jest.fn() } }));
jest.mock('apps/seller-ui/src/hooks/useSeller', () => ({ __esModule: true, default: () => ({ seller: { id: 'seller-1' } }) }), { virtual: true });
jest.mock('apps/seller-ui/src/utils/axioInstance', () => ({ __esModule: true, default: { put: jest.fn().mockResolvedValue({ data: { success: true } }) } }), { virtual: true });
jest.mock('packages/components/input/custom-specification', () => ({ EditableCustomSpecifications: 'specifications-editor' }), { virtual: true });
jest.mock('../../apps/seller-ui/src/shared/components/variant-editor', () => ({ __esModule: true, default: 'sku-editor' }));

const api = jest.requireMock('apps/seller-ui/src/utils/axioInstance').default;
const product = () => ({ id: 'product-1', title: 'Original CPU', slug: 'original-cpu', category: 'PC Components', subCategory: 'CPU', brand: 'AMD', warranty: '3 years', short_description: 'A processor', detailed_description: '<p>Original product details.</p>', regular_price: 140, sale_price: 100, stock: 8, colors: ['Black'], sizes: [], tags: ['cpu'], cash_on_delivery: 'yes', video_url: '', custom_specification: [{ key: 'CPU Socket', value: 'AM5', source: 'manufacturer' }], images: [{ file_id: 'photo-1', url: 'https://example.test/cpu.jpg' }], status: 'Active', variants: [] });

// Drive public component events while keeping React state/ref semantics. Child
// editor callbacks and query refreshes are the integration boundary; no DOM or
// exported implementation helpers are needed for this regression.
function editor(initial = product()) {
  const hooks: any[] = [];
  let cursor = 0;
  let effects: (() => void)[] = [];
  let data: any = initial;
  let pending = false;
  let mutationOptions: any;
  let lastMutation: Promise<unknown> | undefined;
  let tree: any;
  const mutate = jest.fn(() => { lastMutation = mutationOptions.mutationFn(); });
  (React.useState as jest.Mock).mockImplementation((value: any) => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = typeof value === 'function' ? value() : value;
    return [hooks[index], (next: any) => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
  });
  (React.useRef as jest.Mock).mockImplementation((value: any) => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = { current: value };
    return hooks[index];
  });
  (React.useEffect as jest.Mock).mockImplementation(effect => { effects.push(effect); });
  (useQuery as jest.Mock).mockImplementation(({ queryKey }) => queryKey[0] === 'seller-product'
    ? { data, isError: false, refetch: jest.fn() }
    : { data: { categories: ['PC Components'], subCategories: { 'PC Components': ['CPU'] } }, isError: false });
  (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries: jest.fn().mockResolvedValue(undefined) });
  (useMutation as jest.Mock).mockImplementation(options => { mutationOptions = options; return { mutate, isPending: pending }; });
  const render = () => { cursor = 0; effects = []; tree = EditProduct(); effects.forEach(effect => effect()); };
  const all = () => {
    const nodes: any[] = [];
    const visit = (node: any) => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!React.isValidElement(node)) return;
      nodes.push(node); visit((node as any).props.children);
    };
    visit(tree); return nodes;
  };
  const find = (type: string) => all().find(node => node.type === type);
  const text = (node: any): string => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  const saveButton = () => all().find(node => node.type === 'button' && node.props.type === 'submit' && /Save changes|Saving/.test(text(node)));
  render(); render();
  return {
    render, all, find, saveButton, mutate,
    input: (value: unknown) => all().find(node => node.type === 'input' && node.props.value === value),
    refresh: (next: any) => { data = next; render(); },
    pending: (value: boolean) => { pending = value; render(); },
    submit: async () => { find('form').props.onSubmit({ preventDefault: jest.fn() }); await lastMutation; },
  };
}

beforeEach(() => jest.clearAllMocks());

test('unsaved title and specification metadata survive SKU updates and background cache refreshes', async () => {
  const original = product();
  const ui = editor(original);
  ui.input('Original CPU').props.onChange({ target: { value: 'Unsaved CPU title' } });
  const draftSpecifications = [{ ...original.custom_specification[0], value: 'LGA1700' }];
  ui.find('specifications-editor').props.onChange(draftSpecifications);
  ui.render();
  const refreshed = { ...original, stock: 3, sale_price: 125, regular_price: 150, colors: ['Silver'], sizes: ['Box'], variants: [{ id: 'sku-1', sku: 'CPU-BOX' }] };
  ui.find('sku-editor').props.onProductUpdated(refreshed);
  ui.refresh(refreshed);
  expect(ui.input('Unsaved CPU title')).toBeDefined();
  expect(ui.find('specifications-editor').props.value).toEqual(draftSpecifications);
  expect(ui.input(3).props.disabled).toBe(true);
  expect(ui.input(125).props.disabled).toBe(true);
  expect(ui.input('Silver').props.disabled).toBe(true);
  expect(ui.input('Box').props.disabled).toBe(true);
  expect(ui.input(150).props.disabled).toBe(false);
  await ui.submit();
  const [url, payload] = api.put.mock.calls[0];
  expect(url).toBe('/product/api/update-product/product-1');
  expect(payload).toMatchObject({ title: 'Unsaved CPU title', custom_specification: draftSpecifications, regular_price: 150, images: original.images });
  for (const managed of ['stock', 'sale_price', 'colors', 'sizes']) expect(payload).not.toHaveProperty(managed);
});

test('suspended products can save corrected details without attempting to republish', async () => {
  const ui = editor({ ...product(), status: 'Suspended' });
  ui.input('Original CPU').props.onChange({ target: { value: 'Corrected product' } });
  ui.render();
  const status = ui.all().find(node => node.type === 'select' && node.props.value === 'Suspended');
  expect(status.props.disabled).toBe(true);
  await ui.submit();
  expect(api.put).toHaveBeenCalledTimes(1);
  expect(api.put.mock.calls[0][1]).toMatchObject({ title: 'Corrected product', stock: 8, sale_price: 100 });
  expect(api.put.mock.calls[0][1]).not.toHaveProperty('status');
});

test('a pending SKU save blocks product submission, and a pending product save blocks SKU editing', async () => {
  const ui = editor();
  ui.find('sku-editor').props.onBusyChange(true);
  ui.render();
  expect(ui.saveButton().props.disabled).toBe(true);
  await ui.submit();
  expect(ui.mutate).not.toHaveBeenCalled();
  expect(api.put).not.toHaveBeenCalled();
  ui.find('sku-editor').props.onBusyChange(false);
  ui.render();
  expect(ui.saveButton().props.disabled).toBe(false);
  ui.pending(true);
  expect(ui.saveButton().props.disabled).toBe(true);
  expect(ui.find('sku-editor').props.disabled).toBe(true);
  await ui.submit();
  expect(api.put).not.toHaveBeenCalled();
  ui.pending(false);
  expect(ui.find('sku-editor').props.disabled).toBe(false);
  await ui.submit();
  expect(api.put).toHaveBeenCalledTimes(1);
});

test('invalid specifications block product submission without changing the last valid draft', async () => {
  const ui = editor();
  ui.find('specifications-editor').props.onValidationChange(true);
  ui.render();
  expect(ui.saveButton().props.disabled).toBe(true);
  await ui.submit();
  expect(api.put).not.toHaveBeenCalled();
  ui.find('specifications-editor').props.onValidationChange(false);
  ui.render();
  await ui.submit();
  expect(api.put.mock.calls[0][1].custom_specification).toEqual(product().custom_specification);
});
