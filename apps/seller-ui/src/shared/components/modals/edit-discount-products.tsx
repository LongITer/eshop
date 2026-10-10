'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Search } from 'lucide-react';
import api from '../../../utils/axioInstance';
import toast from 'react-hot-toast';

export default function EditDiscountProducts({ discount, onClose }: { discount: any; onClose: () => void }) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['edit-discount-products', discount.id], staleTime: 0, refetchOnWindowFocus: false, queryFn: async () => (await api.get('/product/api/get-shop-products')).data.products as any[] });
  useEffect(() => { if (query.data) setSelected(query.data.filter(p => !p.isDeleted && p.discount_codes?.includes(discount.id)).map(p => p.id)); }, [query.data, discount.id]);
  const mutation = useMutation({ mutationFn: async () => api.patch(`/product/api/discount-code/${discount.id}/products`, { productIds: selected }), onSuccess: () => {
    client.invalidateQueries({ queryKey: ['shop-discounts'] });
    client.invalidateQueries({ queryKey: ['discount-product-options'] });
    client.invalidateQueries({ queryKey: ['edit-discount-products', discount.id] });
    client.invalidateQueries({ queryKey: ['seller-products'] });
    toast.success('Applicable products updated'); onClose();
  }, onError: (error: any) => toast.error(error.response?.data?.message || 'Unable to update products') });
  const products = (query.data || []).filter(p => !p.isDeleted);
  const visible = products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onKeyDown={e => { if (e.key === 'Escape' && !mutation.isPending) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="edit-discount-title" className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-slate-900 p-6 text-slate-100 shadow-xl ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-3"><div><h2 id="edit-discount-title" className="text-lg font-semibold">Edit applicable products</h2><p className="mt-1 text-sm text-blue-400">{discount.discountCode}</p></div><button aria-label="Close" disabled={mutation.isPending} onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"><X size={20} /></button></div>
      <p className="my-4 text-sm text-slate-400">Select the products that can use this code. Deselecting all products removes all assignments.</p>
      <label className="mb-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3"><Search size={16} className="text-slate-400" /><input autoFocus aria-label="Search products" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" /></label>
      <p className="mb-3 text-xs text-slate-400">{selected.length} products selected</p>
      <div className="min-h-24 space-y-2 overflow-y-auto">
        {query.isFetching ? <p className="text-sm text-slate-400">Loading products…</p> : query.isError ? <p role="alert">Unable to load products. <button className="text-blue-400 underline" onClick={() => query.refetch()}>Retry</button></p> : visible.map(product => <label key={product.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-800/60 p-3 text-sm hover:bg-slate-800"><input disabled={mutation.isPending} type="checkbox" checked={selected.includes(product.id)} onChange={e => setSelected(current => e.target.checked ? [...current, product.id] : current.filter(id => id !== product.id))} className="accent-blue-500" /><span className="min-w-0 break-words">{product.title}</span></label>)}
        {!query.isFetching && !query.isError && !visible.length && <p className="text-sm text-slate-400">No matching products.</p>}
      </div>
      <div className="mt-5 flex justify-end gap-3 border-t border-slate-800 pt-4"><button disabled={mutation.isPending} onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button><button disabled={query.isFetching || query.isError || !query.data || mutation.isPending} onClick={() => mutation.mutate()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium disabled:opacity-50">{mutation.isPending ? 'Saving…' : 'Save changes'}</button></div>
    </section>
  </div>;
}
