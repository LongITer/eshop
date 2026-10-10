"use client";
import OrderAftercare from '@packages/components/order-aftercare';
import { transitions } from '@packages/utils/order-status';
import toast from "react-hot-toast";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "apps/seller-ui/src/utils/axioInstance";
import { ArrowLeft, Loader2, Package, Check, Truck, MapPin, CreditCard, CalendarDays, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const fetchOrders = async () => {
  const res = await axiosInstance.get("/order/get-seller-orders");
  return Array.isArray(res.data) ? res.data : (res.data?.orders ?? []);
};

const deliveryStages = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];
const money = (value: unknown) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const card = 'rounded-2xl bg-slate-900/80 p-5 shadow-sm ring-1 ring-white/10 sm:p-6';
const formatAddress = (address: any) => [...new Set([address?.address, address?.street, address?.ward, address?.district, address?.city, address?.state, address?.zip || address?.postalCode, address?.country].filter(Boolean))].join(', ') || 'No shipping address';

const OrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["seller-orders"],
    queryFn: fetchOrders,
  });
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await axiosInstance.patch(
        `/order/update-order-status/${id}`,
        { status },
      );
      return response.data;
    },
    onError: (error: any) => toast.error(error.response?.data?.message || "Could not update status."),
    onSuccess: () => {
      toast.success("Order status updated.");
      queryClient.invalidateQueries({ queryKey: ["aftercare", true, id] });
      queryClient.invalidateQueries({ queryKey: ["seller-payments"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-report"] });
      queryClient.invalidateQueries({ queryKey: ["seller-stats"] });
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
    },
  });
  const order = orders.find((item: any) => item.id === id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080d1a] p-6 text-white md:p-10">
        <div className="mx-auto max-w-4xl animate-pulse">
          <div className="mb-6 h-4 w-44 rounded bg-slate-800" />
          <div className="mb-7 h-8 w-64 rounded bg-slate-800" />
          <div className="mb-8 h-24 rounded-lg border border-slate-800 bg-[#0d1423]" />
          <div className="mb-8 h-16 rounded-lg bg-slate-900" />
          <div className="space-y-3">
            <div className="h-4 w-52 rounded bg-slate-800" />
            <div className="h-4 w-64 rounded bg-slate-800" />
            <div className="h-4 w-40 rounded bg-slate-800" />
          </div>
          <div className="mt-8 h-20 rounded-lg border border-slate-800 bg-[#0d1423]" />
        </div>
      </div>
    );
  }

  if (isError) return <div className="p-8 text-slate-300">Unable to load this order. <button className="text-blue-400 underline" onClick={() => refetch()}>Retry</button></div>;

  if (!order) {
    return (
      <div className="p-8 text-white">
        <p className="mb-4">Order not found.</p>
        <Link href="/dashboard/orders" className="text-blue-400">
          Back to orders
        </Link>
      </div>
    );
  }

  const activeIndex = deliveryStages.indexOf(order.status);
  const nextStatuses = transitions[order.status] || [];
  const itemCount = (order.items || []).reduce((sum: number, item: any) => sum + item.quantity, 0);
  const statusColor = ['Cancelled', 'Refunded', 'Returned'].includes(order.status) ? 'bg-rose-500/10 text-rose-300 ring-rose-500/20' : order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20' : 'bg-blue-500/10 text-blue-300 ring-blue-500/20';
  return (
    <div className="min-h-screen bg-[#080d1a] px-4 py-6 text-slate-100 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/orders" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft size={16} /> Back to orders</Link>
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-400">Order details</p><h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{order.orderNumber || `Order #${order.id.slice(-6).toUpperCase()}`}</h1><p className="mt-3 flex items-center gap-2 text-sm text-slate-400"><CalendarDays size={14} />{new Date(order.createdAt).toLocaleString()}<span className="mx-1">·</span>{itemCount} items</p></div>
          <span className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ${statusColor}`}>{order.status}</span>
        </header>
        <section className={`${card} mb-6`} aria-label="Order fulfillment">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-base font-semibold">Order fulfillment</h2><p className="mt-1 text-sm text-slate-400">Track progress and update the delivery status.</p></div><div className="flex items-center gap-3"><label htmlFor="delivery-status" className="text-sm text-slate-400">Update status</label><select id="delivery-status" value={order.status} onChange={event => updateStatusMutation.mutate(event.target.value)} disabled={updateStatusMutation.isPending || !nextStatuses.length} className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60">{[order.status, ...nextStatuses].map(status => <option key={status} value={status}>{status}</option>)}</select>{updateStatusMutation.isPending && <Loader2 size={16} className="animate-spin text-blue-400" aria-label="Saving status" />}</div></div>
          {activeIndex >= 0 && <div className="relative mt-8 grid grid-cols-5 pb-1">
            <div className="absolute left-[10%] right-[10%] top-4 h-0.5 bg-slate-700" /><div className="absolute left-[10%] top-4 h-0.5 bg-blue-500 transition-all" style={{ width: `${activeIndex * 20}%` }} />
            {deliveryStages.map((stage, index) => <div key={stage} className="relative flex flex-col items-center gap-2.5"><span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-slate-900 ${index < activeIndex ? 'bg-blue-600 text-white' : index === activeIndex ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-800 text-slate-500'}`}>{index < activeIndex ? <Check size={15} /> : index === 3 ? <Truck size={15} /> : index === 4 ? <Check size={15} /> : <Package size={15} />}</span><span className={`text-[10px] sm:text-xs ${index <= activeIndex ? 'font-medium text-blue-300' : 'text-slate-500'}`}>{stage}</span></div>)}
          </div>}
        </section>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <section className={card}>
              <div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 text-base font-semibold"><ShoppingBag size={18} className="text-blue-400" /> Order items</h2><span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-400">{itemCount} items</span></div>
              <div className="divide-y divide-slate-800">{(order.items || []).map((item: any) => <div key={item.id} className="flex gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-800 ring-1 ring-white/5">{item.image ? <img src={item.image} alt={item.title} className="h-full w-full bg-white object-contain p-1" /> : <Package size={24} className="text-slate-500" />}</div>
                <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-medium leading-relaxed">{item.title}</h3><p className="mt-1 text-xs text-slate-400">{[item.color, item.size, item.sku].filter(Boolean).join(' · ') || 'Standard option'}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-400">{money(item.unitPrice)} × {item.quantity}</span><span className="text-sm font-semibold tabular-nums">{money(item.totalPrice)}</span></div></div>
              </div>)}</div>
            </section>
            <OrderAftercare order={order} seller api={axiosInstance} />
          </div>
          <aside className="space-y-6">
            <section className={card}><h2 className="mb-5 flex items-center gap-2 text-base font-semibold"><CreditCard size={18} className="text-blue-400" /> Payment summary</h2><div className="mb-5 flex items-center justify-between text-sm"><span className="text-slate-400">Payment status</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${order.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>{order.paymentStatus}</span></div><dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-400">Subtotal</dt><dd className="tabular-nums">{money(order.subTotal)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-400">Discount</dt><dd className="tabular-nums text-emerald-400">−{money(order.discount)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-400">Shipping</dt><dd className="tabular-nums">{Number(order.shippingFee || 0) === 0 ? 'Free' : money(order.shippingFee)}</dd></div><div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4"><dt className="font-medium">Order total <span className="text-xs text-slate-500">USD</span></dt><dd className="text-xl font-semibold tabular-nums">{money(order.totalAmount)}</dd></div></dl></section>
            <section className={card}><h2 className="mb-4 flex items-center gap-2 text-base font-semibold"><MapPin size={18} className="text-blue-400" /> Shipping details</h2>{order.shippingAddress?.name && <p className="mb-2 text-sm font-medium">{order.shippingAddress.name}</p>}<p className="break-words text-sm leading-6 text-slate-400">{formatAddress(order.shippingAddress)}</p>{order.shippingAddress?.phone && <p className="mt-3 text-sm text-slate-300">{order.shippingAddress.phone}</p>}{order.trackingNumber && <div className="mt-4 border-t border-slate-800 pt-4"><p className="text-xs text-slate-500">Tracking number</p><p className="mt-1 break-all text-sm text-blue-300">{order.trackingNumber}</p></div>}</section>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
