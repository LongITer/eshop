'use client';
import { useId, useState, type ReactNode } from 'react';
import { useLanguage } from '../language-switcher';
import { formatUSD } from '../../utils/money';
import type { MetricChange, PerformanceGroup } from '../../utils/commerce-analytics';

export const analyticsControl = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15';
export const analyticsButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-40';
export function useAnalyticsText() {
  const { language } = useLanguage();
  const vi = language === 'vi';
  return { vi, t: (en: string, vn: string) => vi ? vn : en,
    count: (value: number) => new Intl.NumberFormat(vi ? 'vi-VN' : 'en-US', { maximumFractionDigits: 2 }).format(value),
    date: (value: string | null, time = false) => value ? new Date(value).toLocaleString(vi ? 'vi-VN' : 'en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'short', day: '2-digit', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) }) : '—',
  };
}
export function AnalyticsPanel({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/70 p-5"><div><h2 className="text-sm font-semibold text-slate-100">{title}</h2>{description && <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-500">{description}</p>}</div>{action}</div>{children}</section>;
}
export function AnalyticsEmpty({ children }: { children?: ReactNode }) {
  const { t } = useAnalyticsText();
  return <p className="p-8 text-center text-sm leading-6 text-slate-500">{children ?? t('No data in this reporting period.', 'Chưa có dữ liệu trong khoảng thời gian này.')}</p>;
}
export function MetricCard({ label, value, note, change, onClick, lowerIsBetter = false }: { label: string; value: string; note?: string; change?: MetricChange | null; onClick?: () => void; lowerIsBetter?: boolean }) {
  const { t, count } = useAnalyticsText();
  const direction = (change?.difference ?? 0) * (lowerIsBetter ? -1 : 1);
  const content = <><p className="text-xs font-medium text-slate-400">{label}</p><p className="mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums text-slate-50">{value}</p>{change && <p className={`mt-3 text-[11px] tabular-nums ${direction > 0 ? 'text-emerald-400' : direction < 0 ? 'text-amber-300' : 'text-slate-500'}`}>{change.percent === null ? t('New activity', 'Mới phát sinh') : `${change.difference > 0 ? '+' : ''}${count(change.percent)}%`} <span className="text-slate-500">{t('vs previous period', 'so với kỳ trước')}</span></p>}{note && <p className="mt-2 text-[11px] leading-5 text-slate-500">{note}</p>}</>;
  const classes = 'min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-left';
  return onClick ? <button type="button" onClick={onClick} className={`${classes} hover:border-blue-500/40 focus-visible:outline-2 focus-visible:outline-blue-400`}>{content}</button> : <div className={classes}>{content}</div>;
}
export function AnalyticsChart<T extends { date: string }>({ rows, fields, currency = true, title }: { rows: T[]; fields: { key: keyof T & string; label: string; color: string }[]; currency?: boolean; title: string }) {
  const { t, count } = useAnalyticsText();
  const id = useId().replace(/:/g, '');
  const [active, setActive] = useState<number | null>(null);
  const values = rows.flatMap(row => fields.map(field => Number(row[field.key]) || 0));
  const minimum = Math.min(0, ...values), maximum = Math.max(1, ...values);
  const span = maximum - minimum || 1;
  const x = (i: number) => rows.length === 1 ? 430 : 72 + i / Math.max(1, rows.length - 1) * 708;
  const y = (value: number) => 218 - (value - minimum) / span * 180;
  const selected = active === null ? null : rows[Math.min(active, rows.length - 1)];
  const format = (value: number) => currency ? formatUSD(value) : count(value);
  return <div className="p-5">
    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2">{fields.map(field => <span key={field.key} className="inline-flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: field.color }} />{field.label}</span>)}</div>
    <div className="min-h-12 rounded-xl bg-slate-950/50 px-3 py-2 text-xs leading-5" aria-live="polite">{selected ? <><span className="mr-3 text-slate-400">{selected.date}</span>{fields.map(field => <span key={field.key} className="mr-4 inline-block tabular-nums" style={{ color: field.color }}>{field.label}: <strong>{format(Number(selected[field.key]) || 0)}</strong></span>)}</> : <span className="text-slate-500">{values.some(value => value !== 0) ? t('Hover, tap or use the arrow keys to inspect a point.', 'Di chuột, chạm hoặc dùng phím mũi tên để xem từng mốc.') : t('No activity. Zero-value periods are included.', 'Chưa có hoạt động. Các mốc không phát sinh vẫn được hiển thị.')}</span>}</div>
    <div className="overflow-x-auto"><svg viewBox="0 0 800 264" role="group" aria-label={title} className="mt-3 h-64 w-full min-w-[460px]">
      <defs>{fields.map(field => <linearGradient key={field.key} id={`${id}-${field.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={field.color} stopOpacity=".14" /><stop offset="100%" stopColor={field.color} stopOpacity="0" /></linearGradient>)}</defs>
      {[0, 1, 2, 3, 4].map(i => { const value = minimum + span * i / 4; return <g key={i}><line x1="72" x2="780" y1={y(value)} y2={y(value)} stroke="#334155" strokeOpacity=".55" strokeDasharray="3 5" /><text x="62" y={y(value) + 4} textAnchor="end" fill="#64748b" fontSize="10">{currency ? '$' : ''}{new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}</text></g>; })}
      {fields.map(field => { const points = rows.map((row, i) => `${x(i)},${y(Number(row[field.key]) || 0)}`).join(' '); return <g key={field.key}>{rows.length > 1 && <polygon fill={`url(#${id}-${field.key})`} points={`${x(0)},${y(0)} ${points} ${x(rows.length - 1)},${y(0)}`} />}<polyline points={points} fill="none" stroke={field.color} strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round" />{rows.length === 1 && <circle cx={x(0)} cy={y(Number(rows[0][field.key]) || 0)} r="4" fill={field.color} />}</g>; })}
      {rows.filter((_, i) => i === 0 || i === rows.length - 1 || rows.length > 2 && i === Math.floor(rows.length / 2)).map((row, i, ticks) => <text key={row.date} x={i === 0 ? 72 : i === ticks.length - 1 ? 780 : 426} y="252" textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'} fill="#64748b" fontSize="10">{row.date}</text>)}
      {selected && active !== null && <g><line x1={x(Math.min(active, rows.length - 1))} x2={x(Math.min(active, rows.length - 1))} y1="30" y2="225" stroke="#64748b" strokeDasharray="4 4" />{fields.map(field => <circle key={field.key} cx={x(Math.min(active, rows.length - 1))} cy={y(Number(selected[field.key]) || 0)} r="4" fill={field.color} stroke="#0f172a" strokeWidth="2" />)}</g>}
      {!!rows.length && <rect fill="transparent" x="72" y="30" width="708" height="195" tabIndex={0} role="slider" aria-label={t('Chart period', 'Mốc thời gian biểu đồ')} aria-valuemin={0} aria-valuemax={rows.length - 1} aria-valuenow={Math.min(active ?? 0, rows.length - 1)} aria-valuetext={selected ? `${selected.date} · ${fields.map(field => `${field.label}: ${format(Number(selected[field.key]) || 0)}`).join(' · ')}` : rows[0]?.date} className="outline-none focus:stroke-blue-400" onFocus={() => setActive(0)} onPointerMove={e => { const bounds = e.currentTarget.getBoundingClientRect(); setActive(Math.min(rows.length - 1, Math.max(0, Math.round((e.clientX - bounds.left) / bounds.width * (rows.length - 1))))); }} onPointerDown={e => { const bounds = e.currentTarget.getBoundingClientRect(); setActive(Math.min(rows.length - 1, Math.max(0, Math.round((e.clientX - bounds.left) / bounds.width * (rows.length - 1))))); }} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); setActive(value => e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, (value ?? 0) + (e.key === 'ArrowRight' ? 1 : -1)))); } }} />}
    </svg></div>
    <details className="mt-3 border-t border-slate-800 pt-3"><summary className="w-fit cursor-pointer text-xs font-medium text-blue-400">{t('View chart data', 'Xem bảng dữ liệu biểu đồ')}</summary><div className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-800 text-slate-400"><tr><th scope="col" className="p-3">{t('Period', 'Thời gian')}</th>{fields.map(field => <th scope="col" key={field.key} className="p-3 text-right">{field.label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.map(row => <tr key={row.date}><td className="p-3">{row.date}</td>{fields.map(field => <td key={field.key} className="p-3 text-right tabular-nums">{format(Number(row[field.key]) || 0)}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}
