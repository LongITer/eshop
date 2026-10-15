"use client";
import { useStorefrontText } from '@packages/components/storefront-language';

import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import axiosInstance from "@/utils/axioInstance";
import { XCircle } from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "@/shared/components/checkout/checkoutForm";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY)
  : null;

const Page = () => {
  const { t, language } = useStorefrontText();
  const [clientSecret, setClientSecret] = useState("");
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [coupon, setCoupon] = useState();
  const [summary, setSummary] = useState<any>({ totalAmount: 0, shippingFee: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("sessionId");

  useEffect(() => {
    const fetchSessionAndClientSecret = async () => {
      if (!sessionId) {
        setError(t("Phiên thanh toán không hợp lệ. Vui lòng thử lại."));
        setLoading(false);
        return;
      }

      try {
        const verifyRes = await axiosInstance.get(
          `/order/verify-payment-session?sessionId=${sessionId}`,
        );

        const { totalAmount: sessionTotal, cart, coupon } = verifyRes.data.session;

        if (
          sessionTotal === undefined ||
          sessionTotal === null ||
          !Array.isArray(cart) ||
          cart.length === 0
        ) {
          throw new Error("Invalid payment session data.");
        }

        setCartItems(cart);
        setCoupon(coupon);
        setSummary({ totalAmount: sessionTotal, shippingFee: verifyRes.data.session.shippingFee || 0, shippingAddress: verifyRes.data.session.shippingAddress, shippingByShop: verifyRes.data.session.shippingByShop });

        const intentRes = await axiosInstance.post(
          "/order/create-payment-intent",
          {
            sessionId,
          },
        );

        const secret = intentRes?.data?.clientSecret;

        if (typeof secret !== "string" || !secret.trim()) {
          throw new Error("Payment initialization failed: missing client secret.");
        }

        setClientSecret(secret);
      } catch (err: any) {
        console.error(err);
        setError(t("Không chuẩn bị được thanh toán. Vui lòng thử lại."));
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndClientSecret();
  }, [sessionId]);

  const appearance = {
    theme: "stripe",
    variables: {
      colorPrimary: "#2563eb",
      colorBackground: "#ffffff",
      colorText: "#0f172a",
      colorTextSecondary: "#64748b",
      colorDanger: "#b91c1c",
      fontFamily: 'Roboto, system-ui, sans-serif',
      fontSizeBase: "16px",
      borderRadius: "8px",
      spacingUnit: "4px",
    },
    rules: {
      '.Input': { border: '1px solid #e2e8f0', boxShadow: 'none' },
      '.Input:focus': { border: '1px solid #3b82f6', boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)' },
      '.Label': { color: '#475569', fontWeight: '500', fontSize: '13px' },
      '.Tab': { border: '1px solid #e2e8f0', boxShadow: 'none' },
      '.Tab--selected': { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
    },
  } satisfies Appearance;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[70vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] px-4">
        <div className="w-full text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="text-red-500 w-10 h-10" />
          </div>
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            {t("Chưa thể thanh toán")}</h2>
          <p className="text-sm text-gray-600 mb-6">
            {t(error || "")} <br className="hidden sm:block" /> {t("Vui lòng quay lại giỏ hàng để thử lại.")}
          </p>
          <button
            onClick={() => router.push("/cart")}
            className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700"
          >
            {t("Quay lại giỏ hàng")}</button>
        </div>
      </div>
    );
  }

  if (!stripePromise || !clientSecret) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] px-4 text-center text-red-600">
        {t("Tạm thời không mở được thanh toán. Vui lòng thử lại sau hoặc liên hệ cửa hàng.")}</div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance, locale: language }}>
      <CheckoutForm
        clientSecret={clientSecret}
        cartItems={cartItems}
        coupon={coupon}
        sessionId={sessionId}
        totalAmount={summary.totalAmount}
        shippingFee={summary.shippingFee}
        shippingAddress={summary.shippingAddress}
        shippingByShop={summary.shippingByShop}
      />
    </Elements>
  );
};

export default Page;
