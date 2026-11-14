'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Cloud, Cpu, Fan, GitCompareArrows, HardDrive, Layers3, LayoutGrid, Loader2, MemoryStick, Monitor, RotateCcw, Save, Search, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Zap } from 'lucide-react';
import { useStorefrontText } from '@packages/components/storefront-language';
import { PC_SLOTS, PcSlot } from '@packages/utils/pc-build';
import { parsePcSelections, PcSelection } from '@packages/utils/pc-build-selection';
import { useStore } from '@/store';
import axios from '@/utils/axioInstance';
import useSavedPcBuild from '@/hooks/useSavedPcBuild';
import { formatUSD } from '@packages/utils/money';
import toast from 'react-hot-toast';
import PcProductCard from '@/shared/components/pc-builder/product-card';
import PcComparison from '@/shared/components/pc-builder/comparison';
import PcBuildSummary from '@/shared/components/pc-builder/build-summary';
import PcBuildVisual from '@/shared/components/pc-builder/pc-build-visual';
import PcBuildGuide from '@/shared/components/pc-builder/build-guide';

const slots = {
  cpu: { name: 'Processor', full: 'Processor (CPU)', icon: Cpu, hint: 'The starting point for your PC. Choose the processor that suits your work and play.' },
  motherboard: { name: 'Motherboard', full: 'Motherboard', icon: Layers3, hint: 'Connect your components. Match the CPU socket and memory type.' },
  ram: { name: 'Memory', full: 'Memory (RAM)', icon: MemoryStick, hint: 'Keep your applications running smoothly. Check the memory type your motherboard supports.' },
  gpu: { name: 'Graphics card', full: 'Graphics card (GPU)', icon: Monitor, hint: 'Find a graphics card for your games, design work and display needs.' },
  storage: { name: 'Storage', full: 'Storage', icon: HardDrive, hint: 'Make room for your operating system, games and files.' },
  psu: { name: 'Power supply', full: 'Power supply (PSU)', icon: Zap, hint: 'Choose enough power for your graphics card and the rest of your system.' },
  case: { name: 'PC case', full: 'PC case', icon: LayoutGrid, hint: 'Give your build a home. Review component dimensions and airflow.' },
  cooler: { name: 'Cooling', full: 'CPU cooling', icon: Fan, hint: 'Keep temperatures under control. Check socket support and case clearance.' },
};
const secondaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40';

export default function PcBuilderPage() {
  const ownerId = useStore(state => state.ownerId);
  return <PcBuilderEditor key={ownerId || 'guest'} ownerId={ownerId} />;
}

