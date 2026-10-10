'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '../../utils/axioInstance';

const empty = { id: '', sku: '', color: '', size: '', price: '', stock: '', active: true };
export default function VariantEditor({ productId }: { productId: string }) {
  const client = useQueryClient();
  const [form, setForm] = useState(empty); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ['variant-product', productId], queryFn: async () => (await axios.get(`/product/api/seller-product/${productId}`)).data.product });
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      await axios.put(`/product/api/variants/${productId}`, { ...form, id: form.id || undefined, price: Number(form.price), stock: Number(form.stock) });
      await client.invalidateQueries(); setForm(empty); setMessage('SKU saved. Product stock now equals the sum of active SKUs.');
    } catch (error: any) { setMessage(error.response?.data?.message || 'Could not save SKU'); } finally { setBusy(false); }
  }
  return <section className="border rounded-lg p-5 space-y-4"><h2 className="text-xl font-semibold">SKU inventory</h2><p>Each color/size combination has its own price in USD and stock. Adding the first SKU replaces the product-level stock with SKU stock.</p>
    {query.isError && <p role="alert">Unable to load variants.</p>}
    <div className="flex flex-wrap gap-2">{query.data?.variants?.map((v: any) => <button type="button" className="border rounded p-2" key={v.id} onClick={() => setForm({ ...v, price: String(v.price), stock: String(v.stock) })}>{v.sku} · ${v.price} · {v.stock} {v.active ? '' : '(inactive)'}</button>)}</div>
    <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">{(['sku', 'color', 'size', 'price', 'stock'] as const).map(key => <label key={key} className="block">{key === 'price' ? 'Price (USD)' : key}<input className="block border rounded p-2 w-full bg-transparent" value={form[key]} required={!['color', 'size'].includes(key)} type={['price', 'stock'].includes(key) ? 'number' : 'text'} min={key === 'price' ? '0.01' : '0'} step={key === 'price' ? '0.01' : '1'} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>)}<label><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })}/> Available for sale</label><div className="flex gap-3"><button className="bg-blue-600 text-white rounded px-4 py-2" disabled={busy || query.isLoading || query.isError}>Save SKU</button><button type="button" onClick={() => setForm(empty)}>New SKU</button></div></form><p role="status">{message}</p></section>;
}
