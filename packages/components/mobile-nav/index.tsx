'use client';
import { useState } from 'react';
export default function MobileNav({ links }: { links: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  return <nav className="md:hidden relative p-3"><button className="min-h-11 border rounded px-4" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>☰ Menu</button>{open && <div id="mobile-navigation" className="absolute left-0 right-0 top-full z-[250] bg-slate-900 text-white shadow-xl rounded-b-xl p-3">{links.map(link => <a key={link.href} className="block p-3 min-h-11" href={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}</div>}</nav>;
}
