'use client';
import { useStorefrontText } from '@packages/components/storefront-language';
import Notifications from '@/shared/cards/notifications';
export default function Page() {
  const { t } = useStorefrontText(); return <main className="max-w-3xl mx-auto p-6"><h1 className="text-2xl font-bold mb-6">{t("Notifications")}</h1><Notifications /></main>; }
