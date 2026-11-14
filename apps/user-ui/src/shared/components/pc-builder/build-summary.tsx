'use client';

import React, { useState } from 'react';
import {
  ArrowRight, Check, ChevronDown, CircuitBoard, Cpu, Fan, HardDrive,
  Info, Loader2, MemoryStick, Monitor, Package, Pencil, Plus,
  RefreshCw, ShoppingCart, Trash2, TriangleAlert, Zap,
} from 'lucide-react';
import { useStorefrontText } from '@packages/components/storefront-language';
import { PC_SLOTS, PC_MANUAL_CHECK_NOTE, type PcSlot, type PcCompatibilityCheck } from '@packages/utils/pc-build';
import type { PcSelection } from '@packages/utils/pc-build-selection';
import { formatUSD } from '@packages/utils/money';

export const PC_SLOT_LABELS: Record<PcSlot, string> = {
  cpu: 'CPU / Processor', motherboard: 'Motherboard', ram: 'Memory / RAM',
  gpu: 'Graphics card', storage: 'Storage', psu: 'Power supply',
  case: 'PC case', cooler: 'CPU cooler',
};

const SLOT_ICONS = {
  cpu: Cpu, motherboard: CircuitBoard, ram: MemoryStick, gpu: Monitor,
  storage: HardDrive, psu: Zap, case: Package, cooler: Fan,
};

type BuildSummaryProps = {
  selections: PcSelection[];
  quote: any;
  quoteLoading: boolean;
  quoteError: string | null;
  onSelectSlot: (slot: PcSlot) => void;
  onRemove: (slot: PcSlot) => void;
  onAdd: () => void;
  adding: boolean;
  onRetry: () => void;
};

const MISSING_SPECIFICATION_WARNINGS = new Set([
  'Cannot verify CPU / motherboard socket: specifications are missing.',
  'Cannot verify RAM / motherboard memory type: specifications are missing.',
  'Cannot verify PSU capacity: wattage or recommended PSU watts is missing.',
]);

function isCompatibilityCheck(value: any): value is PcCompatibilityCheck {
  return value && ['passed', 'unknown', 'conflict'].includes(value.status) &&
    typeof value.id === 'string' && typeof value.label === 'string' && typeof value.field === 'string' &&
    Array.isArray(value.slots) && value.slots.every((slot: PcSlot) => PC_SLOTS.includes(slot)) &&
    Array.isArray(value.missing) && value.missing.every((slot: PcSlot) => PC_SLOTS.includes(slot)) &&
    value.values && typeof value.values === 'object';
}

function ComponentImage({ url, slot }: { url?: string; slot: PcSlot }) {
  const [failed, setFailed] = useState(false);
  const Icon = SLOT_ICONS[slot];
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white p-1.5 text-slate-400">
      {url && !failed
        ? <img src={url} alt="" className="h-full w-full object-contain" onError={() => setFailed(true)} />
        : <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />}
    </div>
  );
}

