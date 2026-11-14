'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Bell, ChartNoAxesCombined, ChevronRight, CreditCard, LayoutDashboard, Loader2, LogOut, Mail, Menu, Package, Plus, RefreshCw, Settings, ShoppingBag, Store, Tags, Warehouse, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { LanguageSwitcher, useLanguage } from '@packages/components/language-switcher';
import { UnreadMessages } from '@packages/components/chat';
import useSeller from '../../hooks/useSeller';
import axios from '../../utils/axioInstance';
import { isSuspended } from '@packages/utils/admin-access';
import SellerNotificationToasts from './seller-notification-toasts';

const groups = [
  { label: 'Workspace', vi: 'Không gian làm việc', links: [
    { href: '/dashboard', label: 'Overview', vi: 'Tổng quan', Icon: LayoutDashboard },
    { href: '/dashboard/orders', label: 'Orders', vi: 'Đơn hàng', Icon: ShoppingBag },
    { href: '/dashboard/payment', label: 'Payments', vi: 'Thanh toán', Icon: CreditCard },
    { href: '/dashboard/violations', label: 'Violations & remediation', vi: 'Vi phạm & khắc phục', Icon: Bell },
    { href: '/dashboard/reports', label: 'Revenue reports', vi: 'Báo cáo doanh thu', Icon: ChartNoAxesCombined },
    { href: '/dashboard/statistics', label: 'Statistics', vi: 'Thống kê', Icon: ChartNoAxesCombined },
  ] },
  { label: 'Catalog', vi: 'Danh mục kinh doanh', links: [
    { href: '/dashboard/all-products', label: 'Products', vi: 'Sản phẩm', Icon: Package },
    { href: '/dashboard/create-product', label: 'Add product', vi: 'Thêm sản phẩm', Icon: Plus },
    { href: '/dashboard/inventory', label: 'Inventory', vi: 'Kho hàng', Icon: Warehouse },
    { href: '/dashboard/discount-codes', label: 'Discount codes', vi: 'Mã giảm giá', Icon: Tags },
  ] },
  { label: 'Store', vi: 'Cửa hàng', links: [
    { href: '/dashboard/inbox', label: 'Inbox', vi: 'Hộp thư', Icon: Mail },
    { href: '/dashboard/notification', label: 'Notifications', vi: 'Thông báo', Icon: Bell },
    { href: '/dashboard/shop-settings', label: 'Shop settings', vi: 'Cài đặt cửa hàng', Icon: Settings },
  ] },
];

