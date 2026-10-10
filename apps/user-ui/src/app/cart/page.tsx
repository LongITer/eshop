"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useUser from "../../hooks/useUser";
import useLocationTracking from "../../hooks/useLocationTracking";
import useDeviceTracking from "../../hooks/useDeviceTracking";
import { useStore } from "../../store";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import axiosInstance from "@/utils/axioInstance";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { cartLineKey } from '@packages/utils/cart';

const CartPage = () => {
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const location = useLocationTracking();
  const deviceInfo = useDeviceTracking();

  const cart = useStore((state: any) => state.cart);
  const removeFromCart = useStore((state: any) => state.removeFromCart);
  const [loading, setLoading] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [error, setError] = useState("");
  const [storedCouponCode, setStoredCouponCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountedProductId, setDiscountedProductId] = useState("");

  const getCartItemPrice = (item: any) => {
    const price = Number(
      item?.sale_price ?? item?.price ?? item?.regular_price ?? 0,
    );
    return Number.isFinite(price) ? price : 0;
  };

  const getCartItemImage = (item: any) => {
    const image = item?.images?.[0];
    if (typeof image === "string") return image;
    return image?.url || item?.image || "/default-image.jpg";
  };

  const couponCodeApplyHandler = async () => {
    setError("");

    if (!couponCode.trim()) {
      setError("Please enter a coupon code.");
      return;
    }

    try {
      const res = await axiosInstance.post("/order/verify-coupon", {
        couponCode: couponCode.trim(),
        cart,
      });

      if (res.data.valid) {
        setStoredCouponCode(couponCode.trim());
        setDiscountAmount(Number(res.data.discountAmount));
        setDiscountPercent(res.data.discount);
        setDiscountedProductId(res.data.discountProductId);
        setCouponCode("");
      } else {
        setDiscountAmount(0);
        setDiscountPercent(0);
        setDiscountedProductId("");
        setError(res.data.message || "Coupon not valid for any items in cart.");
      }
    } catch (error: any) {
      setDiscountAmount(0);
      setDiscountPercent(0);
      setDiscountedProductId("");
      setError(
        error.response?.data?.message ||
          "An error occurred while applying the coupon.",
      );
    }
  };

  const createPaymentSession = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!selectedAddressId) {
      toast.error("Please set your delivery address to create an order!");
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.post("/order/create-payment-session", {
        cart,
        selectedAddressId,
        coupon: {
          code: storedCouponCode,
          discountAmount,
          discountPercent,
          discountedProductId,
        },
      });

      const sessionId = res.data.sessionId;
      router.push(`/checkout?sessionId=${sessionId}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Something went wrong. Please try again!");
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const decreaseQuantity = (id: string) => {
    useStore.setState((state: any) => ({
      cart: state.cart.map((item: any) =>
        cartLineKey(item) === id && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item,
      ),
    }));
  };

  const increaseQuantity = (id: string) => {
    useStore.setState((state: any) => ({
      cart: state.cart.map((item: any) =>
        cartLineKey(item) === id ? { ...item, quantity: (item.quantity ?? 1) + 1 } : item,
      ),
    }));
  };

  const subtotal = cart.reduce(
    (total: number, item: any) =>
      total + (item.quantity ?? 1) * getCartItemPrice(item),
    0,
  );

  // Get addresses
  const { data: addresses = [] } = useQuery<any[], Error>({
    queryKey: ["shipping-addresses"],
    queryFn: async () => {
      const res = await axiosInstance.get("/api/shipping-addresses");
      return res.data.addresses;
    },
  });

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find((addr) => addr.isDefault);
      setSelectedAddressId((defaultAddr || addresses[0]).id);
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    setStoredCouponCode(''); setDiscountAmount(0); setDiscountPercent(0); setDiscountedProductId('');
  }, [cart]);

  const removeItem = (id: string) => {
    removeFromCart(id, user, location, deviceInfo);
  };

  return (
    <div className="w-full bg-white">
      <div className="md:w-[80%] w-[95%] mx-auto min-h-screen">
        <div className="pb-[50px]">
          <h1 className="md:pt-[50px] font-medium text-[44px] leading-[1] mb-[16px] font-jost">
            Shopping Cart
          </h1>
          <Link href={"/"} className="text-[#55585b] hover:underline">
            Home
          </Link>
          <span className="inline-block p-[1.5px] mx-1 bg-[#a8acb0] rounded-full"></span>
          <span className="text-[#55585b]">Cart</span>
        </div>

        {cart.length === 0 ? (
          <div className="text-center text-gray-600 text-lg">
            Your cart is empty! Start adding products.
          </div>
        ) : (
          <div className="lg:flex items-start gap-10">
            <table className="w-full lg:w-[70%] border-collapse">
              <thead className="bg-[#f1f3f4] rounded">
                <tr>
                  <th className="py-3 text-left pl-4">Product</th>
                  <th className="py-3 text-left">Price</th>
                  <th className="py-3 text-left">Quantity</th>
                  <th className="py-3 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item: any) => (
                  <tr key={cartLineKey(item)} className="border-b border-b-[#0000000e]">
                    <td className="flex items-center gap-4 p-4">
                      <Image
                        src={getCartItemImage(item)}
                        alt={item.title}
                        width={80}
                        height={80}
                        className="rounded"
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{item.title}</span>
                        {item?.selectedOptions && (
                          <div className="text-sm text-gray-500">
                            {item?.selectedOptions?.color && (
                              <span>
                                Color: {}
                                <span
                                  style={{
                                    backgroundColor:
                                      item?.selectedOptions?.color,
                                    width: "12px",
                                    height: "12px",
                                    borderRadius: "100%",
                                    display: "inline-block",
                                  }}
                                />
                              </span>
                            )}
                            {item?.selectedOptions.size && (
                              <span className="ml-2">
                                Size: {item?.selectedOptions?.size}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 text-lg text-center">
                      <span>${getCartItemPrice(item).toFixed(2)}</span>
                    </td>
                    <td>
                      <div className="flex justify-center border border-gray-200 rounded-[20px] w-[90px] p-[2px]">
                        <button
                          className="text-black cursor-pointer text-xl"
                          onClick={() => decreaseQuantity(cartLineKey(item))}
                        >
                          -
                        </button>
                        <span className="px-4">{item?.quantity}</span>
                        <button
                          className="text-black cursor-pointer text-xl"
                          onClick={() => increaseQuantity(cartLineKey(item))}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => removeItem(cartLineKey(item))}
                        title="Remove item"
                        className="
                          group inline-flex items-center justify-center
                          w-9 h-9 rounded-full
                          border border-gray-200 bg-gray-50
                          text-gray-400
                          hover:bg-red-50 hover:border-red-300 hover:text-red-500
                          active:scale-90
                          transition-all duration-200 ease-in-out
                          cursor-pointer shadow-sm hover:shadow-md
                        "
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-transform duration-200 group-hover:scale-110"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="p-6 shadow-md w-full lg:w-[30%] bg-[#f9f9f9] rounded-lg">
              <h3 className="text-lg font-semibold text-slate-900">Order summary</h3>
              <hr className="my-4 text-slate-200" />
              <div className="mb-4">
                <h4 className="mb-[7px] font-[500] text-[15px]">Have a Coupon?</h4>
                <div className="flex">
                  <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="Enter coupon code" className="w-full p-2 border border-gray-200 rounded-l-md focus:outline-none focus:border-blue-500 focus:ring-0" />
                  <button className="bg-blue-500 cursor-pointer text-white px-4 rounded-r-md hover:bg-blue-600 hover:text-white transition-colors" onClick={() => couponCodeApplyHandler()}>Apply</button>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <hr className="my-4 text-slate-200" />
                <div className="mb-4">
                  <h4 className="mb-[7px] font-medium text-[15px]">Select Shipping Address</h4>
                  {addresses?.length !== 0 && <select className="w-full p-2 border border-gray-200 rounded-md focus:outline-none" value={selectedAddressId} onChange={e => setSelectedAddressId(e.target.value)}>{addresses?.map((address: any) => <option key={address.id} value={address.id}>{address.label} - {address.city}, {address.country}</option>)}</select>}
                  {addresses?.length === 0 && <p className="text-sm text-slate-800">Please add an address from profile to create an order!</p>}
                </div>
                <hr className="my-4 text-slate-200" />
                <div className="mb-4">
                  <h4 className="mb-[7px] font-[500] text-[15px]">Select Payment Method</h4>
                  <select className="w-full p-2 border border-gray-200 rounded-md focus:outline"><option value="credit_card">Online Payment</option></select>
                </div>
                <hr className="my-4 text-slate-200" />
                <div className="mb-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4 text-slate-600"><span>Subtotal</span><span className="shrink-0 font-medium tabular-nums text-slate-900">${subtotal.toFixed(2)}</span></div>
                  {discountAmount > 0 && <div className="flex items-start justify-between gap-4 py-2.5 text-emerald-700"><div className="min-w-0"><span className="font-medium">Discount</span><span className="mt-0.5 block break-all text-xs text-emerald-600">{storedCouponCode}</span></div><span className="shrink-0 font-semibold tabular-nums">−${discountAmount.toFixed(2)}</span></div>}
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-4 text-[#010f1c] text-[20px] font-[550] pb-3"><span className="font-jost">Total</span><span>${(subtotal - discountAmount).toFixed(2)}</span></div>
                <p className="text-sm text-gray-600">Final prices and shipping are confirmed on the checkout page before payment.</p>
                <button onClick={createPaymentSession} disabled={loading || userLoading} className="w-full flex cursor-pointer items-center justify-center gap-2 mt-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-[15px] font-medium rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100">{loading && <Loader2 className="animate-spin w-5 h-5" />}{userLoading ? 'Loading ...' : loading ? 'Redirecting ...' : user ? 'Proceed to Checkout' : 'Login to Checkout'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;
