'use client';
import { useAdminText } from './admin-text';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';

export const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0);
export function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  const t = useAdminText();
  return <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-400">{t("Eshop administration")}</p><h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p></div>{action}</header>;
}
export function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="admin-panel"><div className="admin-panel-heading"><div><h2 className="text-sm font-semibold text-white">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{action}</div>{children}</section>;
}
export function EmptyState({ title = 'No results found', description = 'Try adjusting your filters or choosing a different date range.' }: { title?: string; description?: string }) {
  const t = useAdminText();
  return <div className="flex flex-col items-center px-6 py-12 text-center"><span className="mb-4 rounded-2xl border border-gray-800 bg-slate-800/50 p-3 text-slate-500"><Inbox size={26} /></span><h3 className="text-sm font-medium text-slate-200">{t(title)}</h3><p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">{t(description)}</p></div>;
}
export function ErrorState({ retry }: { retry: () => void }) {
  const t = useAdminText();
  return <div role="alert" className="flex flex-wrap items-center gap-4 rounded-xl border border-red-500/20 bg-red-500/5 p-5"><AlertCircle size={23} className="text-red-400" /><div className="flex-1"><p className="text-sm font-medium text-red-300">{t("Unable to load data")}</p><p className="mt-1 text-xs text-slate-400">{t("Check your filters and connection, then try again.")}</p></div><button className="admin-button" onClick={retry}><RefreshCw size={14} /> {t("Retry")}</button></div>;
}
export function LoadingState() {
  const t = useAdminText();
  return <div role="status" aria-label={t("Loading data")} className="space-y-5"><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-28  rounded-xl border border-gray-800 bg-gray-900" />)}</div><div className="h-72  rounded-xl border border-gray-800 bg-gray-900" /><span className="sr-only">{t("Loading data…")}</span></div>;
}
export function StatusBadge({ status }: { status: string }) {
  const t = useAdminText();
  const color = /delivered|paid|succeeded/i.test(status) ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : /cancel|fail|return/i.test(status) ? 'border-red-500/20 bg-red-500/10 text-red-400' : /pending|processing|requires/i.test(status) ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' : 'border-blue-500/20 bg-blue-500/10 text-blue-400';
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${color}`}><span className="h-1 w-1 rounded-full bg-current" />{t(status).replaceAll('_', ' ')}</span>;
}
