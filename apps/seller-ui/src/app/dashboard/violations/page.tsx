'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@packages/components/language-switcher';
import useSeller from '../../../hooks/useSeller';
import axios from '../../../utils/axioInstance';

export default function SellerViolationsPage() {
  const { seller } = useSeller(), { language } = useLanguage(), vi = language === 'vi';
  const t = (vn: string, en: string) => vi ? vn : en;
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [status, setStatus] = useState('Pending');
  const [selected, setSelected] = useState<any>(null);
  const [resolution, setResolution] = useState('');
  const [message, setMessage] = useState('');
  const [unsuspendReason, setUnsuspendReason] = useState('');
  const [unsuspendMessage, setUnsuspendMessage] = useState('');

  const history = useQuery({
    queryKey: ['seller-violations', seller?.id, historyPage],
    enabled: !!seller?.id,
    queryFn: async ({ signal }) => (await axios.get('/product/api/seller-violations', { params: { page: historyPage, limit: 20 }, signal })).data
  });
  const tasks = useQuery({
    queryKey: ['seller-moderation-tasks', seller?.id, page, status],
    enabled: !!seller?.id,
    queryFn: async ({ signal }) => (await axios.get('/product/api/seller-moderation-tasks', { params: { page, limit: 20, status }, signal })).data
  });
  const unsuspendStatus = useQuery({
    queryKey: ['seller-unsuspend-status', seller?.id],
    enabled: !!seller?.id,
    queryFn: async ({ signal }) => (await axios.get('/product/api/seller-unsuspend-status', { signal })).data
  });

  const refresh = () => {
    client.invalidateQueries({ queryKey: ['seller-moderation-tasks'] });
    client.invalidateQueries({ queryKey: ['seller-orders'] });
    client.invalidateQueries({ queryKey: ['seller-payments'] });
    client.invalidateQueries({ queryKey: ['seller-unsuspend-status'] });
  };

  const action = useMutation({
    mutationFn: async (kind: string) => {
      if (kind === 'cancel') return (await axios.patch(`/order/update-order-status/${selected.orderId}`, { status: 'Cancelled', reason: resolution })).data;
      if (kind === 'refund') return (await axios.post(`/order/seller-refund/${selected.orderId}`, { reason: resolution })).data;
      return (await axios.patch(`/product/api/seller-moderation-tasks/${selected.id}`, { resolution })).data;
    },
    onSuccess: (result, kind) => {
      setMessage(kind === 'refund' && result.status !== 'succeeded'
        ? t('Đã gửi yêu cầu hoàn tiền; chờ xác nhận thanh toán rồi làm mới.', 'Refund requested; wait for payment confirmation and refresh.')
        : t('Đã cập nhật tác vụ.', 'Task updated.'));
      setSelected(null);
      refresh();
    }
  });

  const unsuspendRequest = useMutation({
    mutationFn: async () => (await axios.post('/product/api/seller-unsuspend-request', { reason: unsuspendReason })).data,
    onSuccess: () => {
      setUnsuspendMessage(t('Đã gửi yêu cầu mở khóa tài khoản. Admin sẽ xem xét trong thời gian sớm nhất.', 'Account reinstatement request submitted. Admin will review shortly.'));
      setUnsuspendReason('');
      refresh();
    },
    onError: (e: any) => setUnsuspendMessage(e?.response?.data?.message || t('Không thể gửi yêu cầu. Thử lại.', 'Could not submit request. Retry.'))
  });

  const pages = (current: number, total: number, change: (page: number) => void) => (
    <div className="flex justify-between p-4 text-xs">
      <button className="seller-button border border-slate-700" disabled={current <= 1} onClick={() => change(current - 1)}>←</button>
      <span>{current} / {Math.max(1, Math.ceil(total / 20))}</span>
      <button className="seller-button border border-slate-700" disabled={current * 20 >= total} onClick={() => change(current + 1)}>→</button>
    </div>
  );

  const isSuspended = seller?.suspendedAt && (!seller.suspendedUntil || new Date(seller.suspendedUntil) > new Date());

  return (
    <div className="seller-page">
      <header>
        <h1 className="text-2xl font-semibold">{t('Vi phạm & khắc phục', 'Violations & remediation')}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{t('Xem lý do xử lý sản phẩm và giải quyết đơn liên quan của shop. Đơn bị giữ phải được hủy; đơn đã trả tiền cần hoàn tiền trước khi đóng tác vụ.', 'Review enforcement reasons and remedy affected purchases in your shop. Held orders must be cancelled and paid cancellations refunded before resolving the task.')}</p>
      </header>
      {message && <p role="status" className="text-sm text-blue-300">{message}</p>}
      {isSuspended && (
        <section className="seller-panel p-5 border border-amber-500/30 bg-amber-500/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-amber-300">{t('Tài khoản đang bị khóa', 'Account suspended')}</h2>
              <p className="mt-1 text-sm text-slate-400">{t('Lý do:', 'Reason:')} {seller.suspensionReason}</p>
              {seller.suspendedUntil && (
                <p className="mt-1 text-sm text-slate-400">{t('Khóa đến:', 'Suspended until:')} {new Date(seller.suspendedUntil).toLocaleString(vi ? 'vi-VN' : 'en-US')}</p>
              )}
            </div>
          </div>
                              {unsuspendStatus.isLoading ? (
            <p className="mt-4 text-sm text-slate-400">{t('Đang kiểm tra...', 'Checking...')}</p>
          ) : unsuspendStatus.data?.request?.status === 'Pending' ? (
            <p className="mt-4 text-sm text-blue-300">{t('Đang có yêu cầu mở khóa chờ duyệt', 'Reinstatement request pending review')}</p>
          ) : unsuspendStatus.data?.request?.status === 'Approved' ? (
            <p className="mt-4 text-sm text-emerald-300">{t('Yêu cầu mở khóa đã được chấp nhận. Tài khoản sẽ được khôi phục.', 'Reinstatement request approved. Account will be restored.')}</p>
          ) : unsuspendStatus.isError ? (
            <div className="mt-4 space-y-2">
              <p role="alert" className="text-sm text-rose-300">{t('Không kiểm tra được trạng thái yêu cầu mở khóa.', 'Could not load reinstatement request status.')}</p>
              <button type="button" className="seller-button border border-slate-700" onClick={() => unsuspendStatus.refetch()}>{t('Thử tải lại', 'Retry')}</button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-slate-400">
                {t('Lý do yêu cầu mở khóa', 'Reason for reinstatement request')}
                <textarea
                  className="seller-input mt-2"
                  maxLength={2000}
                  value={unsuspendReason}
                  onChange={e => setUnsuspendReason(e.target.value)}
                  placeholder={t('Giải thích tại sao tài khoản nên được mở khóa...', 'Explain why your account should be reinstated...')}
                />
              </label>
              {unsuspendMessage && (
                <p role={unsuspendRequest.isError ? 'alert' : 'status'} className={unsuspendRequest.isError ? 'text-sm text-rose-300' : 'text-sm text-blue-300'}>
                  {unsuspendMessage}
                </p>
              )}
              <button
                type="button"
                className={`seller-button text-white ${unsuspendReason.trim().length >= 10 && !unsuspendRequest.isPending ? 'bg-amber-600 hover:bg-amber-500' : 'bg-slate-700'}`}
                disabled={unsuspendRequest.isPending || unsuspendReason.trim().length < 10}
                onClick={() => { setUnsuspendMessage(''); unsuspendRequest.mutate(); }}
              >
                {unsuspendRequest.isPending ? t('Đang gửi...', 'Submitting...') : t('Gửi yêu cầu mở khóa', 'Submit reinstatement request')}
              </button>
            </div>
          )}
        </section>
      )}
      <section className="seller-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="font-semibold">{t('Đơn cần xử lý riêng', 'Private order follow-ups')} · {tasks.data?.total ?? 0}</h2>
          <select
            aria-label={t('Trạng thái khắc phục', 'Task status')}
            className="seller-input !w-auto"
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="Pending">{t('Chờ xử lý', 'Pending')}</option>
            <option value="Resolved">{t('Đã xử lý', 'Resolved')}</option>
          </select>
          <button className="seller-button border border-slate-700" onClick={refresh}>{t('Làm mới', 'Refresh')}</button>
        </div>
        {tasks.isLoading && <p className="p-5" role="status">{t('Đang tải…', 'Loading…')}</p>}
        {tasks.isError && <p role="alert" className="p-5 text-rose-300">{t('Không tải được tác vụ.', 'Could not load tasks.')}</p>}
        {tasks.data?.rows.map((task: any) => (
          <div key={task.id} className="space-y-3 border-t border-slate-800 p-5">
            <p className="font-medium">{task.productTitle}</p>
            <p className="text-sm text-slate-400">{task.reason}</p>
            <p className="text-xs text-amber-300">{task.order?.orderNumber} · {task.order?.status} · {task.order?.paymentStatus}{task.order?.moderationHold ? ` · ${t('Đang giữ', 'On hold')}` : ''}</p>
            <div className="flex flex-wrap gap-3">
              <Link className="seller-button border border-slate-700 text-blue-300" href={`/dashboard/orders/${task.orderId}`}>{t('Xem đơn / trả hàng', 'Order / return details')}</Link>
              {task.status === 'Pending' && (
                <button className="seller-button border border-slate-700" onClick={() => { action.reset(); setSelected(task); setResolution(''); }}>
                  {t('Khắc phục', 'Remediate')}
                </button>
              )}
            </div>
            {task.resolution && <p className="text-xs text-slate-500">{task.resolution}</p>}
          </div>
        ))}
        {tasks.data?.rows.length === 0 && <p className="p-8 text-center text-slate-500">{t('Không có tác vụ.', 'No tasks.')}</p>}
        {tasks.data && pages(page, tasks.data.total, setPage)}
      </section>
      {selected && (
        <section className="seller-panel space-y-4 border-blue-500/30 p-5">
          <h2 className="font-semibold">{selected.order?.orderNumber}</h2>
          <label className="block text-sm text-slate-400">
            {t('Nội dung khắc phục / lý do hủy hoặc hoàn tiền', 'Resolution / cancellation or refund reason')}
            <textarea className="seller-input mt-2" maxLength={1000} value={resolution} onChange={e => setResolution(e.target.value)} />
          </label>
          <p className="text-xs leading-6 text-slate-400">{t('Hủy áp dụng cho toàn bộ đơn. Hoàn tiền trả toàn bộ số tiền đơn về phương thức đã thanh toán; chỉ thực hiện sau khi đơn đã hủy hoặc nhận trả hàng. Với đơn đã giao, hãy liên hệ người mua và xử lý yêu cầu trả hàng ở chi tiết đơn.', 'Cancellation affects the entire order. Refund returns the full order amount to the original payment method after cancellation or receipt of a return. For delivered items, contact the buyer and review the return in order details.')}</p>
          {action.isError && <p role="alert" className="text-rose-300">{(action.error as any).response?.data?.message || t('Xử lý thất bại.', 'Action failed.')}</p>}
          <div className="flex flex-wrap gap-3">
            {['Pending', 'Confirmed', 'Processing'].includes(selected.order?.status) && (
              <button disabled={action.isPending || resolution.trim().length < 5} className="seller-button bg-rose-600 text-white" onClick={() => action.mutate('cancel')}>
                {t('Hủy toàn bộ đơn', 'Cancel entire order')}
              </button>
            )}
            {['Cancelled', 'Returned'].includes(selected.order?.status) && selected.order?.paymentStatus === 'Paid' && (
              <button disabled={action.isPending || resolution.trim().length < 5} className="seller-button bg-rose-600 text-white" onClick={() => action.mutate('refund')}>
                {t('Xác nhận hoàn tiền toàn bộ đơn', 'Confirm full order refund')}
              </button>
            )}
            <button disabled={action.isPending || resolution.trim().length < 5} className="seller-button border border-slate-700" onClick={() => action.mutate('resolve')}>
              {t('Đánh dấu đã xử lý', 'Mark resolved')}
            </button>
            <button disabled={action.isPending} className="seller-button border border-slate-700" onClick={() => setSelected(null)}>
              {t('Đóng', 'Close')}
            </button>
          </div>
        </section>
      )}
      <section className="seller-panel overflow-hidden">
        <h2 className="p-5 font-semibold">{t('Lịch sử vi phạm của shop', 'Shop violation history')} · {history.data?.total ?? 0}</h2>
        {history.isError && <p role="alert" className="p-5 text-rose-300">{t('Không tải được lịch sử.', 'Could not load history.')}</p>}
        {history.data?.rows.map((row: any) => (
          <div key={row.id} className="space-y-2 border-t border-slate-800 p-5">
            <p className="font-medium">{row.productTitle} · #{row.occurrence}</p>
            <p className="text-sm text-slate-400">{row.reason}</p>
            <p className="text-xs text-amber-300">{row.severity} · {row.productAction} · {row.sellerAction}{row.suspendedUntil ? ` · ${new Date(row.suspendedUntil).toLocaleString(vi ? 'vi-VN' : 'en-US')}` : ''}</p>
          </div>
        ))}
        {history.data && pages(historyPage, history.data.total, setHistoryPage)}
      </section>
    </div>
  );
}
