'use client';

import { useEffect } from 'react';

export default function ProductError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep the error local to the product route instead of exposing an Axios
    // object through Next's server/client boundary.
    console.error('Product page failed to load');
  }, []);

  return <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
    <h1 className="text-2xl font-semibold text-slate-800">Unable to load this product</h1>
    <p className="text-sm text-slate-500">The product service is temporarily unavailable. Please try again.</p>
    <button type="button" onClick={() => reset()} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Try again</button>
  </main>;
}
