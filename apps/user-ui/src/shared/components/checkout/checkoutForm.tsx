import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import React, { useState } from "react";

const CheckoutForm = ({
  clientSecret,
  cartItems,
  coupon,
  sessionId,
}: {
  clientSecret: string;
  cartItems: any[];
  coupon: any;
  sessionId: string | null;
}) => {
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

    if (!stripe || !elements || !paymentElementReady) {
      setErrorMsg("Payment form is not ready. Please wait and try again.");
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
        setErrorMsg(result.error.message || "Something went wrong!");
      } else {
        setStatus("success");
      }
    } catch (error) {
      console.error(error);
      setStatus("failed");
      setErrorMsg("Unable to submit payment. Please reload and try again.");
    } finally {
      setLoading(false);
    }
  };

  const total = cartItems.reduce(
    (sum, item) => sum + item.sale_price * item.quantity,
    0,
  );

  if (!clientSecret) {
    return null;
  }

  return (
    <div className="flex justify-center items-center min-h-[80vh] px-4 my-10">
      <form
        className="bg-white w-full max-w-lg p-8 rounded-md shadow space-y-6"
        onSubmit={handleSubmit}
      >
        <h2 className="text-3xl font-bold text-center mb-2">
          Secure Payment Checkout
        </h2>

        {/* Dynamic Order Summary */}
        <div className="bg-gray-100 p-4 rounded-md text-sm text-gray-700 space-y-2">
          {cartItems.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm pb-1">
              <span>
                {item.quantity} x {item.title}
              </span>
              <span>${(item.quantity * item.sale_price).toFixed(2)}</span>
            </div>
          ))}

          <div className="flex justify-between font-semibold pt-2 border-t border-t-gray-200">
            {(coupon?.discountAmount ?? 0) > 0 && (
              <>
                <span>Discount</span>
                <span className="text-green-600">
                  -${coupon.discountAmount.toFixed(2)}
                </span>
              </>
            )}
          </div>

          <div className="flex justify-between font-semibold mt-2">
            <span>Total</span>
            <span>${(total - (coupon?.discountAmount ?? 0)).toFixed(2)}</span>
          </div>
        </div>

        {stripe && elements ? (
          <PaymentElement
            onReady={() => setPaymentElementReady(true)}
            onLoadError={(event) => {
              setPaymentElementReady(false);
              setStatus("failed");
              setErrorMsg(
                event.error.message ||
                  "Unable to load the payment form. Please check your Stripe configuration.",
              );
            }}
          />
        ) : (
          <div className="flex items-center justify-center py-4 text-sm text-gray-500">
            Loading payment form...
          </div>
        )}
        <button
          type="submit"
          disabled={!stripe || !paymentElementReady || loading}
          className="w-full min-h-11 inline-flex items-center justify-center gap-2 bg-blue-600 px-4 py-2 text-white rounded-lg font-medium transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span>Processing...</span>
            </>
          ) : (
            <span>{paymentElementReady ? "Pay Now" : "Loading payment..."}</span>
          )}
        </button>

        {errorMsg && (
          <div className="flex items-center gap-2 text-red-600 text-sm justify-center">
            <XCircle className="w-5 h-5" />
            {errorMsg}
          </div>
        )}

        {status === "success" && (
          <div className="flex items-center gap-2 text-green-600 text-sm justify-center">
            <CheckCircle className="w-5 h-5" />
            Payment successful!
          </div>
        )}

        {status === "failed" && (
          <div className="flex items-center gap-2 text-red-600 text-sm justify-center">
            <XCircle className="w-5 h-5" />
            Payment failed. Please try again.
          </div>
        )}
      </form>
    </div>
  );
};

export default CheckoutForm;