export default function SellerShell({ children }: { children: React.ReactNode }) {
  const { seller, isLoading, isError, refetch } = useSeller();
  const pathname = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const { language } = useLanguage();
  const vi = language === 'vi';
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const restricted = !!seller && isSuspended(seller);
  const remedial = ['/dashboard/violations', '/dashboard/orders', '/dashboard/payment', '/dashboard/notification'];
  const allowed = !restricted || remedial.some(path => pathname.startsWith(path));
  useEffect(() => { if (restricted && !allowed) router.replace('/dashboard/violations'); }, [restricted, allowed, router]);
  const active = (href: string) => href === '/dashboard' ? pathname === href
    : pathname.startsWith(href) || (href === '/dashboard/all-products' && pathname.startsWith('/dashboard/edit-product/'));
  const current = groups.flatMap(group => group.links).find(link => active(link.href));
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!isLoading && !isError && !seller) router.replace('/login');
  }, [isLoading, isError, seller, router]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const logout = async () => {
    setLeaving(true);
    try { await axios.get('/api/logout-seller'); client.clear(); router.replace('/login'); }
    catch { toast.error(vi ? 'Không đăng xuất được. Vui lòng thử lại.' : 'Could not sign out. Please try again.'); setLeaving(false); }
  };
  if (isLoading || (!isError && !seller)) return <div role="status" className="flex min-h-screen items-center justify-center gap-3 bg-[#080d1a] p-6 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin text-blue-400" />{vi ? 'Đang mở cửa hàng…' : 'Opening your workspace…'}</div>;
  if (isError && !seller) return <div className="flex min-h-screen items-center justify-center bg-[#080d1a] p-6 text-slate-100"><div role="alert" className="seller-panel max-w-md p-8 text-center"><Store className="mx-auto mb-4 h-10 w-10 text-blue-400" /><h1 className="text-lg font-semibold">{vi ? 'Chưa kết nối được cửa hàng' : 'Unable to connect to your store'}</h1><p className="mt-2 text-sm leading-6 text-slate-400">{vi ? 'Dữ liệu phiên đăng nhập chưa tải được. Vui lòng thử lại.' : 'Your session could not be loaded. Please retry when the connection is available.'}</p><button onClick={() => refetch()} className="seller-button mt-5 bg-blue-600 text-white hover:bg-blue-500"><RefreshCw size={16} />{vi ? 'Thử lại' : 'Try again'}</button></div></div>;
  const shop = seller?.shop;
  const storeUrl = `${(process.env.NEXT_PUBLIC_USER_UI_LINK || 'http://localhost:3000').replace(/\/$/, '')}/shop/${shop?.id}`;
  const navigation = <nav aria-label={vi ? 'Điều hướng người bán' : 'Seller navigation'} className="space-y-6">
    {groups.map(group => <div key={group.label}><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">{vi ? group.vi : group.label}</p><div className="space-y-1">{group.links.filter(link => !restricted || remedial.includes(link.href)).map(({ href, label, vi: translated, Icon }) => {
      const selected = active(href);
      const content = (count = 0) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={selected ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${selected ? 'bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/20' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}><Icon className={`h-[18px] w-[18px] shrink-0 ${selected ? 'text-blue-400' : 'text-slate-500'}`} strokeWidth={1.8} /><span className="min-w-0 flex-1">{vi ? translated : label}</span>{count > 0 && <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] text-white" aria-label={`${count} unread messages`}>{count > 99 ? '99+' : count}</span>}{selected && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}</Link>;
      return href === '/dashboard/inbox' ? <UnreadMessages key={href} api={axios} href={href} renderLink={content} /> : content();
    })}</div></div>)}
  </nav>;
  return <div className="seller-shell min-h-screen lg:flex">
    <a href="#seller-main" className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-blue-600 px-4 py-3 text-sm text-white focus:not-sr-only">{vi ? 'Đến nội dung chính' : 'Skip to main content'}</a>
    <SellerNotificationToasts />
    <aside data-seller-navigation className="hidden w-[248px] shrink-0 border-r border-slate-800/80 bg-[#0b1120] lg:block print:hidden">
      <div className="seller-sidebar-scroll sticky top-0 flex h-dvh flex-col overflow-y-auto px-4 pb-5">
        <Link href="/dashboard" className="flex min-h-[81px] items-center gap-2.5 px-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-950/40"><ShoppingBag size={18} strokeWidth={2} /></span><span className="text-xl font-bold tracking-tight text-white">eshop<span className="text-blue-400">.</span></span><span className="ml-auto rounded border border-slate-700 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-slate-400">SELLER</span></Link>
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-blue-300"><Store size={18} /></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">{shop?.name || seller?.name}</p><p className="mt-1 truncate text-[10px] text-slate-500">{vi ? 'Không gian người bán' : 'Your seller workspace'}</p></div></div>
        {navigation}
        <div className="mt-auto pt-8"><div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"><p className="text-xs font-medium text-slate-300">{vi ? 'Cửa hàng của bạn, trong tầm tay.' : 'Your store, at a glance.'}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{vi ? 'Quản lý sản phẩm, theo dõi đơn và chăm sóc khách hàng.' : 'Manage your catalog, fulfill orders and stay close to your customers.'}</p></div><button type="button" onClick={logout} disabled={leaving} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50">{leaving ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <LogOut size={18} />}{vi ? 'Đăng xuất' : 'Sign out'}</button></div>
      </div>
    </aside>
    <div className="min-w-0 flex-1">
      <header data-seller-navigation className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0b1120] print:hidden">
        <div className="flex min-h-[81px] items-center gap-3 px-4 sm:px-6 xl:px-8">
          <button type="button" onClick={() => setOpen(!open)} aria-label={vi ? 'Mở điều hướng' : 'Toggle navigation'} aria-expanded={open} aria-controls="seller-mobile-navigation" className="rounded-xl border border-slate-800 p-2.5 text-slate-300 lg:hidden">{open ? <X size={20} /> : <Menu size={20} />}</button>
          <div className="min-w-0 flex-1"><p className="hidden text-[10px] font-medium uppercase tracking-[.14em] text-slate-500 sm:block">{vi ? 'Trung tâm người bán' : 'Seller center'}</p><p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-200"><Store className="hidden h-3.5 w-3.5 text-slate-500 sm:block" /><span className="hidden truncate text-slate-400 sm:block">{shop?.name || 'Eshop'}</span><ChevronRight className="hidden h-3.5 w-3.5 text-slate-600 sm:block" /><span className="truncate">{current ? vi ? current.vi : current.label : vi ? 'Cửa hàng' : 'Store'}</span></p></div>
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {shop?.id && <Link href={storeUrl} target="_blank" rel="noopener noreferrer" className="seller-button hidden border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white md:inline-flex"><Store size={15} />{vi ? 'Xem cửa hàng' : 'View store'}<ArrowUpRight size={14} className="text-slate-500" /></Link>}
          <Link href="/dashboard/notification" aria-label={vi ? 'Thông báo' : 'Notifications'} className="rounded-xl border border-slate-800 p-2.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"><Bell size={18} /></Link>
          <span title={seller?.name} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-sm font-bold text-blue-300 ring-1 ring-inset ring-blue-500/20">{(seller?.name || 'S').slice(0, 1).toUpperCase()}</span>
        </div>
        {open && <div id="seller-mobile-navigation" className="seller-sidebar-scroll max-h-[calc(100dvh-81px)] overflow-y-auto border-t border-slate-800 p-4 lg:hidden"><div className="mb-5 flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-200">{shop?.name || 'Eshop Seller'}</p><LanguageSwitcher /></div>{navigation}<button type="button" disabled={leaving} onClick={logout} className="seller-button mt-5 w-full border border-slate-800 text-slate-400"><LogOut size={16} />{vi ? 'Đăng xuất' : 'Sign out'}</button></div>}
      </header>
      <div key={seller?.id} id="seller-main" tabIndex={-1} className="seller-content min-w-0 outline-none">{restricted && <p className="m-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">{vi ? 'Tài khoản bị khóa bán hàng. Bạn vẫn có thể khắc phục các đơn cũ và xem lý do vi phạm.' : 'Selling is suspended. You can still remedy existing orders and review violation notices.'}</p>}{allowed ? children : null}</div>
      <footer className="mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/70 py-5 text-[11px] text-slate-600 sm:mx-6 xl:mx-8 print:hidden"><span>Eshop Seller Center</span><span>{vi ? 'Giá sản phẩm và báo cáo sử dụng USD' : 'Catalog prices and reports are in USD'}</span></footer>
    </div>
  </div>;
}
