"use client";

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "apps/admin-ui/src/utils/axioInstance";
import { Ban, Download, Search } from "lucide-react";
import { useState } from "react";

const LIMIT = 20;

const fetchUsers = async (page: number, search: string) => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(LIMIT),
    ...(search ? { search } : {}),
  });
  const res = await axiosInstance.get(`/admin/get-all-users?${params}`);
  return res.data;
};

const fetchAdmins = async () => {
  const res = await axiosInstance.get("/admin/get-all-admins");
  return res.data?.admins ?? [];
};

const exportCSV = (users: any[]) => {
  const headers = ["Name", "Email", "Role", "Joined"];
  const rows = users.map((u) => [
    `"${u.name}"`,
    u.email,
    u.role,
    new Date(u.createdAt).toLocaleDateString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "users.csv";
  a.click();
  URL.revokeObjectURL(url);
};

const roleColorMap: Record<string, string> = {
  admin: "text-blue-400",
  user: "text-emerald-400",
  seller: "text-purple-400",
};

const UsersPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "admin">("all");

  const { data: userData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users", page, search],
    queryFn: () => fetchUsers(page, search),
    staleTime: 1000 * 60 * 2,
  });

  const { data: admins = [], isLoading: adminsLoading } = useQuery({
    queryKey: ["admin-admins"],
    queryFn: fetchAdmins,
    staleTime: 1000 * 60 * 5,
  });

  const rawUsers: any[] = userData?.users ?? [];
  const totalPages: number = userData?.totalPages ?? 1;

  // Merge users + admins for "all roles" view
  const allEntries =
    roleFilter === "all"
      ? [
          ...admins.map((a: any) => ({ ...a, role: "admin" })),
          ...rawUsers.map((u: any) => ({ ...u, role: "user" })),
        ]
      : roleFilter === "admin"
        ? admins.map((a: any) => ({ ...a, role: "admin" }))
        : rawUsers;

  const isLoading = usersLoading || (roleFilter !== "user" && adminsLoading);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const displayEntries = allEntries.filter((u) =>
    searchInput
      ? u.name?.toLowerCase().includes(searchInput.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchInput.toLowerCase())
      : true,
  );

  return (
    <div className="w-full min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
        <h2 className="text-2xl text-white font-semibold">All Users</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportCSV(displayEntries)}
            disabled={displayEntries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition"
          >
            <Download size={16} />
            Export CSV
          </button>
          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as any);
              setPage(1);
            }}
            className="bg-gray-800 border border-gray-700 text-white text-sm rounded-md px-3 py-2 outline-none cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <p className="text-slate-400 text-sm mb-6">Dashboard &rsaquo; All Users</p>

      {/* Search */}
      <form
        onSubmit={handleSearch}
        className="my-4 flex items-center bg-gray-900 border border-gray-800 p-2 rounded-md"
      >
        <Search size={18} className="text-gray-400 mr-2 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search users..."
          className="w-full bg-transparent text-white outline-none"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </form>

      {/* Table */}
      <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-800">
        {isLoading ? (
          <p className="text-center text-white py-10">Loading users...</p>
        ) : (
          <table className="w-full text-white">
            <thead>
              <tr className="border-b border-gray-800">
                {["Name", "Email", "Role", "Joined", "Actions"].map((h) => (
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
              {displayEntries.map((user) => {
                const joined = new Date(user.createdAt).toLocaleDateString(
                  "en-GB",
                );
                const roleColor =
                  roleColorMap[user.role] ?? "text-slate-300";
                return (
                  <tr
                    key={user.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition"
                  >
                    <td className="p-3 text-sm text-white font-medium">
                      {user.name}
                    </td>
                    <td className="p-3 text-sm text-slate-300">{user.email}</td>
                    <td className="p-3 text-sm">
                      <span className={`font-semibold uppercase ${roleColor}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-slate-300">{joined}</td>
                    <td className="p-3">
                      <button
                        title="Ban user"
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
        {!isLoading && displayEntries.length === 0 && (
          <p className="text-center py-10 text-slate-400">No users found!</p>
        )}
      </div>

      {/* Pagination (only for user role query) */}
      {roleFilter === "user" && (
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
      )}
    </div>
  );
};

export default UsersPage;
