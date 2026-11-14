'use client';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Layers3, Loader2, Pencil, Plus, Save } from 'lucide-react';
import axios from '../../utils/axioInstance';
import useSeller from '../../hooks/useSeller';

const empty = { id: '', sku: '', color: '', size: '', price: '', stock: '', active: true };
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
export default function VariantEditor({ productId, onProductUpdated, disabled = false, onBusyChange }: { productId: string; onProductUpdated?: (product: any) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { seller } = useSeller();
  const client = useQueryClient();
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const saveLock = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const query = useQuery({ queryKey: ['variant-product', seller?.id, productId], enabled: !!seller?.id, queryFn: async () => (await axios.get(`/product/api/seller-product/${productId}`)).data.product });
  const variants: any[] = query.data?.variants || [];
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saveLock.current || disabled) return;
    const price = Number(form.price), stock = Number(form.stock);
    if (!form.sku.trim() || !Number.isFinite(price) || price <= 0 || price > 10_000_000 || !Number.isSafeInteger(stock) || stock < 0) { setFailure('Enter a SKU, a positive price and a whole stock quantity.'); return; }
    saveLock.current = true; setBusy(true); onBusyChange?.(true); setMessage(''); setFailure('');
    let persisted = false;
    try {
      const { data } = await axios.put(`/product/api/variants/${productId}`, { ...form, sku: form.sku.trim(), color: form.color.trim(), size: form.size.trim(), id: form.id || undefined, price, stock });
      persisted = true;
      const updatedVariants = [...variants.filter(variant => variant.id !== data.variant.id), data.variant];
      const available = updatedVariants.filter(variant => variant.active);
      const minimum = available.length ? Math.min(...available.map(variant => variant.price)) : query.data.sale_price;
      const updatedProduct = { ...query.data, variants: updatedVariants, stock: available.reduce((sum, variant) => sum + variant.stock, 0), sale_price: minimum, regular_price: Math.max(query.data.regular_price, minimum), colors: [...new Set(available.map(variant => variant.color).filter(Boolean))], sizes: [...new Set(available.map(variant => variant.size).filter(Boolean))] };
      client.setQueryData(['variant-product', seller?.id, productId], updatedProduct);
      client.setQueryData(['seller-product', seller?.id, productId], updatedProduct);
      onProductUpdated?.(updatedProduct);
      setForm(empty);
      await Promise.all(['products', 'inventory', 'seller-stats'].map(key => client.invalidateQueries({ queryKey: [key] })));
      // Refresh only catalog data. Invalidating every query can replace an unsaved product form.
      const product = (await axios.get(`/product/api/seller-product/${productId}`)).data.product;
      client.setQueryData(['variant-product', seller?.id, productId], product);
      client.setQueryData(['seller-product', seller?.id, productId], product);
      onProductUpdated?.(product);
      setMessage('SKU saved. Product price, options and stock reflect active SKUs.');
    } catch (error: any) { setFailure(persisted ? 'SKU was saved, but the latest inventory could not be refreshed. Reload this page before making another inventory change.' : error.response?.data?.message || 'Could not save SKU. Your entered details have been kept.'); }
    finally { saveLock.current = false; setBusy(false); onBusyChange?.(false); }
  }
  const inputClass = 'mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950/50 p-2.5 text-sm text-slate-100 outline-none focus:border-blue-500 disabled:opacity-50';
  return <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 text-slate-100">
    <div className="border-b border-slate-800 p-5 sm:p-6"><h2 className="flex items-center gap-2 font-semibold"><Layers3 size={19} className="text-blue-400"/>SKU inventory</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-slate-400">Manage each color or size separately. Product stock is the sum of active SKUs; the lowest active SKU price becomes the product price.</p></div>
    {query.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-rose-300"><span>Unable to load SKU inventory.</span><button type="button" onClick={() => query.refetch()} className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300">Try again</button></div> : query.isLoading ? <p role="status" className="p-5 text-sm text-slate-400">Loading SKU inventory…</p> : variants.length ? <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="bg-slate-950/30 text-xs text-slate-500"><tr>{['SKU / Options', 'Price', 'Stock', 'Availability', ''].map((title, index) => <th key={index} className="px-5 py-3 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{variants.map(variant => <tr key={variant.id} className={form.id === variant.id ? 'bg-blue-500/5' : ''}><td className="px-5 py-4"><p className="font-medium">{variant.sku}</p><p className="mt-1 text-xs text-slate-500">{[variant.color, variant.size].filter(Boolean).join(' / ') || 'Default option'}</p></td><td className="px-5 py-4 tabular-nums">{money(variant.price)}</td><td className={`px-5 py-4 tabular-nums ${variant.stock < 5 ? 'text-amber-400' : 'text-slate-300'}`}>{variant.stock}</td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs ${variant.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>{variant.active ? 'Active' : 'Inactive'}</span></td><td className="px-5 py-4"><button type="button" disabled={busy || disabled} aria-label={`Edit SKU ${variant.sku}`} onClick={() => { setForm({ id: variant.id, sku: variant.sku, color: variant.color || '', size: variant.size || '', price: String(variant.price), stock: String(variant.stock), active: variant.active }); setMessage(''); setFailure(''); formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-blue-300"><Pencil size={16}/></button></td></tr>)}</tbody></table></div> : <div className="border-b border-slate-800 p-5 text-sm text-slate-400">No SKUs yet. Adding your first SKU replaces the product-level stock with SKU stock.</div>}
    <form ref={formRef} onSubmit={save} className="space-y-5 p-5 sm:p-6"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{form.id ? `Edit ${form.sku}` : 'Add a SKU'}</h3>{form.id && <button type="button" disabled={busy || disabled} onClick={() => { setForm(empty); setMessage(''); setFailure(''); }} className="inline-flex items-center gap-1 text-xs font-medium text-blue-400"><Plus size={14}/>New SKU</button>}</div><fieldset disabled={busy || disabled || query.isLoading || query.isError} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(['sku', 'color', 'size', 'price', 'stock'] as const).map(key => <label key={key} className="block text-xs font-medium text-slate-400">{{ sku: 'SKU code *', color: 'Color (optional)', size: 'Size (optional)', price: 'Price (USD) *', stock: 'Stock *' }[key]}<input className={inputClass} value={form[key]} required={!['color', 'size'].includes(key)} maxLength={key === 'sku' ? 80 : 100} type={['price', 'stock'].includes(key) ? 'number' : 'text'} min={key === 'price' ? '0.01' : '0'} max={key === 'price' ? '10000000' : undefined} step={key === 'price' ? '0.01' : '1'} placeholder={{ sku: 'e.g. CPU-7700-BOX', color: 'e.g. Black', size: 'e.g. Standard', price: '0.00', stock: '0' }[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>)}<label className="flex items-center gap-2 self-end rounded-xl border border-slate-800 p-3 text-sm text-slate-300"><input type="checkbox" checked={form.active} className="accent-blue-500" onChange={e => setForm({ ...form, active: e.target.checked })}/>Available for sale</label></fieldset>
      {failure && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-300"><AlertCircle size={17} className="mt-0.5 shrink-0"/>{failure}</p>}{message && <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-300"><CheckCircle2 size={17} className="mt-0.5 shrink-0"/>{message}</p>}
      <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50" disabled={busy || disabled || query.isLoading || query.isError}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} {busy ? 'Saving SKU…' : form.id ? 'Update SKU' : 'Add SKU'}</button>
    </form>
  </section>;
}
