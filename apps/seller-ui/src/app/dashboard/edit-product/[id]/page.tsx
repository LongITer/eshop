'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'apps/seller-ui/src/utils/axioInstance';
export default function EditProduct() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['seller-product', id], queryFn: async () => (await axios.get(`/product/api/seller-product/${id}`)).data.product });
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);
  const save = useMutation({ mutationFn: () => axios.put(`/product/api/update-product/${id}`, form), onSuccess: () => { client.invalidateQueries({ queryKey: ['products'] }); client.invalidateQueries({ queryKey: ['seller-stats'] }); client.invalidateQueries({ queryKey: ['inventory'] }); } });
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const fileName = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const { data } = await axios.post('/product/api/upload-product-image', { fileName });
      setForm((prev: any) => ({ ...prev, images: [...prev.images, { file_id: data.fileName, url: data.file_url }] }));
    } catch { setError('Could not upload image'); } finally { setUploading(false); }
  };
  if (query.isError) return <p role="alert" className="p-6">Product unavailable. <button onClick={() => query.refetch()}>Retry</button></p>;
  if (!form) return <p className="p-6">Loading product…</p>;
  return <main className="max-w-4xl mx-auto p-6 text-white"><Link href="/dashboard/all-products">← Products</Link><h1 className="text-2xl font-bold my-5">Edit product</h1><form className="grid sm:grid-cols-2 gap-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>{['title', 'slug', 'category', 'subCategory', 'brand', 'warranty', 'short_description', 'detailed_description'].map(key => <label key={key} className="block">{key.replaceAll('_', ' ')}<textarea className="block w-full bg-slate-900 border border-slate-600 rounded p-3" required={['title', 'slug', 'category', 'subCategory', 'warranty', 'detailed_description'].includes(key)} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}{['regular_price', 'sale_price', 'stock'].map(key => <label key={key}>{key.replaceAll('_', ' ')}<input className="block w-full bg-slate-900 border rounded p-3" type="number" min={0} step={key === 'stock' ? 1 : '0.01'} required value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} /></label>)}{['colors', 'sizes', 'tags'].map(key => <label key={key}>{key} (comma separated)<input className="block w-full bg-slate-900 border rounded p-3" value={form[key].join(',')} onChange={e => setForm({ ...form, [key]: e.target.value.split(',').map(v => v.trim()) })} /></label>)}<label>Status<select className="block bg-slate-900 border p-3" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{['Active', 'Inactive', 'Draft'].map(s => <option key={s}>{s}</option>)}</select></label><div className="sm:col-span-2"><h2>Product images</h2><div className="flex flex-wrap gap-4 py-3">{form.images.map((img: any, index: number) => <div key={img.file_id}><img src={img.url} alt={`Product ${index + 1}`} className="w-24 h-24 object-cover" /><button type="button" disabled={form.images.length === 1} onClick={() => setForm({ ...form, images: form.images.filter((_: any, i: number) => i !== index) })}>Remove</button></div>)}</div><label>Add image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || form.images.length >= 10} onChange={e => upload(e.target.files?.[0])} /></label></div><button disabled={save.isPending || uploading} className="bg-blue-600 rounded p-3">{save.isPending ? 'Saving…' : 'Save changes'}</button>{save.isSuccess && <p role="status">Product updated.</p>}{(save.isError || error) && <p role="alert">{error || (save.error as any)?.response?.data?.message || 'Could not save product'}</p>}</form></main>;
}
