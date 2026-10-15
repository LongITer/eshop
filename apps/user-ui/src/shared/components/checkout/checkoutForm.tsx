'use client';
import { useStorefrontText } from '@packages/components/storefront-language';
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { ArrowLeft, ArrowRight, CheckCircle, CreditCard, Loader2, LockKeyhole, MapPin, Pencil, ShoppingBag, XCircle } from "lucide-react";
import Link from "next/link";
import { formatUSD } from "@packages/utils/money";
import { cartLineKey } from "@packages/utils/cart";
import React, { useState } from "react";

const CheckoutForm = ({
  clientSecret,
  cartItems,
  coupon,
  sessionId,
  totalAmount,
  shippingFee, shippingAddress, shippingByShop,
}: {
  clientSecret: string;
  cartItems: any[];
  coupon: any;
  sessionId: string | null;
  totalAmount: number;
  shippingFee: number; shippingAddress?: Record<string,string>; shippingByShop?: Record<string,number>;
}) => {
  const { t } = useStorefrontText();
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [paymentElementReady, setPaymentElementReady] = useState(false);
  const [status, setStatus] = useState<"success" | "failed" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setStatus(null);

    if (!stripe || !elements || !paymentElementReady) {
      setErrorMsg("Biểu mẫu thanh toán chưa sẵn sàng. Vui lòng chờ rồi thử lại.");
      setLoading(false);
      return;
    }

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success?sessionId=${sessionId}`,
        },
      });

      if (result.error) {
        setStatus("failed");
        setErrorMsg(result.error.message || "Không thanh toán được.");
      } else {
        setStatus("success");
      }
    } catch (error) {
      console.error(error);
      setStatus("failed");
      setErrorMsg("Không gửi được thanh toán. Vui lòng tải lại và thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (!clientSecret) {
    return null;
  }

  const subtotal = cartItems.reduce((sum, item) => sum + Math.round(Number(item.sale_price) * 100) * item.quantity, 0) / 100;
  const discount = Number(coupon?.discountAmount || 0);
  const addressLines = [shippingAddress?.street, [shippingAddress?.city, shippingAddress?.zip].filter(Boolean).join(', '), shippingAddress?.country].filter(Boolean);

  return (
    <main className="mx-auto w-[95%] max-w-6xl py-8 sm:py-12">
      <Link href="/cart" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600">
        <ArrowLeft size={16} aria-hidden="true" />{t("Quay lại giỏ hàng")}
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{t("Xác nhận và thanh toán")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{t("Review your delivery details and order before paying.")}</p>
      </div>

      <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="delivery-heading" className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="delivery-heading" className="flex items-center gap-2.5 text-base font-semibold text-slate-900"><MapPin size={19} className="text-blue-600" aria-hidden="true" />{t("Địa chỉ nhận hàng")}</h2>
            <Link href="/cart" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition hover:text-blue-700"><Pencil size={14} aria-hidden="true" />{t("Sửa")}</Link>
          </div>
          {shippingAddress?.name || addressLines.length ? <div className="border-l-2 border-blue-100 pl-4">
            {shippingAddress?.name && <p className="break-words font-medium text-slate-900">{shippingAddress.name}</p>}
            <p className="mt-1 break-words text-sm leading-6 text-slate-500">{addressLines.join(', ')}</p>
          </div> : <p className="text-sm text-slate-500">{t("Vui lòng chọn địa chỉ nhận hàng.")}</p>}
        </section>

        <aside aria-labelledby="summary-heading" className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <div className="flex items-center gap-2.5 border-b border-slate-200/80 px-5 py-5 sm:px-6"><ShoppingBag size={19} className="text-blue-600" aria-hidden="true" /><h2 id="summary-heading" className="text-base font-semibold text-slate-900">{t("Tóm tắt đơn hàng")}</h2></div>
          <ul className="divide-y divide-slate-200/70 px-5 sm:px-6">
            {cartItems.map(item => {
              const image = item.image || (typeof item.images?.[0] === 'string' ? item.images[0] : item.images?.[0]?.url) || '/product-placeholder.svg';
              const color = item.selectedOptions?.color;
              const hexColor = typeof color === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(color);
              return <li key={cartLineKey(item)} className="flex items-start gap-3 py-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5">
                  <img src={image} alt="" className="h-full w-full object-contain" onError={event => { if (!event.currentTarget.src.endsWith('/product-placeholder.svg')) event.currentTarget.src = '/product-placeholder.svg'; }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium leading-5 text-slate-900">{item.title}</p>
                  {(color || item.selectedOptions?.size) && <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {color && <span className="inline-flex items-center gap-1.5">{t("Color:")}{hexColor ? <span role="img" aria-label={color} title={color} className="inline-block h-3 w-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: color }} /> : color}</span>}
                    {item.selectedOptions?.size && <span>{t("Size:")} {item.selectedOptions.size}</span>}
                  </div>}
                  <p className="mt-2 text-xs text-slate-500">{t("Quantity:")} {item.quantity}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatUSD(Math.round(Number(item.sale_price) * 100) * item.quantity / 100)}</span>
              </li>;
            })}
          </ul>
          <div className="border-t border-slate-200/80 px-5 py-5 sm:px-6">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t("Tạm tính")}</dt><dd className="shrink-0 font-medium tabular-nums text-slate-900">{formatUSD(subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between gap-4"><dt className="min-w-0 text-emerald-700">{t("Giảm giá")}{coupon?.code && <span className="mt-0.5 block break-all text-xs">{coupon.code}</span>}</dt><dd className="shrink-0 font-medium tabular-nums text-emerald-700">−{formatUSD(discount)}</dd></div>}
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{t("Vận chuyển")}{Object.keys(shippingByShop || {}).length > 1 && <span className="ml-1 text-xs">({Object.keys(shippingByShop || {}).length} {t("Shops")})</span>}</dt><dd className="shrink-0 font-medium tabular-nums text-slate-900">{formatUSD(shippingFee)}</dd></div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4"><dt className="font-semibold text-slate-900">{t("Tổng thanh toán")}</dt><dd className="shrink-0 text-right"><span className="text-xl font-semibold tabular-nums text-slate-900">{formatUSD(totalAmount)}</span><span className="ml-1.5 text-xs font-medium text-slate-500">USD</span></dd></div>
            </dl>
          </div>
        </aside>

        <section aria-labelledby="payment-heading" className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-start-1 lg:row-start-2">
          <h2 id="payment-heading" className="mb-5 flex items-center gap-2.5 text-base font-semibold text-slate-900"><CreditCard size={19} className="text-blue-600" aria-hidden="true" />{t("Phương thức thanh toán")}</h2>
          {stripe && elements ? (
            <PaymentElement
              onReady={() => setPaymentElementReady(true)}
              onLoadError={event => {
                setPaymentElementReady(false);
                setStatus("failed");
                setErrorMsg(event.error.message || "Không tải được biểu mẫu thanh toán. Vui lòng thử lại sau.");
              }}
            />
          ) : (
            <div role="status" className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-6 text-sm text-slate-500"><Loader2 size={18} className="animate-spin" aria-hidden="true" />{t("Đang tải biểu mẫu thanh toán…")}</div>
          )}

          {(errorMsg || status === 'failed') && <div role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm leading-5 text-red-700"><XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{t(errorMsg || "Thanh toán thất bại. Vui lòng thử lại.")}</p></div>}
          {status === 'success' && <div role="status" className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm leading-5 text-emerald-700"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{t("Đã gửi thanh toán. Đang chờ xác nhận.")}</p></div>}

          <button type="submit" disabled={!stripe || !paymentElementReady || loading || status === 'success'} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-medium text-white shadow-md transition hover:from-blue-700 hover:to-blue-600 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">
            {loading ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />{t("Đang xử lý…")}</> : <>{t(paymentElementReady ? "Thanh toán ngay" : status === 'failed' ? "Payment unavailable" : "Đang tải thanh toán…")}<span className="tabular-nums">· {formatUSD(totalAmount)}</span>{paymentElementReady && <ArrowRight size={17} aria-hidden="true" />}</>}
          </button>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-slate-500"><LockKeyhole size={13} className="shrink-0" aria-hidden="true" />{t("Payment details are encrypted and processed by Stripe.")}</p>
        </section>
      </form>
    </main>
  );

};

export default CheckoutForm;
