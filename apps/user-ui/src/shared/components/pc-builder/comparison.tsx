'use client';

import Link from 'next/link';
import React from 'react';
import { ArrowLeftRight, Info, X } from 'lucide-react';
import { useStorefrontText } from '@packages/components/storefront-language';
import type { PcSlot } from '@packages/utils/pc-build';
import { formatUSD } from '@packages/utils/money';
import { PcProductImage, pcProductSpecifications } from './product-card';

export default function PcComparison({ products, slot, onRemove, onClose }: { products: any[]; slot: PcSlot; onRemove: (id: string) => void; onClose: () => void }) {
  const { t } = useStorefrontText();
  const specifications = products.map(product => pcProductSpecifications(product.custom_specification));
  const fields = new Map<string, string>();
  specifications.forEach(items => items.forEach(item => { if (!fields.has(item.key)) fields.set(item.key, item.label); }));
  const missing = <span className="text-xs font-normal text-slate-400">{t('Not provided')}</span>;
  const rows = [
    { key: 'base-price', label: 'Base price (USD)', values: products.map(product => <span key={product.id} className="text-lg font-bold text-blue-600">{formatUSD(product.sale_price)}</span>) },
    { key: 'stock', label: 'Stock', values: products.map(product => <span key={product.id} className={product.stock > 0 ? 'text-emerald-700' : 'text-slate-500'}>{product.stock > 0 ? `${product.stock} ${t('in stock')}` : t('Out of stock')}</span>) },
    { key: 'warranty', label: 'Warranty', values: products.map(product => product.warranty || missing) },
    ...[...fields].map(([key, label]) => ({ key: `spec-${key}`, label, values: specifications.map(items => items.find(item => item.key === key)?.value || missing) })),
  ];

  return <section aria-label={t('Component comparison')} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ArrowLeftRight size={20} /></span><div><h2 className="text-lg font-bold text-slate-900">{t('Compare components')} <span className="ml-1 text-sm font-normal text-slate-400">{products.length}/3</span></h2><p className="mt-0.5 text-xs text-slate-500">{t('Compare real specifications before choosing.')}</p></div></div>
      <button type="button" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500" aria-label={t('Close comparison')} onClick={onClose}><X size={18} /></button>
    </div>
    <div className="overflow-x-auto" role="region" aria-label={t('Component comparison table')} tabIndex={0}>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{t('Component comparison')} · {slot.toUpperCase()}</caption>
        <thead><tr className="border-y border-slate-100"><th scope="col" className="sticky left-0 z-10 min-w-32 bg-slate-50 px-4 py-5 align-bottom text-xs font-semibold uppercase tracking-wider text-slate-500 sm:px-6">{t('Specifications')}</th>{products.map(product => <th scope="col" key={product.id} className="relative min-w-56 max-w-72 bg-white px-5 py-5 align-top font-normal"><button type="button" onClick={() => onRemove(product.id)} aria-label={`${t('Remove from comparison')} ${product.title}`} className="absolute right-3 top-3 rounded-full bg-slate-100 p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-2 focus-visible:outline-blue-500"><X size={13} /></button><PcProductImage product={product} slot={slot} className="mx-auto mb-4 h-24 w-36" /><Link href={`/product/${product.slug}`} className="line-clamp-2 text-sm font-semibold leading-6 text-slate-900 transition hover:text-blue-600 hover:underline">{product.title}</Link></th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.key} className="border-b border-slate-100 last:border-0"><th scope="row" className={`sticky left-0 z-10 min-w-32 px-4 py-4 text-xs font-medium text-slate-500 sm:px-6 ${index % 2 ? 'bg-slate-50' : 'bg-white'}`}>{t(row.label)}</th>{row.values.map((value, productIndex) => <td key={products[productIndex].id} className={`max-w-72 break-words px-5 py-4 text-sm leading-6 text-slate-700 ${index % 2 ? 'bg-slate-50/70' : 'bg-white'}`}>{value}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <p className="flex items-start gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-xs leading-5 text-slate-500 sm:px-6"><Info size={15} className="mt-0.5 shrink-0 text-slate-400" />{t('Specifications and warranty are provided by the seller. SKU prices may differ from the base price.')}</p>
  </section>;
}
