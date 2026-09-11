"use client";

import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import axiosInstance from "apps/admin-ui/src/utils/axioInstance";
import { Eye, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const fetchOrders = async () => {
  const res = await axiosInstance.get("/order/get-admin-orders");
  return Array.isArray(res.data) ? res.data : (res.data?.orders ?? []);
};

const ADMIN_FEE_RATE = 0.1; // 10%

const PaymentsTable = () => {
  const [globalFilter, setGlobalFilter] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: fetchOrders,
    staleTime: 1000 * 60 * 5,
  });

  const columns = useMemo(
    () => [
      {
        accessorKey: "id",
        header: "Order ID",
        cell: ({ row }: any) => (
          <span className="text-white text-sm font-mono">
            #{row.original.id.slice(-6).toUpperCase()}
          </span>
        ),
      },
      {
        accessorKey: "shop.name",
        header: "Shop",
        cell: ({ row }: any) => (
          <span className="text-blue-400 font-medium">
            {row.original.shop?.name ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "user.name",
        header: "Buyer",
        cell: ({ row }: any) => (
          <span className="text-white">
            {row.original.user?.name ?? "Guest"}
          </span>
        ),
      },
      {
        id: "adminFee",
        header: "Admin Fee (10%)",
        cell: ({ row }: any) => {
          const total = Number(row.original.totalAmount ?? 0);
          const fee = total * ADMIN_FEE_RATE;
          return (
            <span className="text-emerald-400 font-semibold">
              ${fee.toFixed(2)}
            </span>
          );
        },
      },
      {
        id: "sellerEarnings",
        header: "Seller Earnings",
        cell: ({ row }: any) => {
          const total = Number(row.original.totalAmount ?? 0);
          const earnings = total * (1 - ADMIN_FEE_RATE);
          return (
            <span className="text-white">${earnings.toFixed(2)}</span>
          );
        },
      },
      {
        accessorKey: "paymentStatus",
        header: "Payment Status",
        cell: ({ row }: any) => {
          const status: string =
            row.original.paymentStatus ?? row.original.status ?? "Pending";
          const isPaid =
            status.toLowerCase() === "paid" ||
            status.toLowerCase() === "completed";
          return (
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isPaid
                  ? "bg-emerald-600/80 text-white"
                  : "bg-yellow-500/80 text-white"
              }`}
            >
              {status}
            </span>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Date",
        cell: ({ row }: any) => {
          const date = new Date(row.original.createdAt).toLocaleDateString(
            "en-GB",
            { day: "2-digit", month: "2-digit", year: "numeric" },
          );
          return <span className="text-slate-300 text-sm">{date}</span>;
        },
      },
      {
        header: "Actions",
        cell: ({ row }: any) => (
          <Link
            href={`/order/${row.original.id}`}
            className="text-blue-400 hover:text-blue-300 transition"
            title="View order"
          >
            <Eye size={18} />
          </Link>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  // Summary stats
  const totalAdminFee = orders.reduce(
    (sum: number, o: any) => sum + Number(o.totalAmount ?? 0) * ADMIN_FEE_RATE,
    0,
  );
  const totalSellerEarnings = orders.reduce(
    (sum: number, o: any) =>
      sum + Number(o.totalAmount ?? 0) * (1 - ADMIN_FEE_RATE),
    0,
  );
  const totalRevenue = orders.reduce(
    (sum: number, o: any) => sum + Number(o.totalAmount ?? 0),
    0,
  );

  return (
    <div className="w-full min-h-screen p-8">
      <h2 className="text-2xl text-white font-semibold mb-1">Payments</h2>
      <p className="text-slate-400 text-sm mb-6">
        Dashboard &rsaquo; Payments
      </p>

      {/* Summary Cards */}
      {!isLoading && orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
              Total Revenue
            </p>
            <p className="text-white text-xl font-bold">
              ${totalRevenue.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
              Admin Earnings (10%)
            </p>
            <p className="text-emerald-400 text-xl font-bold">
              ${totalAdminFee.toFixed(2)}
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
              Seller Earnings (90%)
            </p>
            <p className="text-blue-400 text-xl font-bold">
              ${totalSellerEarnings.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="my-4 flex items-center bg-gray-900 p-2 rounded-md border border-gray-800">
        <Search size={18} className="text-gray-400 mr-2 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search payments..."
          className="w-full bg-transparent text-white outline-none"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-800">
        {isLoading ? (
          <p className="text-center text-white py-8">Loading payments...</p>
        ) : (
          <table className="w-full text-white">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-gray-800 bg-gray-900/80"
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="p-3 text-left text-sm text-slate-400 font-medium"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-3 text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && orders.length === 0 && (
          <p className="text-center py-8 text-slate-400">No payments found!</p>
        )}
      </div>
    </div>
  );
};

export default PaymentsTable;
