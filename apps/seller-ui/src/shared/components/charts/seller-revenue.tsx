"use client";
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
const money = (value: number) => `$${value.toFixed(2)}`;
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
  return <section className="space-y-5 text-white print:text-black">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="text-lg font-semibold">Revenue · {custom ? "Custom period" : month ? `${month}/${year}` : year}</h2>
      <div className="flex flex-wrap gap-3 print:hidden">
        {detailed && <label className="text-sm">Period<select aria-label="Revenue period" className="ml-2 rounded border border-gray-700 bg-gray-900 p-2" value={custom ? "custom" : "monthly"} onChange={e => setCustom(e.target.value === "custom")}><option value="monthly">Monthly statistics</option><option value="custom">Custom dates</option></select></label>}
        {!custom && <>
        <label className="text-sm">Year<select aria-label="Revenue year" className="ml-2 rounded border border-gray-700 bg-gray-900 p-2" value={year} onChange={e => setYear(Number(e.target.value))}>
          {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(value => <option key={value}>{value}</option>)}
        </select></label>
        <label className="text-sm">Month<select aria-label="Revenue month" className="ml-2 rounded border border-gray-700 bg-gray-900 p-2" value={month} onChange={e => setMonth(e.target.value)}>
          <option value="">All months</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{new Date(2000, i, 1).toLocaleDateString("en-US", { month: "long" })}</option>)}
        </select></label>
        </>}
        {custom && <>
          <label>From<input aria-label="From" className="block bg-gray-900 border p-2" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></label>
          <label>To<input aria-label="To" className="block bg-gray-900 border p-2" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} /></label>
          <select aria-label="Interval" className="bg-gray-900 border p-2" value={interval} onChange={e => setInterval(e.target.value)}>{['day', 'week', 'month'].map(value => <option key={value}>{value}</option>)}</select>
        </>}
        {detailed && <><button disabled={exporting || !query.data || query.isError} onClick={download}>{exporting ? "Exporting…" : "Export CSV"}</button><button onClick={() => window.print()}>Print / Save PDF</button></>}
      </div>
    </div>
    {query.isLoading && <p className="text-gray-400">Loading revenue…</p>}
    {query.isError && <button className="text-blue-400" onClick={() => query.refetch()}>Retry revenue report</button>}
    {query.data && !query.isError && <>
      <p className="text-sm text-gray-400">{money(query.data.totalRevenue)} total · {query.data.totalOrders} paid orders · UTC</p>
      <RevenueChart key={params} data={query.data.timeline} monthly={grouping === "month"} />
      {detailed && <>
        <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>{grouping === "month" ? "Month" : "Date"}</th><th>Revenue</th><th>Paid orders</th></tr></thead><tbody>{query.data.timeline.map(row => <tr key={row.date} className="border-t border-gray-800"><td className="py-2">{row.date}</td><td>{money(row.revenue)}</td><td>{row.orders}</td></tr>)}</tbody></table></div>
        <h2 className="text-xl">Top products</h2>
        {!query.data.topProducts.length && <p>No products sold in this period.</p>}
        {query.data.topProducts.map(product => <p key={product.id}>{product.title} · {product.quantity} sold · {money(product.revenue)}</p>)}
        <h2 className="text-xl">Coupon performance</h2>
        {!query.data.coupons.length && <p>No coupon usage in this period.</p>}
        {query.data.coupons.map(coupon => <p key={coupon.id}>{coupon.code} · {coupon.uses} uses · {money(coupon.discount)} discounted</p>)}
      </>}
    </>}
  </section>;
}
