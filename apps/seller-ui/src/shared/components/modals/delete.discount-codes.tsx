'use client';

import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

// Keep keyboard focus inside the dialog and return it to its trigger on close.
export function useDiscountDialog(onClose: () => void, busy = false) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose; busyRef.current = busy;
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = ref.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || []).filter(element => !element.matches(':disabled') && element.getClientRects().length > 0);
    (dialog?.querySelector<HTMLElement>('[data-dialog-focus]') || focusable()[0] || dialog)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      if (!controls.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return ref;
}

export default function DeleteDiscountCodeModal({ discount, onClose, onConfirm, busy = false, error = '' }: {
  discount: any; onClose: () => void; onConfirm?: () => void; busy?: boolean; error?: string;
}) {
  const dialogRef = useDiscountDialog(onClose, busy);
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="delete-discount-title" aria-describedby="delete-discount-description" aria-busy={busy} className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0f172a] p-6 text-slate-100 shadow-2xl outline-none">
      <div className="flex items-start justify-between gap-4"><div className="rounded-xl bg-red-500/10 p-3 text-red-400"><AlertTriangle size={22} /></div><button type="button" aria-label="Close delete discount dialog" disabled={busy} onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40"><X size={20} /></button></div>
      <h2 id="delete-discount-title" className="mt-5 text-xl font-semibold">Delete discount code?</h2>
      <p id="delete-discount-description" className="mt-3 text-sm leading-relaxed text-slate-400">Customers will no longer be able to use <span className="break-all font-semibold text-slate-100">{discount.discountCode}</span>. This permanently deletes the promotion <span className="font-medium text-slate-200">“{discount.public_name}”</span>.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-5"><button type="button" data-dialog-focus disabled={busy} onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50">Keep discount</button><button type="button" disabled={busy} onClick={onConfirm} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-wait disabled:opacity-50">{busy && <Loader2 size={16} className="animate-spin" />}{busy ? 'Deleting…' : 'Delete discount'}</button></div>
    </section>
  </div>;
}
