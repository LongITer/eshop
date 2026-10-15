'use client';
import { useStorefrontText } from '@packages/components/storefront-language';

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
  const { t } = useStorefrontText();
  const ownerId = useStore(s=>s.ownerId);
  const savedKey = `saved-pc-build:${ownerId || 'guest'}`;
  const [compared,setCompared] = useState<any[]>([]);
  const [parts, setParts] = useState<Selection[]>([]); const [slot, setSlot] = useState<PcSlot>('cpu');
  const [search, setSearch] = useState(''); const [q, setQ] = useState(''); const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');
  useEffect(() => {
    try { const raw = new URLSearchParams(window.location.search).get('build'); if (raw) setParts(validateSaved(JSON.parse(raw))); }
    catch { setMessage(t('Liên kết cấu hình không hợp lệ. Hãy chọn lại linh kiện.')); }
  }, []);
  const catalog = useQuery({ queryKey: ['pc-catalog', slot, q, page], queryFn: async () => (await axios.get('/product/api/pc-builder/catalog', { params: { slot, q, page, limit: 12 } })).data.products });
  const quote = useQuery({ queryKey: ['pc-quote', parts], enabled: parts.length > 0, queryFn: async () => (await axios.post('/product/api/pc-builder/quote', { parts })).data, retry: false });
  function choose(product: any, variantId?: string) {
    setMessage('');
    setParts(current => [...current.filter(p => p.slot !== slot), { slot, id: product.id, variantId, selectedOptions: { color: product.colors[0] || '', size: product.sizes[0] || '' } }]);
  }
  async function share() {
    const url = new URL(window.location.href); url.search = ''; url.searchParams.set('build', JSON.stringify(parts));
    try { await navigator.clipboard.writeText(url.toString()); setMessage(t('Đã sao chép liên kết. Giá và tồn kho sẽ cập nhật khi mở.')); }
    catch { setMessage(url.toString()); }
  }
  async function addBuild() {
    try {
      const { data } = await axios.post('/product/api/pc-builder/quote', { parts });
      if (!data.canAddToCart) { setMessage(t('Kiểm tra lỗi tương thích hoặc tồn kho trước khi thêm.')); await quote.refetch(); return; }
      data.parts.forEach((product: any) => useStore.getState().addToCart({ ...product, price: product.sale_price, quantity: 1 }, null, null, ''));
      setMessage(t('Đã thêm linh kiện vào giỏ hàng.'));
    } catch (error: any) { setMessage(error.response?.data?.message || 'Không thêm được cấu hình.'); }
  }
  return <main className="max-w-7xl mx-auto p-5 md:p-10 space-y-6"><div><h1 className="text-3xl font-bold">{t("Lắp cấu hình PC")}</h1><p className="text-gray-600 mt-2">{t("Chọn linh kiện, kiểm tra tương thích và thêm vào giỏ hàng. Tất cả giá và thanh toán bằng USD.")}</p></div>
    <div className="flex flex-wrap gap-2">{PC_SLOTS.map(key => <button className={`border rounded-lg px-4 py-2 ${slot === key ? 'bg-blue-600 text-white' : ''}`} key={key} onClick={() => { setSlot(key); setPage(1); setQ(''); setSearch(''); setCompared([]); }}>{key.toUpperCase()}{parts.some(p => p.slot === key) ? ' ✓' : ''}</button>)}</div>
    {!!compared.length && <section className="space-y-3 rounded-xl border p-4"><h2 className="text-xl font-semibold">{t("So sánh ")}{slot.toUpperCase()} ({compared.length}/3)</h2><p className="text-sm text-slate-500">{t("Thông số và bảo hành do cửa hàng cung cấp; ô trống là chưa có dữ liệu. Giá SKU có thể khác giá cơ bản.")}</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">{t("Thông tin")}</th>{compared.map(p=><th className="min-w-48 p-3" key={p.id}><Link href={`/product/${p.slug}`}>{p.title}</Link><button className="ml-3 text-red-600" onClick={()=>setCompared(compared.filter(v=>v.id!==p.id))}>{t("Bỏ")}</button></th>)}</tr></thead><tbody>{[['Giá cơ bản (USD)',(p:any)=>formatUSD(p.sale_price)],['Tồn kho',(p:any)=>p.stock],['Bảo hành',(p:any)=>p.warranty || 'Chưa cung cấp'],...[...new Set(compared.flatMap(p=>Object.keys(p.custom_specification || {})))].map(key=>[key,(p:any)=>{const v=p.custom_specification?.[key];return v==null?'Chưa cung cấp':typeof v==='object'?JSON.stringify(v):String(v);}])].map(([label,value]:any)=><tr key={t(label)} className="border-t"><th className="p-3">{t(label)}</th>{compared.map(p=><td key={p.id} className="p-3">{typeof value(p) === "string" ? t(value(p)) : value(p)}</td>)}</tr>)}</tbody></table></div></section>}
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6"><section><form className="flex gap-2 mb-4" onSubmit={e => { e.preventDefault(); setQ(search); setPage(1); }}><input aria-label={t("Tìm linh kiện")} value={search} onChange={e => setSearch(e.target.value)} placeholder={`${t("Search")} ${slot.toUpperCase()}`} className="border rounded p-3 flex-1 min-w-0"/><button className="bg-blue-600 text-white rounded px-4">{t("Tìm kiếm")}</button></form>
      {catalog.isLoading && <p>{t("Đang tải linh kiện…")}</p>}{catalog.isError && <p role="alert">{t("Không tải được linh kiện. ")}<button onClick={() => catalog.refetch()}>{t("Thử lại")}</button></p>}
      <div className="grid sm:grid-cols-2 gap-4">{catalog.data?.map((product: any) => <article key={product.id} className="border rounded-xl p-4 space-y-3">{product.images[0] && <img alt="" src={product.images[0].url} className="h-32 w-full object-contain"/>}<Link className="font-semibold block hover:underline" href={`/product/${product.slug}`}>{product.title}</Link><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={compared.some(p=>p.id===product.id)} disabled={compared.length>=3&&!compared.some(p=>p.id===product.id)} onChange={e=>setCompared(e.target.checked?[...compared,product]:compared.filter(p=>p.id!==product.id))}/>{t("So sánh thông số")}</label><p>{formatUSD(product.sale_price)} · {product.stock} {t(" còn hàng")}</p>{product.variants.length ? <select aria-label={`${t("Select SKU for")} ${product.title}`} className="border rounded p-2 w-full" value={parts.find(p => p.slot === slot && p.id === product.id)?.variantId || ''} onChange={e => { if(e.target.value) choose(product, e.target.value); }}><option value="">{t("Chọn SKU")}</option>{product.variants.map((v: any) => <option key={v.id} value={v.id} disabled={v.stock < 1}>{v.sku} · {formatUSD(v.price)} · {v.stock} {t(" còn hàng")}</option>)}</select> : <button className="border border-blue-600 text-blue-600 rounded p-2 w-full" onClick={() => choose(product)}>{t("Chọn")}{product.colors[0] || product.sizes[0] ? ` (${[product.colors[0], product.sizes[0]].filter(Boolean).join(' / ')})` : ''}</button>}</article>)}</div>
      {catalog.data?.length === 0 && <p>{t("Không có linh kiện phù hợp. Hãy đổi từ khóa.")}</p>}<div className="flex gap-4 mt-4"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>{t("Trước")}</button><span>{t("Trang ")}{page}</span><button disabled={!catalog.data || catalog.data.length < 12} onClick={() => setPage(p => p + 1)}>{t("Sau")}</button></div>
    </section><aside className="border rounded-xl p-5 space-y-4 h-fit"><h2 className="text-xl font-semibold">{t("Cấu hình đang chọn (")}{parts.length}/8)</h2>
      {parts.map(part => <div className="flex justify-between gap-3" key={part.slot}><span>{part.slot.toUpperCase()}: {quote.data?.parts?.find((p: any) => p.slot === part.slot)?.title || t('Đã chọn')}</span><button aria-label={`${t("Remove")} ${part.slot}`} onClick={() => setParts(parts.filter(p => p.slot !== part.slot))}>{t("Bỏ")}</button></div>)}
      {quote.isFetching && parts.length > 0 && <p>{t("Đang kiểm tra giá và tương thích…")}</p>}{quote.isError && <p role="alert">{(quote.error as any).response?.data?.message || t('Không kiểm tra được cấu hình.')}</p>}
      {parts.length > 0 && quote.data && <><p className="text-xl font-bold">{formatUSD(quote.data.total)}</p><ul className="space-y-2 text-sm">{quote.data.issues.map((issue: any, i: number) => <li key={i} className={issue.level === 'error' ? 'text-red-600' : 'text-amber-800'}>{t(issue.message)}</li>)}</ul></>}
      <button disabled={!parts.length || quote.isFetching || quote.isError || !quote.data?.canAddToCart} className="bg-blue-600 text-white rounded p-3 w-full disabled:opacity-40" onClick={addBuild}>{t("Thêm linh kiện vào giỏ")}</button>
      <div className="flex flex-wrap gap-3"><button disabled={!parts.length} onClick={() => { try { localStorage.setItem(savedKey, JSON.stringify(parts)); setMessage(t('Đã lưu cấu hình trên thiết bị cho tài khoản này.')); } catch { setMessage(t('Không lưu được cấu hình trên thiết bị.')); } }}>{t("Lưu cấu hình")}</button><button onClick={() => { try { setParts(validateSaved(JSON.parse(localStorage.getItem(savedKey) || '[]'))); setMessage(t('Đã mở cấu hình đã lưu.')); } catch { setMessage(t('Không đọc được cấu hình đã lưu.')); } }}>{t("Mở đã lưu")}</button><button disabled={!parts.length} onClick={share}>{t("Chia sẻ")}</button></div><Link className="block underline" href="/cart">{t("Mở giỏ hàng")}</Link><p role="status" className="break-words text-sm">{t(message)}</p>
    </aside></div>
  </main>;
}
