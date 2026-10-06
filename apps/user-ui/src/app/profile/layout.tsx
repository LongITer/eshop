import { Suspense } from 'react';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-6" role="status">Loading profile…</p>}>{children}</Suspense>;
}
