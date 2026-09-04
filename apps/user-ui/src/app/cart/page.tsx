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

const CartPage = () => {
  const router = useRouter();
  const { user } = useUser();
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

  const couponCodeApplyHandler = async () => {
    setError("");

    if (!couponCode.trim()) {
      setError("Please enter a coupon code.");
      return;
    }

    try {
      const res = await axiosInstance.put("/order/api/apply-coupon", {
        couponCode: couponCode.trim(),
        cart,
      });

      if (res.data.valid) {
        setStoredCouponCode(couponCode.trim());
        setDiscountAmount(res.data.discountAmount);
        setDiscountPercent(res.data.discount);
        setDiscountedProductId(res.data.productId);
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
      toast.error("Something went wrong. Please try again!");
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const decreaseQuantity = (id: string) => {
    useStore.setState((state: any) => ({
      cart: state.cart.map((item: any) =>
        item.id === id && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item,
      ),
    }));
  };

  const increaseQuantity = (id: string) => {
    useStore.setState((state: any) => ({
      cart: state.cart.map((item: any) =>
        item.id === id ? { ...item, quantity: (item.quantity ?? 1) + 1 } : item,
      ),
    }));
  };

  const subtotal = cart.reduce(
    (total: number, item: any) => total + item.quantity * item.sale_price,
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
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
      }
    }
  }, [addresses, selectedAddressId]);

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
                  <tr key={item.id} className="border-b border-b-[#0000000e]">
                    <td className="flex items-center gap-4 p-4">
                      <Image
                        src={item?.images[0]?.url}
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
                      {item?.id === discountedProductId ? (
                        <div className="flex flex-col items-center">
                          <span className="line-through text-gray-500 text-sm">
                            ${item.sale_price.toFixed(2)}
                          </span>{" "}
                          <span className="text-green-600 font-semibold">
                            $
                            {(
                              (item.sale_price *
                                (100 - item?.discountPercent)) /
                              100
                            ).toFixed(2)}
                          </span>
                          <span className="text-xs text-green-700 bg-white">
                            Discount Applied
                          </span>
                        </div>
                      ) : (
                        <span>${item?.sale_price.toFixed(2)}</span>
                      )}
                    </td>
                    <td>
                      <div className="flex justify-center border border-gray-200 rounded-[20px] w-[90px] p-[2px]">
                        <button
                          className="text-black cursor-pointer text-xl"
                          onClick={() => decreaseQuantity(item.id)}
                        >
                          -
                        </button>
                        <span className="px-4">{item?.quantity}</span>
                        <button
                          className="text-black cursor-pointer text-xl"
                          onClick={() => increaseQuantity(item.id)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => removeItem(item.id)}
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
              {discountAmount > 0 && (
                <div className="flex justify-center text-[#010f1c] text-base font-medium pb-1">
                  <span className="font-jost">
                    Discount ({discountPercent}%)
                  </span>
                  <span className="text-green-600">
                    - ${discountAmount.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-[#010f1c] text-[20px] font-[550] pb-3">
                <span className="font-jost">Subtotal</span>
                <span>${(subtotal - discountAmount).toFixed(2)}</span>
              </div>
              <hr className="my-4 text-slate-200" />

              <div className="mb-4">
                <h4 className="mb-[7px] font-[500] text-[15px]">
                  Have a Coupon?
                </h4>
                <div className="flex">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e: any) => setCouponCode(e.target.value)}
                    placeholder="Enter coupon code"
                    className="w-full p-2 border border-gray-200 rounded-l-md focus:outline-none focus:border-blue-500 focus:ring-0"
                  />
                  <button
                    className="bg-blue-500 cursor-pointer text-white px-4 rounded-r-md hover:bg-blue-600 hover:text-white transition-colors"
                    onClick={() => couponCodeApplyHandler()}
                  >
                    Apply
                  </button>

                  {error && (
                    <p className="text-red-500 text-sm">{error}</p>
                  )}
                </div>
                <hr className="my-4 text-slate-200" />

                <div className="mb-4">
                  <h4 className="mb-[7px] font-medium text-[15px]">
                    Select Shipping Address
                  </h4>
                  {addresses?.length !== 0 && (
                    <select
                      className="w-full p-2 border border-gray-200 rounded-md focus:outline-none"
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                    >
                      {addresses?.map((address: any) => (
                        <option key={address.id} value={address.id}>
                          {address.label} - {address.city}, {address.country}
                        </option>
                      ))}
                    </select>
                  )}

                  {addresses?.length === 0 && (
                    <p className="text-sm text-slate-800">
                      Please add an address from profile to create an order!
                    </p>
                  )}
                </div>
                <hr className="my-4 text-slate-200" />

                <div className="mb-4">
                  <h4 className="mb-[7px] font-[500] text-[15px]">
                    Select Payment Method
                  </h4>
                  <select className="w-full p-2 border border-gray-200 rounded-md focus:outline">
                    <option value="credit_card">Online Payment</option>
                    <option value="cash_on_delivery">Cash on Delivery</option>
                  </select>
                </div>
                <hr className="my-4 text-slate-200" />

                <div className="flex justify-between items-center text-[#010f1c] text-[20px] font-[550] pb-3">
                  <span className="font-jost">Total</span>
                  <span>${(subtotal - discountAmount).toFixed(2)}</span>
                </div>

                <button
                  onClick={createPaymentSession}
                  disabled={loading}
                  className="w-full flex cursor-pointer items-center justify-center gap-2 mt-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-[15px] font-medium rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {loading && <Loader2 className="animate-spin w-5 h-5" />}
                  {loading ? "Redirecting ..." : "Proceed to Checkout"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartPage;
