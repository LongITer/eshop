"use client";

import axiosInstance from "@/utils/axioInstance";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string;
  productId?: string;
  title?: string;
  image?: string;
  quantity: number;
  size?: string;
  color?: string;
  unitPrice: number;
  totalPrice: number;
};

type ShippingAddress = {
  name?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

type Order = {
  id: string;
  orderNumber?: string;
  status?: string;
  paymentStatus?: string;
  totalAmount?: number;
  createdAt?: string;
  shippingAddress?: ShippingAddress;
  items?: OrderItem[];
};

// ─── Status Steps ─────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: "Ordered", label: "Ordered", Icon: ShoppingCart },
  { key: "Packed", label: "Packed", Icon: Package },
  { key: "Shipped", label: "Shipped", Icon: Truck },
  { key: "Out for Delivery", label: "Out for Delivery", Icon: PackageCheck },
  { key: "Delivered", label: "Delivered", Icon: CheckCircle },
];

const STATUS_INDEX: Record<string, number> = {
  Pending: 0,
  Confirmed: 0,
  Processing: 0,
  Ordered: 0,
  Packed: 1,
  Shipped: 2,
  "Out for Delivery": 3,
  Delivered: 4,
};

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const fetchOrder = async (orderId: string): Promise<Order> => {
  const res = await axiosInstance.get(`/order/get-order/${orderId}`);
  return res.data?.order ?? res.data;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId),
    staleTime: 1000 * 60 * 5,
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center text-gray-500">
        <Package className="h-12 w-12 text-gray-300" />
        <p className="text-sm">Order not found or failed to load.</p>
        <Link
          href="/profile?active=My Orders"
          className="text-sm text-blue-500 hover:underline"
        >
          ← Back to My Orders
        </Link>
      </div>
    );
  }

  const displayId =
    order.orderNumber ?? order.id?.slice(0, 6) ?? order.id ?? "—";
  const currentStep = STATUS_INDEX[order.status ?? ""] ?? 0;
  const paymentPaid = order.paymentStatus?.toLowerCase() === "paid";
  const addr = order.shippingAddress;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Back */}
        <Link
          href="/profile?active=My Orders"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Orders
        </Link>

        {/* Card */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">
            Order <span className="text-blue-500">#{displayId}</span>
          </h1>

          {/* ── Progress Tracker ── */}
          <div className="relative mb-8">
            {/* Background line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0" />
            {/* Filled line */}
            <div
              className="absolute top-4 left-0 h-0.5 bg-green-500 z-0 transition-all duration-500"
              style={{
                width: `${(currentStep / (STATUS_STEPS.length - 1)) * 100}%`,
              }}
            />
            <div className="relative z-10 flex justify-between">
              {STATUS_STEPS.map((step, idx) => {
                const done = idx < currentStep;
                const active = idx === currentStep;
                return (
                  <div
                    key={step.key}
                    className="flex flex-col items-center gap-2"
                    style={{ width: `${100 / STATUS_STEPS.length}%` }}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                        done
                          ? "border-green-500 bg-green-500 text-white shadow-md shadow-green-200"
                          : active
                            ? "border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-200"
                            : "border-gray-300 bg-white text-gray-400"
                      }`}
                    >
                      <step.Icon className="h-3.5 w-3.5" />
                    </div>
                    <span
                      className={`text-center text-[10px] font-medium leading-tight ${
                        done
                          ? "text-green-600"
                          : active
                            ? "text-blue-600"
                            : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Meta Info ── */}
          <div className="space-y-1 text-sm text-gray-600 mb-6">
            <p>
              <span className="font-semibold text-gray-700">
                Payment Status:{" "}
              </span>
              <span
                className={
                  paymentPaid
                    ? "text-green-600 font-medium"
                    : "text-amber-600 font-medium"
                }
              >
                {order.paymentStatus ?? "Pending"}
              </span>
            </p>
            <p>
              <span className="font-semibold text-gray-700">Total Paid: </span>
              ${Number(order.totalAmount ?? 0).toFixed(2)}
            </p>
            <p>
              <span className="font-semibold text-gray-700">Date: </span>
              {order.createdAt
                ? new Date(order.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>

          {/* ── Shipping Address ── */}
          {addr && (
            <div className="mb-6">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <MapPin className="h-4 w-4 text-blue-500" />
                Shipping Address
              </h2>
              <div className="text-sm text-gray-600 leading-relaxed pl-6">
                {addr.name && <p>{addr.name}</p>}
                {addr.street && <p>{addr.street}</p>}
                <p>
                  {[addr.city, addr.state, addr.zip]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {addr.country && <p>{addr.country}</p>}
              </div>
            </div>
          )}

          {/* ── Order Items ── */}
          <div>
            <h2 className="mb-4 text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-blue-500" />
              Order Items
            </h2>

            {!order.items || order.items.length === 0 ? (
              <p className="text-sm text-gray-400 pl-6">No items found.</p>
            ) : (
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
                {order.items.map((item) => {
                  const itemName = item.title ?? "Product";
                  const itemImage = item.image ?? null;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-100">
                        {itemImage ? (
                          <Image
                            src={itemImage}
                            alt={itemName}
                            width={64}
                            height={64}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">
                          {itemName}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Quantity: {item.quantity}
                        </p>
                        {item.size && (
                          <p className="text-xs text-gray-500">
                            Size: {item.size}
                          </p>
                        )}
                        {item.color && (
                          <p className="text-xs text-gray-500">
                            Color: {item.color}
                          </p>
                        )}
                      </div>

                      {/* Price */}
                      <p className="font-semibold text-gray-800 text-sm whitespace-nowrap">
                        ${Number(item.totalPrice ?? item.unitPrice ?? 0).toFixed(2)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Total Footer ── */}
          <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
            <div className="text-right">
              <p className="text-xs text-gray-500">Order Total</p>
              <p className="text-xl font-bold text-gray-800">
                ${Number(order.totalAmount ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
          <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700">
            Current status:{" "}
            <span className="font-semibold">{order.status ?? "Processing"}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
