'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Bell, ChevronRight, CreditCard, LayoutDashboard, Menu, Package, Palette, Settings2, ShieldCheck, ShoppingBag, Store, Tag, Users, UsersRound, X } from 'lucide-react';
import useAdmin from '../app/hooks/useAdmin';

const groups = [
  { title: 'Workspace', links: [
    { label: 'Overview', path: '', icon: LayoutDashboard },
    { label: 'Orders', path: '/orders', icon: ShoppingBag },
    { label: 'Payments', path: '/payments', icon: CreditCard },
    { label: 'Products', path: '/products', icon: Package },
    { label: 'Events', path: '/events', icon: Tag },
  ] },
  { title: 'Community', links: [
    { label: 'Users', path: '/users', icon: Users },
    { label: 'Sellers', path: '/sellers', icon: Store },
    { label: 'Notifications', path: '/notifications', icon: Bell },
  ] },
  { title: 'Administration', links: [
    { label: 'Activity logs', path: '/loggers', icon: Activity },
    { label: 'Log settings', path: '/log-settings', icon: Settings2 },
    { label: 'Team management', path: '/management', icon: UsersRound },
    { label: 'Customization', path: '/customization', icon: Palette },
  ] },
];
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { admin } = useAdmin();
  const current = groups.flatMap(group => group.links).find(link => `/dashboard${link.path}` === pathname)?.label ?? 'Administration';
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const navigation = <>{groups.map(group => <div key={group.title}><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group.title}</p><div className="space-y-1">{group.links.map(({ label, path, icon: Icon }) => <Link key={path} onClick={() => setOpen(false)} href={`/dashboard${path}`} aria-current={pathname === `/dashboard${path}` ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${pathname === `/dashboard${path}` ? 'bg-blue-500/15 font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}><Icon size={18} strokeWidth={1.7} />{label}{pathname === `/dashboard${path}` && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}</Link>)}</div></div>)}</>;
  return <div className="min-h-screen bg-[#080b12]">
    <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-blue-600 focus:p-3">Skip to content</a>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-gray-800 bg-[#0b0f18] lg:flex">
      <Link href="/dashboard" className="flex items-center gap-3 px-6 py-7"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><ShoppingBag size={22} /></span><span className="text-xl font-bold tracking-tight text-white">Eshop<span className="ml-2 rounded border border-blue-400/20 bg-blue-500/10 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-widest text-blue-400">Admin</span></span></Link>
      <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">{navigation}</nav>
      <div className="mx-4 mb-4 rounded-xl border border-gray-800 bg-gray-900 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-medium text-white"><ShieldCheck size={17} className="text-blue-400" /> Admin workspace</div><p className="text-xs leading-5 text-slate-500">Your marketplace, people and operations in one place.</p></div>
    </aside>
    <div className="lg:pl-[248px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-4 border-b border-gray-800 bg-[#0b0f18]/95 px-4 backdrop-blur sm:px-8">
        <div className="flex items-center gap-3"><button className="admin-button !p-2 lg:hidden" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-admin-nav" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button><span className="hidden text-sm text-slate-500 sm:inline">Workspace</span><ChevronRight size={14} className="hidden text-slate-600 sm:block" /><span className="text-sm font-medium text-slate-200">{current}</span></div>
        <div className="flex items-center gap-4"><Link href="/dashboard/notifications" aria-label="Notifications" className="rounded-lg border border-gray-800 p-2.5 text-slate-400 hover:bg-gray-800 hover:text-white"><Bell size={18} /></Link><span className="h-8 border-l border-gray-800" /><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/15 text-sm font-semibold text-blue-300">{admin?.name?.slice(0, 2).toUpperCase() || 'AD'}</span><div className="hidden sm:block"><p className="max-w-40 truncate text-sm font-medium text-white">{admin?.name || 'Administrator'}</p><p className="text-[11px] text-slate-500">Marketplace admin</p></div></div></div>
      </header>
      {open && <nav id="mobile-admin-nav" aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 top-[72px] z-30 space-y-6 overflow-auto bg-[#0b0f18] p-5 lg:hidden">{navigation}</nav>}
      <main id="admin-main" className="admin-content min-w-0"><div>{children}</div></main>
    </div>
  </div>;
}
