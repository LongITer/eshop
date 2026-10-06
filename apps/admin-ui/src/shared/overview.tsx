'use client';
import Link from 'next/link';
import { ArrowUpRight, DollarSign, Package, ShoppingBag, Store, Users } from 'lucide-react';
import { SeriesChart } from '@packages/components/analytics';
import { EmptyState, money, Panel } from './admin-ui';

export interface OverviewData {
  stats: { revenue: number; totalOrders: number; totalUsers: number; totalSellers: number; totalProducts: number };
  timeline: { date: string; revenue: number; users: number; sellers: number; orders: number }[];
  topProducts: { id: string; title: string; quantity: number; totalPrice: number }[];
}
export default function Overview({ data }: { data: OverviewData }) {
  const cards = [
    { label: 'Total revenue', value: money(data.stats.revenue), note: 'Paid orders in selected period', icon: DollarSign, color: 'bg-blue-500/10 text-blue-400', href: '/payments' },
    { label: 'Orders', value: data.stats.totalOrders.toLocaleString(), note: 'Orders in selected period', icon: ShoppingBag, color: 'bg-violet-500/10 text-violet-400', href: '/orders' },
    { label: 'Customers', value: data.stats.totalUsers.toLocaleString(), note: 'Registered customers · all time', icon: Users, color: 'bg-emerald-500/10 text-emerald-400', href: '/users' },
    { label: 'Sellers', value: data.stats.totalSellers.toLocaleString(), note: 'Marketplace sellers · all time', icon: Store, color: 'bg-amber-500/10 text-amber-400', href: '/sellers' },
  ];
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, note, icon: Icon, color, href }) => <Link key={label} href={`/dashboard${href}`} className="admin-panel group p-5 hover:border-slate-600"><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-400">{label}</p><span className={`rounded-lg p-2 ${color}`}><Icon size={18} /></span></div><p className="mt-4 text-3xl font-semibold tracking-tight text-white">{value}</p><div className="mt-3 flex items-center justify-between gap-2"><p className="text-[11px] text-slate-500">{note}</p><ArrowUpRight size={14} className="text-slate-600 group-hover:text-blue-400" /></div></Link>)}</div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <Panel title="Revenue overview" subtitle="Daily revenue from paid, non-returned orders" action={<span className="rounded-md bg-blue-500/10 px-2.5 py-1 text-xs text-blue-400">USD</span>}><div className="p-5"><p className="mb-5 text-3xl font-semibold tracking-tight text-white">{money(data.stats.revenue)}</p>{data.timeline.length ? <SeriesChart rows={data.timeline} fields={['revenue']} /> : <EmptyState title="No revenue yet" />}</div></Panel>
      <Panel title="Marketplace at a glance" subtitle="Your catalog and community"><div className="space-y-5 p-5"><div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5"><Package size={23} className="mb-4 text-blue-400" /><p className="text-3xl font-semibold text-white">{data.stats.totalProducts.toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">Products in your marketplace</p><Link href="/dashboard/products" className="mt-5 flex items-center justify-between border-t border-blue-500/15 pt-4 text-xs font-medium text-blue-400">Explore catalog <ArrowUpRight size={15} /></Link></div>{[{ label: 'Manage seller community', href: '/sellers', icon: Store }, { label: 'Send a notification', href: '/notifications', icon: Users }, { label: 'Review activity logs', href: '/loggers', icon: ShoppingBag }].map(({ label, href, icon: Icon }) => <Link className="flex items-center gap-3 text-sm text-slate-400 hover:text-white" key={href} href={`/dashboard${href}`}><Icon size={16} />{label}<ArrowUpRight className="ml-auto" size={14} /></Link>)}</div></Panel>
    </div>
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Community growth" subtitle="New customer and seller registrations"><div className="p-5">{data.timeline.length ? <SeriesChart rows={data.timeline} fields={['users', 'sellers']} /> : <EmptyState title="No registrations yet" />}</div></Panel>
      <Panel title="Best selling products" subtitle="Ranked by units sold in selected period" action={<Link href="/dashboard/products" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>}>{data.topProducts.length ? <div className="overflow-x-auto"><table className="admin-table"><thead><tr><th>Product</th><th>Units sold</th><th className="text-right">Revenue</th></tr></thead><tbody>{data.topProducts.map((product, i) => <tr key={product.id}><td><div className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">{String(i + 1).padStart(2, '0')}</span><span className="line-clamp-2 max-w-60 text-xs font-medium text-slate-200">{product.title}</span></div></td><td className="text-xs tabular-nums text-slate-400">{product.quantity}</td><td className="text-right text-xs tabular-nums text-white">{money(product.totalPrice)}</td></tr>)}</tbody></table></div> : <EmptyState title="Your best sellers will appear here" description="Products are ranked once paid orders are recorded." />}</Panel>
    </div>
  </>;
}
