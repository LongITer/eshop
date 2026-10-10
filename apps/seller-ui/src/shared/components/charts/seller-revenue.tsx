"use client";
import { Download, Printer, DollarSign, ShoppingBag, TrendingUp, Ticket, CalendarDays, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axios from "apps/seller-ui/src/utils/axioInstance";
import RevenueChart, { RevenuePoint } from "./revenue-chart";

interface Report {
  timeline: RevenuePoint[];
  totalRevenue: number;
  totalOrders: number;
  topProducts: { id: string; title: string; quantity: number; revenue: number }[];
  coupons: { id: string; code: string; uses: number; discount: number }[];
}
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const card = 'rounded-2xl bg-slate-900/80 p-5 shadow-sm ring-1 ring-white/10 sm:p-6 print:bg-white print:ring-slate-200';
const input = 'mt-2 block w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 [color-scheme:dark]';
const action = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
export default function SellerRevenue({ detailed = false }: { detailed?: boolean }) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState("");
  const [exporting, setExporting] = useState(false);
  const [custom, setCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [interval, setInterval] = useState("day");
  const from = custom ? customFrom : month ? `${year}-${month}-01` : `${year}-01-01`;
  const to = custom ? customTo : month ? `${year}-${month}-${new Date(Date.UTC(year, Number(month), 0)).getUTCDate()}` : `${year}-12-31`;
  const grouping = custom ? interval : month ? "day" : "month";
  const params = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), interval: grouping }).toString();
  const query = useQuery<Report>({
    queryKey: ["revenue-report", params],
    queryFn: async () => (await axios.get(`/product/api/seller-reports?${params}`)).data,
  });
  useEffect(() => {
    if (query.isError) toast.error("Unable to load revenue report", { id: "revenue-report-error" });
  }, [query.isError, query.errorUpdatedAt]);
  const download = async () => {
    setExporting(true);
    try {
      const { data } = await axios.get(`/product/api/seller-reports?${params}&format=csv`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = custom ? "seller-revenue.csv" : `seller-revenue-${year}${month ? `-${month}` : ""}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Revenue report exported");
    } catch { toast.error("Export failed"); }
    finally { setExporting(false); }
  };
  const report = query.data;
  return <section className="min-w-0 space-y-6 text-slate-100 print:text-black">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-lg font-semibold">{detailed ? 'Sales overview' : 'Revenue overview'}</h2><p className="mt-1 text-sm text-slate-400">{custom ? 'Custom reporting period' : month ? new Date(year, Number(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `Year ${year}`} · USD · UTC</p></div>
      {detailed && <div className="flex flex-wrap gap-2 print:hidden"><button className={`${action} bg-slate-800 text-slate-300 hover:bg-slate-700`} onClick={() => window.print()}><Printer size={16} /> Print / PDF</button><button className={`${action} bg-blue-600 text-white hover:bg-blue-500`} disabled={exporting || !report || query.isError} onClick={download}><Download size={16} />{exporting ? 'Exporting…' : 'Export CSV'}</button></div>}
    </div>
    <div className={`${card} print:hidden`}>
      <div className="mb-4 flex items-center gap-2 text-sm font-medium"><CalendarDays size={16} className="text-blue-400" /> Reporting period</div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {detailed && <label className="text-xs font-medium text-slate-400">Period<select aria-label="Revenue period" className={input} value={custom ? 'custom' : 'monthly'} onChange={e => setCustom(e.target.value === 'custom')}><option value="monthly">Month / year</option><option value="custom">Custom dates</option></select></label>}
        {!custom ? <><label className="text-xs font-medium text-slate-400">Year<select aria-label="Revenue year" className={input} value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(value => <option key={value}>{value}</option>)}</select></label><label className="text-xs font-medium text-slate-400">Month<select aria-label="Revenue month" className={input} value={month} onChange={e => setMonth(e.target.value)}><option value="">All months</option>{Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' })}</option>)}</select></label></> : <><label className="text-xs font-medium text-slate-400">From<input aria-label="From" className={input} type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></label><label className="text-xs font-medium text-slate-400">To<input aria-label="To" className={input} type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} /></label><label className="text-xs font-medium text-slate-400">Group by<select aria-label="Interval" className={input} value={interval} onChange={e => setInterval(e.target.value)}>{['day', 'week', 'month'].map(value => <option key={value}>{value}</option>)}</select></label></>}
      </div>
    </div>
    {query.isLoading && <div role="status" className="grid animate-pulse gap-4 sm:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-slate-800" />)}<span className="sr-only">Loading revenue…</span></div>}
    {query.isError && <div role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-300">Unable to load this report. <button className="ml-2 underline underline-offset-4" onClick={() => query.refetch()}>Retry revenue report</button></div>}
    {report && !query.isError && <>
      <div className="grid gap-4 sm:grid-cols-3">
        {[{ label: 'Total revenue', value: money(report.totalRevenue), note: 'Revenue from paid orders', Icon: DollarSign, tone: 'bg-blue-500/15 text-blue-400' }, { label: 'Paid orders', value: report.totalOrders.toLocaleString(), note: 'Orders in the selected period', Icon: ShoppingBag, tone: 'bg-violet-500/15 text-violet-400' }, { label: 'Average order value', value: money(report.totalOrders ? report.totalRevenue / report.totalOrders : 0), note: 'Revenue per paid order', Icon: TrendingUp, tone: 'bg-emerald-500/15 text-emerald-400' }].map(({ label, value, note, Icon, tone }) => <div key={label} className={card}><div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-400">{label}</p><span className={`rounded-xl p-2 ${tone}`}><Icon size={18} /></span></div><p className="mt-4 break-words text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-2 text-xs text-slate-500">{note}</p></div>)}
      </div>
      <div className={card}><div className="mb-8 flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><BarChart3 size={18} className="text-blue-400" /> Revenue trend</h3><span className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-blue-500" />Revenue (USD)</span></div><RevenueChart key={params} data={report.timeline} monthly={grouping === 'month'} /></div>
      {detailed && <>
        <section className={card}><div className="mb-5 flex items-center justify-between"><h3 className="font-semibold">Revenue breakdown</h3><span className="text-xs text-slate-500">Grouped by {grouping}</span></div><div className="max-h-96 overflow-auto rounded-xl ring-1 ring-white/5"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-800 text-xs text-slate-400 print:bg-slate-100"><tr><th className="px-4 py-3 font-medium">{grouping === 'month' ? 'Month' : 'Date'}</th><th className="px-4 py-3 text-right font-medium">Revenue</th><th className="px-4 py-3 text-right font-medium">Paid orders</th></tr></thead><tbody className="divide-y divide-slate-800">{report.timeline.map(row => <tr key={row.date} className="transition hover:bg-slate-800/50"><td className="whitespace-nowrap px-4 py-3 text-slate-400">{row.date}</td><td className="px-4 py-3 text-right font-medium tabular-nums">{money(row.revenue)}</td><td className="px-4 py-3 text-right tabular-nums text-slate-400">{row.orders}</td></tr>)}</tbody></table>{!report.timeline.length && <p className="p-6 text-center text-sm text-slate-500">No revenue recorded in this period.</p>}</div></section>
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <section className={card}><h3 className="mb-5 flex items-center gap-2 font-semibold"><ShoppingBag size={18} className="text-blue-400" />Top products</h3>{!report.topProducts.length && <p className="rounded-xl bg-slate-800/50 p-5 text-sm text-slate-400">No products sold in this period.</p>}<ol className="divide-y divide-slate-800">{report.topProducts.map((product, index) => <li key={product.id} className="flex gap-3 py-4 first:pt-0 last:pb-0"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-400">{index + 1}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{product.title}</p><p className="mt-1 text-xs text-slate-500">{product.quantity} sold</p></div><span className="text-sm font-medium tabular-nums">{money(product.revenue)}</span></li>)}</ol></section>
          <section className={card}><h3 className="mb-5 flex items-center gap-2 font-semibold"><Ticket size={18} className="text-violet-400" />Coupon performance</h3>{!report.coupons.length && <p className="rounded-xl bg-slate-800/50 p-5 text-sm text-slate-400">No coupon usage in this period.</p>}<ul className="divide-y divide-slate-800">{report.coupons.map(coupon => <li key={coupon.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"><div className="min-w-0"><p className="break-all font-mono text-sm font-medium text-violet-300">{coupon.code}</p><p className="mt-1 text-xs text-slate-500">{coupon.uses} uses</p></div><div className="text-right"><p className="text-sm font-medium tabular-nums">{money(coupon.discount)}</p><p className="mt-1 text-xs text-slate-500">Discount given</p></div></li>)}</ul></section>
        </div>
      </>}
    </>}
  </section>;
}
