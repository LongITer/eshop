"use client";

import axiosInstance from "@/utils/axioInstance";
import { useQuery } from "@tanstack/react-query";
import { Package, Search } from "lucide-react";
import { useState } from "react";

type Order = {
  id?: string;
  orderNumber?: string;
  totalAmount?: number;
  status?: string;
  createdAt?: string;
};

const fetchOrders = async (): Promise<Order[]> => {
  const response = await axiosInstance.get("/order/get-user-orders");
  return Array.isArray(response.data) ? response.data : response.data?.orders ?? [];
};

const statusClassName: Record<string, string> = {
  Delivered: "bg-green-100 text-green-700",
  Confirmed: "bg-blue-100 text-blue-700",
  Processing: "bg-blue-100 text-blue-700",
  Shipped: "bg-indigo-100 text-indigo-700",
  Cancelled: "bg-red-100 text-red-700",
  Returned: "bg-orange-100 text-orange-700",
  Refunded: "bg-purple-100 text-purple-700",
  Pending: "bg-amber-100 text-amber-700",
};

const OrdersTable = () => {
  const [search, setSearch] = useState("");
  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey: ["user-orders"],
    queryFn: fetchOrders,
    staleTime: 1000 * 60 * 5,
  });
  const filteredOrders = orders.filter((order) =>
    `${order.orderNumber ?? ""} ${order.id ?? ""} ${order.status ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders..." className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
      </div>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-500">Loading orders...</p>
      ) : isError ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Unable to load your orders right now.</p>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-500"><Package className="h-8 w-8 text-gray-300" /><p className="text-sm">No orders found.</p></div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-100">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3 font-medium">Order</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Total</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map((order) => {
                const orderId = order.orderNumber ?? order.id ?? "Unknown";
                const status = order.status ?? "Pending";
                return <tr key={order.id ?? order.orderNumber} className="text-gray-700"><td className="whitespace-nowrap px-4 py-3 font-medium">#{orderId}</td><td className="whitespace-nowrap px-4 py-3">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "-"}</td><td className="whitespace-nowrap px-4 py-3">${Number(order.totalAmount ?? 0).toFixed(2)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClassName[status] ?? "bg-gray-100 text-gray-700"}`}>{status}</span></td></tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrdersTable;