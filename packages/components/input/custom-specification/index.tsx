import React, { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useWatch } from "react-hook-form";
import Input from "..";
import { Info, PlusCircle, Trash2 } from "lucide-react";
import { pcSpecificationFieldName } from '@packages/utils/pc-build';

type SpecificationField = { name: Exclude<ReturnType<typeof pcSpecificationFieldName>, undefined>; example: string };
type SpecificationContext = { category?: string; subCategory?: string };

function specificationNames(raw: unknown, depth = 0): string[] {
  if (depth > 3 || !raw || typeof raw !== 'object') return [];
  if (Array.isArray(raw)) return raw.slice(0, 200).flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    const label = [row.name, row.key, row.label].find(value => typeof value === 'string' && value.trim());
    return label ? [label] : [];
  });
  return Object.entries(raw).slice(0, 200).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value) && !('value' in value)
      ? specificationNames(value, depth + 1) : [key]);
}

function pcSpecificationFields({ category, subCategory }: SpecificationContext): SpecificationField[] {
  const text = `${category || ''} ${subCategory || ''}`.toLowerCase();
  const names = new Set<SpecificationField['name']>();
  if (/cpu|processor|bộ xử lý|motherboard|mainboard|bo mạch/.test(text)) names.add('socket');
  if (/\bram\b|memory|bộ nhớ|motherboard|mainboard|bo mạch/.test(text)) names.add('memoryType');
  if (/\bpsu\b|power supply|nguồn/.test(text)) names.add('wattage');
  if (/\bgpu\b|\bvga\b|graphics|card đồ họa/.test(text)) names.add('recommendedPsuWatts');
  const examples: Record<string, string> = { socket: 'e.g. AM5 (or LGA1700, depending on model)', memoryType: 'DDR5', wattage: '750 W', recommendedPsuWatts: '650 W' };
  return [...names].map(name => ({ name, example: examples[name] }));
}

function PcSpecificationGuidance({ category, subCategory, names, onAdd }: SpecificationContext & { names: string[]; onAdd: (fields: SpecificationField[]) => void }) {
  const fields = pcSpecificationFields({ category, subCategory });
  if (!fields.length) return null;
  const existingFields = new Set(names.map(pcSpecificationFieldName));
  const missing = fields.filter(field => !existingFields.has(field.name));
  return <div className="mb-3 rounded-lg border border-blue-800/60 bg-blue-950/30 p-3 text-sm text-slate-300">
    <p className="flex items-center gap-2 font-medium text-blue-300"><Info size={16} />PC compatibility specifications</p>
    <p className="mt-1 leading-6">Enter these values from the manufacturer&apos;s specifications so the PC builder can check this component. Examples are suggestions only.</p>
    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">{fields.map(field => <div key={field.name}><dt className="inline font-semibold text-slate-200">{field.name}</dt><dd className="inline text-slate-400">: {field.example}</dd></div>)}</dl>
    {missing.length > 0 && <button type="button" onClick={() => onAdd(missing)} className="mt-3 rounded border border-blue-700 px-3 py-1.5 font-medium text-blue-300 hover:bg-blue-900/40">Add missing PC fields</button>}
  </div>;
}

const CustomSpecifications = ({ control, error, category, subCategory }: any) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "custom_specifications",
  });
  const values = useWatch({ control, name: 'custom_specifications', defaultValue: [] });
  return (
    <div>
      <label className="block font-semibold text-gray-300 mb-1">
        Custom Specifications
      </label>
      <PcSpecificationGuidance category={category} subCategory={subCategory} names={specificationNames(values)} onAdd={missing => append(missing.map(field => ({ name: field.name, value: '' })))} />
      <div className="flex flex-col gap-3 ">
        {fields?.map((item, index) => (
          <div key={item.id} className="flex gap-2 items-center">
            <Controller
              name={`custom_specifications.${index}.name`}
              control={control}
              rules={{ required: "Specification name is required" }}
              render={({ field }) => (
                <Input
                  label="Specification name"
                  placeholder="e.g, Battery life, Weight, Material"
                  {...field}
                />
              )}
            />
            <Controller
              name={`custom_specifications.${index}.value`}
              control={control}
              rules={{ required: "Specification value is required" }}
              render={({ field }) => (
                <Input
                  label="Value"
                  placeholder="e.g, 10 hours, 200g, Aluminum"
                  {...field}
                />
              )}
            />

            <button
              type="button"
              className="text-red-500 hover:text-red-700"
              onClick={() => remove(index)}
            >
              <Trash2 size={20} />
            </button>
          </div>
        ))}

        <button
          type="button"
          className="flex items-center gap-2 text-blue-500 hover:text-blue-600"
          onClick={() => append({ name: "", value: "" })}
        >
          <PlusCircle size={20} /> Add Specification
        </button>
      </div>
      {error && (
        <p className="text-red-500 text-sm mt-1">
          {error.custom_specifications?.message as string}
        </p>
      )}
    </div>
  );
};

export default CustomSpecifications;

type SpecificationRow = {
  label: string;
  labelKey: string;
  rawEntry: any;
  originalValue: unknown;
  text: string;
  json: boolean;
  edited: boolean;
  added: boolean;
  opaque: boolean;
};

