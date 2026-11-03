'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import { BarChart3, ChevronLeft, ChevronRight, Download, RefreshCw, Search, ShoppingBag, Users } from 'lucide-react';
import { useLanguage } from './language-switcher';
import type { StatisticsKind, StatisticsReport } from '../utils/commerce-statistics';
import { formatUSD } from '../utils/money';

const control = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400';
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40';
const initial = { period: 'all', from: '', to: '', q: '', sort: 'amount' };

export default function CommerceStatistics({ client, endpoint, scope, enabled, admin = false, extraFilters, shopId }: {
  client: AxiosInstance; endpoint: string; scope: string; enabled: boolean;
  admin?: boolean; extraFilters?: ReactNode; shopId?: string;
}) {
  const { language } = useLanguage();
  const vi = language === 'vi';
  const text = (en: string, vn: string) => vi ? vn : en;
  const [kind, setKind] = useState<StatisticsKind>(admin ? 'products' : 'customers');
  const [draft, setDraft] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const exportController = useRef<AbortController | null>(null);
  const params = { kind, q: filters.q, sort: filters.sort, page, limit: 20,
    ...(filters.period === 'custom' ? { from: filters.from, to: filters.to } : {}), ...(shopId ? { shopId } : {}) };
  const requestKey = JSON.stringify([scope, params]);
  const currentRequest = useRef(requestKey);
  currentRequest.current = requestKey;
  useEffect(() => { setPage(1); }, [shopId]);
  useEffect(() => {
    exportController.current?.abort(); setExporting(false); setExportError(false);
    return () => exportController.current?.abort();
  }, [requestKey]);
  const query = useQuery<StatisticsReport>({
    queryKey: ['commerce-statistics', scope, params], enabled,
    queryFn: async ({ signal }) => (await client.get(endpoint, { params, signal })).data,
    staleTime: 30000,
  });
  const data = query.data;
  useEffect(() => { if (data && page > data.pagination.totalPages) setPage(data.pagination.totalPages); }, [data?.pagination.totalPages, page]);
  const date = (value: string) => new Date(value).toLocaleDateString(vi ? 'vi-VN' : 'en-US', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: 'short', year: 'numeric' });
  async function download() {
    const controller = new AbortController();
    exportController.current = controller;
    const key = requestKey;
    setExporting(true); setExportError(false);
    try {
      const result = await client.get(endpoint, { params: { ...params, format: 'csv' }, responseType: 'blob', signal: controller.signal });
      if (controller.signal.aborted || currentRequest.current !== key) return;
      const url = URL.createObjectURL(new Blob(['\uFEFF', result.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = `${admin ? 'admin' : 'seller'}-${kind}-statistics.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (!controller.signal.aborted && currentRequest.current === key) setExportError(true); }
    finally { if (!controller.signal.aborted && currentRequest.current === key) setExporting(false); }
  }
  const rawColumns = kind === 'customers'
    ? [text('Customer', 'Người mua'), text('Paid orders', 'Đơn đã thanh toán'), text('Units purchased', 'Số lượng đã mua'), text('Distinct products', 'Sản phẩm khác nhau'), text('Total spent', 'Tổng tiền đã mua'), text('Average order', 'TB mỗi đơn'), text('Last purchase', 'Lần mua gần nhất')]
    : [text('Product', 'Sản phẩm'), text('Paid orders', 'Đơn đã thanh toán'), text('Units sold', 'Số lượng đã bán'), text('Unique buyers', 'Người mua khác nhau'), text('Gross product sales', 'Tiền hàng trước giảm giá'), text('Average unit price', 'Giá bán TB'), text('Current stock', 'Tồn kho hiện tại'), text('Last sale', 'Lần bán gần nhất')];
  const columns = admin ? rawColumns.filter((_, index) => index !== 1 && index !== 3) : rawColumns;
  const cards = data ? admin ? [[text('Gross product sales', 'Tiền hàng trước giảm giá'), formatUSD(data.summary.productSales)], [text('Units sold', 'Số lượng đã bán'), data.summary.units.toLocaleString()], [text('Products sold', 'Sản phẩm đã bán'), data.summary.products.toLocaleString()]] : [
    [text('Total spent', 'Tổng tiền đã mua'), formatUSD(data.summary.totalSpent)],
    [text('Paid orders', 'Đơn đã thanh toán'), data.summary.orders.toLocaleString()],
    [text('Units purchased', 'Số lượng đã mua'), data.summary.units.toLocaleString()],
    [text('Buying customers', 'Khách đã mua'), data.summary.customers.toLocaleString()],
    [text('Products sold', 'Sản phẩm đã bán'), data.summary.products.toLocaleString()],
    [text('Average order value', 'Giá trị đơn trung bình'), formatUSD(data.summary.averageOrderValue)],
  ] : [];

  return <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 text-slate-100 sm:p-6 xl:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-400">{text('Sales analytics', 'Phân tích bán hàng')}</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{admin ? text('Product statistics', 'Thống kê sản phẩm') : text('Customer & product statistics', 'Thống kê người mua & sản phẩm')}</h1><p className="mt-2 text-sm text-slate-400">{admin ? text('Purchase activity across the marketplace.', 'Hoạt động mua hàng trên toàn hệ thống.') : text('Purchase activity in your shop only.', 'Chỉ tính hoạt động mua hàng tại cửa hàng của bạn.')}</p></div><div className="flex gap-2"><button type="button" className={button} disabled={!enabled || query.isFetching} onClick={() => query.refetch()}><RefreshCw size={15} />{text('Refresh', 'Làm mới')}</button><button type="button" className={button} disabled={!data || query.isFetching || exporting} onClick={download}><Download size={15} />{exporting ? text('Exporting…', 'Đang xuất…') : text('Export CSV', 'Xuất CSV')}</button></div></header>
    <form className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5" onSubmit={event => { event.preventDefault(); setFilters({ ...draft, q: draft.q.trim() }); setPage(1); }}>
      <label className="min-w-40 flex-1 text-xs text-slate-400">{text('Reporting period', 'Thời gian thống kê')}<select className={control} value={draft.period} onChange={e => setDraft({ ...draft, period: e.target.value })}><option value="all">{text('All time', 'Từ trước đến nay')}</option><option value="custom">{text('Custom dates', 'Chọn khoảng ngày')}</option></select></label>
      {draft.period === 'custom' && <><label className="text-xs text-slate-400">{text('From', 'Từ ngày')}<input className={control} required type="date" min="0001-01-01" max={draft.to || '9999-12-31'} value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} /></label><label className="text-xs text-slate-400">{text('To', 'Đến ngày')}<input className={control} required type="date" min={draft.from || '0001-01-01'} max="9999-12-31" value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} /></label></>}
      <label className="min-w-48 flex-1 text-xs text-slate-400">{admin ? text('Search product or shop', 'Tìm sản phẩm hoặc cửa hàng') : text('Search name, email or product', 'Tìm tên, email hoặc sản phẩm')}<input className={control} maxLength={200} value={draft.q} onChange={e => setDraft({ ...draft, q: e.target.value })} /></label>
      <label className="text-xs text-slate-400">{text('Sort descending by', 'Sắp xếp giảm dần theo')}<select className={control} value={draft.sort} onChange={e => setDraft({ ...draft, sort: e.target.value })}><option value="amount">{text('Amount', 'Số tiền')}</option><option value="units">{text('Quantity', 'Số lượng')}</option>{!admin && <option value="orders">{text('Orders', 'Số đơn')}</option>}<option value="lastPurchasedAt">{text('Latest purchase', 'Mua gần nhất')}</option></select></label>
      {extraFilters}<button type="submit" className={`${button} bg-blue-600 !text-white hover:bg-blue-500`}><Search size={15} />{text('Apply', 'Áp dụng')}</button><button type="button" className={button} onClick={() => { setDraft(initial); setFilters(initial); setPage(1); }}>{text('Reset', 'Đặt lại')}</button>
    </form>
    <div className="space-y-2 text-xs leading-6 text-slate-400"><p>{text('USD · Vietnam time (UTC+7). Paid orders only; cancelled, returned and refunded orders are excluded. Custom periods support up to 366 days.', 'USD · Giờ Việt Nam (UTC+7). Chỉ tính đơn đã thanh toán; loại đơn hủy, trả hàng và hoàn tiền. Khoảng ngày tùy chọn tối đa 366 ngày.')}</p><p>{admin ? text('Aggregated product totals only. Customer identities and order records are not available to administrators.', 'Chỉ hiển thị số liệu tổng hợp sản phẩm. Admin không được truy cập danh tính người mua hoặc chi tiết đơn hàng.') : text('Customer spending includes shipping and order discounts. Product sales use line totals before order discounts, excluding shipping. Only customers and products with qualifying purchases appear.', 'Tiền khách mua gồm phí giao hàng và đã trừ giảm giá đơn. Tiền hàng sản phẩm tính trước giảm giá cấp đơn, không gồm phí giao hàng. Chỉ hiển thị người mua và sản phẩm có giao dịch đủ điều kiện.')}</p><p className="font-medium text-slate-300">{filters.period === 'all' ? text('Showing all time', 'Đang xem: từ trước đến nay') : `${date(`${filters.from}T00:00:00+07:00`)} – ${date(`${filters.to}T00:00:00+07:00`)}`}{data && <> · {text('Updated', 'Cập nhật')} {date(data.asOf)}</>}</p></div>
    {exportError && <p role="alert" className="text-sm text-rose-300">{text('Export failed. Please try again.', 'Xuất dữ liệu thất bại. Vui lòng thử lại.')}</p>}
    {(query.isLoading || !enabled) && <div role="status" aria-label={text('Loading statistics', 'Đang tải thống kê')} className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-28 rounded-2xl border border-slate-800 bg-slate-900" />)}</div>}
    {query.isError && <div role="alert" className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6"><p>{text('Statistics could not be loaded. Check your reporting dates and try again.', 'Không tải được thống kê. Kiểm tra khoảng ngày và thử lại.')}</p><button type="button" className={`${button} mt-4`} onClick={() => query.refetch()}>{text('Retry', 'Thử lại')}</button></div>}
    {data && !query.isError && <>
      <section aria-label={text('Period totals', 'Tổng số liệu trong kỳ')} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><p className="text-xs text-slate-400">{label}</p><p className="mt-3 break-words text-2xl font-semibold tabular-nums">{value}</p></div>)}</section>
      <p className="text-xs text-slate-500">{text('Summary totals use the period and shop filters; the search only filters the table. CSV exports all matching rows, across all pages.', 'Các thẻ tổng quan tính theo kỳ và cửa hàng; tìm kiếm chỉ lọc bảng. CSV xuất mọi dòng phù hợp trên tất cả các trang.')}</p>
    </>}
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4"><div role="group" aria-label={text('Statistics breakdown', 'Phân loại thống kê')} className="flex flex-wrap gap-2">{(admin ? ['products'] as const : ['customers', 'products'] as const).map(value => <button key={value} id={`statistics-tab-${value}`} aria-pressed={kind === value} aria-controls="statistics-table" type="button" className={`${button} ${kind === value ? 'border-blue-500/40 bg-blue-500/10 !text-blue-300' : ''}`} onClick={() => { setKind(value); setPage(1); }}>{value === 'customers' ? <Users size={16} /> : <ShoppingBag size={16} />}{value === 'customers' ? text('Customers', 'Người mua') : text('Products', 'Sản phẩm')}</button>)}</div><span className="text-xs text-slate-400">{data?.pagination.total ?? 0} {text('results', 'kết quả')}</span></div>
      <div id="statistics-table" aria-labelledby={`statistics-tab-${kind}`} aria-busy={query.isFetching}>
        {data && !query.isError && (data.rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-slate-950/40 text-slate-400"><tr>{columns.map((label, index) => <th key={label} scope="col" className={`px-5 py-4 font-medium ${index ? 'text-right' : ''}`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{data.rows.map(row => <tr key={row.id} className="hover:bg-slate-800/30"><td className="max-w-72 px-5 py-4"><p className="break-words text-sm font-medium text-slate-200">{row.name}</p>{row.email && <p className="mt-1 break-all text-slate-500">{row.email}</p>}{admin && row.shopName && <p className="mt-1 text-slate-500">{row.shopName}</p>}</td>{!admin && <td className="px-5 py-4 text-right tabular-nums">{row.orders.toLocaleString()}</td>}<td className="px-5 py-4 text-right tabular-nums">{row.units.toLocaleString()}</td>{!admin && <td className="px-5 py-4 text-right tabular-nums">{row.distinctCount.toLocaleString()}</td>}<td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-blue-300">{formatUSD(row.amount)}</td><td className="whitespace-nowrap px-5 py-4 text-right tabular-nums">{formatUSD(row.average)}</td>{kind === 'products' && <td className="px-5 py-4 text-right tabular-nums">{row.stock?.toLocaleString() ?? '—'}</td>}<td className="whitespace-nowrap px-5 py-4 text-right text-slate-400">{date(row.lastPurchasedAt)}</td></tr>)}</tbody></table></div> : <div className="p-12 text-center"><BarChart3 size={32} className="mx-auto mb-4 text-slate-600" /><p className="text-sm text-slate-300">{text('No matching purchases', 'Chưa có giao dịch phù hợp')}</p><p className="mt-2 text-xs text-slate-500">{text('Try another period or clear the search.', 'Thử khoảng thời gian khác hoặc bỏ từ khóa tìm kiếm.')}</p></div>)}
      </div>
      {data && !query.isError && <nav aria-label={text('Statistics pages', 'Trang thống kê')} className="flex items-center justify-between gap-3 border-t border-slate-800 p-4"><button type="button" className={button} disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} />{text('Previous', 'Trước')}</button><span className="text-xs text-slate-400">{text('Page', 'Trang')} {page} / {data.pagination.totalPages}</span><button type="button" className={button} disabled={page >= data.pagination.totalPages || query.isFetching} onClick={() => setPage(value => value + 1)}>{text('Next', 'Sau')}<ChevronRight size={16} /></button></nav>}
    </section>
  </div>;
}
