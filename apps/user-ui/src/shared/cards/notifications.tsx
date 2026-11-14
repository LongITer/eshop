'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Bell, CheckCheck, ChevronLeft, ChevronRight, LogIn, RefreshCw } from 'lucide-react';
import { useStorefrontText } from '@packages/components/storefront-language';
import useUser from '@/hooks/useUser';
import { useNotifications, useReadNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from '@/shared/components/notification-item';

function NotificationSkeleton() {
  const { t } = useStorefrontText();
  return <div role="status" aria-label={t('Loading notifications…')} className="divide-y divide-slate-100">
    {[0, 1, 2, 3].map(index => <div key={index} className="flex animate-pulse gap-4 px-5 py-6"><div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" /><div className="flex-1 space-y-3"><div className="h-3 w-2/5 rounded bg-slate-100" /><div className="h-3 w-5/6 rounded bg-slate-100" /><div className="h-3 w-1/4 rounded bg-slate-100" /></div></div>)}
    <span className="sr-only">{t('Loading notifications…')}</span>
  </div>;
}

export default function Notifications() {
  const { t, locale } = useStorefrontText();
  const { user, isLoading: loadingUser, isError: userError, refetch: retryUser } = useUser();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const query = useNotifications(user?.id, { page, limit: 20, unreadOnly });
  const read = useReadNotifications(user?.id);
  const listId = useId();
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 20));
  const formatter = new Intl.NumberFormat(locale);

  useEffect(() => { setPage(1); setUnreadOnly(false); }, [user?.id]);
  useEffect(() => { if (query.data && page > pageCount) setPage(pageCount); }, [query.data, page, pageCount]);

  if (loadingUser) return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><NotificationSkeleton /></section>;
  if (userError) return <section role="alert" className="flex flex-col items-center rounded-2xl border border-rose-100 bg-white px-5 py-12 text-center"><AlertCircle className="mb-3 text-rose-400" size={30} /><p className="font-medium text-slate-800">{t('Unable to load notifications.')}</p><button type="button" onClick={() => retryUser()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><RefreshCw size={15} />{t('Retry')}</button></section>;
  if (!user) return <section className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm"><span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#3489FF]"><Bell size={27} strokeWidth={1.6} /></span><h2 className="text-lg font-semibold text-slate-900">{t('Sign in to view your notifications.')}</h2><Link href="/login" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#3489FF] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"><LogIn size={16} />{t('Sign in')}</Link></section>;

  const groups = (query.data?.notifications ?? []).reduce<Array<{ label: string; items: NonNullable<typeof query.data>['notifications'] }>>((result, notification) => {
    const created = new Date(notification.createdAt);
    const today = new Date();
    const label = created.toDateString() === today.toDateString() ? 'Today' : 'Earlier';
    let group = result.find(item => item.label === label);
    if (!group) { group = { label, items: [] }; result.push(group); }
    group.items.push(notification);
    return result;
  }, []);

  return <section aria-label={t('Notification center')} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-b border-slate-100 px-4 pt-4 sm:px-6">
      <div role="tablist" aria-label={t('Notifications')} className="flex gap-5 sm:gap-7">
        {[{ label: 'All notifications', unread: false, count: query.data?.totalCount }, { label: 'Unread', unread: true, count: query.data?.unreadCount }].map(tab => <button key={tab.label} type="button" role="tab" aria-selected={unreadOnly === tab.unread} aria-controls={listId} onClick={() => { setUnreadOnly(tab.unread); setPage(1); }} className={`inline-flex items-center gap-2 border-b-2 pb-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${unreadOnly === tab.unread ? 'border-[#3489FF] text-[#2876df]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t(tab.label)}{typeof tab.count === 'number' && <span className={`rounded-full px-2 py-0.5 text-[11px] leading-4 ${unreadOnly === tab.unread ? 'bg-blue-50 text-[#2876df]' : 'bg-slate-100 text-slate-500'}`}>{formatter.format(tab.count)}</span>}</button>)}
      </div>
      <div className="mb-3 flex items-center gap-2">
        <button type="button" aria-label={t('Refresh notifications')} title={t('Refresh notifications')} disabled={query.isFetching} onClick={() => query.refetch()} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-[#3489FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-wait"><RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} aria-hidden="true" /></button>
        <button type="button" disabled={read.isPending || !query.data?.unreadCount} onClick={() => read.mutate(undefined)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-[#2876df] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-default disabled:opacity-40"><CheckCheck size={15} aria-hidden="true" />{t('Mark all as read')}</button>
      </div>
    </div>
    {read.isError && <p role="alert" className="flex items-center gap-2 border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700"><AlertCircle size={16} className="shrink-0" />{t('Could not update notifications. Please retry.')}</p>}
    <div id={listId} role="tabpanel" aria-label={t(unreadOnly ? 'Unread' : 'All notifications')} aria-busy={query.isFetching}>
      {query.isLoading ? <NotificationSkeleton /> : query.isError ? <div role="alert" className="flex flex-col items-center px-5 py-14 text-center"><AlertCircle size={28} className="mb-3 text-slate-400" /><p className="font-medium text-slate-800">{t('Unable to load notifications.')}</p><button type="button" onClick={() => query.refetch()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><RefreshCw size={15} />{t('Retry')}</button></div>
        : !query.data?.notifications.length ? <div className="flex flex-col items-center px-6 py-16 text-center"><span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#3489FF]">{unreadOnly ? <CheckCheck size={28} strokeWidth={1.6} /> : <Bell size={28} strokeWidth={1.6} />}</span><h2 className="text-lg font-semibold text-slate-800">{t(unreadOnly ? 'All caught up' : 'No notifications yet.')}</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{t(unreadOnly ? 'No unread notifications.' : 'Stay up to date with your orders and account.')}</p></div>
          : groups.map(group => <div key={group.label}><div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs font-semibold text-slate-500 sm:px-6">{t(group.label)}</div><div className="divide-y divide-slate-100">{group.items.map(notification => <NotificationItem key={notification.id} notification={notification} onRead={id => read.mutate(id)} reading={read.isPending} />)}</div></div>)}
    </div>
    {query.data && total > 0 && <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 sm:px-6">
      <p className="text-xs text-slate-500">{t('Page')} <span className="font-medium text-slate-800">{formatter.format(page)}</span> / {formatter.format(pageCount)}</p>
      <nav aria-label={t('Notification pages')} className="flex items-center gap-2"><button type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPage(current => current - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-default disabled:opacity-35"><ChevronLeft size={14} aria-hidden="true" />{t('Previous')}</button><button type="button" disabled={page >= pageCount || query.isFetching} onClick={() => setPage(current => current + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-default disabled:opacity-35">{t('Next')}<ChevronRight size={14} aria-hidden="true" /></button></nav>
    </footer>}
  </section>;
}

