"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, CreditCard, Search, RefreshCw, ArrowUpRight } from "lucide-react";
import axios from "apps/seller-ui/src/utils/axioInstance";
import useSeller from "apps/seller-ui/src/hooks/useSeller";

const statuses = ["Paid", "Pending", "Failed", "Refunded"] as const;
type Status = typeof statuses[number];
interface Payment {
  id: string;
  orderNumber: string;
  totalAmount: number;
  paymentStatus: Status;
  paymentMethod: string | null;
  stripePaymentId: string | null;
  stripeRefundId: string | null;
  refundState: string | null;
  status: string;
  createdAt: string;
  user: { name: string | null } | null;
}
interface PaymentsResponse {
  payments: Payment[];
  summary: Record<Status, { amount: number; count: number }>;
  total: number;
  page: number;
  totalPages: number;
}
const colors: Record<Status, string> = {
  Paid: "bg-emerald-500/15 text-emerald-400",
  Pending: "bg-amber-500/15 text-amber-400",
  Failed: "bg-red-500/15 text-red-400",
  Refunded: "bg-purple-500/15 text-purple-400",
};
const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
const control = "min-h-11 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10";

export default function SellerPayments() {
  const { seller, isLoading: sellerLoading } = useSeller();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const [monthError, setMonthError] = useState("");
  const params = new URLSearchParams({ month, status, search, page: String(page), limit: "20" }).toString();
  const query = useQuery<PaymentsResponse>({
    queryKey: ["seller-payments", seller?.id, params],
    enabled: !!seller?.id,
    queryFn: async ({ signal }) => (await axios.get(`/order/seller-payments?${params}`, { signal })).data,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (query.data && page > Math.max(1, query.data.totalPages)) setPage(Math.max(1, query.data.totalPages));
  }, [query.data, page]);

  return <section className="min-h-screen bg-[#080d1a] p-4 text-slate-100 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <Link href="/dashboard" className="text-blue-400">Dashboard</Link><ChevronRight size={16} /><span>Payments</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payments</h1>
        <p className="mt-2 text-sm text-slate-400">A clear view of order payments, transactions and refunds.</p>
      </div>
      <button className={`${control} flex items-center gap-2 disabled:opacity-50`} disabled={query.isFetching || !seller?.id} onClick={() => query.refetch()}>
        <RefreshCw size={16} className={query.isFetching ? "animate-spin" : ""} /> Refresh
      </button>
    </div>

    <div className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <label className="space-y-2 text-sm text-slate-400"><span className="block">Order month (UTC)</span>
        <input aria-label="Payment month" className={control} type="month" min="1000-01" max="9999-12" value={month} onChange={event => { const next = event.target.value; if (next && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(next) || Number(next.slice(0, 4)) < 1000)) { setMonthError('Choose a valid month.'); return; } setMonthError(''); setMonth(next); setPage(1); }} />
      </label>
      <label className="space-y-2 text-sm text-slate-400"><span className="block">Payment status</span>
        <select className={control} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}
        </select>
      </label>
      <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setSearch(draft.trim()); setPage(1); }}>
        <input aria-label="Search order or transaction" className={`${control} w-64 max-w-full`} placeholder="Order or transaction ID" maxLength={100} value={draft} onChange={event => setDraft(event.target.value)} />
        <button className={`${control} flex items-center gap-2`}><Search size={16} /> Search</button>
      </form>
      <button className="min-h-11 text-sm text-blue-400" onClick={() => { setMonth(""); setStatus(""); setSearch(""); setDraft(""); setPage(1); setMonthError(''); }}>Clear filters</button>
      {monthError && <p role="alert" className="w-full text-sm text-rose-400">{monthError}</p>}
    </div>

    {(sellerLoading || query.isLoading) && <div role="status" className="py-16 text-center text-slate-400">Loading payments…</div>}
    {query.isError && <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center"><p>Payments are unavailable.</p><button className="mt-3 text-blue-400" onClick={() => query.refetch()}>Try again</button></div>}
    {query.data && !query.isError && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statuses.map(value => <div key={value} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between"><p className="text-sm text-slate-400">{value}</p><CreditCard size={20} className={colors[value].split(" ")[1]} /></div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{money(query.data.summary[value]?.amount ?? 0)}</p>
          <p className="mt-1 text-xs text-slate-500">{query.data.summary[value]?.count ?? 0} orders</p>
        </div>)}
      </div>
      <p className="my-4 text-xs text-slate-400">Totals reflect the selected filters and each order’s payment status. Amounts are in USD. Bank payouts and available balance are not shown here.</p>
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-800 p-5"><h2 className="font-semibold">Payment history</h2><span className="text-sm text-slate-400">{query.data.total} orders</span></div>
        {!query.data.payments.length ? <div className="p-12 text-center text-slate-400"><CreditCard className="mx-auto mb-3" size={32} /><p>No payments found for these filters.</p></div> : <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/30 text-xs text-slate-500"><tr>{["Order / buyer", "Transaction", "Amount", "Payment status", "Method", "Order date"].map(title => <th scope="col" key={title} className="whitespace-nowrap p-4 font-medium">{title}</th>)}</tr></thead>
            <tbody>{query.data.payments.map(payment => <tr key={payment.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30">
              <td className="p-4"><Link className="inline-flex items-center gap-1 font-medium text-blue-400 hover:underline" href={`/dashboard/orders/${payment.id}`}>{payment.orderNumber}<ArrowUpRight size={13} /></Link><p className="mt-1 text-xs text-slate-400">{payment.user?.name || "Guest"} · {payment.status}</p></td>
              <td className="max-w-xs break-all p-4 text-xs text-slate-400">{payment.stripePaymentId || "—"}{payment.refundState && <p className="mt-1">Refund: {payment.refundState}</p>}{payment.stripeRefundId && <p className="mt-1">{payment.stripeRefundId}</p>}</td>
              <td className="whitespace-nowrap p-4 font-medium">{money(payment.totalAmount)}</td>
              <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs ${colors[payment.paymentStatus]}`}>{payment.paymentStatus}</span></td>
              <td className="p-4 capitalize">{payment.paymentMethod || "—"}</td>
              <td className="whitespace-nowrap p-4 text-slate-400">{new Date(payment.createdAt).toLocaleString()}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="flex items-center justify-end gap-4 border-t border-slate-800 p-4 text-sm">
          <button className={`${control} disabled:opacity-40`} disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>Previous</button>
          <span>Page {page} of {Math.max(1, query.data.totalPages)}</span>
          <button className={`${control} disabled:opacity-40`} disabled={page >= query.data.totalPages || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</button>
        </div>
      </div>
    </>}
  </div></section>;
}
