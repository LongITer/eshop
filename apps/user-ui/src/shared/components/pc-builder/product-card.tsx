'use client';

import React, { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, Check, ChevronRight, CircuitBoard, Cpu, Fan, HardDrive, MemoryStick, Monitor, PackageCheck, ShieldCheck, Zap } from 'lucide-react';
import { useStorefrontText } from '@packages/components/storefront-language';
import type { PcSlot } from '@packages/utils/pc-build';
import type { PcSelection } from '@packages/utils/pc-build-selection';
import { formatUSD } from '@packages/utils/money';

export const pcSlotIcons = { cpu: Cpu, motherboard: CircuitBoard, ram: MemoryStick, gpu: Monitor, storage: HardDrive, psu: Zap, case: PackageCheck, cooler: Fan };

function specificationValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (Array.isArray(value)) return value.map(specificationValue).filter(Boolean).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => {
    const text = specificationValue(item);
    return text ? `${key}: ${text}` : '';
  }).filter(Boolean).join(' · ');
  return '';
}

/** Preserve the seller's labels and values, including the legacy name/value array format. */
export function pcProductSpecifications(raw: unknown): { key: string; label: string; value: string }[] {
  const entries: [unknown, unknown][] = Array.isArray(raw)
    ? raw.map(item => [item?.name ?? item?.key ?? item?.label, item?.value])
    : raw && typeof raw === 'object' ? Object.entries(raw) : [];
  const seen = new Set<string>();
  return entries.flatMap(([label, value]) => {
    if (typeof label !== 'string' || !label.trim()) return [];
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, '');
    const text = specificationValue(value);
    if (!text || seen.has(key)) return [];
    seen.add(key);
    return [{ key, label: label.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').trim(), value: text }];
  });
}

const preferredSpecifications: Record<PcSlot, string[]> = {
  cpu: ['socket', 'cores', 'corecount', 'threads', 'boostclock', 'tdp'],
  motherboard: ['socket', 'memorytype', 'chipset', 'formfactor'],
  ram: ['memorytype', 'capacity', 'speed', 'frequency', 'latency'],
  gpu: ['chipset', 'vram', 'memory', 'memorysize', 'recommendedpsuwatts'],
  storage: ['capacity', 'interface', 'formfactor', 'readspeed'],
  psu: ['wattage', 'efficiency', 'certification', 'modular'],
  case: ['formfactor', 'motherboardsupport', 'gpuclearance', 'material'],
  cooler: ['socket', 'type', 'tdp', 'radiatorsize'],
};

export function pcProductImage(product: any): string | undefined {
  const images = Array.isArray(product?.images) ? product.images : [];
  for (const image of images) {
    if (typeof image === 'string' && image) return image;
    if (typeof image?.url === 'string' && image.url) return image.url;
  }
  return undefined;
}

export function PcProductImage({ product, slot, className = '' }: { product: any; slot: PcSlot; className?: string }) {
  const [failed, setFailed] = useState(false);
  const image = pcProductImage(product);
  const Icon = pcSlotIcons[slot];
  useEffect(() => setFailed(false), [image]);
  return image && !failed ? <img src={image} alt={product.title || ''} loading="lazy" className={`object-contain ${className}`} onError={() => setFailed(true)} />
    : <span className={`flex items-center justify-center text-slate-300 ${className}`} aria-hidden="true"><Icon size={58} strokeWidth={1.2} /></span>;
}

type ProductCardProps = {
  product: any;
  slot: PcSlot;
  selected?: PcSelection;
  compared: boolean;
  comparisonFull: boolean;
  onChoose: (product: any, variantId?: string, selectedOptions?: { color: string; size: string }) => void;
  onCompare: (product: any) => void;
};

export default function PcProductCard({ product, slot, selected, compared, comparisonFull, onChoose, onCompare }: ProductCardProps) {
  const { t } = useStorefrontText();
  const fieldId = useId();
  const isSelectedProduct = selected?.id === product.id;
  const [variantId, setVariantId] = useState(isSelectedProduct ? selected?.variantId || '' : '');
  const [color, setColor] = useState(isSelectedProduct ? selected?.selectedOptions.color || '' : '');
  const [size, setSize] = useState(isSelectedProduct ? selected?.selectedOptions.size || '' : '');
  useEffect(() => {
    const current = selected?.id === product.id;
    setVariantId(current ? selected?.variantId || '' : '');
    setColor(current ? selected?.selectedOptions.color || '' : '');
    setSize(current ? selected?.selectedOptions.size || '' : '');
  }, [selected?.id, selected?.variantId, selected?.selectedOptions.color, selected?.selectedOptions.size, product.id]);

  const variants = Array.isArray(product.variants) ? product.variants.filter((variant: any) => variant.active !== false) : [];
  const colors: string[] = Array.isArray(product.colors) ? product.colors.filter((value: unknown) => typeof value === 'string' && value) : [];
  const sizes: string[] = Array.isArray(product.sizes) ? product.sizes.filter((value: unknown) => typeof value === 'string' && value) : [];
  const variant = variants.find((item: any) => item.id === variantId);
  const stock = Math.max(0, Math.min(Number(product.stock) || 0, variant ? Number(variant.stock) || 0 : Number(product.stock) || 0));
  const hasAvailableVariant = !variants.length || variants.some((item: any) => item.stock > 0);
  const available = stock > 0 && hasAvailableVariant;
  const ready = available && (variants.length ? !!variant : (!colors.length || colors.includes(color)) && (!sizes.length || sizes.includes(size)));
  const exactSelection = isSelectedProduct && (variants.length
    ? selected?.variantId === variantId
    : selected?.selectedOptions.color === color && selected?.selectedOptions.size === size);
  const priceVariants = variants.filter((item: any) => item.stock > 0);
  const shownPrice = variant?.price ?? (variants.length ? Math.min(...(priceVariants.length ? priceVariants : variants).map((item: any) => Number(item.price))) : product.sale_price);
  const specifications = pcProductSpecifications(product.custom_specification);
  const preferred = preferredSpecifications[slot];
  const chips = [...specifications.filter(item => preferred.includes(item.key)), ...specifications.filter(item => !preferred.includes(item.key))].slice(0, 3);
  const controlClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400';

  return <article className={`group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60 ${isSelectedProduct ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'}`}>
    <div className="relative mx-3 mt-3 overflow-hidden rounded-xl bg-slate-50/80">
      <Link href={`/product/${product.slug}`} className="block px-7 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500" aria-label={`${t('View product')} ${product.title}`}>
        <PcProductImage product={product} slot={slot} className="h-40 w-full transition duration-300 group-hover:scale-105" />
      </Link>
      {isSelectedProduct && <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm"><Check size={12} />{t('In your build')}</span>}
    </div>
    <div className="flex flex-1 flex-col p-4">
      <p className="mb-1.5 truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">{product.brand || product.subCategory || slot.toUpperCase()}</p>
      <Link href={`/product/${product.slug}`} className="mb-3 line-clamp-2 min-h-12 text-[15px] font-semibold leading-6 text-slate-900 transition hover:text-blue-600 focus-visible:outline-none focus-visible:underline">{product.title}</Link>
      {product.recommendation?.status === 'matched' && <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700"><Check size={13} />{t('Matches checked specifications')}</p>}
      {product.recommendation?.status === 'unknown' && <p className="mb-3 text-xs text-amber-700">{t('Missing specifications — compatibility needs review')}</p>}
      {chips.length > 0 && <dl className="mb-4 flex flex-wrap gap-1.5">{chips.map(item => <div key={item.key} className="max-w-full rounded-md bg-slate-100 px-2 py-1 text-[11px] leading-4 text-slate-600" title={`${t(item.label)}: ${item.value}`}><dt className="sr-only">{t(item.label)}</dt><dd className="max-w-[210px] truncate">{item.value}</dd></div>)}</dl>}
      <div className="mb-4 mt-auto space-y-1.5">
        <p className={`flex items-center gap-1.5 text-xs ${available ? 'text-emerald-700' : 'text-slate-500'}`}><span className={`h-1.5 w-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-slate-400'}`} />{available ? `${stock} ${t('in stock')}` : t('Out of stock')}</p>
        {product.warranty && <p className="flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={13} className="shrink-0" /><span>{t('Warranty')}: {product.warranty}</span></p>}
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-x-2 gap-y-0.5">
        {variants.length > 0 && !variant && <span className="pb-0.5 text-xs text-slate-500">{t('From')}</span>}
        <strong className="text-[23px] font-bold tracking-tight text-blue-600">{formatUSD(shownPrice)}</strong><span className="pb-0.5 text-[11px] font-medium text-slate-400">USD</span>
      </div>
      {variants.length > 0 ? <div className="mb-3"><label htmlFor={`${fieldId}-sku`} className="mb-1.5 block text-xs font-medium text-slate-600">{t('Select SKU')}</label><select id={`${fieldId}-sku`} className={controlClass} value={variantId} onChange={event => setVariantId(event.target.value)}><option value="">{t('Choose a configuration')}</option>{variants.map((item: any) => <option key={item.id} value={item.id} disabled={item.stock < 1}>{[item.sku, item.color, item.size].filter(Boolean).join(' / ')} · {formatUSD(item.price)}{item.stock < 1 ? ` · ${t('Out of stock')}` : ''}</option>)}</select></div>
        : (colors.length > 0 || sizes.length > 0) && <div className="mb-3 grid grid-cols-2 gap-2">{[{ name: 'color', label: 'Color', values: colors, value: color, setValue: setColor }, { name: 'size', label: 'Size', values: sizes, value: size, setValue: setSize }].filter(option => option.values.length > 0).map(option => <div key={option.name} className={colors.length && sizes.length ? '' : 'col-span-2'}><label htmlFor={`${fieldId}-${option.name}`} className="mb-1.5 block text-xs font-medium text-slate-600">{t(option.label)}</label><select id={`${fieldId}-${option.name}`} className={controlClass} value={option.value} onChange={event => option.setValue(event.target.value)}><option value="">{t('Please select')}</option>{option.values.map(value => <option key={value} value={value}>{value}</option>)}</select></div>)}</div>}
      <button type="button" onClick={() => onChoose(product, variant?.id, variant ? { color: variant.color || '', size: variant.size || '' } : { color, size })} disabled={!ready || exactSelection} className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-default ${exactSelection ? 'bg-blue-50 text-blue-600' : 'bg-blue-600 text-white shadow-sm shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none'}`}>{exactSelection ? <><Check size={16} />{t('Selected')}</> : <>{t(selected ? 'Replace component' : 'Choose component')}<ChevronRight size={16} /></>}</button>
      <label className={`mt-3 flex min-h-8 cursor-pointer items-center justify-center gap-2 text-xs transition ${comparisonFull && !compared ? 'cursor-not-allowed text-slate-400' : compared ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}><input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500" checked={compared} disabled={comparisonFull && !compared} onChange={() => onCompare(product)} /><ArrowLeftRight size={13} aria-hidden="true" />{t('Compare specifications')}<span className="sr-only"> {product.title}</span></label>
    </div>
  </article>;
}