function specificationRows(raw: unknown): SpecificationRow[] {
  const rows: [string, unknown, any, string, boolean][] = Array.isArray(raw)
    ? raw.map(entry => {
      const labelKey = entry && typeof entry === 'object' ? ['name', 'key', 'label'].find(key => typeof entry[key] === 'string' && entry[key].trim()) : undefined;
      return [labelKey ? entry[labelKey] : '', labelKey ? entry.value : entry, entry, labelKey || 'name', !labelKey];
    })
    : raw && typeof raw === 'object' ? Object.entries(raw).map(([label, value]) => [label, value, null, 'name', false]) : raw == null ? [] : [['', raw, raw, 'name', true]];
  return rows.map(([label, value, rawEntry, labelKey, opaque]) => ({ label, labelKey, rawEntry, originalValue: value, text: value != null && typeof value === 'object' ? JSON.stringify(value, null, 2) : value == null ? '' : String(value), json: value != null && typeof value === 'object', edited: false, added: false, opaque }));
}

function serializeRows(rows: SpecificationRow[], objectShape: boolean): { value?: unknown; error?: string } {
  const entries: [string, unknown][] = [];
  const array: unknown[] = [];
  for (const row of rows) {
    if (row.opaque) { array.push(row.rawEntry); continue; }
    if (!row.label.trim()) return { error: 'Enter a name for each specification.' };
    if ((row.added || row.edited) && !row.text.trim()) return { error: `Enter a value for ${row.label}.` };
    let value = row.originalValue;
    if (row.edited) {
      try { value = row.json ? JSON.parse(row.text) : row.text; }
      catch { return { error: `Enter valid JSON for ${row.label}.` }; }
    }
    if (objectShape && entries.some(([label]) => label === row.label)) return { error: 'Specification names must be unique.' };
    entries.push([row.label, value]);
    array.push({ ...(row.rawEntry && typeof row.rawEntry === 'object' ? row.rawEntry : {}), [row.labelKey]: row.label, value });
  }
  return { value: objectShape ? Object.fromEntries(entries) : array };
}

/** Keep the original object/array shape and metadata; only changed values are rewritten. */
export function EditableCustomSpecifications({ value, onChange, onValidationChange, category, subCategory }: SpecificationContext & { value: unknown; onChange: (value: unknown) => void; onValidationChange: (invalid: boolean) => void }) {
  const [rows, setRows] = useState(() => specificationRows(value));
  const [objectShape, setObjectShape] = useState(() => !!value && typeof value === 'object' && !Array.isArray(value));
  const latestValue = useRef(value);
  useEffect(() => {
    if (value === latestValue.current) return;
    latestValue.current = value;
    setRows(specificationRows(value));
    setObjectShape(!!value && typeof value === 'object' && !Array.isArray(value));
    onValidationChange(false);
  }, [value, onValidationChange]);
  useEffect(() => { onValidationChange(!!serializeRows(rows, objectShape).error); }, [rows, objectShape, onValidationChange]);
  const update = (next: SpecificationRow[]) => {
    setRows(next);
    const result = serializeRows(next, objectShape);
    onValidationChange(!!result.error);
    if (!result.error) { latestValue.current = result.value; onChange(result.value); }
  };
  const add = (names: string[]) => update([...rows, ...names.map(label => ({ label, labelKey: 'name', rawEntry: null, originalValue: '', text: '', json: false, edited: false, added: true, opaque: false }))]);
  const error = serializeRows(rows, objectShape).error;
  return <section className="sm:col-span-2 rounded-lg border border-slate-700 p-4">
    <h2 className="mb-3 font-semibold">Product specifications</h2>
    <PcSpecificationGuidance category={category} subCategory={subCategory} names={specificationNames(serializeRows(rows, objectShape).value ?? rows.filter(row => !row.opaque).map(row => ({ name: row.label, value: row.originalValue })))} onAdd={missing => add(missing.map(field => field.name))} />
    <div className="space-y-3">{rows.map((row, index) => <div key={index} className="flex items-start gap-2">
      {row.opaque ? <div className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 p-3 text-xs"><p className="mb-1 text-slate-400">Existing structured entry (preserved)</p><pre className="whitespace-pre-wrap break-words">{JSON.stringify(row.rawEntry, null, 2)}</pre></div> : <>
        <label className="min-w-0 flex-1 text-sm text-slate-300">Specification name<input className="mt-1 block w-full rounded border border-slate-600 bg-slate-900 p-2 text-white" value={row.label} onChange={event => update(rows.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /></label>
        <label className="min-w-0 flex-1 text-sm text-slate-300">{row.json ? 'Value (JSON)' : 'Value'}{row.json ? <textarea className="mt-1 block min-h-24 w-full rounded border border-slate-600 bg-slate-900 p-2 font-mono text-xs text-white" value={row.text} onChange={event => update(rows.map((item, i) => i === index ? { ...item, text: event.target.value, edited: true } : item))} /> : <input className="mt-1 block w-full rounded border border-slate-600 bg-slate-900 p-2 text-white" value={row.text} onChange={event => update(rows.map((item, i) => i === index ? { ...item, text: event.target.value, edited: true } : item))} />}</label>
      </>}
      <button type="button" className="mt-7 rounded p-2 text-red-400 hover:bg-slate-800" aria-label={`Remove specification ${row.label || index + 1}`} onClick={() => update(rows.filter((_, i) => i !== index))}><Trash2 size={18} /></button>
    </div>)}</div>
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    <button type="button" className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-400" onClick={() => add([''])}><PlusCircle size={18} />Add specification</button>
  </section>;
}
