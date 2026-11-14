import { StorefrontText } from '@packages/components/storefront-language';
import { Suspense } from 'react';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-6" role="status"><StorefrontText>Loading checkout…</StorefrontText></p>}>{children}</Suspense>;
}
