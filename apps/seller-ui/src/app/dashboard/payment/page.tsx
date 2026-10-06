"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, CreditCard, Search, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import axios from "apps/seller-ui/src/utils/axioInstance";

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
const control = "rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function SellerPayments() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ month, status, search, page: String(page), limit: "20" }).toString();
  const query = useQuery<PaymentsResponse>({
    queryKey: ["seller-payments", params],
    queryFn: async () => (await axios.get(`/order/seller-payments?${params}`)).data,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (query.isError) toast.error("Could not load payments. Please try again.", { id: "seller-payments-error" });
  }, [query.isError, query.errorUpdatedAt]);
  useEffect(() => {
    if (query.data && page > Math.max(1, query.data.totalPages)) setPage(Math.max(1, query.data.totalPages));
  }, [query.data, page]);

  return <section className="min-h-screen p-6 text-white md:p-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <nav aria-label="Breadcrumb" className="mt-2 flex items-center gap-1 text-sm text-gray-400">
          <Link href="/dashboard" className="text-blue-400">Dashboard</Link><ChevronRight size={16} /><span>Payments</span>
        </nav>
      </div>
      <button className={`${control} flex items-center gap-2 disabled:opacity-50`} disabled={query.isFetching} onClick={() => query.refetch()}>
        <RefreshCw size={16} className={query.isFetching ? "animate-spin" : ""} /> Refresh
      </button>
    </div>

    <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4">
      <label className="space-y-2 text-sm text-gray-400"><span className="block">Order month (UTC)</span>
        <input aria-label="Payment month" className={control} type="month" value={month} onChange={event => { setMonth(event.target.value); setPage(1); }} />
      </label>
      <label className="space-y-2 text-sm text-gray-400"><span className="block">Payment status</span>
        <select className={control} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}
        </select>
      </label>
      <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setSearch(draft.trim()); setPage(1); }}>
        <input aria-label="Search order or transaction" className={`${control} w-64 max-w-full`} placeholder="Order or transaction ID" maxLength={100} value={draft} onChange={event => setDraft(event.target.value)} />
        <button className={`${control} flex items-center gap-2`}><Search size={16} /> Search</button>
      </form>
      <button className="min-h-10 text-sm text-blue-400" onClick={() => { setMonth(""); setStatus(""); setSearch(""); setDraft(""); setPage(1); }}>Clear filters</button>
    </div>

    {query.isLoading && <div role="status" className="py-16 text-center text-gray-400">Loading payments…</div>}
    {query.isError && <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center"><p>Payments are unavailable.</p><button className="mt-3 text-blue-400" onClick={() => query.refetch()}>Try again</button></div>}
    {query.data && !query.isError && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statuses.map(value => <div key={value} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center justify-between"><p className="text-sm text-gray-400">{value}</p><CreditCard size={20} className={colors[value].split(" ")[1]} /></div>
          <p className="mt-2 text-2xl font-semibold">{money(query.data.summary[value].amount)}</p>
          <p className="mt-1 text-xs text-gray-500">{query.data.summary[value].count} orders</p>
        </div>)}
      </div>
      <p className="my-4 text-xs text-gray-400">Totals reflect the selected filters and each order’s payment status. Amounts are in USD. Bank payouts and available balance are not shown here.</p>
      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-800 p-5"><h2 className="font-semibold">Payment history</h2><span className="text-sm text-gray-400">{query.data.total} orders</span></div>
        {!query.data.payments.length ? <div className="p-12 text-center text-gray-400"><CreditCard className="mx-auto mb-3" size={32} /><p>No payments found for these filters.</p></div> : <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-800 text-xs uppercase text-gray-400"><tr>{["Order / buyer", "Transaction", "Amount", "Payment status", "Method", "Order date"].map(title => <th key={title} className="whitespace-nowrap p-4">{title}</th>)}</tr></thead>
            <tbody>{query.data.payments.map(payment => <tr key={payment.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40">
              <td className="p-4"><Link className="text-blue-400 hover:underline" href={`/dashboard/orders/${payment.id}`}>{payment.orderNumber}</Link><p className="mt-1 text-xs text-gray-400">{payment.user?.name || "Guest"} · {payment.status}</p></td>
              <td className="max-w-xs break-all p-4 text-xs text-gray-400">{payment.stripePaymentId || "—"}{payment.refundState && <p className="mt-1">Refund: {payment.refundState}</p>}{payment.stripeRefundId && <p className="mt-1">{payment.stripeRefundId}</p>}</td>
              <td className="whitespace-nowrap p-4 font-medium">{money(payment.totalAmount)}</td>
              <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs ${colors[payment.paymentStatus]}`}>{payment.paymentStatus}</span></td>
              <td className="p-4 capitalize">{payment.paymentMethod || "—"}</td>
              <td className="whitespace-nowrap p-4 text-gray-400">{new Date(payment.createdAt).toLocaleString()}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className="flex items-center justify-end gap-4 border-t border-gray-800 p-4 text-sm">
          <button className={`${control} disabled:opacity-40`} disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>Previous</button>
          <span>Page {page} of {Math.max(1, query.data.totalPages)}</span>
          <button className={`${control} disabled:opacity-40`} disabled={page >= query.data.totalPages || query.isFetching} onClick={() => setPage(value => value + 1)}>Next</button>
        </div>
      </div>
    </>}
  </section>;
}
