'use client';
import { useStorefrontText } from '@packages/components/storefront-language';

import OrderAftercare from '@packages/components/order-aftercare';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/utils/axioInstance';
import { useStore } from '@/store';
import { useRouter } from 'next/navigation';
export default function OrderActions({ order }: { order: any }) {
  const { t, locale } = useStorefrontText();
  const router = useRouter();
  const reorder = useMutation({ mutationFn: async () => (await axios.get(`/order/api/reorder/${order.id}`)).data, onSuccess: data => { data.cart.forEach((item:any) => useStore.getState().addToCart(item,null,null,'')); router.push('/cart'); } });
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const client = useQueryClient();
  const cancel = useMutation({ mutationFn: () => axios.post(`/order/api/cancel-order/${order.id}`, { reason }), onSuccess: () => { client.invalidateQueries({ queryKey: ['order', order.id] }); client.invalidateQueries({ queryKey: ['user-orders'] }); client.invalidateQueries({ queryKey: ['user-order-stats'] }); } });
  const refundLabel:Record<string,string>={pending:'Đang xử lý',requires_action:'Cần kiểm tra thêm',succeeded:'Đã hoàn tiền',failed:'Hoàn tiền thất bại',canceled:'Đã hủy yêu cầu hoàn'};
  return <div className="space-y-3 mb-5">{order.refundState&&<p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{t("Tiến độ hoàn tiền: ")}{t(refundLabel[order.refundState]||order.refundState)}</p>}<p>{t("Trạng thái đơn: ")}<strong>{t(order.status)}</strong></p>{order.trackingNumber && <p>{t("Mã vận đơn: ")}<strong>{order.trackingNumber}</strong></p>}{order.estimatedDelivery && <p>{t("Dự kiến giao: ")}{new Date(order.estimatedDelivery).toLocaleDateString(locale)}</p>}{order.status === 'Cancelled' && order.paymentStatus === 'Paid' && <p>{t("Đã hủy đơn. Đang chờ xử lý hoàn tiền.")}</p>}{order.status === 'Pending' && (!confirm ? <button onClick={() => setConfirm(true)} className="text-red-600 border border-red-300 p-3 rounded">{t("Hủy đơn")}</button> : <form className="space-y-3" onSubmit={e => { e.preventDefault(); cancel.mutate(); }}><label className="block">{t("Lý do hủy")}<textarea className="border rounded p-3 block w-full" value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} /></label><button disabled={cancel.isPending} className="bg-red-600 text-white p-3 rounded">{t("Xác nhận hủy")}</button><button type="button" className="p-3" onClick={() => setConfirm(false)}>{t("Giữ đơn")}</button></form>)}{cancel.isError && <p role="alert">{t("Không hủy được. Đơn có thể đã được xử lý.")}</p>}<button className="rounded border border-blue-400 p-3 text-blue-600" disabled={reorder.isPending} onClick={()=>reorder.mutate()}>{t("Mua lại (kiểm tra giá và tồn kho hiện tại)")}</button>{reorder.isError && <p role="alert">{t("Không tải được sản phẩm để mua lại.")}</p>}<OrderAftercare order={order} api={axios}/></div>;
}

