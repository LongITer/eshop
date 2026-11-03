'use client';
import { useAdminText } from './admin-text';
import Link from 'next/link';
import { ArrowUpRight, DollarSign, Package, ShoppingBag, Store, Users } from 'lucide-react';
import { SeriesChart } from '@packages/components/analytics';
import { EmptyState, money, Panel } from './admin-ui';

export interface OverviewData {
  stats: { revenue: number; earnings: number; totalOrders: number; totalUsers: number; totalSellers: number; totalProducts: number; estimatedOrders?: number };
  timeline: { date: string; revenue: number; earnings: number; users: number; sellers: number; orders: number }[];
  topProducts: { id: string; title: string; quantity: number; totalPrice: number }[];
}
export default function Overview({ data }: { data: OverviewData }) {
  const t = useAdminText();
  const cards = [
    { label: t('Platform earnings'), value: money(data.stats.earnings), note: data.stats.estimatedOrders ? `${data.stats.estimatedOrders} ${t('orders use an estimated 10% fee')}` : t('Recorded platform fees'), icon: DollarSign, color: 'bg-emerald-500/10 text-emerald-400', href: '/statistics' },
    { label: t('Total revenue'), value: money(data.stats.revenue), note: t('Paid orders in selected period'), icon: DollarSign, color: 'bg-blue-500/10 text-blue-400', href: '/payments' },
    { label: t('Orders'), value: data.stats.totalOrders.toLocaleString(), note: t('Orders in selected period'), icon: ShoppingBag, color: 'bg-violet-500/10 text-violet-400', href: '/statistics' },
    { label: t('Customers'), value: data.stats.totalUsers.toLocaleString(), note: t('Registered customers · all time'), icon: Users, color: 'bg-indigo-500/10 text-indigo-400', href: '/users' },
    { label: t('Sellers'), value: data.stats.totalSellers.toLocaleString(), note: t('Marketplace sellers · all time'), icon: Store, color: 'bg-amber-500/10 text-amber-400', href: '/sellers' },
  ];
  return <>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{cards.map(({ label, value, note, icon: Icon, color, href }) => <Link key={label} href={`/dashboard${href}`} className="admin-panel group p-5 hover:border-slate-600"><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-400">{label}</p><span className={`rounded-lg p-2 ${color}`}><Icon size={18} /></span></div><p className="mt-4 break-words text-2xl font-semibold tracking-tight text-white">{value}</p><div className="mt-3 flex items-center justify-between gap-2"><p className="text-[11px] text-slate-500">{note}</p><ArrowUpRight size={14} className="text-slate-600 group-hover:text-blue-400" /></div></Link>)}</div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <Panel title={t("Revenue overview")} subtitle={t("Daily revenue and earnings from paid, non-returned orders")} action={<span className="rounded-md bg-blue-500/10 px-2.5 py-1 text-xs text-blue-400">USD</span>}><div className="p-5"><p className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-2xl font-semibold tracking-tight text-white">{money(data.stats.earnings)} <span className="text-sm font-medium text-slate-500">{t("Earnings")}</span> <span className="text-slate-700">|</span> {money(data.stats.revenue)} <span className="text-sm font-medium text-slate-500">{t("Revenue")}</span></p>{data.timeline.length ? <SeriesChart rows={data.timeline} fields={['revenue', 'earnings']} /> : <EmptyState title={t("No revenue yet")} />}</div></Panel>
      <Panel title={t("Marketplace at a glance")} subtitle={t("Your catalog and community")}><div className="space-y-5 p-5"><div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5"><Package size={23} className="mb-4 text-blue-400" /><p className="text-3xl font-semibold text-white">{data.stats.totalProducts.toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">{t("Products in your marketplace")}</p><Link href="/dashboard/products" className="mt-5 flex items-center justify-between border-t border-blue-500/15 pt-4 text-xs font-medium text-blue-400">{t("Explore catalog")} <ArrowUpRight size={15} /></Link></div>{[{ label: t('Manage seller community'), href: '/sellers', icon: Store }, { label: t('Send a notification'), href: '/notifications', icon: Users }, { label: 'Vi phạm sản phẩm', href: '/violations', icon: ShoppingBag }].map(({ label, href, icon: Icon }) => <Link className="flex items-center gap-3 text-sm text-slate-400 hover:text-white" key={href} href={`/dashboard${href}`}><Icon size={16} />{label}<ArrowUpRight className="ml-auto" size={14} /></Link>)}</div></Panel>
    </div>
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title={t("Community growth")} subtitle={t("New customer and seller registrations")}><div className="p-5">{data.timeline.length ? <SeriesChart rows={data.timeline} fields={['users', 'sellers']} /> : <EmptyState title={t("No registrations yet")} />}</div></Panel>
      <Panel title={t("Best selling products")} subtitle={t("Ranked by units sold in selected period")} action={<Link href="/dashboard/products" className="text-xs text-blue-400 hover:text-blue-300">{t("View all →")}</Link>}>{data.topProducts.length ? <div className="overflow-x-auto"><table className="admin-table"><thead><tr><th>{t("Product")}</th><th>{t("Units sold")}</th><th className="text-right">{t("Revenue")}</th></tr></thead><tbody>{data.topProducts.map((product, i) => <tr key={product.id}><td><div className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-500">{String(i + 1).padStart(2, '0')}</span><span className="line-clamp-2 max-w-60 text-xs font-medium text-slate-200">{product.title}</span></div></td><td className="text-xs tabular-nums text-slate-400">{product.quantity}</td><td className="text-right text-xs tabular-nums text-white">{money(product.totalPrice)}</td></tr>)}</tbody></table></div> : <EmptyState title={t("Your best sellers will appear here")} description={t("Products are ranked once paid orders are recorded.")} />}</Panel>
    </div>
  </>;
}
