'use client';
import { useStorefrontText } from '@packages/components/storefront-language';
import { FollowedShops } from '@/shared/components/account-tools';
export default function Page() {
  const { t } = useStorefrontText(); return <main className="max-w-4xl mx-auto p-6"><h1 className="text-2xl font-bold mb-6">{t("Following shops")}</h1><FollowedShops /></main>; }
