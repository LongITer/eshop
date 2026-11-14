import React from 'react';
import { EditableCustomSpecifications } from '../../packages/components/input/custom-specification';

jest.mock('react', () => ({ ...jest.requireActual('react'), useState: jest.fn(), useRef: jest.fn(), useEffect: jest.fn() }));

// Exercise controlled input events without a browser/DOM dependency. The public
// component remains the boundary; private draft/serialization helpers stay private.
function editor(value: unknown, context = { category: 'PC Components', subCategory: 'Motherboard' }) {
  const hooks: any[] = [];
  let cursor = 0;
  let effects: (() => void)[] = [];
  let currentValue = value;
  const changed = jest.fn((next: unknown) => { currentValue = next; });
  const validation = jest.fn();
  (React.useState as jest.Mock).mockImplementation((initial: any) => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks[index], (next: any) => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
  });
  (React.useRef as jest.Mock).mockImplementation((initial: any) => {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = { current: initial };
    return hooks[index];
  });
  (React.useEffect as jest.Mock).mockImplementation(effect => { effects.push(effect as () => void); });
  let tree: any;
  const render = () => {
    cursor = 0;
    effects = [];
    tree = EditableCustomSpecifications({ value: currentValue, onChange: changed, onValidationChange: validation, ...context });
    effects.forEach(effect => effect());
  };
  const all = (): any[] => {
    const nodes: any[] = [];
    const visit = (node: any) => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!React.isValidElement(node)) return;
      nodes.push(node);
      const element = node as any;
      if (typeof element.type === 'function') visit(element.type(element.props));
      else visit(element.props.children);
    };
    visit(tree);
    return nodes;
  };
  const text = (node: any): string => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  const input = (oldValue: string) => all().find(node => node.type === 'input' && node.props.value === oldValue);
  const change = (oldValue: string, nextValue: string) => {
    const field = input(oldValue);
    expect(field).toBeDefined();
    field.props.onChange({ target: { value: nextValue } });
    render();
  };
  const button = (label: string) => all().find(node => node.type === 'button' && text(node).includes(label));
  render();
  return { changed, validation, render, all, change, button, value: () => currentValue };
}

afterEach(() => jest.clearAllMocks());

describe('seller PC specifications editor', () => {
  it('keeps the original object untouched until a row changes', () => {
    const original = { socket: 'AM5', memoryType: 'DDR5', details: { count: 2, supported: ['DDR5'] }, nullable: null, flag: false };
    const ui = editor(original);
    expect(ui.changed).not.toHaveBeenCalled();
    expect(ui.value()).toBe(original);
    expect(ui.validation).toHaveBeenLastCalledWith(false);
    ui.change('AM5', 'LGA1700');
    expect(ui.value()).toEqual({ ...original, socket: 'LGA1700' });
    expect((ui.value() as any).details).toBe(original.details);
  });

  it('preserves legacy row keys, metadata and unrecognized array entries', () => {
    const original = [{ key: 'CPU Socket', value: 'AM5', source: 'manufacturer' }, { label: 'Loại RAM', value: ['DDR5'], unit: 'type' }, 'legacy note', null];
    const ui = editor(original);
    ui.change('AM5', 'LGA1700');
    expect(ui.value()).toEqual([{ ...original[0] as object, value: 'LGA1700' }, ...original.slice(1)]);
  });

  it('uses a valid key when a legacy name is empty', () => {
    const original = [{ name: '', key: 'CPU Socket', value: 'AM5', source: 'legacy' }];
    const ui = editor(original, { category: 'PC Components', subCategory: 'CPU' });
    expect(ui.validation).toHaveBeenLastCalledWith(false);
    expect(ui.button('Add missing PC fields')).toBeUndefined();
    ui.change('AM5', 'LGA1700');
    expect(ui.value()).toEqual([{ ...original[0], value: 'LGA1700' }]);
  });

  it('blocks invalid JSON while preserving the previously saved nested value', () => {
    const original = { socket: 'AM5', details: { supported: ['DDR5'], count: 2 } };
    const ui = editor(original);
    const jsonField = ui.all().find(node => node.type === 'textarea');
    jsonField.props.onChange({ target: { value: '{' } });
    ui.render();
    expect(ui.validation).toHaveBeenLastCalledWith(true);
    expect(ui.value()).toBe(original);
    expect(ui.changed).not.toHaveBeenCalled();
    ui.all().find(node => node.type === 'textarea').props.onChange({ target: { value: '{"supported":["DDR5"],"count":4}' } });
    ui.render();
    expect(ui.validation).toHaveBeenLastCalledWith(false);
    expect(ui.value()).toEqual({ ...original, details: { supported: ['DDR5'], count: 4 } });
  });

  it('blocks duplicate object labels without overwriting another specification', () => {
    const original = { socket: 'AM5', memoryType: 'DDR5' };
    const ui = editor(original);
    ui.change('memoryType', 'socket');
    expect(ui.validation).toHaveBeenLastCalledWith(true);
    expect(ui.value()).toBe(original);
    expect(ui.changed).not.toHaveBeenCalled();
  });

  it('notifies the form when regular initial rows are invalid', () => {
    const ui = editor([{ name: ' ', value: 'AM5' }, { name: 'memoryType', value: 'DDR5' }]);
    // A row without any usable label is preserved as opaque legacy data.
    expect(ui.validation).toHaveBeenLastCalledWith(false);
    const badObject = editor({ '': 'AM5', memoryType: 'DDR5' });
    expect(badObject.validation).toHaveBeenLastCalledWith(true);
  });

  it('adds canonical fields with no invented values and blocks save until filled', () => {
    const ui = editor({}, { category: 'PC Components', subCategory: 'CPU' });
    ui.button('Add missing PC fields').props.onClick();
    ui.render();
    expect(ui.validation).toHaveBeenLastCalledWith(true);
    expect(ui.changed).not.toHaveBeenCalled();
    ui.change('', 'AM5');
    expect(ui.validation).toHaveBeenLastCalledWith(false);
    expect(ui.value()).toEqual({ socket: 'AM5' });
  });

  it('explains alternative socket examples without presenting a combined value', () => {
    const ui = editor({}, { category: 'PC Components', subCategory: 'CPU' });
    const example = ui.all().find(node => node.type === 'dd');
    expect(example.props.children.join('')).toContain('AM5 (or LGA1700, depending on model)');
    expect(example.props.children.join('')).not.toContain('AM5 / LGA1700');
  });

  it('recognizes existing aliases inside grouped specifications', () => {
    const ui = editor({ cpu: { 'CPU Socket': 'AM5' }, memory: { 'Loại RAM': 'DDR5' } });
    expect(ui.button('Add missing PC fields')).toBeUndefined();
  });

  it('does not mistake a memory group without a type for a provided RAM type', () => {
    const ui = editor({ cpu: { socket: 'AM5' }, memory: { capacity: '32 GB' } });
    expect(ui.button('Add missing PC fields')).toBeDefined();
    ui.button('Add missing PC fields').props.onClick();
    ui.render();
    expect(ui.validation).toHaveBeenLastCalledWith(true);
    ui.change('', 'DDR5');
    expect(ui.value()).toEqual({ cpu: { socket: 'AM5' }, memory: { capacity: '32 GB' }, memoryType: 'DDR5' });
  });

  it('keeps generic products free of hardware field suggestions', () => {
    const ui = editor({ Material: 'Cotton' }, { category: 'Clothes', subCategory: 'Shirts' });
    expect(ui.button('Add missing PC fields')).toBeUndefined();
    expect(ui.button('Add specification')).toBeDefined();
  });
});
