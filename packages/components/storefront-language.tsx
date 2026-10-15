'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLanguage, type EshopLanguage } from './language-switcher';
import { translateStorefront } from '../utils/storefront-messages';

const defaultValue = {
  language: 'en' as EshopLanguage,
  locale: 'en-US',
  setLanguage: (_language: EshopLanguage) => {},
  t: (text: string) => text,
};
const StorefrontLanguageContext = createContext(defaultValue);

export function StorefrontLanguageProvider({ children }: { children: ReactNode }) {
  const { language, setLanguage } = useLanguage('vi');
  const t = useMemo(() => (text: string) => translateStorefront(text, language), [language]);
  return <StorefrontLanguageContext.Provider value={{ language, locale: language === 'vi' ? 'vi-VN' : 'en-US', setLanguage, t }}>{children}</StorefrontLanguageContext.Provider>;
}

export function useStorefrontText() { return useContext(StorefrontLanguageContext); }

export function StorefrontText({ children }: { children: string }) {
  const { t } = useStorefrontText();
  return <>{t(children)}</>;
}

export function StorefrontLanguageSwitcher() {
  const { language, setLanguage } = useStorefrontText();
  return <label className="inline-flex shrink-0 items-center text-sm">
    <span className="sr-only">Ngôn ngữ / Language</span>
    <select aria-label="Ngôn ngữ / Language" value={language} onChange={event => setLanguage(event.target.value as EshopLanguage)} className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
      <option value="vi">VI · Tiếng Việt</option>
      <option value="en">EN · English</option>
    </select>
  </label>;
}
