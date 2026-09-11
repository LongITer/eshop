"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "apps/admin-ui/src/utils/axioInstance";
import { Search, UserPlus, X } from "lucide-react";
import { useState } from "react";

const fetchAdmins = async () => {
  const res = await axiosInstance.get("/admin/get-all-admins");
  return res.data?.admins ?? [];
};

const addAdminFn = async ({ email, role }: { email: string; role: string }) => {
  const res = await axiosInstance.post("/admin/add-admin", { email, role });
  return res.data;
};

const ManagementPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [error, setError] = useState("");

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["admin-admins"],
    queryFn: fetchAdmins,
    staleTime: 1000 * 60 * 5,
  });

  const { mutate: addAdmin, isPending } = useMutation({
    mutationFn: addAdminFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
      setShowModal(false);
      setNewEmail("");
      setNewRole("user");
      setError("");
    },
    onError: (err: any) => {
      setError(
        err?.response?.data?.message ?? "Failed to add admin. Try again.",
      );
    },
  });

  const filtered = admins.filter(
    (a: any) =>
      a.name?.toLowerCase().includes(search.toLowerCase()) ||
      a.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!newEmail.trim()) return setError("Email is required");
    addAdmin({ email: newEmail.trim(), role: newRole });
  };

  return (
    <div className="w-full min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl text-white font-semibold">Team Management</h2>
        <button
          onClick={() => {
            setShowModal(true);
            setError("");
            setNewEmail("");
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition"
        >
          <UserPlus size={16} />
          Add Admin
        </button>
      </div>

      <p className="text-slate-400 text-sm mb-6">
        Dashboard &rsaquo; Team Management
      </p>

      {/* Search */}
      <div className="my-4 flex items-center bg-gray-900 border border-gray-800 p-2 rounded-md">
        <Search size={18} className="text-gray-400 mr-2 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search admins..."
          className="w-full bg-transparent text-white outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-gray-900 rounded-lg border border-gray-800">
        {isLoading ? (
          <p className="text-center text-white py-10">Loading...</p>
        ) : (
          <table className="w-full text-white">
            <thead>
              <tr className="border-b border-gray-800">
                {["Name", "Email", "Role"].map((h) => (
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
              {filtered.map((admin: any) => (
                <tr
                  key={admin.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition"
                >
                  <td className="p-3 text-sm text-white font-medium">
                    {admin.name}
                  </td>
                  <td className="p-3 text-sm text-slate-300">{admin.email}</td>
                  <td className="p-3 text-sm text-slate-300">
                    {admin.role ?? "admin"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center py-10 text-slate-400">No admins found!</p>
        )}
      </div>

      {/* Add Admin Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg text-white font-semibold">Add New Admin</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  User Email
                </label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 text-white rounded-md px-3 py-2 text-sm outline-none transition"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-1">
                  The user must already have an account.
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 text-white rounded-md px-3 py-2 text-sm outline-none transition cursor-pointer"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="seller">Seller</option>
                </select>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-md transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition"
                >
                  {isPending ? "Adding..." : "Add Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagementPage;
