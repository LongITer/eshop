"use client";

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "apps/admin-ui/src/utils/axioInstance";
import { Download, Search } from "lucide-react";
import { useState } from "react";

const LIMIT = 20;

const fetchEvents = async (page: number, search: string) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(LIMIT),
    ...(search ? { search } : {}),
  });
  const res = await axiosInstance.get(`/admin/get-all-events?${params}`);
  return res.data;
};

const exportCSV = (events: any[]) => {
  const headers = ["Title", "Price", "Stock", "Start Date", "End Date", "Shop"];
  const rows = events.map((e) => [
    `"${e.title}"`,
    e.sale_price,
    e.stock,
    e.starting_date ? new Date(e.starting_date).toLocaleDateString() : "",
    e.ending_date ? new Date(e.ending_date).toLocaleDateString() : "",
    `"${e.shop?.name ?? ""}"`,
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "events.csv";
  a.click();
  URL.revokeObjectURL(url);
};

const EventsPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-events", page, search],
    queryFn: () => fetchEvents(page, search),
    staleTime: 1000 * 60 * 2,
  });

  const events: any[] = data?.events ?? [];
  const totalPages: number = data?.totalPages ?? 1;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB") : "—";

  return (
    <div className="w-full min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl text-white font-semibold">All Events</h2>
        <button
          onClick={() => exportCSV(events)}
          disabled={events.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      <p className="text-slate-400 text-sm mb-6">Dashboard &rsaquo; All Events</p>

      {/* Search */}
      <form
        onSubmit={handleSearch}
        className="my-4 flex items-center bg-gray-900 border border-gray-800 p-2 rounded-md"
      >
        <Search size={18} className="text-gray-400 mr-2 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search events..."
          className="w-full bg-transparent text-white outline-none"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </form>

      {/* Table */}
      <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-800">
        {isLoading ? (
          <p className="text-center text-white py-10">Loading events...</p>
        ) : (
          <table className="w-full text-white">
            <thead>
              <tr className="border-b border-gray-800">
                {["Image", "Title", "Price", "Stock", "Start", "End", "Shop Name"].map(
                  (h) => (
                    <th
                      key={h}
                      className="p-3 text-left text-sm text-slate-400 font-medium"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const thumb = event.images?.[0]?.url ?? null;
                return (
                  <tr
                    key={event.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition"
                  >
                    <td className="p-3">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={event.title}
                          className="h-10 w-10 rounded object-cover border border-gray-700 bg-white"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-gray-700 border border-gray-600" />
                      )}
                    </td>
                    <td className="p-3 max-w-[200px]">
                      <span className="text-sm text-white line-clamp-2">
                        {event.title}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-white">
                      ${Number(event.sale_price ?? 0).toFixed(0)}
                    </td>
                    <td className="p-3 text-sm text-slate-300">{event.stock}</td>
                    <td className="p-3 text-sm text-slate-300">
                      {fmt(event.starting_date)}
                    </td>
                    <td className="p-3 text-sm text-slate-300">
                      {fmt(event.ending_date)}
                    </td>
                    <td className="p-3 text-sm text-blue-400 font-medium">
                      {event.shop?.name ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!isLoading && events.length === 0 && (
          <p className="text-center py-10 text-slate-400">No events found!</p>
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

export default EventsPage;
