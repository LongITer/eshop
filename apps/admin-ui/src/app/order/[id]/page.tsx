"use client";

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "apps/admin-ui/src/utils/axioInstance";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const fetchAdminOrders = async () => {
  const res = await axiosInstance.get("/order/get-admin-orders");
  return Array.isArray(res.data) ? res.data : (res.data?.orders ?? []);
};

const deliveryStages = [
  { label: "Ordered", statuses: ["Pending"] },
  { label: "Packed", statuses: ["Confirmed", "Processing"] },
  { label: "Shipped", statuses: ["Shipped"] },
  { label: "Out for Delivery", statuses: [] },
  { label: "Delivered", statuses: ["Delivered"] },
];

const statusColorMap: Record<string, string> = {
  Pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  Confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  Processing: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  Shipped: "bg-purple-500/20 text-purple-400 border-purple-500/40",
  Delivered: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  Cancelled: "bg-red-500/20 text-red-400 border-red-500/40",
};

const formatAddress = (address: Record<string, unknown> | null | undefined) =>
  [
    address?.name,
    address?.street,
    address?.city,
    address?.zip,
    address?.country,
  ]
    .filter(Boolean)
    .join(", ") || "No shipping address";

const OrderDetails = () => {
  const { id } = useParams<{ id: string }>();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: fetchAdminOrders,
    staleTime: 1000 * 60 * 5,
  });

  const order = orders.find((item: any) => item.id === id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080d1a] p-6 text-white md:p-10">
        <div className="mx-auto max-w-4xl animate-pulse">
          <div className="mb-6 h-4 w-44 rounded bg-slate-800" />
          <div className="mb-7 h-8 w-64 rounded bg-slate-800" />
          <div className="mb-8 h-24 rounded-lg border border-slate-800 bg-[#0d1423]" />
          <div className="mb-8 h-16 rounded-lg bg-slate-900" />
          <div className="space-y-3">
            <div className="h-4 w-52 rounded bg-slate-800" />
            <div className="h-4 w-64 rounded bg-slate-800" />
            <div className="h-4 w-40 rounded bg-slate-800" />
          </div>
          <div className="mt-8 h-20 rounded-lg border border-slate-800 bg-[#0d1423]" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#080d1a] p-8 text-white">
        <p className="mb-4 text-slate-300">Order not found.</p>
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
        >
          <ArrowLeft size={16} />
          Back to orders
        </Link>
      </div>
    );
  }

  const activeIndex = Math.max(
    0,
    deliveryStages.findIndex((stage) => stage.statuses.includes(order.status)),
  );

  const statusColor =
    statusColorMap[order.status] ??
    "bg-slate-500/20 text-slate-400 border-slate-500/40";

  return (
    <div className="min-h-screen bg-[#080d1a] p-6 text-white md:p-10">
      <div className="mx-auto max-w-4xl">
        {/* Back link */}
        <Link
          href="/dashboard/orders"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-blue-400"
        >
          <ArrowLeft size={16} />
          Back to All Orders
        </Link>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Order #{order.id.slice(-6).toUpperCase()}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Placed on{" "}
              {new Date(order.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-sm font-medium ${statusColor}`}
          >
            {order.status}
          </span>
        </div>

        {/* Delivery tracker (read-only) */}
        <div className="mb-8 overflow-x-auto rounded-lg border border-slate-800 bg-[#0d1423] p-5 pb-6">
          <p className="mb-4 text-sm font-medium text-slate-400">
            Delivery Progress
          </p>
          <div className="relative grid min-w-[600px] grid-cols-5 pt-1">
            <div className="absolute left-[10%] right-[10%] top-[9px] h-[2px] rounded-full bg-slate-700" />
            <div
              className="absolute left-[10%] top-[9px] h-[2px] rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${activeIndex * 20}%` }}
            />
            {deliveryStages.map((stage, index) => {
              const complete = index <= activeIndex;
              const isCurrent = index === activeIndex;
              return (
                <div key={stage.label} className="relative text-center">
                  <div
                    className={`relative z-10 mx-auto h-3 w-3 rounded-full ring-4 ring-[#0d1423] ${
                      isCurrent
                        ? "bg-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.3)]"
                        : complete
                          ? "bg-emerald-500"
                          : "bg-slate-600"
                    }`}
                  />
                  <p
                    className={`mt-3 text-xs ${
                      isCurrent
                        ? "font-semibold text-blue-400"
                        : complete
                          ? "font-medium text-emerald-400"
                          : "text-slate-500"
                    }`}
                  >
                    {stage.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          {/* Buyer info */}
          <div className="rounded-lg border border-slate-800 bg-[#0d1423] p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Buyer
            </h2>
            <p className="font-medium text-white">
              {order.user?.name ?? "Guest"}
            </p>
            {order.user?.email && (
              <p className="mt-1 text-sm text-slate-400">{order.user.email}</p>
            )}
          </div>

          {/* Shop info */}
          <div className="rounded-lg border border-slate-800 bg-[#0d1423] p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Shop
            </h2>
            <p className="font-medium text-blue-400">
              {order.shop?.name ?? "—"}
            </p>
            {order.shop?.id && (
              <p className="mt-1 text-xs text-slate-500">
                ID: {order.shop.id.slice(-8).toUpperCase()}
              </p>
            )}
          </div>

          {/* Payment info */}
          <div className="rounded-lg border border-slate-800 bg-[#0d1423] p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Payment
            </h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className="font-medium text-emerald-400">
                  {order.paymentStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Method</span>
                <span className="capitalize text-white">
                  {order.paymentMethod ?? "Card"}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Discount</span>
                  <span className="text-red-400">
                    -${Number(order.discount).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-700 pt-1 font-semibold">
                <span className="text-slate-300">Total</span>
                <span className="text-white">
                  ${Number(order.totalAmount ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Shipping address */}
          <div className="rounded-lg border border-slate-800 bg-[#0d1423] p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Shipping Address
            </h2>
            <p className="text-sm leading-relaxed text-slate-300">
              {formatAddress(order.shippingAddress)}
            </p>
          </div>
        </div>

        {/* Order Items */}
        <section>
          <h2 className="mb-3 text-lg font-semibold">Order Items</h2>
          <div className="space-y-3">
            {(order.items ?? []).map((item: any) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-lg border border-slate-800 bg-[#0d1423] p-4"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-14 w-14 flex-shrink-0 rounded border border-slate-700 bg-white object-contain"
                  />
                ) : (
                  <div className="h-14 w-14 flex-shrink-0 rounded border border-slate-700 bg-slate-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">
                    {item.title}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
                    <span>Qty: {item.quantity}</span>
                    {item.size && <span>Size: {item.size}</span>}
                    {item.color && <span>Color: {item.color}</span>}
                    <span>Unit: ${Number(item.unitPrice ?? 0).toFixed(2)}</span>
                  </div>
                </div>
                <p className="flex-shrink-0 text-sm font-semibold text-white">
                  ${Number(item.totalPrice ?? 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default OrderDetails;

