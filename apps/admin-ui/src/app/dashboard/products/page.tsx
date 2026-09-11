"use client";

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "apps/admin-ui/src/utils/axioInstance";
import { Eye, Search, Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const LIMIT = 20;

const fetchProducts = async (page: number, search: string) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(LIMIT),
    ...(search ? { search } : {}),
  });
  const res = await axiosInstance.get(`/admin/get-all-products?${params}`);
  return res.data;
};

const exportCSV = (products: any[]) => {
  const headers = [
    "Title",
    "Price",
    "Stock",
    "Category",
    "Rating",
    "Shop",
    "Created",
  ];
  const rows = products.map((p) => [
    `"${p.title}"`,
    p.sale_price,
    p.stock,
    p.category,
    p.ratings ?? 0,
    `"${p.shop?.name ?? ""}"`,
    new Date(p.createdAt).toLocaleDateString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products.csv";
  a.click();
  URL.revokeObjectURL(url);
};

const ProductsPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", page, search],
    queryFn: () => fetchProducts(page, search),
    staleTime: 1000 * 60 * 2,
  });

  const products: any[] = data?.products ?? [];
  const totalPages: number = data?.totalPages ?? 1;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  return (
    <div className="w-full min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl text-white font-semibold">All Products</h2>
        <button
          onClick={() => exportCSV(products)}
          disabled={products.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Breadcrumb */}
      <p className="text-slate-400 text-sm mb-6">
        Dashboard &rsaquo; All Products
      </p>

      {/* Search */}
      <form
        onSubmit={handleSearch}
        className="my-4 flex items-center bg-gray-900 border border-gray-800 p-2 rounded-md"
      >
        <Search size={18} className="text-gray-400 mr-2 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search products..."
          className="w-full bg-transparent text-white outline-none"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </form>

      {/* Table */}
      <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-800">
        {isLoading ? (
          <p className="text-center text-white py-10">Loading products...</p>
        ) : (
          <table className="w-full text-white">
            <thead>
              <tr className="border-b border-gray-800">
                {[
                  "Image",
                  "Title",
                  "Price",
                  "Stock",
                  "Category",
                  "Rating",
                  "Shop",
                  "Created",
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
              {products.map((product) => {
                const thumb = product.images?.[0]?.url ?? null;
                const date = new Date(product.createdAt).toLocaleDateString(
                  "en-GB",
                  { day: "2-digit", month: "2-digit", year: "numeric" },
                );
                return (
                  <tr
                    key={product.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition"
                  >
                    {/* Image */}
                    <td className="p-3">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={product.title}
                          className="h-10 w-10 rounded object-cover border border-gray-700 bg-white"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-gray-700 border border-gray-600" />
                      )}
                    </td>

                    {/* Title */}
                    <td className="p-3 max-w-[160px]">
                      <span className="text-blue-400 text-sm font-medium line-clamp-2">
                        {product.title}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="p-3 text-sm text-white">
                      ${Number(product.sale_price ?? 0).toFixed(0)}
                    </td>

                    {/* Stock */}
                    <td className="p-3 text-sm text-slate-300">
                      {product.stock ?? 0} left
                    </td>

                    {/* Category */}
                    <td className="p-3 text-sm text-slate-300">
                      {product.category ?? "—"}
                    </td>

                    {/* Rating */}
                    <td className="p-3 text-sm text-white">
                      {product.ratings ?? 0}
                    </td>

                    {/* Shop */}
                    <td className="p-3 text-sm">
                      <span className="text-blue-400 font-medium">
                        {product.shop?.name ?? "—"}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="p-3 text-sm text-slate-300">{date}</td>

                    {/* Actions */}
                    <td className="p-3">
                      <Link
                        href={`/product/${product.slug}`}
                        target="_blank"
                        className="text-blue-400 hover:text-blue-300 transition"
                        title="View product"
                      >
                        <Eye size={18} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!isLoading && products.length === 0 && (
          <p className="text-center py-10 text-slate-400">
            No products found!
          </p>
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

export default ProductsPage;
