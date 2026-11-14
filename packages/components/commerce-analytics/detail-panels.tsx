'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';
import Link from 'next/link';
import { Download, X } from 'lucide-react';
import type { ProductAnalyticsDetail, CustomerAnalyticsDetail } from '../../utils/commerce-analytics';
import { formatUSD } from '../../utils/money';
import { AnalyticsChart, AnalyticsEmpty, AnalyticsPanel, MetricCard, analyticsButton, useAnalyticsText } from './analytics-ui';

export function AnalyticsDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), { t } = useAnalyticsText();
  useEffect(() => { if (!ref.current?.open) ref.current?.showModal(); }, []);
  return <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }} className="m-auto max-h-[90dvh] w-[min(1120px,95vw)] overflow-y-auto rounded-2xl border border-slate-700 bg-[#0b1120] p-0 text-slate-100 shadow-2xl backdrop:bg-black/70"><div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0b1120] p-5"><h2 className="text-lg font-semibold">{title}</h2><button type="button" className={analyticsButton} aria-label={t('Close details', 'Đóng chi tiết')} onClick={onClose}><X size={17} /></button></div><div className="space-y-5 p-4 sm:p-6">{children}</div></dialog>;
}
export function ProductDetailPanel({ id, name, scope, client, endpoint, params, onClose }: { id: string; name: string; scope: string; client: AxiosInstance; endpoint: string; params: Record<string, unknown>; onClose: () => void }) {
  const { t, count, date } = useAnalyticsText();
  const query = useQuery<ProductAnalyticsDetail>({ queryKey: ['product-analytics-detail', scope, id, params], queryFn: async ({ signal }) => (await client.get(`${endpoint}/products/${id}`, { params, signal })).data });
  const data = query.data;
  return <AnalyticsDialog title={name} onClose={onClose}>
    {query.isLoading && <p role="status" className="p-6 text-slate-400">{t('Loading product analysis…', 'Đang phân tích sản phẩm…')}</p>}
    {query.isError && <p role="alert" className="rounded-xl bg-rose-500/10 p-5 text-sm text-rose-300">{t('Could not load this product for the selected shop and period.', 'Không tải được sản phẩm trong phạm vi shop và khoảng thời gian đã chọn.')} <button type="button" className="underline" onClick={() => query.refetch()}>{t('Retry', 'Thử lại')}</button></p>}
    {data && <>
      <p className="text-xs text-slate-500">{data.product.shopName} · {data.product.category} · {t('Last sale', 'Bán gần nhất')}: {date(data.product.lastSaleAt)}</p>
      <div className="grid gap-3 sm:grid-cols-3"><MetricCard label={t('Net product sales', 'Tiền hàng thuần')} value={formatUSD(data.product.netSales)} /><MetricCard label={t('Units sold', 'Số lượng bán')} value={count(data.product.units)} /><MetricCard label={t('Available stock', 'Tồn khả dụng')} value={count(data.product.availableStock)} note={data.product.coverageDays === null ? t('No sales velocity estimate', 'Chưa đủ dữ liệu tốc độ bán') : `${count(data.product.coverageDays)} ${t('estimated days of cover', 'ngày dự kiến đủ bán')}`} /></div>
      <AnalyticsPanel title={t('Sales trend for this product', 'Xu hướng bán của sản phẩm')}><AnalyticsChart rows={data.timeline} fields={[{ key: 'netSales', label: t('Net product sales', 'Tiền hàng thuần'), color: '#60a5fa' }]} title={t('Product sales over time', 'Tiền hàng sản phẩm theo thời gian')} /></AnalyticsPanel>
      <AnalyticsPanel title={t('SKU / configuration performance', 'Hiệu quả từng SKU / phiên bản')} description={t('Historical selling prices and allocated order discounts. Zero-sale and retired SKUs remain visible.', 'Dùng giá bán lịch sử và giảm giá đã phân bổ. Bao gồm cả SKU chưa bán và SKU ngừng bán.')}>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-950/50 text-slate-500"><tr>{[t('SKU / options', 'SKU / tùy chọn'), t('State', 'Trạng thái'), t('Units', 'Số lượng'), t('Gross sales', 'Trước giảm'), t('Discount', 'Giảm giá'), t('Net sales', 'Sau giảm'), t('Recorded stock', 'Tồn ghi nhận')].map(label => <th key={label} scope="col" className="p-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{data.variants.map(row => <tr key={row.id}><td className="p-4"><p className="font-medium text-slate-200">{row.sku}</p><p className="mt-1 text-slate-500">{[row.color, row.size].filter(Boolean).join(' / ')}</p></td><td className={`p-4 ${row.active ? 'text-emerald-400' : 'text-slate-500'}`}>{row.active ? t('Active', 'Đang bán') : t('Retired / unavailable', 'Ngừng bán / không còn')}</td><td className="p-4 tabular-nums">{count(row.units)}</td><td className="whitespace-nowrap p-4 tabular-nums">{formatUSD(row.grossSales)}</td><td className="whitespace-nowrap p-4 tabular-nums">{formatUSD(row.discounts)}</td><td className="whitespace-nowrap p-4 tabular-nums text-blue-300">{formatUSD(row.netSales)}</td><td className="p-4 tabular-nums">{row.stock === null ? '—' : count(row.stock)}</td></tr>)}</tbody></table></div>
      </AnalyticsPanel>
      <AnalyticsPanel title={t('Recorded engagement · all time', 'Tương tác đã ghi nhận · toàn thời gian')} description={t('These are event counters, not unique visitors or a conversion rate for the selected period.', 'Đây là bộ đếm sự kiện, không phải người xem duy nhất hoặc tỷ lệ chuyển đổi của khoảng ngày đang chọn.')}><div className="grid gap-4 p-5 sm:grid-cols-4">{[[t('Views', 'Lượt xem'), count(data.engagement.views)], [t('Cart additions', 'Lượt thêm giỏ'), count(data.engagement.cartAdds)], [t('Wishlist additions', 'Lượt yêu thích'), count(data.engagement.wishListAdds)], [t('Reviews / average', 'Đánh giá / trung bình'), `${count(data.engagement.reviews)} · ${data.engagement.averageRating === null ? '—' : count(data.engagement.averageRating) + '/5'}`]].map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></div>)}</div></AnalyticsPanel>
    </>}
  </AnalyticsDialog>;
}
export function CustomerDetailPanel({ id, name, scope, client, endpoint, params, onClose }: { id: string; name: string; scope: string; client: AxiosInstance; endpoint: string; params: Record<string, unknown>; onClose: () => void }) {
  const { t, count, date } = useAnalyticsText();
  const [page, setPage] = useState(1), [exporting, setExporting] = useState(false), [exportError, setExportError] = useState(false);
  const mounted = useRef(true), controller = useRef<AbortController | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  const query = useQuery<CustomerAnalyticsDetail>({ queryKey: ['customer-analytics-detail', scope, id, params, page], queryFn: async ({ signal }) => (await client.get(`${endpoint}/customers/${id}`, { params: { ...params, page, limit: 10 }, signal })).data });
  const data = query.data;
  const download = async () => {
    const current = new AbortController(); controller.current = current; setExporting(true); setExportError(false);
    try {
      const result = await client.get(`${endpoint}/customers/${id}`, { params: { ...params, format: 'csv' }, responseType: 'blob', signal: current.signal });
      if (!mounted.current || current.signal.aborted) return;
      const url = URL.createObjectURL(new Blob(['\uFEFF', result.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'customer-product-statistics.csv'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (mounted.current && !current.signal.aborted) setExportError(true); }
    finally { if (mounted.current && !current.signal.aborted) setExporting(false); }
  };
  return <AnalyticsDialog title={name} onClose={onClose}>
    {query.isLoading && <p role="status" className="p-6 text-slate-400">{t('Loading customer purchases…', 'Đang tải lịch sử mua…')}</p>}
    {query.isError && <p role="alert" className="rounded-xl bg-rose-500/10 p-5 text-sm text-rose-300">{t('This customer is unavailable in your shop.', 'Không tải được người mua trong phạm vi shop của bạn.')} <button type="button" className="underline" onClick={() => query.refetch()}>{t('Retry', 'Thử lại')}</button></p>}
    {data && <>
      <p className="text-sm text-slate-400">{data.customer.email}</p>
      <div className="grid gap-3 sm:grid-cols-4"><MetricCard label={t('Spent in period', 'Chi tiêu trong kỳ')} value={formatUSD(data.summary.totalSpent)} /><MetricCard label={t('Paid orders in period', 'Đơn đã trả tiền trong kỳ')} value={count(data.summary.orders)} /><MetricCard label={t('Units in period', 'Số lượng mua trong kỳ')} value={count(data.summary.units)} /><MetricCard label={t('Average order', 'Trung bình mỗi đơn')} value={formatUSD(data.summary.averageOrderValue)} /></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-5 text-xs leading-6 text-slate-400"><strong className="text-slate-200">{t('Lifetime in your shop', 'Toàn thời gian tại shop của bạn')}</strong><p>{count(data.lifetime.orders)} {t('paid orders', 'đơn đã thanh toán')} · {count(data.lifetime.units)} {t('units', 'sản phẩm')} · {count(data.lifetime.products)} {t('distinct products', 'loại sản phẩm')} · {formatUSD(data.lifetime.totalSpent)}</p><p>{t('First purchase', 'Mua lần đầu')}: {date(data.lifetime.firstPurchase)} · {t('Latest purchase', 'Mua gần nhất')}: {date(data.lifetime.lastPurchase)}</p></div>
      <AnalyticsPanel title={t('Customer spending trend', 'Xu hướng chi tiêu của khách')} description={t('Includes shipping, after order discounts; excludes cancelled, returned and refunded purchases.', 'Gồm phí giao hàng, đã trừ giảm giá; loại đơn hủy, trả hàng và hoàn tiền.')}><AnalyticsChart rows={data.timeline} fields={[{ key: 'amount', label: t('Spent', 'Chi tiêu'), color: '#60a5fa' }]} title={t('Customer spending over time', 'Chi tiêu của khách theo thời gian')} /></AnalyticsPanel>
      <AnalyticsPanel title={t('Products purchased in the period', 'Sản phẩm đã mua trong kỳ')} action={<button type="button" className={analyticsButton} disabled={exporting} onClick={download}><Download size={14} />{exporting ? '…' : t('Export products', 'Xuất sản phẩm đã mua')}</button>} description={t('Product amounts are before order-level discounts and exclude shipping.', 'Giá trị sản phẩm trước giảm giá cấp đơn, không gồm phí giao hàng.')}>
        {exportError && <p role="alert" className="p-4 text-xs text-rose-300">{t('Export failed. Please retry.', 'Xuất dữ liệu thất bại. Vui lòng thử lại.')}</p>}
        {data.products.length ? <div className="max-h-72 overflow-auto"><table className="w-full min-w-[500px] text-left text-xs"><thead className="sticky top-0 bg-slate-900 text-slate-500"><tr>{[t('Product', 'Sản phẩm'), t('Paid orders', 'Số đơn'), t('Units', 'Số lượng'), t('Gross product spending', 'Tiền hàng trước giảm')].map(label => <th scope="col" key={label} className="p-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{data.products.map(row => <tr key={row.id}><td className="p-4 font-medium">{row.name}</td><td className="p-4 tabular-nums">{count(row.orders)}</td><td className="p-4 tabular-nums">{count(row.units)}</td><td className="p-4 tabular-nums text-blue-300">{formatUSD(row.grossSales)}</td></tr>)}</tbody></table></div> : <AnalyticsEmpty />}
      </AnalyticsPanel>
      <AnalyticsPanel title={t('Purchase history in this shop', 'Lịch sử mua tại shop')}>
        {data.purchases.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className="bg-slate-950/50 text-slate-500"><tr>{[t('Order', 'Đơn hàng'), t('Date', 'Ngày mua'), t('Items', 'Hàng đã mua'), t('Status', 'Trạng thái'), t('Paid amount', 'Số tiền đã trả')].map(label => <th scope="col" key={label} className="p-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{data.purchases.map(order => <tr key={order.id}><td className="p-4"><Link href={`/dashboard/orders/${order.id}`} className="font-medium text-blue-300 hover:underline">{order.orderNumber}</Link></td><td className="whitespace-nowrap p-4 text-slate-400">{date(order.createdAt)}</td><td className="max-w-72 p-4 text-slate-400">{order.items.map((item, index) => <p key={index} className="line-clamp-2">{item.title} × {count(item.quantity)}</p>)}</td><td className="p-4 text-slate-400">{order.status}</td><td className="whitespace-nowrap p-4 font-medium tabular-nums">{formatUSD(order.totalAmount)}</td></tr>)}</tbody></table></div> : <AnalyticsEmpty />}
        <div className="flex items-center justify-between border-t border-slate-800 p-4 text-xs text-slate-400"><button type="button" className={analyticsButton} disabled={page === 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>← {t('Previous', 'Trước')}</button><span>{page} / {data.pagination.totalPages}</span><button type="button" className={analyticsButton} disabled={page >= data.pagination.totalPages || query.isFetching} onClick={() => setPage(value => value + 1)}>{t('Next', 'Sau')} →</button></div>
      </AnalyticsPanel>
    </>}
  </AnalyticsDialog>;
}
