'use client';

import { useEffect, useState } from 'react';

export type EshopLanguage = 'en' | 'vi';
export const LANGUAGE_STORAGE_KEY = 'eshop-language';
const LANGUAGE_EVENT = 'eshop-language-change';

export function useLanguage(defaultLanguage: EshopLanguage = 'en') {
  const [language, setLanguageState] = useState<EshopLanguage>(defaultLanguage);

  useEffect(() => {
    const apply = (value: unknown) => {
      if (value === 'vi' || value === 'en') {
        setLanguageState(value);
        document.documentElement.lang = value;
      }
    };
    try { apply(window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || defaultLanguage); }
    catch { apply(defaultLanguage); }
    const onChange = (event: Event) => {
      const value = (event as CustomEvent<EshopLanguage>).detail;
      apply(value);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) apply(event.newValue || defaultLanguage);
    };
    window.addEventListener(LANGUAGE_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(LANGUAGE_EVENT, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [defaultLanguage]);

  const setLanguage = (value: EshopLanguage) => {
    setLanguageState(value);
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, value); } catch { /* Switching still works when storage is disabled. */ }
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