function PcBuilderEditor({ ownerId }: { ownerId: string | null }) {
  const { t } = useStorefrontText();
  const queryClient = useQueryClient();
  const workspace = useRef<HTMLDivElement>(null);
  const summaryPanel = useRef<HTMLDivElement>(null);
  const comparisonPanel = useRef<HTMLDivElement>(null);
  const [parts, setParts] = useState<PcSelection[]>([]);
  const [slot, setSlot] = useState<PcSlot>('cpu');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('recommended');
  const [compared, setCompared] = useState<any[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const saved = useSavedPcBuild(ownerId, async selections => {
    if (useStore.getState().ownerId !== ownerId) return;
    setMessage(''); setParts(selections);
    await queryClient.invalidateQueries({ queryKey: ['pc-quote', ownerId] });
  });

  useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get('build');
      if (raw) setParts(parsePcSelections(JSON.parse(raw)));
    } catch { setMessage('Liên kết cấu hình không hợp lệ. Hãy chọn lại linh kiện.'); }
  }, []);

  useEffect(() => {
    if (compareOpen) comparisonPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [compareOpen]);

  const catalogParts = JSON.stringify(parts.filter(part => part.slot !== slot));
  useEffect(() => { setPage(1); setCompared([]); setCompareOpen(false); }, [catalogParts]);

  const catalog = useQuery({
    queryKey: ['pc-catalog', slot, q, page, sort, catalogParts],
    queryFn: async ({ signal }) => (await axios.get('/product/api/pc-builder/catalog', { params: { slot, q, page, sort, parts: catalogParts, limit: 12 }, signal })).data,
  });
  const quote = useQuery({
    queryKey: ['pc-quote', ownerId, parts], enabled: parts.length > 0,
    queryFn: async ({ signal }) => (await axios.post('/product/api/pc-builder/quote', { parts }, { signal })).data,
    retry: false, staleTime: 0,
  });
  const products = catalog.data?.products || [];
  const pagination = catalog.data?.pagination;
  const totalPages = pagination?.totalPages || (products.length === 12 ? page + 1 : page);
  const ActiveIcon = slots[slot].icon;

  function selectSlot(value: PcSlot) {
    setSlot(value); setSearch(''); setQ(''); setPage(1); setCompared([]); setCompareOpen(false);
  }
  function choose(product: any, variantId?: string, selectedOptions?: { color: string; size: string }) {
    setMessage(''); saved.clearMessage();
    setParts(current => [...current.filter(part => part.slot !== slot), { slot, id: product.id, ...(variantId ? { variantId } : {}), selectedOptions: selectedOptions || { color: '', size: '' } }]);
  }
  function toggleCompared(product: any) {
    setCompared(current => current.some(item => item.id === product.id) ? current.filter(item => item.id !== product.id) : current.length < 3 ? [...current, product] : current);
  }
  async function share() {
    const url = new URL(window.location.href); url.search = ''; url.searchParams.set('build', JSON.stringify(parts));
    try { await navigator.clipboard.writeText(url.toString()); setMessage('Đã sao chép liên kết. Giá và tồn kho sẽ cập nhật khi mở.'); }
    catch { setMessage(url.toString()); }
  }
  async function addBuild() {
    if (adding || useStore.getState().ownerId !== ownerId) return;
    setAdding(true); setMessage('');
    try {
      const { data } = await axios.post('/product/api/pc-builder/quote', { parts });
      if (useStore.getState().ownerId !== ownerId) return;
      if (!data.canAddToCart) { setMessage('Kiểm tra lỗi tương thích hoặc tồn kho trước khi thêm.'); await quote.refetch(); return; }
      data.parts.forEach((product: any) => useStore.getState().addToCart({ ...product, price: product.sale_price, quantity: 1 }, null, null, ''));
      setMessage('Đã thêm linh kiện vào giỏ hàng.');
      toast.success(t('Đã thêm linh kiện vào giỏ hàng.'));
    } catch (error: any) {
      if (useStore.getState().ownerId === ownerId) {
        const failure = error.response?.data?.message || 'Không thêm được cấu hình.';
        setMessage(failure); toast.error(t(failure));
      }
    } finally { setAdding(false); }
  }

  return <main className="bg-[#f5f7fb] pb-28 pt-5 font-Roboto text-slate-900 sm:pt-7 lg:pb-16">
    <div className="mx-auto w-[94%] max-w-[1440px] space-y-6">
      <nav aria-label={t('Breadcrumb')} className="flex items-center gap-2 text-xs font-medium text-slate-500 sm:text-sm">
        <Link href="/" className="transition hover:text-blue-600">{t('Home')}</Link><ChevronRight size={13} aria-hidden="true" /><span className="text-slate-800">PC Builder</span>
      </nav>

      <section className="relative isolate overflow-hidden rounded-[24px] bg-[#101d36] px-6 py-8 text-white sm:px-9 sm:py-10 lg:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(ellipse_at_80%_50%,rgba(59,130,246,0.22),transparent_65%)]" />
        <div className="relative z-10 max-w-2xl md:w-3/5">
          <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-blue-200"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />ESHOP · PC BUILDER</p>
          <h1 className="max-w-lg text-[30px] font-bold leading-tight tracking-tight sm:text-[38px]">{t('Build a PC that is yours.')}</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">{t('From the first processor to the final detail. Choose your components and bring your next PC together.')}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-slate-200">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-blue-300" aria-hidden="true" />{t('Compatibility checks')}</span>
            <span className="inline-flex items-center gap-2"><Zap size={16} className="text-blue-300" aria-hidden="true" />{t('Live component prices')}</span>
            <span className="inline-flex items-center gap-2"><Cloud size={16} className="text-blue-300" aria-hidden="true" />{t('Save your configuration')}</span>
          </div>
          <button type="button" onClick={() => workspace.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white underline decoration-blue-500 underline-offset-[6px] transition hover:text-blue-200">{t('Start your build')}<ArrowDown size={15} aria-hidden="true" /></button>
        </div>
        <div className="pointer-events-none absolute -bottom-2 right-0 hidden h-[290px] w-[38%] md:block lg:right-7"><PcBuildVisual /></div>
      </section>

      <PcBuildGuide currentPartCount={parts.length} onApply={suggested => { setParts(suggested); setSlot(PC_SLOTS.find(key => !suggested.some(part => part.slot === key)) || 'cpu'); setMessage('Your suggested starting build is ready. Review compatibility and current stock before adding it to your cart.'); saved.clearMessage(); }} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200/70"><SlidersHorizontal size={20} aria-hidden="true" /></span>
          <div><h2 className="text-lg font-bold tracking-tight">{t('Your build, your choices')}</h2><p className="mt-0.5 text-xs text-slate-500">{t('Select a component category to get started.')}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButton} disabled={!parts.length || !saved.canSave} onClick={() => { setMessage(''); void saved.save(parts); }}><Save size={16} aria-hidden="true" />{t('Save build')}</button>
          <button type="button" className={secondaryButton} disabled={saved.busy} onClick={() => { setMessage(''); void saved.open(); }}><Cloud size={16} aria-hidden="true" />{t('Open saved build')}</button>
          {ownerId && saved.hasDeviceBuild && <button type="button" className={secondaryButton} disabled={saved.busy} onClick={() => { setMessage(''); void saved.open(true); }}><HardDrive size={16} aria-hidden="true" />{t('Open device build')}</button>}
          <button type="button" className={secondaryButton} disabled={!parts.length} onClick={share}><Share2 size={16} aria-hidden="true" />{t('Share')}</button>
          <button type="button" className={secondaryButton} disabled={!parts.length || adding} onClick={() => { setParts([]); saved.clearMessage(); setMessage('Started a new build. Your saved configuration is kept.'); }}><RotateCcw size={15} aria-hidden="true" />{t('Start over')}</button>
        </div>
      </div>

      {(saved.busy || message || saved.message || saved.conflict) && <div role={saved.conflict ? 'alert' : 'status'} className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${saved.conflict ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-100 bg-blue-50 text-blue-800'}`}>
        <p className="flex items-start gap-2 break-words">{saved.busy ? <Loader2 size={17} className="mt-1 shrink-0 animate-spin" aria-hidden="true" /> : <Cloud size={17} className="mt-1 shrink-0" aria-hidden="true" />}<span className="min-w-0 [overflow-wrap:anywhere]">{saved.busy ? t('Updating saved build…') : t(saved.conflict ? saved.message : message || saved.message)}</span></p>
        {saved.conflict && <div className="mt-3 flex flex-wrap gap-2"><button className={secondaryButton} disabled={saved.busy} onClick={() => saved.open()}>{t('Use account build')}</button><button className={secondaryButton} disabled={saved.busy || !parts.length} onClick={() => saved.save(parts, true)}>{t('Replace with current build')}</button></div>}
      </div>}

      {compareOpen && compared.length > 0 && <div ref={comparisonPanel} className="scroll-mt-24"><PcComparison products={compared} slot={slot} onRemove={id => setCompared(current => current.filter(product => product.id !== id))} onClose={() => setCompareOpen(false)} /></div>}

      <div ref={workspace} className="grid scroll-mt-24 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[205px_minmax(0,1fr)_330px]">
        <aside className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:col-span-2 xl:sticky xl:top-24 xl:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><h2 className="text-sm font-bold">{t('Components')}</h2><span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold tabular-nums text-blue-700">{parts.length}/8</span></div>
          <nav aria-label={t('Component categories')} className="flex gap-1 overflow-x-auto p-2 xl:flex-col xl:overflow-visible">
            {PC_SLOTS.map((key, index) => {
              const Icon = slots[key].icon; const chosen = parts.some(part => part.slot === key); const active = slot === key;
              return <button type="button" key={key} aria-pressed={active} onClick={() => selectSlot(key)} className={`group flex min-w-max items-center gap-3 rounded-xl px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 xl:min-w-0 ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'bg-slate-100 text-slate-500'}`}><Icon size={17} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className={`block text-xs font-semibold ${active ? 'text-blue-700' : 'text-slate-700'}`}>{t(slots[key].name)}</span><span className="mt-0.5 hidden text-[10px] text-slate-400 xl:block">{String(index + 1).padStart(2, '0')} · {key === 'cpu' ? 'CPU' : key === 'gpu' ? 'GPU' : key === 'ram' ? 'RAM' : t(chosen ? 'Selected' : 'Not selected')}</span></span>
                {chosen ? <Check size={15} className="shrink-0 text-emerald-500" aria-hidden="true" /> : active ? <ChevronRight size={14} className="hidden shrink-0 xl:block" aria-hidden="true" /> : null}
              </button>;
            })}
          </nav>
          <div className="hidden border-t border-slate-100 p-4 xl:block"><p className="flex items-center gap-2 text-[11px] font-medium text-slate-600"><Cloud size={15} className="shrink-0 text-blue-500" aria-hidden="true" />{t(ownerId ? 'Account storage' : 'Build at your own pace')}</p><p className="mt-2 text-[11px] leading-5 text-slate-400">{t(ownerId ? 'Save your progress and continue on another device.' : 'Sign in to save and open your build on other devices.')}</p>{!ownerId && <Link href="/login?next=/pc-builder" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600">{t('Sign in')}<ArrowUpRight size={13} aria-hidden="true" /></Link>}</div>
        </aside>

        <section aria-labelledby="component-catalog-heading" className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ActiveIcon size={23} aria-hidden="true" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t('Choose your component')}</p><h2 id="component-catalog-heading" className="mt-1 text-lg font-bold tracking-tight">{t(slots[slot].full)}</h2></div></div><span className="shrink-0 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-400">{PC_SLOTS.indexOf(slot) + 1} / 8</span></div>
            <p className="mb-4 text-xs leading-5 text-slate-500">{t(slots[slot].hint)}</p>
            <form className="relative" onSubmit={event => { event.preventDefault(); setQ(search); setPage(1); }}><Search size={17} className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input aria-label={t('Search components')} value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Search by product name…')} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-20 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /><button type="submit" className="absolute right-1.5 top-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-blue-600 hover:text-white">{t('Search')}</button></form>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-500"><p>{catalog.isFetching ? t('Finding components…') : <><span className="font-semibold text-slate-800">{pagination?.total ?? products.length}</span> {t('products available')}</>}</p><label className="inline-flex items-center gap-2"><span>{t('Sort by')}</span><select aria-label={t('Sort components')} value={sort} onChange={event => { setSort(event.target.value); setPage(1); }} className="max-w-[170px] rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-400"><option value="recommended">{t('Recommended')}</option><option value="priceAsc">{t('Price: low to high')}</option><option value="priceDesc">{t('Price: high to low')}</option></select></label></div>
          <p className="px-1 text-xs leading-5 text-slate-500">{t('Suggestions update with your build. Known conflicts are hidden; verified matches and higher stock come first in Recommended. Missing specifications still need review.')}</p>
          {compared.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800"><span className="flex items-center gap-2"><GitCompareArrows size={17} aria-hidden="true" />{compared.length}/3 {t('components to compare')}</span><button type="button" onClick={() => setCompareOpen(value => !value)} className="inline-flex items-center gap-1 font-semibold hover:underline">{t(compareOpen ? 'Hide comparison' : 'Compare now')}<ArrowRight size={13} aria-hidden="true" /></button></div>}
          {catalog.isLoading ? <div aria-label={t('Loading components…')} role="status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 min-[1180px]:grid-cols-2">{[0, 1, 2, 3].map(index => <div key={index} className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-4"><div className="mb-5 h-36 rounded-xl bg-slate-100"/><div className="mb-3 h-4 w-3/4 rounded-md bg-slate-100"/><div className="mb-6 h-3 w-1/2 rounded-md bg-slate-100"/><div className="h-10 rounded-xl bg-slate-100"/></div>)}</div>
            : catalog.isError ? <div role="alert" className="rounded-2xl border border-rose-100 bg-white p-8 text-center"><p className="text-sm text-slate-600">{t('Could not load components. Please try again.')}</p><button className={`${secondaryButton} mt-4`} onClick={() => catalog.refetch()}><RotateCcw size={14} aria-hidden="true" />{t('Retry')}</button></div>
              : products.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 min-[1180px]:grid-cols-2">{products.map((product: any) => <PcProductCard key={product.id} product={product} slot={slot} selected={parts.find(part => part.slot === slot)} compared={compared.some(item => item.id === product.id)} comparisonFull={compared.length >= 3} onChoose={choose} onCompare={toggleCompared} />)}</div>
                : <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300"><Search size={26} aria-hidden="true" /></span><h3 className="mt-4 text-base font-semibold">{t('No components found')}</h3><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">{t('Try another search or explore a different component category.')}</p>{q && <button type="button" className={`${secondaryButton} mt-5`} onClick={() => { setSearch(''); setQ(''); setPage(1); }}>{t('Clear search')}</button>}</div>}
          {totalPages > 1 && <nav aria-label={t('Component pages')} className="flex items-center justify-center gap-4 pt-3"><button type="button" aria-label={t('Previous page')} className={secondaryButton} disabled={page === 1 || catalog.isFetching} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} aria-hidden="true" /></button><span className="text-xs text-slate-500">{t('Page')} <strong className="text-slate-800">{page}</strong> / {totalPages}</span><button type="button" aria-label={t('Next page')} className={secondaryButton} disabled={page >= totalPages || catalog.isFetching} onClick={() => setPage(value => value + 1)}><ChevronRight size={16} aria-hidden="true" /></button></nav>}
        </section>

        <div ref={summaryPanel} className="min-w-0 scroll-mt-24 space-y-4 lg:sticky lg:top-24">
          <PcBuildSummary selections={parts} quote={quote.data} quoteLoading={quote.isFetching} quoteError={quote.isError ? t((quote.error as any).response?.data?.message || 'Không kiểm tra được cấu hình.') : null} onSelectSlot={value => { selectSlot(value); workspace.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} onRemove={value => { setParts(current => current.filter(part => part.slot !== value)); setMessage(''); saved.clearMessage(); }} onAdd={addBuild} adding={adding} onRetry={() => quote.refetch()} />
          <Link href="/cart" className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-600"><span>{t('Open cart')}</span><ArrowUpRight size={15} className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" /></Link>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-5 py-4 text-xs leading-6 text-slate-500"><Sparkles size={18} className="mt-0.5 shrink-0 text-blue-500" aria-hidden="true" /><p>{t('A great build starts with the right match. Review product specifications, dimensions and connection requirements before ordering.')}</p></div>
    </div>
    {parts.length > 0 && <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 py-3 pl-4 pr-24 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] backdrop-blur-md lg:hidden">
      <div className="min-w-0"><p className="text-[10px] text-slate-500">{parts.length}/8 {t('components selected')}</p><p className="mt-0.5 text-sm font-bold text-slate-900">{!quote.isFetching && !quote.isError && quote.data ? formatUSD(quote.data.total) : '—'}</p></div>
      <button type="button" onClick={() => summaryPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700">{t('View build')}<ArrowRight size={14} aria-hidden="true" /></button>
    </div>}
  </main>;
}
