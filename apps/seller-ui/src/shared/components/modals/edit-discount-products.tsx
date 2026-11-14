'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Loader2, Package, Search, X } from 'lucide-react';
import api from '../../../utils/axioInstance';
import toast from 'react-hot-toast';
import useSeller from '../../../hooks/useSeller';
import { useDiscountDialog } from './delete.discount-codes';

export default function EditDiscountProducts({ discount, onClose }: { discount: any; onClose: () => void }) {
  const client = useQueryClient();
  const { seller } = useSeller();
  const [selected, setSelected] = useState<string[] | null>(null);
  const [original, setOriginal] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['edit-discount-products', seller?.id, discount.id], enabled: Boolean(seller?.shop?.id), staleTime: 0, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => { const data = (await api.get('/product/api/get-shop-products', { signal })).data.products; if (!Array.isArray(data)) throw new Error('Invalid product response'); return data.filter((product: any) => !product.isDeleted); },
  });
  // Initialize once. A retry/refetch must not silently replace checkbox edits.
  useEffect(() => {
    if (query.data && !query.isFetching && !query.isError && selected === null) { const ids = query.data.filter((product: any) => product.discount_codes?.includes(discount.id)).map((product: any) => product.id); setSelected(ids); setOriginal(ids); }
  }, [query.data, query.isFetching, query.isError, selected, discount.id]);
  const mutation = useMutation({
    mutationFn: async (productIds: string[]) => api.patch(`/product/api/discount-code/${discount.id}/products`, { productIds }),
    onSuccess: async () => {
      await Promise.all([['shop-discounts'], ['discount-product-options'], ['edit-discount-products'], ['seller-products'], ['products']].map(queryKey => client.invalidateQueries({ queryKey })));
      toast.success('Applicable products updated.'); onClose();
    },
    onError: (failure: any) => { const message = failure.response?.data?.message || 'Unable to update products. Please try again.'; setError(message); toast.error(message); },
  });
  const dialogRef = useDiscountDialog(onClose, mutation.isPending);
  const products: any[] = query.data || [];
  const visible = products.filter(product => String(product.title || '').toLowerCase().includes(search.trim().toLowerCase()));
  const changed = selected !== null && (selected.length !== original.length || selected.some(id => !original.includes(id)));
  const submit = () => {
    if (selected === null || !changed || query.isFetching || mutation.isPending) return;
    const available = new Set(products.map(product => product.id));
    if (selected.some(id => !available.has(id))) { setError('Some selected products are no longer available. Reload the list and review your selection.'); return; }
    if (selected.length > 1000) { setError('Select up to 1000 products per discount.'); return; }
    setError(''); mutation.mutate(selected);
  };
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="edit-discount-title" aria-describedby="edit-discount-description" aria-busy={mutation.isPending} className="flex max-h-[90dvh] w-full max-w-xl flex-col rounded-2xl border border-slate-700 bg-[#0f172a] p-5 text-slate-100 shadow-2xl outline-none sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-400">Product assignment</p><h2 id="edit-discount-title" className="text-xl font-semibold">Edit applicable products</h2><p className="mt-2 inline-block break-all rounded-lg bg-blue-500/10 px-2.5 py-1 font-mono text-sm text-blue-300">{discount.discountCode}</p></div><button type="button" aria-label="Close edit products dialog" disabled={mutation.isPending} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 disabled:opacity-40"><X size={20} /></button></div>
      <p id="edit-discount-description" className="my-4 text-sm leading-relaxed text-slate-400">Only the selected products can use this code. Clear all selections to remove every assignment.</p>
      <label className="mb-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 focus-within:border-blue-500"><Search size={16} className="shrink-0 text-slate-500" /><input data-dialog-focus aria-label="Search applicable products" disabled={mutation.isPending} className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-slate-600" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by product name…" /></label>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-400"><span><span className="font-semibold text-blue-300">{selected?.length || 0}</span> products selected</span><button type="button" disabled={!selected?.length || mutation.isPending} onClick={() => { setSelected([]); setError(''); }} className="text-slate-400 hover:text-white disabled:opacity-40">Clear selection</button></div>
      <div className="min-h-24 space-y-2 overflow-y-auto pr-1">
        {query.isLoading || selected === null && !query.isError ? <div className="flex items-center gap-2 py-8 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading products…</div> : query.isError ? <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Unable to load products. <button type="button" className="ml-1 underline" onClick={() => query.refetch()}>Try again</button></div> : visible.map(product => <label key={product.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${selected?.includes(product.id) ? 'border-blue-500/40 bg-blue-500/10' : 'border-slate-800 bg-slate-950/30 hover:border-slate-700'}`}><input disabled={mutation.isPending} type="checkbox" checked={selected?.includes(product.id) || false} onChange={event => { setError(''); setSelected(current => event.target.checked ? [...new Set([...(current || []), product.id])] : (current || []).filter(id => id !== product.id)); }} className="h-4 w-4 shrink-0 accent-blue-500" /><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-800">{product.images?.[0]?.url ? <img alt="" src={product.images[0].url} className="h-full w-full object-cover" /> : <Package size={17} className="text-slate-500" />}</span><span className="min-w-0 flex-1"><span className="block break-words font-medium">{product.title}</span><span className="mt-1 block text-xs tabular-nums text-slate-500">${Number(product.sale_price || 0).toFixed(2)} · {Number(product.stock || 0)} in stock</span></span>{selected?.includes(product.id) && <Check size={16} className="shrink-0 text-blue-400" />}</label>)}
        {!query.isLoading && !query.isError && selected !== null && !visible.length && <div className="py-8 text-center"><Package size={28} className="mx-auto mb-3 text-slate-600" /><p className="text-sm text-slate-400">{products.length ? 'No products match your search.' : 'No available products in your shop yet.'}</p></div>}
      </div>
      {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-300"><AlertCircle size={16} className="shrink-0" />{error}</p>}
      <div className="mt-5 flex shrink-0 justify-end gap-3 border-t border-slate-800 pt-4"><button type="button" disabled={mutation.isPending} onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">Cancel</button><button type="button" disabled={query.isFetching || query.isError || !query.data || selected === null || !changed || mutation.isPending} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending && <Loader2 size={16} className="animate-spin" />}{mutation.isPending ? 'Saving…' : 'Save changes'}</button></div>
    </section>
  </div>;
}
