'use client';

import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, CircleHelp, Gamepad2, Laptop, Loader2, MonitorCog, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useStorefrontText } from '@packages/components/storefront-language';
import { PC_SLOTS, PcSlot } from '@packages/utils/pc-build';
import type { PcSelection } from '@packages/utils/pc-build-selection';
import { formatUSD } from '@packages/utils/money';
import axios from '@/utils/axioInstance';

type Goal = 'office' | 'gaming' | 'creative';
type SuggestedPart = { selection: PcSelection; title: string; price: number; status: 'matched' | 'unchecked' | 'unknown' };
type Product = { id: string; title: string; sale_price: number; stock: number; colors?: string[]; sizes?: string[]; variants?: any[]; recommendation?: { status?: SuggestedPart['status'] } };

const goals: { id: Goal; title: string; detail: string; icon: typeof Laptop; weights: Record<PcSlot, number> }[] = [
  { id: 'office', title: 'Học tập & văn phòng', detail: 'Ưu tiên CPU, RAM và trải nghiệm hằng ngày.', icon: Laptop, weights: { cpu: .22, motherboard: .12, ram: .16, gpu: .02, storage: .14, psu: .1, case: .12, cooler: .12 } },
  { id: 'gaming', title: 'Chơi game', detail: 'Dành phần ngân sách lớn hơn cho card đồ họa.', icon: Gamepad2, weights: { cpu: .18, motherboard: .12, ram: .1, gpu: .32, storage: .08, psu: .1, case: .05, cooler: .05 } },
  { id: 'creative', title: 'Thiết kế & dựng video', detail: 'Cân đối CPU, GPU và bộ nhớ cho tác vụ sáng tạo.', icon: MonitorCog, weights: { cpu: .23, motherboard: .12, ram: .15, gpu: .23, storage: .11, psu: .08, case: .04, cooler: .04 } },
];

const labels: Record<PcSlot, string> = { cpu: 'CPU', motherboard: 'Bo mạch chủ', ram: 'RAM', gpu: 'Card đồ họa', storage: 'Ổ lưu trữ', psu: 'Nguồn', case: 'Vỏ máy', cooler: 'Tản nhiệt' };
const statusRank: Record<SuggestedPart['status'], number> = { matched: 0, unchecked: 1, unknown: 2 };

function productChoice(product: Product, slot: PcSlot, remaining: number, target: number): SuggestedPart | undefined {
  if (!product || !product.id || Number(product.stock) < 1) return undefined;
  const variants = Array.isArray(product.variants) ? product.variants.filter(item => item.stock > 0).sort((a, b) => Number(a.price) - Number(b.price)) : [];
  const variant = variants[0];
  const price = variant ? Number(variant.price) : Number(product.sale_price);
  if (!Number.isFinite(price) || price <= 0 || price > remaining) return undefined;
  return {
    selection: {
      slot, id: product.id,
      ...(variant ? { variantId: variant.id } : {}),
      selectedOptions: { color: variant?.color || product.colors?.[0] || '', size: variant?.size || product.sizes?.[0] || '' },
    },
    title: product.title,
    price,
    status: product.recommendation?.status === 'matched' || product.recommendation?.status === 'unknown' ? product.recommendation.status : 'unchecked',
  };
}

