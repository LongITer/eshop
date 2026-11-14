'use client';

import Link from 'next/link';
import { ArrowUpRight, Bell, Check, CheckCircle2, MessageSquare, Package, RotateCcw, Tag, Truck, XCircle } from 'lucide-react';
import { useStorefrontText } from '@packages/components/storefront-language';
import type { StorefrontNotification } from '@/hooks/useNotifications';

export function safeNotificationHref(url?: string | null): string | null {
  if (!url || !url.startsWith('/') || url.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(url)) return null;
  try {
    const decoded = decodeURIComponent(url);
    if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null;
  } catch {
    return null;
  }
  return url;
}

function notificationCategory(type: string) {
  if (type === 'NewOrder' || type.startsWith('Order')) return 'Orders';
  if (type === 'Promotion') return 'Offers';
  return 'System';
}

export function NotificationTypeIcon({ type, className = '' }: { type: string; className?: string }) {
  const Icon = type === 'OrderShipped' ? Truck : type === 'OrderDelivered' || type === 'OrderConfirmed' ? CheckCircle2
    : type === 'OrderCancelled' ? XCircle : type === 'OrderRefunded' ? RotateCcw
      : type === 'NewOrder' ? Package : type === 'Promotion' ? Tag : type === 'NewReview' ? MessageSquare : Bell;
  const color = type === 'Promotion' ? 'bg-amber-50 text-amber-600' : type === 'OrderCancelled' ? 'bg-rose-50 text-rose-500'
    : type === 'OrderDelivered' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-[#3489FF]';
  return <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color} ${className}`}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>;
}

export function NotificationItem({ notification, compact = false, onRead, reading = false, onNavigate }: {
  notification: StorefrontNotification;
  compact?: boolean;
  onRead: (id: string) => void;
  reading?: boolean;
  onNavigate?: () => void;
}) {
  const { t, locale } = useStorefrontText();
  const href = safeNotificationHref(notification.redirectUrl);
  const date = new Date(notification.createdAt);
  const dateLabel = Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, compact
    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { dateStyle: 'medium', timeStyle: 'short' }).format(date);

  return <article className={`relative flex gap-3 transition-colors sm:gap-4 ${compact ? 'px-4 py-4' : 'px-4 py-5 sm:px-6'} ${notification.isRead ? 'bg-white' : 'bg-blue-50/40'}`}>
    <NotificationTypeIcon type={notification.type} className={compact ? 'h-9 w-9 rounded-xl' : ''} />
    <div className="min-w-0 flex-1">
      <div className={`flex gap-2 ${compact ? 'items-start' : 'flex-wrap items-center'}`}>
        <h3 className={`min-w-0 flex-1 break-words text-sm leading-5 text-slate-900 ${notification.isRead ? 'font-medium' : 'font-semibold'}`}>{notification.title}</h3>
        {!notification.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#3489FF]" aria-label={t('Unread')} />}
        {!compact && <time dateTime={Number.isNaN(date.getTime()) ? undefined : notification.createdAt} className="w-full shrink-0 text-xs text-slate-400 sm:ml-auto sm:w-auto">{dateLabel}</time>}
      </div>
      <p className={`mt-1.5 whitespace-pre-line break-words text-sm leading-6 text-slate-600 ${compact ? 'line-clamp-2' : ''}`}>{notification.message}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {compact ? <time dateTime={Number.isNaN(date.getTime()) ? undefined : notification.createdAt} className="text-slate-400">{dateLabel}</time>
          : <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-500">{t(notificationCategory(notification.type))}</span>}
        {!notification.isRead && <button type="button" disabled={reading} onClick={() => onRead(notification.id)} className="inline-flex items-center gap-1 font-medium text-[#2876df] transition-colors hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-wait disabled:opacity-50"><Check size={13} aria-hidden="true" />{t('Mark as read')}</button>}
        {href && <Link href={href} onClick={() => { if (!notification.isRead) onRead(notification.id); onNavigate?.(); }} className="inline-flex items-center gap-0.5 font-medium text-[#2876df] transition-colors hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">{t('View details')}<ArrowUpRight size={13} aria-hidden="true" /></Link>}
      </div>
    </div>
  </article>;
}
