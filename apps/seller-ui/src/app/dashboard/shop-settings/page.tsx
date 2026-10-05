'use client';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import useSeller from 'apps/seller-ui/src/hooks/useSeller';
import axios from 'apps/seller-ui/src/utils/axioInstance';
export default function ShopSettings() {
  const { seller, refetch, isLoading } = useSeller();
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (seller?.shop) setForm({ ...seller.shop, avatar: undefined, socialLinks: Array.isArray(seller.shop.socialLinks) ? seller.shop.socialLinks : Object.entries(seller.shop.socialLinks || {}).map(([name, url]) => ({ name, url })) }); }, [seller]);
  const save = useMutation({ mutationFn: () => axios.put(`/api/update-shop/${seller.shop.id}`, form), onSuccess: () => { toast.success('Shop saved.'); return refetch(); }, onError: () => toast.error('Could not save shop') });
  const upload = async (key: string, file?: File) => {
    if (!file) return; setBusy(true);
    try {
      const encoded = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file); });
      const { data } = await axios.post('/api/upload-account-image', { file: encoded });
      setForm((prev: any) => ({ ...prev, [key]: key === 'avatar' ? data : data.url }));
    } catch { toast.error('Image upload failed. Use a PNG, JPEG or WebP smaller than 5 MB.'); } finally { setBusy(false); }
  };
  if (!form) return <p className="p-6">{isLoading ? 'Loading shop…' : 'Create a shop to manage its settings.'}</p>;
  return <main className="max-w-3xl mx-auto p-6 text-white"><h1 className="text-2xl font-bold mb-6">Shop settings</h1><form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>{['name', 'bio', 'address', 'opening_hours', 'website'].map(key => <label className="block" key={key}>{key.replaceAll('_', ' ')}<input className="block w-full bg-slate-900 rounded border p-3" required={key === 'name'} type={key === 'website' ? 'url' : 'text'} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}{['avatar', 'coverBanner'].map(key => <label key={key} className="block">{key}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="block my-2" onChange={e => upload(key, e.target.files?.[0])} />{(key === 'avatar' ? form.avatar?.url : form.coverBanner) && <img className="h-24 object-cover" alt={key} src={key === 'avatar' ? form.avatar.url : form.coverBanner} />}</label>)}<h2>Social links</h2>{form.socialLinks.map((link: any, index: number) => <div key={index} className="flex flex-wrap gap-2"><input aria-label="Social network" className="bg-slate-900 border rounded p-2" value={link.name} required onChange={e => setForm({ ...form, socialLinks: form.socialLinks.map((v: any, i: number) => i === index ? { ...v, name: e.target.value } : v) })} /><input aria-label="Social link URL" type="url" required className="bg-slate-900 border rounded p-2" value={link.url} onChange={e => setForm({ ...form, socialLinks: form.socialLinks.map((v: any, i: number) => i === index ? { ...v, url: e.target.value } : v) })} /><button type="button" onClick={() => setForm({ ...form, socialLinks: form.socialLinks.filter((_: any, i: number) => i !== index) })}>Remove</button></div>)}<button type="button" disabled={form.socialLinks.length >= 10} onClick={() => setForm({ ...form, socialLinks: [...form.socialLinks, { name: '', url: '' }] })}>Add social link</button><button className="block bg-blue-600 rounded p-3" disabled={busy || save.isPending}>Save shop</button></form></main>;
}