export function PerformanceGroups({ rows, onShop }: { rows: PerformanceGroup[]; onShop?: (id: string) => void }) {
  const { t, count } = useAnalyticsText();
  if (!rows.length) return <AnalyticsEmpty />;
  return <div className="max-h-[520px] overflow-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className="sticky top-0 bg-slate-900 text-slate-500"><tr>{[t('Name', 'Tên'), t('Units sold', 'Số lượng bán'), t('Net product sales', 'Tiền hàng thuần'), t('Sales share', 'Tỷ trọng'), t('Products', 'Sản phẩm'), t('Available stock', 'Tồn khả dụng')].map(label => <th key={label} scope="col" className="px-5 py-3.5 font-medium first:text-left [&:not(:first-child)]:text-right">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800/70">{rows.map(row => <tr key={row.id} className="hover:bg-slate-800/25"><td className="min-w-48 px-5 py-4"><button type="button" disabled={!onShop} onClick={() => onShop?.(row.id)} className="max-w-72 text-left font-medium text-slate-200 enabled:text-blue-300 enabled:hover:underline disabled:cursor-default">{row.name}</button><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-500/70" style={{ width: `${Math.min(100, Math.max(0, row.sharePercent))}%` }} /></div></td><td className="px-5 py-4 text-right tabular-nums">{count(row.units)}</td><td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums text-blue-300">{formatUSD(row.netSales)}</td><td className="px-5 py-4 text-right tabular-nums text-slate-400">{count(row.sharePercent)}%</td><td className="px-5 py-4 text-right tabular-nums">{count(row.products)}</td><td className="px-5 py-4 text-right tabular-nums">{count(row.availableStock)}</td></tr>)}</tbody></table></div>;
}
