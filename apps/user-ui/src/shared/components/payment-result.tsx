'use client';
import { useStorefrontText } from '@packages/components/storefront-language';

import { useStore } from '@/store';
import { cartLineKey } from '@packages/utils/cart';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '@/utils/axioInstance';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { CheckCircle, Truck, Loader2, Clock3, AlertCircle, ArrowRight } from 'lucide-react';

export default function PaymentResult() {
  const { t } = useStorefrontText();
  const params = useSearchParams();
  const sessionId = params.get('sessionId');
  const paymentIntentId = params.get('payment_intent');
  const [timedOut, setTimedOut] = useState(false);
  const cleared = useRef(false);
  useEffect(() => {
    setTimedOut(false);
    cleared.current = false;
    const timer = setTimeout(() => setTimedOut(true), 60000);
    return () => clearTimeout(timer);
  }, [sessionId]);
  const result = useQuery({ queryKey: ['payment-result', sessionId], enabled: !!sessionId,
    queryFn: async () => (await axios.get('/order/api/payment-result', { params: { sessionId, paymentIntentId } })).data,
    refetchInterval: query => timedOut || query.state.data?.complete || ['needs_review', 'canceled', 'requires_payment_method', 'expired'].includes(query.state.data?.status) || query.state.error ? false : 3000,
    retry: 2,
  });
  useEffect(() => {
    if (!result.data?.complete || cleared.current) return;
    cleared.current = true;
    const marker = `checkout-cleared:${sessionId}`;
    if (localStorage.getItem(marker)) return;
    const purchased = new Map<string, number>(result.data.cart.map((item: any) => [cartLineKey(item), item.quantity]));
    useStore.setState(state => ({ cart: state.cart.flatMap(item => {
      const quantity = (item.quantity || 1) - (purchased.get(cartLineKey(item)) || 0);
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }) }));
    localStorage.setItem(marker, '1');
  }, [result.data, sessionId]);
  const celebrated = useRef<string | null>(null);
  useEffect(() => {
    if (!result.data?.complete || !sessionId || celebrated.current === sessionId) return;
    // Wait for the success card to paint and the tab to be visible after Stripe redirects.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const celebrate = () => {
      if (document.visibilityState !== 'visible' || celebrated.current === sessionId || timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (document.visibilityState !== 'visible') return;
        celebrated.current = sessionId;
        confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, zIndex: 10000 });
      }, 350);
    };
    celebrate();
    document.addEventListener('visibilitychange', celebrate);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', celebrate); };
  }, [result.data?.complete, sessionId]);

  if (result.data?.complete) return <div className="min-h-[80vh] flex items-center justify-center px-4">
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg max-w-md w-full text-center p-8">
      <div className="text-green-500 mb-4"><CheckCircle className="w-16 h-16 mx-auto" /></div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">{t("Payment Successful 🎉")}</h2>
      <p className="text-sm text-gray-600 mb-6">{t("Thank you for your purchase. Your order has been placed successfully!")}</p>
      <Link href="/profile?active=My+Orders" className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700"><Truck className="w-4 h-4" />{t("Track Order")}</Link>
      <div className="mt-8 text-xs text-gray-400">{t("Payment Session ID: ")}<span className="break-all font-mono">{sessionId}</span></div>
    </div>
  </div>;

  const needsReview = result.data?.status === 'needs_review';
  const notPaid = ['canceled', 'requires_payment_method'].includes(result.data?.status);
  const expired = result.data?.status === 'expired';
  const waiting = !!sessionId && !result.isError && !needsReview && !notPaid && !expired && !timedOut;
  const title = !sessionId ? 'Missing checkout session' : result.isError ? 'Unable to verify payment' : needsReview ? 'Your order needs a review' : notPaid ? 'Payment not completed' : expired ? 'Checkout session expired' : timedOut ? 'Confirmation is taking longer' : 'Confirming your order…';
  const description = !sessionId ? 'Open your order history to check your recent purchases.' : needsReview ? 'Payment was received, but we could not finish creating your order. Contact the shop with your checkout reference.' : notPaid ? 'This payment has not completed. Your items are still in your cart.' : expired ? 'This checkout session has expired. Check your order history before starting another checkout.' : result.isError ? 'We could not check your order right now. Please try checking again.' : timedOut ? 'We are still waiting for confirmation. You can check again or view your order history.' : 'We are checking your payment and preparing your order details. This usually takes a few moments.';
  return <main className="flex min-h-[80vh] items-center justify-center px-4 py-12">
    <section aria-live="polite" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="px-6 pb-6 pt-8 text-center sm:px-8">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${waiting ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>{waiting ? <Loader2 size={30} className="animate-spin motion-reduce:animate-none" /> : timedOut ? <Clock3 size={30} /> : <AlertCircle size={30} />}</div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{t("Order confirmation")}</p>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{t(title)}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{t(description)}</p>
        {sessionId && !notPaid && <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{t("Your cart stays saved. If you have already paid, please do not pay again.")}</div>}
        <div className="mt-6 flex flex-col gap-3">
          {sessionId && !waiting && <button disabled={result.isFetching} onClick={() => result.refetch()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{result.isFetching && <Loader2 size={15} className="animate-spin" />}{result.isFetching ? t('Checking…') : t('Check again')}</button>}
          <Link href="/profile?active=My+Orders" className="inline-flex items-center justify-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700">{t("View my orders")}<ArrowRight size={15} /></Link>
        </div>
      </div>
      {sessionId && <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-center"><p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{t("Checkout reference")}</p><p className="break-all font-mono text-xs text-slate-500">{sessionId}</p></div>}
    </section>
  </main>;
}
