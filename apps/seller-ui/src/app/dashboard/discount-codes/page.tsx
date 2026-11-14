'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Check, ChevronRight, Loader2, Package, Pencil, Plus, Search, Tag, TicketPercent, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import toast from 'react-hot-toast';
import useSeller from 'apps/seller-ui/src/hooks/useSeller';
import api from 'apps/seller-ui/src/utils/axioInstance';
import EditDiscountProducts from '../../../shared/components/modals/edit-discount-products';
import DeleteDiscountCodeModal, { useDiscountDialog } from 'apps/seller-ui/src/shared/components/modals/delete.discount-codes';

const fieldClass = 'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3.5 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-50';
type DiscountDraft = { public_name: string; discountType: string; discountValue: string; discountCode: string; productIds: string[] };
const money = (value: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);

export default function DiscountsPage() {
  const { seller, isLoading, isError, refetch } = useSeller();
  if (isLoading) return <div aria-label="Loading discounts" aria-busy="true" className="space-y-5 p-4 sm:p-8"><div className="h-16 w-72 rounded-xl bg-slate-800" /><div className="h-72 rounded-2xl bg-slate-900" /></div>;
  if (isError && !seller) return <div role="alert" className="m-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-slate-200 sm:m-8"><h1 className="font-semibold">Unable to load your seller account</h1><button onClick={() => refetch()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white">Try again</button></div>;
  if (!seller) return <p className="p-8 text-slate-400">Please <Link href="/login" className="text-blue-400 underline">sign in</Link> to manage discounts.</p>;
  if (!seller.shop) return <p className="p-8 text-slate-400">Complete your shop setup before creating promotions.</p>;
  return <DiscountManager key={`${seller.id}:${seller.shop.id}`} sellerId={seller.id} />;
}

function DiscountManager({ sellerId }: { sellerId: string }) {
  const client = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');
  const codesQuery = useQuery({
    queryKey: ['shop-discounts', sellerId],
    queryFn: async ({ signal }) => { const data = (await api.get('/product/api/get-discount-code', { signal })).data.discount_codes; if (!Array.isArray(data)) throw new Error('Invalid discount response'); return data; },
  });
  const productsQuery = useQuery({
    queryKey: ['discount-product-options', sellerId],
    queryFn: async ({ signal }) => { const data = (await api.get('/product/api/get-shop-products', { signal })).data.products; if (!Array.isArray(data)) throw new Error('Invalid product response'); return data.filter((product: any) => !product.isDeleted); },
  });
  const deletion = useMutation({
    mutationFn: async (id: string) => api.delete(`/product/api/delete-discount-code/${id}`),
    onSuccess: async () => {
      await Promise.all([['shop-discounts'], ['discount-product-options'], ['edit-discount-products'], ['products'], ['seller-products']].map(queryKey => client.invalidateQueries({ queryKey })));
      setDeleting(null); toast.success('Discount code deleted.');
    },
    onError: () => toast.error('Unable to delete the discount. Please try again.'),
  });
  const codes: any[] = codesQuery.data || [];
  const products: any[] = productsQuery.data || [];
  const visible = codes.filter(code => `${code.public_name || ''} ${code.discountCode || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const assignedCount = (id: string) => products.filter(product => product.discount_codes?.includes(id)).length;
  const activeAssignments = products.filter(product => product.discount_codes?.some((id: string) => codes.some(code => code.id === id))).length;
  return <div className="mx-auto max-w-7xl p-4 text-slate-100 sm:p-8">
    <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-xs text-slate-500"><Link href="/dashboard" className="transition hover:text-slate-200">Dashboard</Link><ChevronRight size={14} /><span className="text-slate-300">Discount codes</span></nav>
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">Promotions</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Discount codes</h1><p className="mt-2 text-sm text-slate-400">Create offers and choose exactly which products they apply to.</p></div><button type="button" onClick={() => setCreateOpen(true)} disabled={codesQuery.isLoading || codesQuery.isError} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500 disabled:opacity-50"><Plus size={17} /> Create discount</button></div>
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><Metric label="Discount codes" value={codesQuery.isLoading || codesQuery.isError ? '—' : String(codes.length)} icon={<TicketPercent size={20} />} /><Metric label="Products with promotions" value={productsQuery.isLoading || productsQuery.isError || codesQuery.isLoading || codesQuery.isError ? '—' : String(activeAssignments)} icon={<Package size={20} />} /><div className="flex items-center gap-3 rounded-2xl border border-blue-500/15 bg-blue-500/5 px-5 py-4"><div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400"><Tag size={20} /></div><div><p className="text-sm font-medium text-slate-200">Two ways to save</p><p className="mt-1 text-xs text-slate-500">Percentage or fixed amount in USD</p></div></div></div>
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 p-5"><div><h2 className="font-semibold">Your promotions</h2><p className="mt-1 text-xs text-slate-500">Manage codes, values and applicable products.</p></div><label className="flex w-full items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/50 px-3 focus-within:border-blue-500 sm:w-72"><Search size={16} className="shrink-0 text-slate-500" /><input aria-label="Search discount codes" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or code…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-600" /></label></div>
      {codesQuery.isLoading ? <div aria-busy="true" className="space-y-3 p-5">{[1, 2, 3].map(item => <div key={item} className="h-16 rounded-xl bg-slate-800/60" />)}</div> : codesQuery.isError ? <div role="alert" className="p-8 text-center"><AlertCircle size={28} className="mx-auto mb-3 text-red-400" /><h3 className="font-medium">Unable to load discount codes</h3><p className="mt-2 text-sm text-slate-400">Please check your connection and try again.</p><button onClick={() => codesQuery.refetch()} className="mt-4 rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Try again</button></div> : !visible.length ? <div className="px-5 py-16 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400"><TicketPercent size={26} /></div><h3 className="font-semibold">{search.trim() ? 'No matching promotions' : 'Create your first promotion'}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{search.trim() ? 'Try a different code or promotion name.' : 'Give customers a reason to come back with a discount on selected products.'}</p>{!search.trim() && <button onClick={() => setCreateOpen(true)} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300">Create a discount <ArrowRight size={16} /></button>}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-slate-950/30 text-xs font-medium uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3.5 font-medium">Promotion</th><th className="px-5 py-3.5 font-medium">Discount</th><th className="px-5 py-3.5 font-medium">Code</th><th className="px-5 py-3.5 font-medium">Products</th><th className="px-5 py-3.5 text-right font-medium">Actions</th></tr></thead><tbody className="divide-y divide-slate-800/80">{visible.map(discount => <tr key={discount.id} className="transition hover:bg-slate-800/30"><td className="max-w-64 px-5 py-5"><p className="break-words font-medium text-slate-100">{discount.public_name}</p><p className="mt-1 text-xs text-slate-500">{discount.discountType === 'percentage' ? 'Percentage offer' : 'Fixed amount offer'}</p></td><td className="whitespace-nowrap px-5 py-5"><span className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 font-semibold text-emerald-300">{discount.discountType === 'percentage' ? `${discount.discountValue}% off` : `${money(discount.discountValue)} off`}</span></td><td className="max-w-48 px-5 py-5"><code className="break-all rounded-md border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-300">{discount.discountCode}</code></td><td className="px-5 py-5">{productsQuery.isLoading || productsQuery.isError ? <span className="text-slate-500">—</span> : <span className={`whitespace-nowrap text-xs ${assignedCount(discount.id) ? 'text-slate-300' : 'text-amber-300'}`}>{assignedCount(discount.id) ? `${assignedCount(discount.id)} assigned` : 'Not assigned'}</span>}</td><td className="whitespace-nowrap px-5 py-5 text-right"><button type="button" disabled={deletion.isPending} aria-label={`Edit products for ${discount.discountCode}`} onClick={() => setEditing(discount)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-blue-400 transition hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-40"><Pencil size={14} /> Products</button><button type="button" disabled={deletion.isPending} aria-label={`Delete ${discount.discountCode}`} onClick={() => { deletion.reset(); setDeleting(discount); }} className="ml-1 inline-flex rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>}
      {!codesQuery.isLoading && !codesQuery.isError && codes.length > 0 && <div className="border-t border-slate-800 px-5 py-3 text-xs text-slate-500">Showing {visible.length} of {codes.length} promotions</div>}
    </section>
    {productsQuery.isError && <p role="alert" className="mt-4 flex flex-wrap items-center gap-2 text-xs text-amber-300"><AlertCircle size={15} />Product assignment counts are unavailable.<button type="button" onClick={() => productsQuery.refetch()} className="underline">Reload products</button></p>}
    <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-slate-500"><AlertCircle size={15} className="mt-0.5 shrink-0" />A code must be assigned to at least one product before customers can apply it at checkout.</p>
    {createOpen && <CreateDiscountModal sellerId={sellerId} onClose={() => setCreateOpen(false)} />}
    {editing && <EditDiscountProducts key={`${sellerId}:${editing.id}`} discount={editing} onClose={() => setEditing(null)} />}
    {deleting && <DeleteDiscountCodeModal discount={deleting} busy={deletion.isPending} error={deletion.isError ? (deletion.error as any)?.response?.data?.message || 'Unable to delete this discount. Please try again.' : ''} onClose={() => { if (!deletion.isPending) setDeleting(null); }} onConfirm={() => { if (!deletion.isPending) deletion.mutate(deleting.id); }} />}
  </div>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4"><div className="rounded-xl bg-slate-800/80 p-2.5 text-slate-400">{icon}</div><div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-0.5 text-xs text-slate-500">{label}</p></div></div>;
}

function CreateDiscountModal({ sellerId, onClose }: { sellerId: string; onClose: () => void }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<DiscountDraft>({ public_name: '', discountType: 'percentage', discountValue: '', discountCode: '', productIds: [] });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const productsQuery = useQuery({
    queryKey: ['discount-product-options', sellerId], staleTime: 0,
    queryFn: async ({ signal }) => { const data = (await api.get('/product/api/get-shop-products', { signal })).data.products; if (!Array.isArray(data)) throw new Error('Invalid product response'); return data.filter((product: any) => !product.isDeleted); },
  });
  const creation = useMutation({
    mutationFn: async (payload: any) => api.post('/product/api/create-discount-code', payload),
    onSuccess: async () => {
      await Promise.all([['shop-discounts'], ['discount-product-options'], ['products'], ['seller-products']].map(queryKey => client.invalidateQueries({ queryKey })));
      toast.success('Discount code created.'); onClose();
    },
    onError: (failure: any) => { const message = failure.response?.data?.message || 'Unable to create this discount. Please try again.'; setError(message); toast.error(message); },
  });
  const dialogRef = useDiscountDialog(onClose, creation.isPending);
  const products: any[] = productsQuery.data || [];
  const visible = products.filter(product => String(product.title || '').toLowerCase().includes(search.trim().toLowerCase()));
  const update = <K extends keyof DiscountDraft>(key: K, value: DiscountDraft[K]) => { setDraft(current => ({ ...current, [key]: value })); setError(''); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); if (creation.isPending) return;
    const value = Number(draft.discountValue);
    if (!draft.public_name.trim() || !draft.discountCode.trim() || draft.discountCode.trim().length > 100) { setError('Enter a promotion name and a discount code with up to 100 characters.'); return; }
    if (!Number.isFinite(value) || value <= 0 || draft.discountType === 'percentage' && value > 100) { setError(draft.discountType === 'percentage' ? 'Enter a percentage greater than 0 and no higher than 100.' : 'Enter a discount amount greater than 0.'); return; }
    if (draft.productIds.length > 1000) { setError('Select up to 1000 products per discount.'); return; }
    if (draft.productIds.length && (productsQuery.isFetching || productsQuery.isError || draft.productIds.some(id => !products.some(product => product.id === id)))) { setError('Product availability changed. Reload the products and review your selections.'); return; }
    creation.mutate({ ...draft, public_name: draft.public_name.trim(), discountCode: draft.discountCode.trim(), discountValue: value });
  };
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"><section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="create-discount-title" aria-describedby="create-discount-description" aria-busy={creation.isPending} className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] text-slate-100 shadow-2xl outline-none"><div className="flex items-start justify-between gap-3 border-b border-slate-800 p-5 sm:p-6"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-400">New promotion</p><h2 id="create-discount-title" className="text-xl font-semibold">Create discount code</h2><p id="create-discount-description" className="mt-2 text-sm text-slate-400">Set the offer and choose products for your promotion.</p></div><button type="button" aria-label="Close create discount dialog" disabled={creation.isPending} onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 disabled:opacity-40"><X size={20} /></button></div>
    <form onSubmit={submit} className="overflow-y-auto p-5 sm:p-6"><fieldset disabled={creation.isPending} className="space-y-5"><label className="block text-sm font-medium" htmlFor="discount-name">Promotion name<input data-dialog-focus id="discount-name" required maxLength={100} value={draft.public_name} onChange={event => update('public_name', event.target.value)} className={fieldClass} placeholder="e.g. Weekend upgrade sale" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium" htmlFor="discount-type">Discount type<select id="discount-type" value={draft.discountType} onChange={event => update('discountType', event.target.value)} className={fieldClass}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount (USD)</option></select></label><label className="block text-sm font-medium" htmlFor="discount-value">{draft.discountType === 'percentage' ? 'Discount percentage' : 'Amount in USD'}<input id="discount-value" required type="number" min="0.01" max={draft.discountType === 'percentage' ? 100 : undefined} step="0.01" value={draft.discountValue} onChange={event => update('discountValue', event.target.value)} className={fieldClass} placeholder={draft.discountType === 'percentage' ? 'e.g. 10' : 'e.g. 20.00'} /></label></div><label className="block text-sm font-medium" htmlFor="discount-code">Discount code<input id="discount-code" required maxLength={100} value={draft.discountCode} onChange={event => update('discountCode', event.target.value)} className={`${fieldClass} font-mono`} placeholder="e.g. UPGRADE10" /><span className="mt-2 block text-xs font-normal text-slate-500">Customers enter this exact code at checkout.</span></label>
    <div className="border-t border-slate-800 pt-5"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Applicable products</h3><div className="flex items-center gap-3">{draft.productIds.length > 0 && <button type="button" onClick={() => update('productIds', [])} className="text-xs text-slate-400 hover:text-white">Clear selection</button>}<span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300">{draft.productIds.length} selected</span></div></div><p className="mt-2 text-xs leading-relaxed text-slate-500">You can leave this empty and assign products later. The code can only be used on assigned products.</p><label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/60 px-3 focus-within:border-blue-500"><Search size={15} className="shrink-0 text-slate-500" /><input aria-label="Search applicable products" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-600" placeholder="Search products…" /></label><div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">{productsQuery.isLoading ? <p className="flex items-center gap-2 py-5 text-sm text-slate-400"><Loader2 size={15} className="animate-spin" /> Loading products…</p> : productsQuery.isError ? <p role="alert" className="rounded-xl bg-red-500/5 p-3 text-sm text-red-300">Unable to load products. <button type="button" onClick={() => productsQuery.refetch()} className="underline">Try again</button></p> : visible.length ? visible.map(product => <label key={product.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${draft.productIds.includes(product.id) ? 'border-blue-500/40 bg-blue-500/10' : 'border-slate-800 bg-slate-950/30 hover:border-slate-700'}`}><input type="checkbox" checked={draft.productIds.includes(product.id)} onChange={event => update('productIds', event.target.checked ? [...new Set([...draft.productIds, product.id])] : draft.productIds.filter(id => id !== product.id))} className="h-4 w-4 shrink-0 accent-blue-500" /><span className="min-w-0 flex-1"><span className="block break-words">{product.title}</span><span className="mt-1 block text-xs text-slate-500">{money(product.sale_price)}</span></span>{draft.productIds.includes(product.id) && <Check size={15} className="shrink-0 text-blue-400" />}</label>) : <p className="py-6 text-center text-sm text-slate-500">{products.length ? 'No products match your search.' : 'No available products yet. You can assign this code later.'}</p>}</div></div></fieldset>
    {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-300"><AlertCircle size={16} className="shrink-0" />{error}</p>}<div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-5"><button type="button" disabled={creation.isPending} onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">Cancel</button><button type="submit" disabled={creation.isPending || draft.productIds.length > 0 && productsQuery.isFetching} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{creation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}{creation.isPending ? 'Creating…' : 'Create discount'}</button></div></form>
  </section></div>;
}
