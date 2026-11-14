"use client";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { useEffect, useRef } from "react";

export default function DeleteConfirmationModel({ product, onClose, onConfirm, onRestore, pending = false }: any) {
  const cancel = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    return () => previous?.focus();
  }, []);
  if (!product) return null;
  const deleted = !!product.isDeleted;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => { if (!pending) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="product-action-title" aria-describedby="product-action-description" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl" onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key === "Escape" && !pending) onClose();
      if (e.key === "Tab") {
        const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || []);
        if (!buttons.length) { e.preventDefault(); return; }
        if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons.at(-1)?.focus(); }
        else if (!e.shiftKey && document.activeElement === buttons.at(-1)) { e.preventDefault(); buttons[0].focus(); }
      }
    }}>
      <div className="flex items-start justify-between"><span className={`rounded-xl p-3 ${deleted ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>{deleted ? <RotateCcw size={23}/> : <AlertTriangle size={23}/>}</span><button disabled={pending} type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-40"><X size={20}/></button></div>
      <h2 id="product-action-title" className="mt-5 text-xl font-semibold">{deleted ? "Restore product?" : "Delete product?"}</h2>
      <div id="product-action-description" className="mt-3 text-sm leading-6 text-slate-400"><p className="font-medium text-slate-200">{product.title}</p><p className="mt-2">{deleted ? "This product will be restored with its previous status and inventory." : "The product will be hidden from your shop and scheduled for permanent deletion after 24 hours. You can restore it during that period."}</p>{deleted && product.deleteAt && <p className="mt-2 text-xs text-slate-500">Scheduled deletion: {new Date(product.deleteAt).toLocaleString()}</p>}</div>
      <div className="mt-7 flex justify-end gap-3"><button ref={cancel} type="button" disabled={pending} onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40">Cancel</button><button type="button" disabled={pending} onClick={deleted ? onRestore : onConfirm} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${deleted ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"}`}>{pending ? "Updating…" : deleted ? "Restore product" : "Delete product"}</button></div>
    </div>
  </div>;
}
