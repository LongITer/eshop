'use client';

import { useEffect, useState } from 'react';

export type EshopLanguage = 'en' | 'vi';
export const LANGUAGE_STORAGE_KEY = 'eshop-language';
const LANGUAGE_EVENT = 'eshop-language-change';

export function useLanguage() {
  const [language, setLanguageState] = useState<EshopLanguage>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'vi' || stored === 'en') setLanguageState(stored);
    const onChange = (event: Event) => {
      const value = (event as CustomEvent<EshopLanguage>).detail;
      if (value === 'vi' || value === 'en') setLanguageState(value);
    };
    window.addEventListener(LANGUAGE_EVENT, onChange);
    return () => window.removeEventListener(LANGUAGE_EVENT, onChange);
  }, []);

  const setLanguage = (value: EshopLanguage) => {
    setLanguageState(value);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent(LANGUAGE_EVENT, { detail: value }));
    document.documentElement.lang = value;
  };

  return { language, setLanguage };
}

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage();
  return <label className={`inline-flex items-center gap-2 text-xs ${className}`}>
    <span className="sr-only">Language</span>
    <select aria-label="Language" value={language} onChange={event => setLanguage(event.target.value as EshopLanguage)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-300 outline-none hover:border-slate-500 focus:border-blue-500">
      <option value="en">EN · English</option>
      <option value="vi">VI · Tiếng Việt</option>
    </select>
  </label>;
}
