'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, ImagePlus, Link2, Loader2, Plus, RotateCcw, Save, Store, Trash2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import useSeller from 'apps/seller-ui/src/hooks/useSeller';
import axios from 'apps/seller-ui/src/utils/axioInstance';

type ShopForm = { name: string; bio: string; address: string; opening_hours: string; website: string; coverBanner: string; socialLinks: { name: string; url: string }[] };
const inputClass = 'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3.5 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60';
const panelClass = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6';
const isWebUrl = (value: string) => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };
const shopAvatarUrl = (shop: any): string => { const image = Array.isArray(shop.avatar) ? shop.avatar[0] : shop.avatar; return typeof image?.url === 'string' ? image.url : ''; };

function shopForm(shop: any): ShopForm {
  const links = Array.isArray(shop.socialLinks) ? shop.socialLinks : Object.entries(shop.socialLinks || {}).map(([name, url]) => ({ name, url }));
  return { name: shop.name || '', bio: shop.bio || '', address: shop.address || '', opening_hours: shop.opening_hours || '', website: shop.website || '', coverBanner: shop.coverBanner || '', socialLinks: links.map((link: any) => ({ name: String(link.name || ''), url: String(link.url || '') })) };
}

export default function ShopSettings() {
  const { seller, isLoading, isError, refetch } = useSeller();
  if (isLoading) return <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8" aria-busy="true" aria-label="Loading shop settings"><div className="h-16 w-64 rounded-xl bg-slate-800" /><div className="h-80 rounded-2xl bg-slate-900" /></div>;
  if (isError && !seller) return <div className="m-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-slate-200 sm:m-8" role="alert"><h1 className="font-semibold">Unable to load shop settings</h1><p className="mt-2 text-sm text-slate-400">Your settings could not be retrieved. Please try again.</p><button onClick={() => refetch()} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white">Try again</button></div>;
  if (!seller) return <div className="p-8 text-slate-300">Please <Link href="/login" className="text-blue-400 underline">sign in</Link> to manage your shop.</div>;
  if (!seller.shop) return <div className="m-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-slate-200 sm:m-8"><Store className="mb-4 text-blue-400" size={30} /><h1 className="text-xl font-semibold">Your shop is not set up yet</h1><p className="mt-2 text-sm text-slate-400">Complete your seller registration to manage your shop profile.</p></div>;
  return <ShopEditor key={`${seller.id}:${seller.shop.id}`} shop={seller.shop} />;
}

