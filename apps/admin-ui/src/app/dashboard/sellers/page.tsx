"use client";

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "apps/admin-ui/src/utils/axioInstance";
import { Ban, Download, Search, Star } from "lucide-react";
import { useState } from "react";

const LIMIT = 20;

const fetchSellers = async (page: number, search: string) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(LIMIT),
    ...(search ? { search } : {}),
  });
  const res = await axiosInstance.get(`/admin/get-all-sellers?${params}`);
  return res.data;
};

const exportCSV = (sellers: any[]) => {
  const headers = ["Name", "Email", "Phone", "Country", "Shop", "Rating", "Joined"];
  const rows = sellers.map((s) => [
    `"${s.name}"`,
    s.email,
    s.phone_number ?? "",
    s.country ?? "",
    `"${s.shop?.name ?? ""}"`,
    s.shop?.ratings ?? 0,
    new Date(s.createdAt).toLocaleDateString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sellers.csv";
  a.click();
  URL.revokeObjectURL(url);
};

const SellersPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-sellers", page, search],
    queryFn: () => fetchSellers(page, search),
    staleTime: 1000 * 60 * 2,
  });

  const sellers: any[] = data?.sellers ?? [];
  const totalPages: number = data?.totalPages ?? 1;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  return (
    <div className="w-full min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <h2 className="text-2xl text-white font-semibold">All Sellers</h2>
        <button
          onClick={() => exportCSV(sellers)}
          disabled={sellers.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <p className="text-slate-400 text-sm mb-6">
        Dashboard &rsaquo; All Sellers
      </p>

      {/* Search */}
      <form
        onSubmit={handleSearch}
        className="my-4 flex items-center bg-gray-900 border border-gray-800 p-2 rounded-md"
      >
        <Search size={18} className="text-gray-400 mr-2 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search sellers..."
          className="w-full bg-transparent text-white outline-none"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </form>

      {/* Table */}
      <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-800">
        {isLoading ? (
          <p className="text-center text-white py-10">Loading sellers...</p>
        ) : (
          <table className="w-full text-white">
            <thead>
              <tr className="border-b border-gray-800">
                {[
                  "Name",
                  "Email",
                  "Phone",
                  "Country",
                  "Shop",
                  "Rating",
                  "Joined",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="p-3 text-left text-sm text-slate-400 font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sellers.map((seller) => {
                const joined = new Date(seller.createdAt).toLocaleDateString(
                  "en-GB",
                );
                const shopAvatar = seller.shop?.avatar?.[0]?.url ?? null;
                return (
                  <tr
                    key={seller.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition"
                  >
                    {/* Name */}
                    <td className="p-3 text-sm text-white font-medium">
                      {seller.name}
                    </td>
                    {/* Email */}
                    <td className="p-3 text-sm text-slate-300">
                      {seller.email}
                    </td>
                    {/* Phone */}
                    <td className="p-3 text-sm text-slate-300">
                      {seller.phone_number ?? "—"}
                    </td>
                    {/* Country */}
                    <td className="p-3 text-sm text-slate-300">
                      {seller.country ?? "—"}
                    </td>
                    {/* Shop */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {shopAvatar ? (
                          <img
                            src={shopAvatar}
                            alt={seller.shop?.name}
                            className="h-7 w-7 rounded-full object-cover border border-gray-600"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-gray-700 border border-gray-600 flex-shrink-0" />
                        )}
                        <span className="text-sm text-blue-400 font-medium">
                          {seller.shop?.name ?? "No shop"}
                        </span>
                      </div>
                    </td>
                    {/* Rating */}
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-sm text-yellow-400">
                        <Star size={13} fill="currentColor" />
                        <span>{Number(seller.shop?.ratings ?? 0).toFixed(1)}</span>
                      </div>
                    </td>
                    {/* Joined */}
                    <td className="p-3 text-sm text-slate-300">{joined}</td>
                    {/* Actions */}
                    <td className="p-3">
                      <button
                        title="Ban seller"
                        className="text-red-500 hover:text-red-400 transition"
                      >
                        <Ban size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!isLoading && sellers.length === 0 && (
          <p className="text-center py-10 text-slate-400">No sellers found!</p>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-md transition"
        >
          Previous
        </button>
        <span className="text-slate-400 text-sm">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages || totalPages === 0}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-md transition"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default SellersPage;
