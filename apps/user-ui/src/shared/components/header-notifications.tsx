'use client';

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Bell, CheckCheck, Loader2, RefreshCw, X } from 'lucide-react';
import { useStorefrontText } from '@packages/components/storefront-language';
import useUser from '@/hooks/useUser';
import { useNotifications, useReadNotifications } from '@/hooks/useNotifications';
import { HeaderActionCount, headerActionClass, useHeaderChatController } from './header-chat';
import { NotificationItem } from './notification-item';

type NotificationController = { open: boolean; panelId: string; toggle: (trigger: HTMLButtonElement) => void };
const HeaderNotificationsContext = createContext<NotificationController | null>(null);

/** Both header rows share one panel, and opening Messages dismisses it. */
export function HeaderNotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();
  const chat = useHeaderChatController();
  const panelId = useId();
  const [opened, setOpened] = useState<{ userId: string; pathname: string } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const open = !!user?.id && opened?.userId === user.id && opened?.pathname === pathname && !chat?.open;
  useEffect(() => { setOpened(null); }, [pathname, user?.id]);
  useEffect(() => { if (chat?.open) setOpened(null); }, [chat?.open]);
  const close = useCallback((restoreFocus = false) => {
    setOpened(null);
    if (restoreFocus && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
  }, []);
  const toggle = (element: HTMLButtonElement) => {
    trigger.current = element;
    if (open || !user?.id) { setOpened(null); return; }
    chat?.close();
    setOpened({ userId: user.id, pathname });
  };
  return <HeaderNotificationsContext.Provider value={{ open, panelId, toggle }}>
    {children}
    {open && <HeaderNotificationsPopup key={user.id} userId={user.id} panelId={panelId} trigger={trigger.current} onClose={close} />}
  </HeaderNotificationsContext.Provider>;
}

export function HeaderNotificationButton({ userId }: { userId: string }) {
  const { t } = useStorefrontText();
  const controller = useContext(HeaderNotificationsContext);
  const query = useNotifications(userId, { limit: 1 });
  const count = query.data?.unreadCount ?? 0;
  const label = `${t('Notifications')}: ${count} ${t('unread')}`;
  const contents = <><Bell size={24} aria-hidden="true" /><HeaderActionCount count={count} /></>;
  if (!controller) return <Link href="/notifications" title={t('Notifications')} aria-label={label} className={headerActionClass}>{contents}</Link>;
  return <button type="button" data-header-notification-trigger title={t('Notifications')} aria-label={label} aria-haspopup="dialog" aria-expanded={controller.open} aria-controls={controller.open ? controller.panelId : undefined} onClick={event => controller.toggle(event.currentTarget)} className={headerActionClass}>{contents}</button>;
}

function HeaderNotificationsPopup({ userId, panelId, trigger, onClose }: {
  userId: string; panelId: string; trigger: HTMLButtonElement | null; onClose: (restoreFocus?: boolean) => void;
}) {
  const { t } = useStorefrontText();
  const query = useNotifications(userId, { limit: 6 });
  const read = useReadNotifications(userId);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 80, right: 12, width: 410, maxHeight: 560 });
  useEffect(() => { panel.current?.focus({ preventScroll: true }); }, []);
  useLayoutEffect(() => {
    const place = () => {
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const viewportTop = window.visualViewport?.offsetTop || 0;
      const margin = 12;
      const width = Math.min(410, viewportWidth - margin * 2);
      const visible = (button: HTMLButtonElement) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.bottom > viewportTop && rect.top < viewportTop + viewportHeight;
      };
      const anchor = trigger && visible(trigger) ? trigger : [...document.querySelectorAll<HTMLButtonElement>('[data-header-notification-trigger]')].find(visible);
      if (!anchor) { onClose(); return; }
      const rect = anchor.getBoundingClientRect();
      const top = Math.max(viewportTop + margin, Math.min(rect.bottom + 14, viewportTop + viewportHeight - 220));
      setPosition({ top, right: Math.max(margin, Math.min(viewportWidth - rect.right, viewportWidth - width - margin)), width, maxHeight: Math.max(160, Math.min(600, viewportTop + viewportHeight - top - margin)) });
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && !panel.current?.contains(event.target) && !event.target.closest('[data-header-notification-trigger]')) onClose();
    };
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(true); } };
    place();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [trigger, onClose]);
  if (typeof document === 'undefined') return null;
  const action = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40';
  return createPortal(<div id={panelId} ref={panel} tabIndex={-1} role="dialog" aria-labelledby={`${panelId}-title`} style={position} className="fixed z-[200] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_60px_-16px_rgba(15,23,42,0.3)] outline-none">
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div><h2 id={`${panelId}-title`} className="text-lg font-semibold text-slate-900">{t('Notifications')}</h2><p className="mt-0.5 text-xs text-slate-500">{t('Recent notifications')}{!!query.data?.unreadCount && <span className="ml-2 font-medium text-blue-600">· {query.data.unreadCount} {t('unread')}</span>}</p></div>
      <div className="flex items-center gap-1">
        <button type="button" title={t('Refresh notifications')} aria-label={t('Refresh notifications')} disabled={query.isFetching} onClick={() => void query.refetch()} className={action}><RefreshCw size={16} className={query.isFetching ? 'animate-spin' : ''} /></button>
        <button type="button" title={t('Close notifications')} aria-label={t('Close notifications')} onClick={() => onClose(true)} className={action}><X size={19} /></button>
      </div>
    </div>
    {!!query.data?.unreadCount && <div className="flex shrink-0 justify-end border-b border-slate-100 bg-slate-50/60 px-5 py-2"><button type="button" disabled={read.isPending} onClick={() => read.mutate(undefined)} className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50">{read.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={15} />}{t('Mark all as read')}</button></div>}
    {read.isError && <p role="alert" className="shrink-0 bg-red-50 px-5 py-2 text-xs text-red-700">{t('Could not update notifications. Please retry.')}</p>}
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {query.isLoading ? <div role="status" aria-label={t('Loading notifications…')} className="divide-y divide-slate-100">{[0, 1, 2].map(key => <div key={key} className="flex animate-pulse gap-3 p-5"><div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" /><div className="flex-1 space-y-2"><div className="h-3 w-3/4 rounded bg-slate-100" /><div className="h-3 w-full rounded bg-slate-100" /><div className="h-2 w-1/3 rounded bg-slate-100" /></div></div>)}</div> : query.isError ? <div role="alert" className="px-6 py-10 text-center"><Bell size={30} className="mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-600">{t('Unable to load notifications.')}</p><button type="button" onClick={() => void query.refetch()} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">{t('Retry')}</button></div> : !query.data?.notifications.length ? <div className="px-7 py-12 text-center"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-500"><Bell size={25} /></span><p className="text-sm font-semibold text-slate-900">{t('No notifications yet.')}</p><p className="mt-1.5 text-sm leading-6 text-slate-500">{t('Stay up to date with your orders and account.')}</p></div> : <div className="divide-y divide-slate-100">{query.data.notifications.map(notification => <NotificationItem key={notification.id} notification={notification} compact onRead={id => read.mutate(id)} reading={read.isPending} onNavigate={() => onClose()} />)}</div>}
    </div>
    <Link href="/notifications" onClick={() => onClose()} className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-100 bg-white px-5 py-3.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">{t('View all notifications')}<ArrowUpRight size={17} /></Link>
  </div>, document.body);
}
