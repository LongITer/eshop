'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SeriesChart } from '@packages/components/analytics';
import axios from 'apps/seller-ui/src/utils/axioInstance';
export default function Reports() {
  const [interval, setInterval] = useState('day');
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [error, setError] = useState('');
  const params = new URLSearchParams({ interval, ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const query = useQuery({ queryKey: ['revenue-report', params], queryFn: async () => (await axios.get(`/product/api/seller-reports?${params}`)).data });
  const download = async () => { try { const { data } = await axios.get(`/product/api/seller-reports?${params}&format=csv`, { responseType: 'blob' }); const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = 'seller-revenue.csv'; a.click(); URL.revokeObjectURL(url); } catch { setError('Export failed'); } };
  return <main className="p-6 text-white space-y-6 print:text-black"><h1 className="text-2xl font-bold">Revenue report</h1><div className="flex flex-wrap gap-4 print:hidden"><label>From<input aria-label="From" className="block bg-slate-900 border p-2" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>To<input aria-label="To" className="block bg-slate-900 border p-2" type="date" value={to} onChange={e => setTo(e.target.value)} /></label><select aria-label="Interval" className="bg-slate-900 border p-2" value={interval} onChange={e => setInterval(e.target.value)}>{['day', 'week', 'month'].map(v => <option key={v}>{v}</option>)}</select><button onClick={download}>Export CSV</button><button onClick={() => window.print()}>Print / Save PDF</button></div>{query.isLoading && <p>Loading report…</p>}{(query.isError || error) && <p role="alert">{error || 'Unable to load report. Check the date range.'}</p>}{query.data && <><p className="text-xl">${query.data.totalRevenue.toFixed(2)} · {query.data.totalOrders} paid orders</p><SeriesChart rows={query.data.timeline} fields={['revenue']} /><h2 className="text-xl">Top products</h2>{query.data.topProducts.map((p: any) => <p key={p.id}>{p.title} · {p.quantity} sold · ${p.revenue.toFixed(2)}</p>)}<h2 className="text-xl">Coupon performance</h2>{!query.data.coupons.length && <p>No coupon usage in this period.</p>}{query.data.coupons.map((c: any) => <p key={c.id}>{c.code} · {c.uses} uses · ${c.discount.toFixed(2)} discounted</p>)}</>}</main>;
}
