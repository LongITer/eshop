"use client";
import { useStorefrontText } from '@packages/components/storefront-language';


import axiosInstance from "@/utils/axioInstance";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Package, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type Order = {
  id?: string;
  orderNumber?: string;
  totalAmount?: number;
  status?: string;
  createdAt?: string;
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
  const { t, locale } = useStorefrontText();
  const [search, setSearch] = useState("");
  const [page,setPage]=useState(1),[status,setStatus]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');
  const params={q:search,page,status,from,to,limit:10};
  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["user-orders",params],
    queryFn: async ({signal}):Promise<{orders:Order[];total:number;totalPages:number}> => (await axiosInstance.get('/order/api/my-orders',{params,signal})).data,
    staleTime: 1000 * 60 * 5,
  });

  const filteredOrders = data?.orders || [];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => {setSearch(e.target.value);setPage(1);}}
          placeholder={t("Tìm mã đơn…")}
          className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 text-sm text-gray-600"><label>{t("Trạng thái")}<select className="mt-1 block rounded-md border border-gray-200 bg-white px-3 py-2" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">{t("Tất cả")}</option>{Object.keys(statusClassName).map(value=><option key={value} value={value}>{t(value)}</option>)}</select></label><label>{t("Từ ngày")}<input className="mt-1 block rounded-md border border-gray-200 px-3 py-2" type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1);}}/></label><label>{t("Đến ngày")}<input className="mt-1 block rounded-md border border-gray-200 px-3 py-2" type="date" value={to} onChange={e=>{setTo(e.target.value);setPage(1);}}/></label></div>
      {/* States */}
      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-500">{t("Đang tải đơn hàng…")}</p>
      ) : isError ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          {t("Chưa tải được đơn hàng. Vui lòng thử lại.")}</p>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-500">
          <Package className="h-8 w-8 text-gray-300" />
          <p className="text-sm">{t("Không có đơn phù hợp.")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-100">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("Đơn hàng")}</th>
                <th className="px-4 py-3 font-medium">{t("Ngày")}</th>
                <th className="px-4 py-3 font-medium">{t("Tổng tiền")}</th>
                <th className="px-4 py-3 font-medium">{t("Trạng thái")}</th>
                <th className="px-4 py-3 font-medium">{t("Thao tác")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map((order) => {
                const orderId = order.orderNumber ?? order.id ?? "Unknown";
                const rawId = order.id ?? order.orderNumber ?? "";
                const status = order.status ?? "Pending";
                return (
                  <tr
                    key={order.id ?? order.orderNumber}
                    className="text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      #{orderId}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString(locale,{timeZone:'Asia/Ho_Chi_Minh'})
                        : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      ${Number(order.totalAmount ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          statusClassName[status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {t(status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/order/${rawId}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        {t("Theo dõi đơn")}</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data&&<div className="flex items-center justify-between gap-2 text-sm text-gray-500"><span>{data.total} {t(" đơn · Trang ")}{page}/{data.totalPages}</span><div className="flex gap-2"><button className="rounded-md border border-gray-200 px-3 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-40" disabled={page<=1} onClick={()=>setPage(page-1)}>{t("Trước")}</button><button className="rounded-md border border-gray-200 px-3 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-40" disabled={page>=data.totalPages} onClick={()=>setPage(page+1)}>{t("Sau")}</button></div></div>}
    </div>
  );
};

export default OrdersTable;