"use client";

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "apps/seller-ui/src/utils/axioInstance";
import useSeller from "apps/seller-ui/src/hooks/useSeller";
import { ArrowRight, ChevronLeft, ChevronRight, Package, RefreshCw, Search, ShoppingBag, Truck, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

interface SellerOrder {
  id: string; orderNumber?: string; totalAmount: number; status: string;
  paymentStatus: string; createdAt: string; user?: { name?: string; email?: string };
  items?: { quantity: number }[];
}
const statuses = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Refunded"];
const statusColor = (status: string) => status === "Delivered" ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20" : ["Cancelled", "Returned", "Refunded"].includes(status) ? "bg-rose-500/10 text-rose-300 ring-rose-500/20" : status === "Pending" ? "bg-amber-500/10 text-amber-300 ring-amber-500/20" : "bg-blue-500/10 text-blue-300 ring-blue-500/20";
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const control = "min-h-11 rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-slate-100 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";
const pageSize = 20;

export default function OrdersTable() {
  const { seller, isLoading: sellerLoading } = useSeller();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery<SellerOrder[]>({
    queryKey: ["seller-orders", seller?.id], enabled: !!seller?.id,
    queryFn: async ({ signal }) => {
      const res = await axiosInstance.get("/order/get-seller-orders", { signal });
      return Array.isArray(res.data) ? res.data : (res.data?.orders ?? []);
    },
    staleTime: 30_000,
  });
  const orders = query.data ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter(order => (!status || order.status === status) && (!term || [order.id, order.orderNumber, order.user?.name, order.user?.email].some(value => value?.toLowerCase().includes(term))));
  }, [orders, search, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(page, pageCount);
  const visible = filtered.slice((activePage - 1) * pageSize, activePage * pageSize);
  const loading = sellerLoading || query.isLoading;
  const stats = [
    { label: "Total orders", count: orders.length, icon: ShoppingBag, color: "text-blue-400" },
    { label: "To fulfill", count: orders.filter(order => ["Pending", "Confirmed", "Processing"].includes(order.status)).length, icon: Package, color: "text-amber-400" },
    { label: "In transit", count: orders.filter(order => order.status === "Shipped").length, icon: Truck, color: "text-violet-400" },
    { label: "Delivered", count: orders.filter(order => order.status === "Delivered").length, icon: CheckCircle2, color: "text-emerald-400" },
  ];

  return <main className="min-h-screen bg-[#080d1a] p-4 text-slate-100 sm:p-6 lg:p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs text-slate-500"><Link href="/dashboard" className="hover:text-blue-400">Dashboard</Link><ChevronRight size={14} /><span className="text-slate-400">Orders</span></nav><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Orders</h1><p className="mt-2 text-sm text-slate-400">Keep every purchase moving, from confirmation to delivery.</p></div>
        <button type="button" className={`${control} flex items-center gap-2 disabled:opacity-50`} onClick={() => query.refetch()} disabled={query.isFetching || !seller?.id}><RefreshCw size={16} className={query.isFetching ? "animate-spin" : ""} /> Refresh</button>
      </header>
      {!query.isError && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(({ label, count, icon: Icon, color }) => <section key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-400 sm:text-sm">{label}</p><Icon size={18} className={color} /></div><p className="mt-3 text-2xl font-semibold tabular-nums">{loading ? "—" : count}</p></section>)}</div>}
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 p-4 sm:p-5">
          <label className={`flex min-w-0 flex-1 items-center gap-2 ${control}`}><Search size={17} className="shrink-0 text-slate-500" /><span className="sr-only">Search orders</span><input type="search" value={search} maxLength={200} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search order, buyer or email" className="w-full min-w-0 bg-transparent py-3 outline-none placeholder:text-slate-500" /></label>
          <select aria-label="Fulfillment status" className={`${control} w-full sm:w-auto`} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All fulfillment statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select>
        </div>
        {loading ? <div role="status" className="p-6"><span className="sr-only">Loading orders</span>{Array.from({ length: 5 }).map((_, index) => <div key={index} className="my-4 h-10 rounded-lg bg-slate-800/70" />)}</div> : query.isError ? <div role="alert" className="p-12 text-center"><Package className="mx-auto mb-4 text-slate-500" size={32} /><p className="font-medium">Orders could not be loaded.</p><p className="mt-2 text-sm text-slate-400">Try again to get your shop’s latest orders.</p><button type="button" onClick={() => query.refetch()} className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium hover:bg-blue-500">Try again</button></div> : visible.length === 0 ? <div className="px-6 py-16 text-center"><ShoppingBag className="mx-auto mb-4 text-slate-500" size={36} /><h2 className="font-medium">{orders.length ? "No matching orders" : "Your first order starts here"}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">{orders.length ? "Try another buyer, order number or fulfillment status." : "New purchases will appear here with the details you need to fulfill them."}</p>{(search || status) && <button type="button" className="mt-4 text-sm text-blue-400 hover:text-blue-300" onClick={() => { setSearch(""); setStatus(""); setPage(1); }}>Clear filters</button>}</div> : <>
          <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-950/30 text-xs text-slate-500"><tr>{["Order", "Buyer", "Total", "Fulfillment", "Payment", "Placed", ""].map((title, index) => <th key={index} scope="col" className="whitespace-nowrap px-5 py-4 font-medium">{title || <span className="sr-only">Details</span>}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{visible.map(order => <tr key={order.id} className="transition hover:bg-slate-800/30"><td className="px-5 py-5"><Link href={`/dashboard/orders/${order.id}`} className="font-medium text-slate-100 hover:text-blue-400">{order.orderNumber || `#${order.id.slice(-6).toUpperCase()}`}</Link><p className="mt-1 text-xs text-slate-500">{(order.items ?? []).reduce((sum, item) => sum + item.quantity, 0)} items</p></td><td className="px-5 py-5"><p>{order.user?.name || "Guest"}</p><p className="mt-1 max-w-44 truncate text-xs text-slate-500">{order.user?.email || "—"}</p></td><td className="whitespace-nowrap px-5 py-5 font-medium tabular-nums">{money(order.totalAmount)}</td><td className="px-5 py-5"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusColor(order.status)}`}>{order.status}</span></td><td className="px-5 py-5"><span className={`text-xs ${order.paymentStatus === "Paid" ? "text-emerald-400" : order.paymentStatus === "Failed" ? "text-rose-400" : "text-slate-400"}`}>{order.paymentStatus || "—"}</span></td><td className="whitespace-nowrap px-5 py-5 text-slate-400">{new Date(order.createdAt).toLocaleDateString()}</td><td className="px-5 py-5"><Link href={`/dashboard/orders/${order.id}`} aria-label={`View order ${order.orderNumber || order.id.slice(-6)}`} className="inline-flex rounded-lg p-2 text-slate-400 hover:bg-blue-500/10 hover:text-blue-400"><ArrowRight size={18} /></Link></td></tr>)}</tbody></table></div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-4 text-xs text-slate-400"><span>Showing {(activePage - 1) * pageSize + 1}–{Math.min(activePage * pageSize, filtered.length)} of {filtered.length} orders</span><div className="flex items-center gap-3"><button type="button" aria-label="Previous orders page" className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800 disabled:opacity-40" disabled={activePage <= 1} onClick={() => setPage(activePage - 1)}><ChevronLeft size={16} /></button><span>Page {activePage} of {pageCount}</span><button type="button" aria-label="Next orders page" className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800 disabled:opacity-40" disabled={activePage >= pageCount} onClick={() => setPage(activePage + 1)}><ChevronRight size={16} /></button></div></footer>
        </>}
      </section>
    </div>
  </main>;
}
