'use client';
import { useId, useState } from 'react';
const palette = ['#60a5fa', '#34d399', '#fbbf24'];
const label = (key: string) => ({ revenue: 'Revenue', earnings: 'Earnings', users: 'Customers', sellers: 'Sellers', views: 'Views', cartAdds: 'Cart additions', purchases: 'Purchases', orders: 'Orders' }[key] || key);
export function SeriesChart({ rows, fields }: { rows: any[]; fields: string[] }) {
  const id = useId().replaceAll(':', '');
  const [active, setActive] = useState<number | null>(null);
  const currency = fields.every(field => ['revenue', 'earnings'].includes(field));
  const format = (value: number) => new Intl.NumberFormat('en-US', currency ? { style: 'currency', currency: 'USD', maximumFractionDigits: 2 } : { maximumFractionDigits: 0 }).format(value);
  const maxValue = Math.max(0, ...rows.flatMap(row => fields.map(field => Number(row[field]) || 0)));
  const maximum = Math.max(1, Math.ceil(maxValue / 4) * 4);
  const x = (index: number) => rows.length === 1 ? 430 : 70 + index * 710 / Math.max(1, rows.length - 1);
  const y = (value: number) => 220 - value / maximum * 190;
  const selected = active !== null ? rows[active] : null;
  return <div className="min-w-0">
    <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">{fields.map((field, index) => <span key={field} className="inline-flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: palette[index % palette.length] }} />{label(field)}</span>)}</div>
    <div className="mb-2 min-h-12 rounded-lg bg-slate-800/40 px-3 py-2 text-xs" aria-live="polite">{selected ? <><span className="mr-4 text-slate-400">{selected.date}</span><span className="inline-flex flex-wrap gap-x-4 gap-y-1">{fields.map((field, i) => <span key={field} style={{ color: palette[i % palette.length] }}>{label(field)}: <strong className="tabular-nums">{format(Number(selected[field]) || 0)}</strong></span>)}</span></> : <span className="text-slate-500">{maxValue ? 'Hover, tap or use arrow keys to explore the chart.' : 'No activity recorded in this period.'}</span>}</div>
    <div className="overflow-x-auto">
      <svg viewBox="0 0 800 260" className="h-64 w-full min-w-[480px]" role="img" aria-label={`${fields.map(label).join(', ')} over time`}>
        <defs>{fields.map((field, i) => <linearGradient key={field} id={`${id}-${field}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={palette[i % palette.length]} stopOpacity="0.16" /><stop offset="100%" stopColor={palette[i % palette.length]} stopOpacity="0" /></linearGradient>)}</defs>
        {[0, 1, 2, 3, 4].map(tick => { const value = maximum * tick / 4; return <g key={tick}><line x1="70" x2="780" y1={y(value)} y2={y(value)} stroke="#334155" strokeDasharray="3 5" strokeOpacity="0.6" /><text x="60" y={y(value) + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{currency ? '$' : ''}{new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}</text></g>; })}
        {fields.map((field, i) => { const points = rows.map((row, index) => `${x(index)},${y(Number(row[field]) || 0)}`).join(' '); return <g key={field}>{rows.length > 1 && <polygon points={`${x(0)},220 ${points} ${x(rows.length - 1)},220`} fill={`url(#${id}-${field})`} />}<polyline points={points} fill="none" stroke={palette[i % palette.length]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />{rows.length === 1 && <circle cx={x(0)} cy={y(Number(rows[0][field]) || 0)} r="4" fill={palette[i % palette.length]} />}</g>; })}
        {rows.filter((_, i) => i === 0 || i === rows.length - 1 || (rows.length > 2 && i === Math.floor(rows.length / 2))).map((row, i, ticks) => <text key={row.date} x={i === 0 ? 70 : i === ticks.length - 1 ? 780 : 425} y="247" textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'} fill="#94a3b8" fontSize="11">{row.date}</text>)}
        {selected && active !== null && <g><line x1={x(active)} x2={x(active)} y1="20" y2="220" stroke="#94a3b8" strokeDasharray="4 4" />{fields.map((field, i) => <circle key={field} cx={x(active)} cy={y(Number(selected[field]) || 0)} r="4" stroke="#0f172a" strokeWidth="2" fill={palette[i % palette.length]} />)}</g>}
        {rows.length > 0 && <rect x="70" y="20" width="710" height="200" fill="transparent" tabIndex={0} role="slider" aria-label="Chart date" aria-valuemin={0} aria-valuemax={rows.length - 1} aria-valuenow={active ?? 0} aria-valuetext={selected?.date || rows[0]?.date} className="outline-none focus:stroke-blue-400" onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); setActive(Math.min(rows.length - 1, Math.max(0, Math.round((event.clientX - rect.left) / rect.width * (rows.length - 1))))); }} onFocus={() => setActive(0)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, (index ?? 0) + (event.key === 'ArrowRight' ? 1 : -1)))); } }} />}
      </svg>
    </div>
    <details className="mt-4 border-t border-slate-800 pt-3"><summary className="w-fit cursor-pointer text-xs font-medium text-blue-400">View chart data</summary><div className="mt-3 max-h-64 overflow-auto rounded-lg"><table className="w-full text-left text-xs"><thead className="bg-slate-800 text-slate-400"><tr><th className="p-3">Date</th>{fields.map(field => <th className="p-3 text-right" key={field}>{label(field)}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{rows.map(row => <tr key={row.date}><td className="whitespace-nowrap p-3 text-slate-400">{row.date}</td>{fields.map(field => <td className="p-3 text-right tabular-nums text-slate-200" key={field}>{format(Number(row[field]) || 0)}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}