function ShopEditor({ shop }: { shop: any }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ShopForm>(() => shopForm(shop));
  const [baseline, setBaseline] = useState<ShopForm>(() => shopForm(shop));
  const [avatar, setAvatar] = useState<{ url: string; file_id: string } | null>(null);
  const [savedAvatar, setSavedAvatar] = useState(() => shopAvatarUrl(shop));
  const [uploading, setUploading] = useState<'avatar' | 'coverBanner' | null>(null);
  const [error, setError] = useState('');
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline) || Boolean(avatar);
  // Background seller refreshes must not replace a draft the seller is editing.
  useEffect(() => { if (!dirty) { const next = shopForm(shop); setForm(next); setBaseline(next); setSavedAvatar(shopAvatarUrl(shop)); } }, [shop]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const save = useMutation({
    mutationFn: async (payload: ShopForm & { avatar?: { url: string; file_id: string } }) => (await axios.put(`/api/update-shop/${shop.id}`, payload)).data.shop,
    onSuccess: async updated => {
      const next = shopForm(updated);
      setForm(next); setBaseline(next); setSavedAvatar(shopAvatarUrl(updated)); setAvatar(null); setError('');
      toast.success('Shop settings saved.');
      await queryClient.invalidateQueries({ queryKey: ['seller'] });
    },
    onError: (failure: any) => { const message = failure.response?.data?.message || 'Unable to save your shop. Please try again.'; setError(message); toast.error(message); },
  });
  const busy = Boolean(uploading) || save.isPending;
  const update = <K extends keyof ShopForm>(key: K, value: ShopForm[K]) => { setForm(current => ({ ...current, [key]: value })); setError(''); };
  const upload = async (key: 'avatar' | 'coverBanner', file?: File) => {
    if (!file || busy) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0) { toast.error('Choose a PNG, JPEG or WebP image under 5 MB.'); return; }
    setUploading(key); setError('');
    try {
      const encoded = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Unable to read image')); reader.readAsDataURL(file); });
      const { data } = await axios.post('/api/upload-account-image', { file: encoded });
      if (typeof data.url !== 'string' || !data.url.startsWith('https://') || typeof data.file_id !== 'string') throw new Error('Invalid upload response');
      if (key === 'avatar') setAvatar({ url: data.url, file_id: data.file_id });
      else update('coverBanner', data.url);
      toast.success('Image uploaded. Save your changes to publish it.');
    } catch { toast.error('Image upload failed. Please try another image.'); }
    finally { setUploading(null); }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !dirty) return;
    const payload = { ...form, name: form.name.trim(), website: form.website.trim(), socialLinks: form.socialLinks.map(link => ({ name: link.name.trim(), url: link.url.trim() })), ...(avatar ? { avatar } : {}) };
    if (!payload.name || payload.name.length > 100) { setError('Enter a shop name with 1 to 100 characters.'); return; }
    if (payload.website && !isWebUrl(payload.website)) { setError('Use a complete website URL beginning with http:// or https://.'); return; }
    if (payload.socialLinks.length > 10 || payload.socialLinks.some(link => !link.name || !isWebUrl(link.url))) { setError('Each social link needs a name and a valid http:// or https:// URL.'); return; }
    save.mutate(payload);
  };
  const discard = () => { const next = shopForm(shop); setForm(next); setBaseline(next); setSavedAvatar(shopAvatarUrl(shop)); setAvatar(null); setError(''); };
  return <div className="mx-auto max-w-6xl p-4 text-slate-100 sm:p-8">
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">Storefront</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Shop settings</h1><p className="mt-2 text-sm text-slate-400">Make your shop recognizable and help customers get in touch.</p></div><span className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${dirty ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-slate-800 bg-slate-900 text-slate-400'}`}><span className={`h-1.5 w-1.5 rounded-full ${dirty ? 'bg-amber-400' : 'bg-emerald-400'}`} />{dirty ? 'Unsaved changes' : 'All changes saved'}</span></div>
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={busy} className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0 space-y-5">
          <section className={panelClass}><div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400"><Store size={20} /></div><div><h2 className="font-semibold">Shop profile</h2><p className="mt-0.5 text-xs text-slate-400">The details customers see on your shop page.</p></div></div><div className="space-y-5"><label className="block text-sm font-medium" htmlFor="shop-name">Shop name <span className="text-blue-400">*</span><input id="shop-name" required maxLength={100} value={form.name} onChange={event => update('name', event.target.value)} className={inputClass} placeholder="Your shop name" /></label><label className="block text-sm font-medium" htmlFor="shop-bio">About your shop<textarea id="shop-bio" maxLength={2000} rows={4} value={form.bio} onChange={event => update('bio', event.target.value)} className={`${inputClass} resize-y`} placeholder="Tell customers what makes your shop special…" /><span className="mt-1 block text-right text-xs font-normal text-slate-500">{form.bio.length}/2000</span></label><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-medium" htmlFor="shop-address">Address<input id="shop-address" maxLength={2000} value={form.address} onChange={event => update('address', event.target.value)} className={inputClass} placeholder="Street, city, country" /></label><label className="block text-sm font-medium" htmlFor="shop-hours">Opening hours<input id="shop-hours" maxLength={2000} value={form.opening_hours} onChange={event => update('opening_hours', event.target.value)} className={inputClass} placeholder="e.g. Mon – Sat, 9:00 – 18:00" /></label></div><label className="block text-sm font-medium" htmlFor="shop-website">Website<input id="shop-website" type="url" maxLength={2000} value={form.website} onChange={event => update('website', event.target.value)} className={inputClass} placeholder="https://your-store.com" /></label></div></section>
          <section className={panelClass}><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold"><Link2 size={18} className="text-blue-400" /> Social links</h2><p className="mt-1 text-xs text-slate-400">Connect your customers with your other channels.</p></div><button type="button" disabled={form.socialLinks.length >= 10} onClick={() => update('socialLinks', [...form.socialLinks, { name: '', url: '' }])} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"><Plus size={14} /> Add link</button></div>{form.socialLinks.length ? <div className="space-y-3">{form.socialLinks.map((link, index) => <div key={index} className="flex items-start gap-2"><div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[150px_minmax(0,1fr)]"><input aria-label={`Social network ${index + 1}`} required maxLength={100} className={`${inputClass} !mt-0`} placeholder="e.g. Facebook" value={link.name} onChange={event => update('socialLinks', form.socialLinks.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /><input aria-label={`Social link URL ${index + 1}`} required type="url" maxLength={2000} className={`${inputClass} !mt-0`} placeholder="https://…" value={link.url} onChange={event => update('socialLinks', form.socialLinks.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} /></div><button type="button" aria-label={`Remove social link ${index + 1}`} onClick={() => update('socialLinks', form.socialLinks.filter((_, i) => i !== index))} className="rounded-xl p-3 text-slate-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 size={18} /></button></div>)}</div> : <div className="rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">No social links added yet.</div>}<p className="mt-3 text-xs text-slate-500">{form.socialLinks.length}/10 links</p></section>
        </div>
        <div className="min-w-0 space-y-5"><section className={panelClass}><h2 className="font-semibold">Shop branding</h2><p className="mt-1 text-xs text-slate-400">Use clear images that represent your business.</p><div className="mt-6"><p className="mb-3 text-sm font-medium">Shop logo</p><div className="mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">{avatar?.url || savedAvatar ? <img src={avatar?.url || savedAvatar} alt="Shop logo preview" className="h-full w-full object-cover" /> : <Store size={30} className="text-slate-600" />}</div><label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-800 ${busy ? 'pointer-events-none opacity-50' : ''}`}>{uploading === 'avatar' ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}{uploading === 'avatar' ? 'Uploading…' : 'Change logo'}<input aria-label="Upload shop logo" type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={event => { upload('avatar', event.target.files?.[0]); event.target.value = ''; }} /></label></div><div className="mt-6 border-t border-slate-800 pt-5"><p className="mb-3 text-sm font-medium">Cover banner</p><div className="mb-3 flex aspect-[2.2/1] items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950">{form.coverBanner ? <img src={form.coverBanner} alt="Shop cover preview" className="h-full w-full object-cover" /> : <ImagePlus size={26} className="text-slate-600" />}</div><div className="flex flex-wrap gap-2"><label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-800 ${busy ? 'pointer-events-none opacity-50' : ''}`}>{uploading === 'coverBanner' ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}{uploading === 'coverBanner' ? 'Uploading…' : 'Change banner'}<input aria-label="Upload cover banner" type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={event => { upload('coverBanner', event.target.files?.[0]); event.target.value = ''; }} /></label>{form.coverBanner && <button type="button" onClick={() => update('coverBanner', '')} className="rounded-lg px-2 py-2 text-xs text-slate-400 hover:text-red-400">Remove</button>}</div></div><p className="mt-5 text-xs leading-relaxed text-slate-500">PNG, JPEG or WebP, up to 5 MB per image. Uploads are published when you save.</p></section><div className="rounded-2xl border border-blue-500/15 bg-blue-500/5 p-5 text-sm"><Check size={18} className="mb-3 text-blue-400" /><p className="font-medium text-slate-200">Keep your profile up to date</p><p className="mt-2 leading-relaxed text-slate-400">A recognizable logo, accurate contact details and opening hours help customers shop with confidence.</p></div></div>
      </fieldset>
      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"><AlertCircle size={18} className="shrink-0" />{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4"><p className="text-xs text-slate-400">{uploading ? 'Your image is uploading…' : dirty ? 'Your changes are ready to save.' : 'Your shop profile is up to date.'}</p><div className="flex gap-2"><button type="button" onClick={discard} disabled={busy || !dirty} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 disabled:opacity-40"><RotateCcw size={16} /> Reset</button><button type="submit" disabled={busy || !dirty} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{save.isPending ? 'Saving…' : 'Save changes'}</button></div></div>
    </form>
  </div>;
}
