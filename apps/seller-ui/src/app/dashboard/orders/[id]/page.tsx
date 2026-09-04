"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "apps/seller-ui/src/utils/axioInstance";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const fetchOrders = async () => {
  const res = await axiosInstance.get("/order/get-seller-orders");
  return Array.isArray(res.data) ? res.data : (res.data?.orders ?? []);
};

const deliveryStages = [
  { label: "Ordered", statuses: ["Pending"] },
  { label: "Packed", statuses: ["Confirmed", "Processing"] },
  { label: "Shipped", statuses: ["Shipped"] },
  { label: "Out for Delivery", statuses: [] },
  { label: "Delivered", statuses: ["Delivered"] },
];

const formatAddress = (address: Record<string, unknown> | null | undefined) =>
  [address?.address, address?.street, address?.city, address?.state, address?.postalCode]
    .filter(Boolean)
    .join(", ") || "No shipping address";

const OrderDetails = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["seller-orders"],
    queryFn: fetchOrders,
  });
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await axiosInstance.patch(
        `/order/update-order-status/${id}`,
        { status },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-orders"] });
    },
  });
  const order = orders.find((item: any) => item.id === id);

  if (isLoading) {
    return <p className="p-8 text-white">Loading order...</p>;
  }

  if (!order) {
    return (
      <div className="p-8 text-white">
        <p className="mb-4">Order not found.</p>
        <Link href="/dashboard/orders" className="text-blue-400">
          Back to orders
        </Link>
      </div>
    );
  }

  const activeIndex = Math.max(
    0,
    deliveryStages.findIndex((stage) => stage.statuses.includes(order.status)),
  );

  return (
    <div className="min-h-screen bg-[#080d1a] p-6 text-white md:p-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard/orders"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-200 transition hover:text-blue-400"
        >
          <ArrowLeft size={18} />
          Go Back to Dashboard
        </Link>

        <h1 className="mb-5 text-2xl font-bold">
          Order #{order.id.slice(-6).toUpperCase()}
        </h1>

        <div className="mb-7 flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span>Update Delivery Status:</span>
          <select
            defaultValue={
              deliveryStages.find((stage) => stage.statuses.includes(order.status))
                ?.statuses[0] ?? "Pending"
            }
            onChange={(event) => updateStatusMutation.mutate(event.target.value)}
            disabled={updateStatusMutation.isPending}
            className="min-w-[108px] rounded-md border border-slate-500 bg-[#111827] px-3 py-1.5 text-white outline-none transition focus:border-blue-400"
          >
            {deliveryStages.filter((stage) => stage.statuses.length > 0).map((stage) => (
              <option key={stage.label} value={stage.statuses[0] ?? stage.label}>
                {stage.label}
              </option>
            ))}
          </select>
          {updateStatusMutation.isPending && (
            <span className="text-xs text-slate-400">Saving...</span>
          )}
          {updateStatusMutation.isError && (
            <span className="text-xs text-red-400">Could not update status.</span>
          )}
        </div>

        <div className="mb-7 overflow-x-auto pb-2">
          <div className="relative grid min-w-[680px] grid-cols-5 pt-1">
            <div className="absolute left-[10%] right-[10%] top-[9px] h-[2px] rounded-full bg-slate-200" />
            <div
              className="absolute left-[10%] top-[9px] h-[2px] rounded-full bg-blue-600 transition-all"
              style={{ width: `${activeIndex * 20}%` }}
            />
            {deliveryStages.map((stage, index) => {
              const complete = index <= activeIndex;
              const isCurrent = index === activeIndex;
              return (
                <div key={stage.label} className="relative text-center">
                  <div
                    className={`relative z-10 mx-auto h-3 w-3 rounded-full ring-4 ring-[#080d1a] ${
                      isCurrent
                        ? "bg-blue-500"
                        : complete
                          ? "bg-emerald-500"
                          : "bg-slate-200"
                    } ${
                      isCurrent
                        ? "shadow-[0_0_0_2px_rgba(59,130,246,0.35)]"
                        : ""
                    }`}
                  />
                  <p
                    className={`mt-3 text-xs ${
                      isCurrent
                        ? "font-medium text-blue-500"
                        : complete
                          ? "font-medium text-emerald-400"
                          : "text-slate-300"
                    }`}
                  >
                    {stage.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-1 text-sm text-slate-200">
          <p>
            Payment Status: <span className="text-emerald-400">{order.paymentStatus}</span>
          </p>
          <p>Total Paid: ${Number(order.totalAmount ?? 0).toFixed(2)}</p>
          <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
        </div>

        <div className="mt-6 text-sm text-slate-200">
          <h2 className="mb-2 font-semibold">Shipping Address</h2>
          <p>{formatAddress(order.shippingAddress)}</p>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Order Items</h2>
          <div className="space-y-3">
            {(order.items ?? []).map((item: any) => (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-md border border-slate-500 bg-[#0d1423] p-3"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-12 w-12 rounded border border-slate-300 bg-white object-contain"
                  />
                ) : (
                  <div className="h-12 w-12 rounded border border-slate-500 bg-slate-800" />
                )}
                <div className="min-w-0 flex-1 text-xs text-slate-300">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p>Quantity: {item.quantity}</p>
                  {item.size && <p>Size: {item.size}</p>}
                  {item.color && <p>Color: {item.color}</p>}
                </div>
                <p className="text-sm font-semibold">
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