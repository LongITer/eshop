'use client';
import { useStorefrontText } from './storefront-language';
import { useState } from 'react';
import { RotateCcw, History, Clock3, ExternalLink } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
export default function OrderAftercare({ order, seller = false, api }: { order: any; seller?: boolean; api: any }) {
  const { t: customerText, locale } = useStorefrontText();
  const t = (text: string) => seller ? text : customerText(text);
  const statusLabel = t;
  const client = useQueryClient(); const [reason, setReason] = useState(''); const [evidence, setEvidence] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [appeal,setAppeal]=useState('');
  const query = useQuery({ queryKey: ['aftercare', seller, order.id], queryFn: async () => (await api.get(`/order/api/${seller ? 'seller-aftercare' : 'aftercare'}/${order.id}`)).data });
  const request = query.data?.request;
  async function submit(status?: string) {
    setBusy(true); setError('');
    try {
      if (seller) await api.patch(`/order/api/returns/${order.id}`, { status, sellerNote: reason });
      else await api.post(`/order/api/returns/${order.id}`, { reason, evidence: evidence.split('\n').map(s => s.trim()).filter(Boolean) });
      await client.invalidateQueries(); setReason('');
    } catch (err: any) { setError(err.response?.data?.message || t("Unable to update return request")); } finally { setBusy(false); }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const existing=evidence.split('\n').filter(Boolean); if(existing.length+files.length>5){setError(t('Tối đa 5 ảnh.'));return;}
    setBusy(true);setError('');const urls=[...existing];
    try { for(const file of Array.from(files)){if(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Ảnh PNG/JPEG/WebP tối đa 5 MB.');const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});urls.push((await api.post('/order/api/return-evidence/'+order.id,{file:encoded})).data.url);} }
    catch(e:any){setError(e.response?.data?.message||e.message||'Không tải được ảnh.');}finally{setEvidence(urls.join('\n'));setBusy(false);}
  }
  async function escalate(){setBusy(true);setError('');try{await api.post('/order/api/escalate-return/'+order.id,{reason:appeal});await query.refetch();setAppeal('');}catch(e:any){setError(e.response?.data?.message||'Không gửi được khiếu nại.');}finally{setBusy(false);}}
  const muted = seller ? 'text-slate-400' : 'text-slate-500';
  const panel = seller ? 'bg-slate-800/60 ring-white/10' : 'bg-white ring-slate-200/70';
  const field = `mt-2 block min-h-24 w-full rounded-xl border p-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 ${seller ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-800'}`;
  const button = 'rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
  return <section aria-label={t("Returns and order history")} className={`my-6 space-y-4 ${seller ? 'text-slate-100' : 'text-slate-800'}`}>
    <div className={`rounded-2xl p-5 shadow-sm ring-1 sm:p-6 ${panel}`}>
      <div className="mb-5 flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${seller ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-600'}`}><RotateCcw size={19} aria-hidden="true" /></span>
        <div><h2 className="text-base font-semibold">{t("Returns")}</h2><p className={`mt-0.5 text-sm ${muted}`}>{t("Return requests and updates from your shop")}</p></div>
      </div>
      {query.isLoading && <p className={`text-sm ${muted}`} role="status">{t("Loading return information…")}</p>}
      {query.isError && <p role="alert" className="text-sm text-rose-500">{t("Unable to load return information.")} <button className="font-medium underline underline-offset-4" onClick={() => query.refetch()}>{t("Retry")}</button></p>}
      {request && <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3"><span className={muted}>{t("Return status")}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${request.status === 'Rejected' ? 'bg-rose-500/10 text-rose-500' : request.status === 'Requested' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>{statusLabel(request.status)}</span></div>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{request.reason}</p>
        {!seller && request.status === 'Rejected' && !request.escalatedAt && <form className="space-y-3" onSubmit={e=>{e.preventDefault();escalate();}}><label>{t("Lý do yêu cầu admin xem xét")}<textarea required maxLength={2000} className={field} value={appeal} onChange={e=>setAppeal(e.target.value)}/></label><button className={button} disabled={busy||!appeal.trim()}>{t("Gửi khiếu nại tới admin")}</button></form>}{request.status === 'Escalated' && <p>{t("Đã gửi khiếu nại. Admin đang chờ xem xét.")}</p>}{order.paymentStatus === 'Refunded' && <p>{t("Đã hoàn tiền về phương thức thanh toán ban đầu.")}</p>}{order.refundState && <p>{t("Trạng thái hoàn tiền: ")}{statusLabel(order.refundState)}</p>}{request.sellerNote && <div className={`rounded-xl p-3 ${seller ? 'bg-slate-900/60' : 'bg-slate-50'}`}><p className={`mb-1 text-xs font-medium ${muted}`}>{t("Seller response")}</p><p className="whitespace-pre-wrap break-words">{request.sellerNote}</p></div>}
        <div className="flex flex-wrap gap-3">{request.evidence?.map((url: string, i: number) => <a className="inline-flex items-center gap-1.5 font-medium text-blue-500 hover:underline" key={url} href={url} target="_blank" rel="noopener noreferrer">{t("Evidence")} {i + 1}<ExternalLink size={13} aria-hidden="true" /></a>)}</div>
        {request.status === 'Received' && <p className={muted}>{t("Returned goods received. Refund processing is handled by the administrator.")}</p>}
      </div>}
      {!query.isLoading && !query.isError && !request && (seller || order.status !== 'Delivered' || order.paymentStatus !== 'Paid') && <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${seller ? 'bg-slate-900/50 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>{t("No return request for this order.")}{!seller && t(" Returns become available after a paid order is delivered.")}</div>}
      {!seller && order.status === 'Delivered' && order.paymentStatus === 'Paid' && !query.isLoading && !query.isError && !request && <form onSubmit={e => { e.preventDefault(); submit(); }} className="space-y-4">
        <label className="block text-sm font-medium">{t("Reason for returning this order")}<textarea className={field} placeholder={t("Tell us what went wrong…")} required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <label className="block text-sm font-medium">{t("Ảnh bằng chứng (tối đa 5 ảnh)")}<input type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>{upload(e.target.files);e.target.value='';}} className="mt-2 block w-full"/></label><label className="block text-sm font-medium">{t("Evidence links")} <span className={`font-normal ${muted}`}>{t("(optional)")}</span><textarea className={field} placeholder="https://…" value={evidence} onChange={e => setEvidence(e.target.value)} /><span className={`mt-1.5 block text-xs font-normal ${muted}`}>{t("HTTPS links, one per line. Up to 5 links.")}</span></label>
        <button disabled={busy} className={button}>{busy ? t("Submitting…") : t("Request return")}</button>
      </form>}
      {seller && request && ['Requested', 'Approved'].includes(request.status) && <div className="mt-4 space-y-4"><label className="block text-sm font-medium">Response / return instructions<textarea maxLength={2000} className={field} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="flex flex-wrap gap-2">{(request.status === 'Requested' ? ['Approved', 'Rejected'] : ['Received']).map(status => <button key={status} disabled={busy || !reason.trim()} className={status === 'Rejected' ? 'rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/20 disabled:opacity-50' : button} onClick={() => submit(status)}>{status === 'Received' ? 'Confirm goods received' : status === 'Approved' ? 'Approve return' : 'Reject return'}</button>)}</div><p className={`text-xs ${muted}`}>Returned goods are inspected before stock is adjusted in inventory.</p></div>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-500">{t(error)}</p>}
    </div>
    <div className={`rounded-2xl p-5 shadow-sm ring-1 sm:p-6 ${panel}`}>
      <div className="mb-5 flex items-center gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${seller ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><History size={19} aria-hidden="true" /></span><div><h2 className="text-base font-semibold">{t("Order history")}</h2><p className={`mt-0.5 text-sm ${muted}`}>{t("Updates throughout your order")}</p></div></div>
      <ol>{query.data?.events?.map((event: any, index: number, events: any[]) => <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
        {index < events.length - 1 && <span aria-hidden="true" className={`absolute bottom-0 left-[13px] top-7 w-px ${seller ? 'bg-slate-700' : 'bg-slate-200'}`} />}
        <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${seller ? 'bg-slate-700 text-slate-300' : 'bg-blue-50 text-blue-500'}`}><Clock3 size={14} aria-hidden="true" /></span>
        <div className="min-w-0 pt-0.5"><p className="text-sm font-medium">{statusLabel(event.from || "")} <span className={muted}>→</span> {statusLabel(event.to || "")}</p><time className={`mt-1 block text-xs ${muted}`} dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString(seller ? undefined : locale)}</time>{event.reason && <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed ${muted}`}>{event.reason}</p>}</div>
      </li>)}</ol>
      {query.isLoading && <p className={`text-sm ${muted}`}>{t("Loading history…")}</p>}
      {query.isError && <p className={`text-sm ${muted}`}>{t("Order history is currently unavailable.")}</p>}
      {!query.isLoading && !query.isError && !query.data?.events?.length && <p className={`text-sm ${muted}`}>{t("No order updates yet.")}</p>}
    </div>
  </section>;
}