export default function PcBuildGuide({ onApply, currentPartCount = 0 }: { onApply: (parts: PcSelection[]) => void; currentPartCount?: number }) {
  const { t } = useStorefrontText();
  const [expanded, setExpanded] = useState(false);
  const [goal, setGoal] = useState<Goal>('gaming');
  const [budget, setBudget] = useState('1200');
  const [suggestions, setSuggestions] = useState<SuggestedPart[]>([]);
  const [missing, setMissing] = useState<PcSlot[]>([]);
  const [quote, setQuote] = useState<any>(null);
  const [quoteError, setQuoteError] = useState('');
  const [confirmApply, setConfirmApply] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate() {
    const maxBudget = Number(budget);
    if (!Number.isFinite(maxBudget) || maxBudget < 250 || maxBudget > 20000) {
      setError(t('Enter a budget between $250 and $20,000.'));
      return;
    }
    setLoading(true); setError(''); setSuggestions([]); setMissing([]); setQuote(null); setQuoteError(''); setConfirmApply(false);
    try {
      const profile = goals.find(item => item.id === goal)!;
      const chosen: SuggestedPart[] = [];
      let total = 0;
      let remainingWeight = 1;
      for (const slot of PC_SLOTS) {
        const target = Math.max(0, (maxBudget - total) * profile.weights[slot] / remainingWeight);
        remainingWeight -= profile.weights[slot];
        const { data } = await axios.get('/product/api/pc-builder/catalog', {
          params: { slot, sort: 'priceAsc', page: 1, limit: 100, parts: JSON.stringify(chosen.map(item => item.selection)) },
        });
        const products: Product[] = Array.isArray(data?.products) ? data.products : [];
        const options = products.map(product => productChoice(product, slot, maxBudget - total, target)).filter((item): item is SuggestedPart => !!item);
        const affordable = options.filter(item => item.price <= target);
        const pool = affordable.length ? affordable : options;
        pool.sort((a, b) => statusRank[a.status] - statusRank[b.status] || b.price - a.price);
        const next = pool[0];
        if (next) { chosen.push(next); total += next.price; }
        else setMissing(current => [...current, slot]);
      }
      setSuggestions(chosen);
      if (!chosen.length) setError(t('No in-stock components were found. You can still choose parts manually.'));
      else {
        try {
          const { data } = await axios.post('/product/api/pc-builder/quote', { parts: chosen.map(item => item.selection) });
          setQuote(data);
          setSuggestions(chosen.map(item => {
            const current = data.parts?.find((part: any) => part.slot === item.selection.slot);
            return current ? { ...item, selection: { slot: current.slot, id: current.id, ...(current.variantId ? { variantId: current.variantId } : {}), selectedOptions: current.selectedOptions || item.selection.selectedOptions }, title: current.title, price: Number(current.sale_price) } : item;
          }));
        } catch (reason: any) {
          setQuoteError(reason?.response?.data?.message || t('Could not verify the latest price and compatibility. Review the build before adding it to your cart.'));
        }
      }
    } catch (reason: any) {
      setSuggestions([]);
      setError(reason?.response?.data?.message || t('Could not create a suggestion. Please try again.'));
    } finally { setLoading(false); }
  }

  const total = Number.isFinite(Number(quote?.total)) ? Number(quote.total) : suggestions.reduce((sum, item) => sum + item.price, 0);
  const selectedGoal = goals.find(item => item.id === goal)!;

  function applySuggestion() {
    if (currentPartCount > 0 && !confirmApply) { setConfirmApply(true); return; }
    onApply(suggestions.map(item => item.selection));
    setConfirmApply(false);
    setExpanded(false);
  }

  return <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm" aria-labelledby="pc-build-guide-title">
    <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-blue-50 via-white to-indigo-50 px-5 py-5 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200"><Sparkles size={20} aria-hidden="true" /></span>
        <div className="min-w-0"><h2 id="pc-build-guide-title" className="font-bold text-slate-900">{t('Not sure where to start?')}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{t('Tell us what you need and your budget. We will suggest available parts you can adjust.')}</p></div>
      </div>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
        {t(expanded ? 'Close guide' : 'Find my build')} {expanded ? <X size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
      </button>
    </div>

    {expanded && <div className="space-y-5 border-t border-blue-100 p-5 sm:p-6">
      <div><div className="mb-3 flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">1</span><h3 className="text-sm font-bold text-slate-900">{t('What will you use your PC for?')}</h3></div>
        <div className="grid gap-2 sm:grid-cols-3">{goals.map(item => { const Icon = item.icon; const active = goal === item.id; return <button type="button" key={item.id} aria-pressed={active} onClick={() => setGoal(item.id)} className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'}`}><span className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon size={17} className={active ? 'text-blue-600' : 'text-slate-400'} aria-hidden="true" />{t(item.title)}{active && <Check size={15} className="ml-auto text-blue-600" aria-hidden="true" />}</span><span className="mt-1.5 block text-xs leading-5 text-slate-500">{t(item.detail)}</span></button>; })}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,.8fr)] md:items-end">
        <div><label htmlFor="pc-guide-budget" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700">2</span>{t('What is your total budget?')}</label><div className="relative"><span className="pointer-events-none absolute left-3 top-3 text-sm font-medium text-slate-400">$</span><input id="pc-guide-budget" inputMode="numeric" type="number" min="250" max="20000" step="50" value={budget} onChange={event => setBudget(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-16 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /><span className="pointer-events-none absolute right-3 top-3 text-xs text-slate-400">USD</span></div><p className="mt-1.5 text-[11px] text-slate-500">{t('For components only; shipping and discounts are calculated at checkout.')}</p></div>
        <button type="button" disabled={loading} onClick={() => void generate()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70">{loading ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" />{t('Finding compatible parts…')}</> : <><Sparkles size={16} aria-hidden="true" />{t('Build my suggestion')}</>}</button>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600"><CircleHelp size={15} className="mt-0.5 shrink-0 text-blue-500" aria-hidden="true" /><span>{t(selectedGoal.detail)} {t('The estimate uses current catalog prices and compatibility data. Review missing specifications before ordering.')}</span></p>

      {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">{t(error)}</p>}
      {suggestions.length > 0 && <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5" aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold text-slate-900">{t('Your starting build')}</h3><p className="mt-1 text-xs text-slate-500">{t('A starting point based on your answers. Change any component below.')}</p></div><div className="text-right"><p className="text-[11px] font-medium text-slate-500">{t('Estimated total')}</p><p className="text-xl font-bold tabular-nums text-blue-700">{formatUSD(total)}</p></div></div>
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">{suggestions.map(item => <li key={item.selection.slot} className="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5 text-xs"><span className="min-w-0"><span className="block font-semibold text-slate-700">{t(labels[item.selection.slot])}</span><span className="block truncate text-slate-500">{item.title}</span></span><span className="shrink-0 text-right"><span className="block font-semibold tabular-nums text-slate-800">{formatUSD(item.price)}</span><span className={`mt-0.5 block ${item.status === 'matched' ? 'text-emerald-700' : item.status === 'unknown' ? 'text-amber-700' : 'text-slate-500'}`}>{t(item.status === 'matched' ? 'Specifications match' : item.status === 'unknown' ? 'Review specifications' : 'No related check yet')}</span></span></li>)}</ul>
        {quoteError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">{t(quoteError)}</p>}
        {quote && <div role={quote.canAddToCart ? 'status' : 'alert'} className={`rounded-xl border px-3 py-3 ${quote.canAddToCart ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
          <p className="flex items-center gap-2 text-xs font-bold"><ShieldCheck size={15} aria-hidden="true" />{t('Compatibility review')} · {quote.canAddToCart ? t('No known blocking conflicts') : t('Resolve issues before adding to cart')}</p>
          {quote.issues?.length > 0 && <ul className="mt-2 space-y-1.5 text-xs leading-5">{quote.issues.map((issue: any, index: number) => <li key={`${index}:${issue.message}`} className={issue.level === 'error' ? 'text-red-800' : 'text-amber-800'}>{t(issue.message)}</li>)}</ul>}
          {!quote.issues?.length && <p className="mt-1.5 text-xs leading-5">{t('No known compatibility conflicts were found in the available specifications.')}</p>}
          {quote.compatibility?.notes?.length > 0 && <p className="mt-2 border-t border-current/10 pt-2 text-[11px] leading-5 opacity-80">{quote.compatibility.notes.map((note: string) => t(note)).join(' ')}</p>}
        </div>}
        {total > Number(budget) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">{t('The latest total is over your budget by')} {formatUSD(total - Number(budget))}. {t('You can replace components after applying this build.')}</p>}
        {missing.length > 0 && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{t('No suitable in-budget item was found for:')} {missing.map(slot => t(labels[slot])).join(', ')}. {t('You can fill these slots manually.')}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{t('Prices and stock may change. Compatibility checks depend on seller specifications.')}</p><button type="button" onClick={applySuggestion} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">{t('Use this starting build')}<ArrowRight size={15} aria-hidden="true" /></button></div>
        {confirmApply && <div role="alert" aria-labelledby="pc-guide-replace-title" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="min-w-0"><p id="pc-guide-replace-title" className="text-sm font-bold text-amber-900">{t('Replace your current build?')}</p><p className="mt-1 text-xs leading-5 text-amber-800">{t('This will replace the components currently selected in the builder. Your saved build will not be changed.')}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => setConfirmApply(false)} className="min-h-9 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900">{t('Keep current build')}</button><button type="button" onClick={applySuggestion} className="min-h-9 rounded-lg bg-amber-700 px-3 text-xs font-semibold text-white">{t('Replace with suggestion')}</button></div></div>}
      </div>}
      <details className="group"><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-slate-500 marker:hidden"><span>{t('How are suggestions chosen?')}</span><ChevronDown size={15} className="transition group-open:rotate-180" aria-hidden="true" /></summary><p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">{t('We use in-stock catalog items, your budget and verified compatibility checks. The use case changes how the budget is shared across component types. This is a starting point, not a performance guarantee.')}</p></details>
    </div>}
  </section>;
}
