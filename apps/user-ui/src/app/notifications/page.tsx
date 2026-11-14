'use client';

import Link from 'next/link';
import { Bell, ChevronRight, Home } from 'lucide-react';
import { useStorefrontText } from '@packages/components/storefront-language';
import Notifications from '@/shared/cards/notifications';

export default function NotificationsPage() {
  const { t } = useStorefrontText();

  return <main className="min-h-[65vh] bg-slate-50/70 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
    <div className="mx-auto max-w-5xl">
      <nav aria-label={t('Breadcrumb')} className="mb-7 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="inline-flex items-center gap-1.5 transition-colors hover:text-[#3489FF]"><Home size={15} aria-hidden="true" />{t('Home')}</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page" className="font-medium text-slate-800">{t('Notifications')}</span>
      </nav>
      <header className="mb-7 flex items-start gap-4 sm:mb-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-[#3489FF] sm:h-14 sm:w-14"><Bell size={25} strokeWidth={1.8} aria-hidden="true" /></div>
        <div className="min-w-0 pt-0.5">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{t('Notifications')}</h1>
          <p className="mt-1.5 text-sm leading-6 text-slate-500 sm:text-base">{t('Stay up to date with your orders and account.')}</p>
        </div>
      </header>
      <Notifications />
    </div>
  </main>;
}