export default function PcBuildSummary({
  selections, quote, quoteLoading, quoteError, onSelectSlot, onRemove, onAdd, adding, onRetry,
}: BuildSummaryProps) {
  const { t } = useStorefrontText();
  const selectedCount = selections.length;
  const nextSlot = PC_SLOTS.find(slot => !selections.some(selection => selection.slot === slot));
  const quotedParts = Array.isArray(quote?.parts) ? quote.parts : [];
  const findPart = (selection: PcSelection) => quotedParts.find((part: any) =>
    part.slot === selection.slot && part.id === selection.id &&
    (part.variantId || undefined) === (selection.variantId || undefined) &&
    (selection.variantId || ((part.selectedOptions?.color || '') === selection.selectedOptions.color &&
      (part.selectedOptions?.size || '') === selection.selectedOptions.size)));
  // A cached quote may belong to the previous selection while a new request starts.
  const currentQuote = selectedCount > 0 && quotedParts.length === selectedCount &&
    selections.every(selection => !!findPart(selection));
  const quoteReady = currentQuote && !quoteLoading && !quoteError &&
    typeof quote?.total === 'number' && Number.isFinite(quote.total) && quote.total >= 0;
  const canAdd = quoteReady && quote?.canAddToCart === true && !adding;
  const issues: { level: string; message: string }[] = quoteReady && Array.isArray(quote?.issues)
    ? quote.issues.filter((issue: any) => issue && typeof issue.message === 'string') : [];
  const errors = issues.filter(issue => issue.level === 'error');
  const hasCompatibilityChecks = quoteReady && Array.isArray(quote?.compatibility?.checks);
  const checks: PcCompatibilityCheck[] = hasCompatibilityChecks
    ? quote.compatibility.checks.filter(isCompatibilityCheck) : [];
  const unknownChecks = checks.filter(check => check.status === 'unknown');
  const passedChecks = checks.filter(check => check.status === 'passed');
  const warnings = issues.filter(issue => issue.level !== 'error' && issue.message !== PC_MANUAL_CHECK_NOTE &&
    !(hasCompatibilityChecks && checks.length > 0 && MISSING_SPECIFICATION_WARNINGS.has(issue.message)));
  const manualNotes: string[] = quoteReady && Array.isArray(quote?.compatibility?.notes)
    ? quote.compatibility.notes.filter((note: any) => typeof note === 'string' && note.trim())
    : [PC_MANUAL_CHECK_NOTE];

  return (
    <section aria-labelledby="pc-summary-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <CircuitBoard className="h-6 w-6" strokeWidth={1.7} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="pc-summary-title" className="text-lg font-bold tracking-tight text-slate-900">{t('Your configuration')}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{selectedCount} / {PC_SLOTS.length} {t('components selected')}</p>
          </div>
          <span className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">PC</span>
        </div>
        <div className="mt-4 flex gap-1.5" role="progressbar" aria-label={t('Components selected')} aria-valuemin={0} aria-valuemax={PC_SLOTS.length} aria-valuenow={selectedCount}>
          {PC_SLOTS.map(slot => <span key={slot} className={`h-1.5 min-w-0 flex-1 rounded-full ${selections.some(selection => selection.slot === slot) ? 'bg-blue-600' : 'bg-slate-100'}`} />)}
        </div>
      </div>

      {selectedCount === 0 ? (
        <div className="px-6 py-8 text-center">
          <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
            <Cpu className="h-10 w-10" strokeWidth={1.3} aria-hidden="true" />
            <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-4 border-white bg-blue-600 text-white"><Plus className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <h3 className="text-base font-semibold text-slate-900">{t('Your next PC starts here')}</h3>
          <p className="mx-auto mt-2 max-w-64 text-sm leading-6 text-slate-500">{t('Choose your first component to see live pricing and compatibility notes.')}</p>
          <button type="button" onClick={() => onSelectSlot('cpu')} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            {t('Choose a processor')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="px-5 sm:px-6">
          <ul className="divide-y divide-slate-100">
            {PC_SLOTS.flatMap(slot => {
              const selection = selections.find(part => part.slot === slot);
              if (!selection) return [];
              const product = findPart(selection);
              const options = [product?.selectedOptions?.color, product?.selectedOptions?.size].filter(Boolean);
              return [<li key={slot} className="flex items-start gap-3 py-4">
                <ComponentImage key={`${selection.id}:${product?.images?.[0]?.url || ''}`} url={product?.images?.[0]?.url} slot={slot} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t(PC_SLOT_LABELS[slot])}</p>
                  <button type="button" onClick={() => onSelectSlot(slot)} className="mt-0.5 block max-w-full break-words text-left text-sm font-semibold leading-5 text-slate-800 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    {product?.title || t('Selected component')}
                  </button>
                  {options.length > 0 && <p className="mt-1 break-words text-xs text-slate-500">{options.join(' / ')}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold tabular-nums text-slate-900">{quoteReady && typeof product?.sale_price === 'number' ? formatUSD(product.sale_price) : <span className="text-xs font-normal text-slate-400">{t('Checking price…')}</span>}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label={`${t('Change component')}: ${t(PC_SLOT_LABELS[slot])}`} title={t('Change component')} onClick={() => onSelectSlot(slot)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
                      <button type="button" aria-label={`${t('Remove component')}: ${t(PC_SLOT_LABELS[slot])}`} title={t('Remove component')} onClick={() => onRemove(slot)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                    </div>
                  </div>
                </div>
              </li>];
            })}
          </ul>
          {nextSlot ? <button type="button" onClick={() => onSelectSlot(nextSlot)} className="mb-5 mt-1 flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Plus className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{t('Add next')}: <span className="font-semibold">{t(PC_SLOT_LABELS[nextSlot])}</span></span><ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /></button>
            : <p className="mb-5 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-3 text-xs font-medium text-blue-700"><Check className="h-4 w-4 shrink-0" aria-hidden="true" />{t('All component slots are filled.')}</p>}
        </div>
      )}

      {selectedCount > 0 && <div className="px-5 pb-5 sm:px-6">
        {quoteLoading ? <p role="status" className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-700"><Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />{t('Checking live prices and compatibility…')}</p>
          : quoteError ? <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700"><p className="flex items-start gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{t(quoteError)}</span></p><button type="button" onClick={onRetry} className="ml-6 mt-2 inline-flex items-center gap-1.5 font-semibold underline underline-offset-2"><RefreshCw className="h-3 w-3" aria-hidden="true" />{t('Try again')}</button></div>
            : quoteReady ? <div className="space-y-2">
              {errors.length > 0 && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-700"><p className="flex items-center gap-2 font-semibold"><TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />{t('Review before adding to cart')}</p><ul className="mt-2 space-y-1.5">{errors.map((issue, index) => <li key={`${index}:${issue.message}`} className="break-words">{t(issue.message)}</li>)}</ul></div>}
              {unknownChecks.length > 0 && <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-xs leading-5 text-amber-900">
                <p className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4 shrink-0" aria-hidden="true" />{t('Needs product specifications')}</p>
                <p className="mt-1 text-amber-800">{t('The seller has not provided clear specifications for these checks.')}</p>
                <ul className="mt-2 space-y-2.5">{unknownChecks.map(check => <li key={check.id} className="break-words">
                  <p className="font-medium">{t(check.label)}</p>
                  <p className="text-amber-800">{t(check.field)}: {check.missing.length > 0
                    ? check.missing.map(slot => t(PC_SLOT_LABELS[slot])).join(', ')
                    : check.slots.map(slot => t(PC_SLOT_LABELS[slot])).join(', ')}</p>
                </li>)}</ul>
              </div>}
              {warnings.length > 0 && <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-xs leading-5 text-amber-900">
                <p className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4 shrink-0" aria-hidden="true" />{t('Specifications to review')}</p>
                <ul className="mt-2 space-y-2">{warnings.map((issue, index) => <li key={`${index}:${issue.message}`} className="break-words">{t(issue.message)}</li>)}</ul>
              </div>}
              {passedChecks.length > 0 && <details className="group rounded-xl border border-emerald-100 bg-emerald-50/50 text-xs leading-5 text-emerald-900">
                <summary className="flex cursor-pointer list-none items-center gap-2 p-3 font-semibold marker:hidden"><Check className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{t('Checked specifications')} ({passedChecks.length})</span><ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" aria-hidden="true" /></summary>
                <ul className="space-y-2.5 border-t border-emerald-100 px-3 pb-3 pt-2">{passedChecks.map(check => <li key={check.id} className="break-words">
                  <p className="font-medium">{t(check.label)}</p>
                  <p className="text-emerald-800">{check.slots.filter(slot => typeof check.values[slot] === 'string').map(slot => `${t(PC_SLOT_LABELS[slot])}: ${check.values[slot]}`).join(' · ')}</p>
                </li>)}</ul>
              </details>}
              {hasCompatibilityChecks && checks.length === 0 && <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">{t('Select both components in a related pair to check their specifications.')}</p>}
              {manualNotes.length > 0 && <details className="group rounded-xl border border-slate-200 bg-slate-50 text-xs leading-5 text-slate-600">
                <summary className="flex cursor-pointer list-none items-center gap-2 p-3 font-medium marker:hidden"><Info className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{t('Additional checks before ordering')}</span><ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" aria-hidden="true" /></summary>
                <ul className="space-y-2 border-t border-slate-200 px-3 pb-3 pt-2">{manualNotes.map((note, index) => <li key={`${index}:${note}`} className="break-words">{t(note)}</li>)}</ul>
              </details>}
            </div>
              : <p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">{t('Waiting for a current price check.')}<button type="button" onClick={onRetry} className="ml-1 font-semibold text-blue-600 underline underline-offset-2">{t('Try again')}</button></p>}
      </div>}

      <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><p className="text-sm font-semibold text-slate-700">{t('Component total')}</p><p className="mt-0.5 text-[11px] text-slate-500">{t('Prices in USD')}</p></div>
          <p aria-live="polite" className="min-w-0 break-words text-right text-2xl font-bold tabular-nums tracking-tight text-slate-900">{selectedCount === 0 ? formatUSD(0) : quoteReady ? formatUSD(quote.total) : <span className="text-lg font-medium text-slate-400">—</span>}</p>
        </div>
        <button type="button" disabled={!canAdd} onClick={onAdd} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
          {adding ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>{t(adding ? 'Adding components…' : 'Add components to cart')}</span>
          {!adding && <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
        </button>
        <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">{t('Shipping and available discounts are calculated at checkout.')}</p>
      </div>
    </section>
  );
}
