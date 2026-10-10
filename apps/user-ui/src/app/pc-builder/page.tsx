'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PC_SLOTS, PcSlot } from '@packages/utils/pc-build';
import { formatUSD } from '@packages/utils/money';
import { useStore } from '@/store';
import axios from '@/utils/axioInstance';
import Link from 'next/link';

type Selection = { slot: PcSlot; id: string; variantId?: string; selectedOptions?: { color?: string; size?: string } };
function validateSaved(value: unknown): Selection[] {
  if (!Array.isArray(value) || value.length > 8) throw new Error('Invalid build');
  const parts = value.filter(p => p && PC_SLOTS.includes(p.slot) && typeof p.id === 'string' && /^[a-f\d]{24}$/i.test(p.id));
  if (parts.length !== value.length || new Set(parts.map(p => p.slot)).size !== parts.length) throw new Error('Invalid build');
  return parts;
}
export default function PcBuilderPage() {
  const [parts, setParts] = useState<Selection[]>([]); const [slot, setSlot] = useState<PcSlot>('cpu');
  const [search, setSearch] = useState(''); const [q, setQ] = useState(''); const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  useEffect(() => {
    try { const raw = new URLSearchParams(window.location.search).get('build'); if (raw) setParts(validateSaved(JSON.parse(raw))); }
    catch { setMessage('The shared build is invalid. Start a new selection.'); }
  }, []);
  const catalog = useQuery({ queryKey: ['pc-catalog', slot, q, page], queryFn: async () => (await axios.get('/product/api/pc-builder/catalog', { params: { slot, q, page, limit: 12 } })).data.products });
  const quote = useQuery({ queryKey: ['pc-quote', parts], enabled: parts.length > 0, queryFn: async () => (await axios.post('/product/api/pc-builder/quote', { parts })).data, retry: false });
  function choose(product: any, variantId?: string) {
    setMessage('');
    setParts(current => [...current.filter(p => p.slot !== slot), { slot, id: product.id, variantId, selectedOptions: { color: product.colors[0] || '', size: product.sizes[0] || '' } }]);
  }
  async function share() {
    const url = new URL(window.location.href); url.search = ''; url.searchParams.set('build', JSON.stringify(parts));
    try { await navigator.clipboard.writeText(url.toString()); setMessage('Build link copied. Prices and stock are refreshed when opened.'); }
    catch { setMessage(url.toString()); }
  }
  async function addBuild() {
    try {
      const { data } = await axios.post('/product/api/pc-builder/quote', { parts });
      if (!data.canAddToCart) { setMessage('Resolve compatibility or stock issues first.'); await quote.refetch(); return; }
      data.parts.forEach((product: any) => useStore.getState().addToCart({ ...product, price: product.sale_price, quantity: 1 }, null, null, ''));
      setMessage('Selected components added to your cart.');
    } catch (error: any) { setMessage(error.response?.data?.message || 'Unable to add build'); }
  }
  return <main className="max-w-7xl mx-auto p-5 md:p-10 space-y-6"><div><h1 className="text-3xl font-bold">Build your PC</h1><p className="text-gray-600 mt-2">Choose components, review compatibility and add your selection to the cart. All prices are USD.</p></div>
    <div className="flex flex-wrap gap-2">{PC_SLOTS.map(key => <button className={`border rounded-lg px-4 py-2 ${slot === key ? 'bg-blue-600 text-white' : ''}`} key={key} onClick={() => { setSlot(key); setPage(1); setQ(''); setSearch(''); }}>{key.toUpperCase()}{parts.some(p => p.slot === key) ? ' ✓' : ''}</button>)}</div>
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6"><section><form className="flex gap-2 mb-4" onSubmit={e => { e.preventDefault(); setQ(search); setPage(1); }}><input aria-label="Search components" value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${slot}`} className="border rounded p-3 flex-1 min-w-0"/><button className="bg-blue-600 text-white rounded px-4">Search</button></form>
      {catalog.isLoading && <p>Loading components…</p>}{catalog.isError && <p role="alert">Unable to load products. <button onClick={() => catalog.refetch()}>Retry</button></p>}
      <div className="grid sm:grid-cols-2 gap-4">{catalog.data?.map((product: any) => <article key={product.id} className="border rounded-xl p-4 space-y-3">{product.images[0] && <img alt="" src={product.images[0].url} className="h-32 w-full object-contain"/>}<Link className="font-semibold block hover:underline" href={`/product/${product.slug}`}>{product.title}</Link><p>{formatUSD(product.sale_price)} · {product.stock} in stock</p>{product.variants.length ? <select aria-label={`Choose SKU for ${product.title}`} className="border rounded p-2 w-full" value={parts.find(p => p.slot === slot && p.id === product.id)?.variantId || ''} onChange={e => { if(e.target.value) choose(product, e.target.value); }}><option value="">Choose SKU</option>{product.variants.map((v: any) => <option key={v.id} value={v.id} disabled={v.stock < 1}>{v.sku} · {formatUSD(v.price)} · {v.stock} in stock</option>)}</select> : <button className="border border-blue-600 text-blue-600 rounded p-2 w-full" onClick={() => choose(product)}>Select{product.colors[0] || product.sizes[0] ? ` (${[product.colors[0], product.sizes[0]].filter(Boolean).join(' / ')})` : ''}</button>}</article>)}</div>
      {catalog.data?.length === 0 && <p>No components found. Try another search.</p>}<div className="flex gap-4 mt-4"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button disabled={!catalog.data || catalog.data.length < 12} onClick={() => setPage(p => p + 1)}>Next</button></div>
    </section><aside className="border rounded-xl p-5 space-y-4 h-fit"><h2 className="text-xl font-semibold">Your selection ({parts.length}/8)</h2>
      {parts.map(part => <div className="flex justify-between gap-3" key={part.slot}><span>{part.slot.toUpperCase()}: {quote.data?.parts?.find((p: any) => p.slot === part.slot)?.title || 'Selected'}</span><button aria-label={`Remove ${part.slot}`} onClick={() => setParts(parts.filter(p => p.slot !== part.slot))}>Remove</button></div>)}
      {quote.isFetching && parts.length > 0 && <p>Checking current price and compatibility…</p>}{quote.isError && <p role="alert">{(quote.error as any).response?.data?.message || 'Unable to check build'}</p>}
      {parts.length > 0 && quote.data && <><p className="text-xl font-bold">{formatUSD(quote.data.total)}</p><ul className="space-y-2 text-sm">{quote.data.issues.map((issue: any, i: number) => <li key={i} className={issue.level === 'error' ? 'text-red-600' : 'text-amber-800'}>{issue.message}</li>)}</ul></>}
      <button disabled={!parts.length || quote.isFetching || quote.isError || !quote.data?.canAddToCart} className="bg-blue-600 text-white rounded p-3 w-full disabled:opacity-40" onClick={addBuild}>Add selected components to cart</button>
      <div className="flex flex-wrap gap-3"><button disabled={!parts.length} onClick={() => { try { localStorage.setItem('saved-pc-build', JSON.stringify(parts)); setMessage('Build saved on this device.'); } catch { setMessage('Cannot save on this device.'); } }}>Save build</button><button onClick={() => { try { setParts(validateSaved(JSON.parse(localStorage.getItem('saved-pc-build') || '[]'))); setMessage('Saved selection loaded.'); } catch { setMessage('Saved build is unavailable.'); } }}>Load saved</button><button disabled={!parts.length} onClick={share}>Share</button></div><Link className="block underline" href="/cart">Open cart</Link><p role="status" className="break-words text-sm">{message}</p>
    </aside></div>
  </main>;
}
