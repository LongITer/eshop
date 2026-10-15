'use client';
import { adminDate, useAdminText } from './admin-text';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@packages/components/language-switcher';
import { isSuspended } from '@packages/utils/admin-access';
import axios from '../utils/axioInstance';
import { EmptyState, ErrorState, LoadingState, money, PageHeading, Panel, StatusBadge } from './admin-ui';

type Mode = 'users' | 'sellers' | 'products' | 'events';
export default function CatalogManagement({ mode }: { mode: Mode }) {
  const statusLabel = useAdminText();
  const { language } = useLanguage(); const vi = language === 'vi'; const t = (a: string, b: string) => vi ? a : b;
  const titles = { users: t('Khách hàng', 'Customers'), sellers: t('Người bán', 'Sellers'), products: t('Sản phẩm', 'Products'), events: t('Khuyến mãi', 'Promotions') };
  const catalog = mode === 'products' || mode === 'events';
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [draft, setDraft] = useState(''), [role, setRole] = useState('all'), [status, setStatus] = useState('');
  const [selected, setSelected] = useState<any>(null), [reason, setReason] = useState(''), [until, setUntil] = useState(''), [exporting, setExporting] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null); const client = useQueryClient();
  const params = new URLSearchParams({ page: String(page), search, ...(mode === 'users' ? { role } : {}), ...(status ? { status } : {}) });
  const endpoint = `/admin/get-all-${mode}`;
  const query = useQuery({ queryKey: ['admin-catalog', mode, params.toString()], queryFn: async () => (await axios.get(`${endpoint}?${params}`)).data });
  const rows = query.data?.[mode] ?? [];
  const mutation = useMutation({ mutationFn: async () => catalog
    ? axios.patch(`/admin/products/${selected.id}/moderation`, { hidden: selected.status !== 'Suspended', reason })
    : axios.patch(`/admin/accounts/${mode}/${selected.id}`, { suspended: !isSuspended(selected), reason, until: until ? new Date(until).toISOString() : null }),
    onSuccess: () => { setSelected(null); client.invalidateQueries({ queryKey: ['admin-catalog'] }); client.invalidateQueries({ queryKey: ['admin-work'] }); },
  });
  useEffect(() => { if (selected) dialog.current?.showModal(); else dialog.current?.close(); }, [selected]);
  const select = (row: any) => { mutation.reset(); setReason(''); setUntil(''); setSelected(row); };
  const download = async () => {
    setExporting(true); setError('');
    try { const response = await axios.get(`${endpoint}?${params}&format=csv`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const a = document.createElement('a'); a.href = url; a.download = `${mode}.csv`; a.click(); URL.revokeObjectURL(url); }
    catch { setError(t('Không thể xuất dữ liệu. Vui lòng thử lại.', 'Export failed. Please retry.')); }
    finally { setExporting(false); }
  };
  return <div className="admin-page">
    <PageHeading title={titles[mode]} description={t('Tìm kiếm, kiểm tra và quản lý dữ liệu trên toàn sàn.', 'Search, review and manage marketplace records.')} action={<button className="admin-button" disabled={exporting || query.isLoading || query.isError} onClick={download}>{exporting ? t('Đang xuất…', 'Exporting…') : t('Xuất toàn bộ kết quả CSV', 'Export all matching results')}</button>} />
    {catalog && <nav className="flex gap-4 text-sm"><Link className="text-blue-400" href="/dashboard/products">{t('Sản phẩm', 'Products')}</Link><Link className="text-blue-400" href="/dashboard/events">{t('Khuyến mãi', 'Promotions')}</Link></nav>}
    <form className="admin-panel flex flex-wrap gap-3 p-4" onSubmit={e => { e.preventDefault(); setSearch(draft.trim()); setPage(1); }}>
      <input className="admin-control min-w-0 flex-1 basis-full sm:basis-60" aria-label={t('Tìm kiếm', 'Search')} placeholder={t('Nhập tên hoặc email…', 'Search by name or email…')} value={draft} onChange={e => setDraft(e.target.value)} />
      {mode === 'users' && <select className="admin-control !w-auto" aria-label="Role" value={role} onChange={e => { setRole(e.target.value); setPage(1); }}><option value="all">{t('Mọi vai trò', 'All roles')}</option><option value="user">{t('Khách hàng', 'Customer')}</option><option value="admin">Admin</option></select>}
      {catalog && <select className="admin-control !w-auto" aria-label="Status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">{t('Mọi trạng thái', 'All statuses')}</option>{['Active', 'Inactive', 'Draft', 'Suspended'].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</select>}
      <button className="admin-primary">{t('Tìm kiếm', 'Search')}</button>
    </form>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState retry={query.refetch} /> : <Panel title={t(`${query.data.total} kết quả`, `${query.data.total} results`)}>
      <div className="overflow-x-auto"><table className="admin-table"><thead><tr><th>{t('Tên', 'Name')}</th><th>{catalog ? t('Giá / Tồn kho', 'Price / Stock') : 'Email'}</th><th>{t('Thông tin', 'Details')}</th><th>{t('Trạng thái', 'Status')}</th><th>{t('Thao tác', 'Actions')}</th></tr></thead>
        <tbody>{rows.map((row: any) => <tr key={row.id}><td><p className="max-w-xs font-medium text-white">{row.title ?? row.name}</p>{row.shop?.name && <p className="mt-1 text-xs text-slate-400">{row.shop.name}</p>}</td><td>{catalog ? <>{money(row.sale_price)}<p className="text-xs text-slate-400">{row.stock} {t('sản phẩm', 'in stock')}</p></> : row.email}</td><td>{catalog ? <>{row.category}<p className="text-xs">★ {Number(row.rating ?? 0).toFixed(1)}</p>{mode === 'events' && <p className="text-xs">{adminDate(row.starting_date, false)} – {adminDate(row.ending_date, false)}</p>}</> : <>{row.role ?? row.country}<p className="text-xs">{row.phone_number}</p></>}</td><td><StatusBadge status={catalog ? row.isDeleted ? 'Deleted' : row.status : isSuspended(row) ? 'Suspended' : 'Active'} /></td><td><button className="text-blue-400" onClick={() => select(row)}>{t('Xem / xử lý', 'Review')}</button></td></tr>)}</tbody></table></div>
      {!rows.length && <EmptyState />}
    </Panel>}
    {query.data && <div className="flex items-center justify-between"><button className="admin-button" disabled={page <= 1 || query.isFetching} onClick={() => setPage(p => p - 1)}>{t('Trước', 'Previous')}</button><p>{page} / {query.data.totalPages}</p><button className="admin-button" disabled={page >= query.data.totalPages || query.isFetching} onClick={() => setPage(p => p + 1)}>{t('Sau', 'Next')}</button></div>}
    <dialog ref={dialog} onCancel={e => { if (mutation.isPending) e.preventDefault(); else setSelected(null); }} onClose={() => setSelected(null)} className="m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 p-6 text-white backdrop:bg-black/70" aria-labelledby="review-title">
      {selected && <><h2 id="review-title" className="mb-4 text-xl">{selected.title ?? selected.name}</h2>
        {catalog ? <><div className="mb-4 flex gap-2 overflow-x-auto">{selected.images?.map((img: any) => <img key={img.id} alt={selected.title} src={img.url} className="h-28 rounded object-contain" />)}</div><p>{selected.short_description}</p><p className="mt-3 text-sm text-slate-400">{selected.moderationReason}</p><Link className="mt-3 inline-block text-blue-400" href={`${process.env.NEXT_PUBLIC_USER_UI_URL || 'http://localhost:3000'}/product/${encodeURIComponent(selected.slug)}`} target="_blank" rel="noreferrer">{t('Xem trang bán hàng', 'Open storefront')}</Link></> : <><p>{selected.email}</p><p className="text-slate-400">{selected.suspensionReason}</p>{selected.suspendedUntil && <p>{t('Hết hạn', 'Expires')}: {adminDate(selected.suspendedUntil)}</p>}</>}
        {selected.role === 'admin' ? <p className="my-4 text-amber-300">{t('Đổi quyền admin tại Quản lý đội ngũ trước khi khóa tài khoản.', 'Revoke admin access in Team management before suspending this account.')}</p> : <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
          <label className="admin-label">{t('Lý do (bắt buộc)', 'Reason (required)')}<textarea className="admin-control" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
          {!catalog && !isSuspended(selected) && <label className="admin-label">{t('Khóa đến (để trống để khóa vô thời hạn)', 'Suspend until (blank for indefinite)')}<input className="admin-control" type="datetime-local" value={until} onChange={e => setUntil(e.target.value)} /></label>}
          {catalog && selected.status === 'Suspended' && <p className="text-sm text-amber-300">{t('Khôi phục về Inactive để người bán kiểm tra trước khi đăng lại.', 'Restore to Inactive so the seller can review before republishing.')}</p>}
          {mutation.isError && <p role="alert" className="text-red-400">{(mutation.error as any).response?.data?.message ?? 'Operation failed'}</p>}
          <button className="admin-primary" disabled={mutation.isPending || !reason.trim()}>{mutation.isPending ? '…' : catalog ? selected.status === 'Suspended' ? t('Khôi phục sản phẩm', 'Restore product') : t('Ẩn sản phẩm', 'Hide product') : isSuspended(selected) ? t('Mở khóa', 'Restore account') : t('Khóa tài khoản', 'Suspend account')}</button>
        </form>}
        <button className="admin-button mt-4" disabled={mutation.isPending} onClick={() => setSelected(null)}>{t('Đóng', 'Close')}</button>
      </>}
    </dialog>
  </div>;
}
