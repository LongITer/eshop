'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/utils/axioInstance';
export default function OrderActions({ order }: { order: any }) {
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const client = useQueryClient();
  const cancel = useMutation({ mutationFn: () => axios.post(`/order/api/cancel-order/${order.id}`, { reason }), onSuccess: () => { client.invalidateQueries({ queryKey: ['order', order.id] }); client.invalidateQueries({ queryKey: ['user-orders'] }); } });
  return <div className="space-y-3 mb-5"><p>Order status: <strong>{order.status}</strong></p>{order.trackingNumber && <p>Tracking number: <strong>{order.trackingNumber}</strong></p>}{order.estimatedDelivery && <p>Estimated delivery: {new Date(order.estimatedDelivery).toLocaleDateString()}</p>}{order.status === 'Cancelled' && order.paymentStatus === 'Paid' && <p>Cancellation confirmed. Your refund is awaiting processing.</p>}{order.status === 'Pending' && (!confirm ? <button onClick={() => setConfirm(true)} className="text-red-600 border border-red-300 p-3 rounded">Cancel order</button> : <form className="space-y-3" onSubmit={e => { e.preventDefault(); cancel.mutate(); }}><label className="block">Cancellation reason<textarea className="border rounded p-3 block w-full" value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} /></label><button disabled={cancel.isPending} className="bg-red-600 text-white p-3 rounded">Confirm cancellation</button><button type="button" className="p-3" onClick={() => setConfirm(false)}>Keep order</button></form>)}{cancel.isError && <p role="alert">Unable to cancel. The order may already have been processed.</p>}</div>;
}

