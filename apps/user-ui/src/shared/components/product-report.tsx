'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Flag } from 'lucide-react';
import { useLanguage } from '@packages/components/language-switcher';
import useUser from '../../hooks/useUser';
import axios from '../../utils/axioInstance';

export default function ProductReport({ productId }: { productId: string }) {
  const { user } = useUser(); const { language } = useLanguage(); const vi = language === 'vi';
  const [open, setOpen] = useState(false), [category, setCategory] = useState('Misleading'), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const t = (vn: string, en: string) => vi ? vn : en;
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { await axios.post(`/product/api/products/${productId}/report`, { category, reason }); setMessage(t('Đã tiếp nhận báo cáo. Ban quản trị sẽ kiểm tra nội dung.', 'Report received. The moderation team will review the listing.')); setReason(''); }
    catch (error: any) { setMessage(error.response?.data?.message || t('Không gửi được báo cáo. Hãy thử lại.', 'Could not submit your report. Please retry.')); }
    finally { setBusy(false); }
  };
  return <div className="mt-3 text-xs"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-rose-600"><Flag size={13} />{t('Báo cáo sản phẩm vi phạm', 'Report this listing')}</button>
    {open && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">{!user ? <Link className="font-medium text-blue-600" href="/login">{t('Đăng nhập để gửi báo cáo', 'Sign in to report this listing')}</Link> : <form onSubmit={send} className="space-y-3"><label className="block text-slate-600">{t('Lý do báo cáo', 'Report category')}<select className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-2.5" value={category} onChange={e => setCategory(e.target.value)}>{[['Prohibited', 'Hàng cấm'], ['Counterfeit', 'Hàng giả'], ['Misleading', 'Thông tin sai lệch / lừa đảo'], ['Unsafe', 'Không an toàn'], ['Other', 'Khác']].map(([key, label]) => <option key={key} value={key}>{vi ? label : key}</option>)}</select></label><label className="block text-slate-600">{t('Mô tả dấu hiệu vi phạm để ban quản trị kiểm tra', 'Describe the listing evidence for the moderation team')}<textarea required minLength={10} maxLength={2000} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3" value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={busy} className="rounded-lg bg-rose-600 px-4 py-2.5 font-medium text-white disabled:opacity-50">{busy ? '…' : t('Gửi báo cáo', 'Submit report')}</button></form>}{message && <p role="status" className="mt-3 leading-5 text-slate-700">{message}</p>}</div>}
  </div>;
}
