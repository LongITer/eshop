"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  DollarSign,
  ExternalLink,
  PackageSearch,
  ShoppingCart,
  Store,
  TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "apps/seller-ui/src/utils/axioInstance";
import RevenueChart, { RevenuePoint } from "apps/seller-ui/src/shared/components/charts/revenue-chart";

interface ShopInfo {
  id: string;
  name: string;
  avatar: string;
}

interface Stats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  lowStockCount: number;
  pendingOrders: number;
  statusCounts: Record<string, number>;
}

interface RecentOrder {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  user: { name?: string | null; email?: string | null } | null;
  items: { title: string; image?: string | null; quantity: number }[];
}

interface TopProduct {
  id: string;
  title: string;
  slug: string;
  sale_price: number;
  image: string;
  unitsSold: number;
}

interface LowStockProduct {
  id: string;
  title: string;
  slug: string;
  stock: number;
  images: { url: string }[];
}

interface SellerDashboardData {
  success: boolean;
  shop: ShopInfo | null;
  stats: Stats;
  revenueByDay: RevenuePoint[];
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
  lowStockProducts: LowStockProduct[];
}

const fetchSellerStats = async (): Promise<SellerDashboardData> => {
  const res = await axiosInstance.get("/product/api/get-seller-stats");
  return res.data;
};

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  Confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  Processing: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40",
  Shipped: "bg-purple-500/20 text-purple-400 border-purple-500/40",
  Delivered: "bg-green-500/20 text-green-400 border-green-500/40",
  Cancelled: "bg-red-500/20 text-red-400 border-red-500/40",
  Returned: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  Refunded: "bg-gray-500/20 text-gray-400 border-gray-500/40",
};

const money = (value: number) =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  accent: string;
}) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start justify-between">
    <div>
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-2xl font-semibold text-white mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
    <div className={`rounded-lg p-2.5 ${accent}`}>{icon}</div>
  </div>
);

const DashboardPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["seller-stats"],
    queryFn: fetchSellerStats,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="w-full min-h-screen p-8">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-900 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-gray-900 rounded-xl animate-pulse mb-6" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 h-96 bg-gray-900 rounded-xl animate-pulse" />
          <div className="h-96 bg-gray-900 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="w-full min-h-screen p-8">
        <h2 className="text-2xl text-white font-semibold mb-4">Dashboard</h2>
        <div className="bg-gray-900 border border-red-500/30 rounded-xl p-8 text-center">
          <AlertTriangle className="mx-auto text-red-400 mb-3" size={32} />
          <p className="text-white font-medium">
            Failed to load dashboard data
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {error instanceof Error ? error.message : "Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  const { shop, stats, revenueByDay, recentOrders, topProducts, lowStockProducts } =
    data;

  if (!shop) {
    return (
      <div className="w-full min-h-screen p-8">
        <h2 className="text-2xl text-white font-semibold mb-4">Dashboard</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center max-w-xl mx-auto">
          <Store className="mx-auto text-blue-400 mb-4" size={40} />
          <h3 className="text-xl text-white font-semibold">
            No shop found
          </h3>
          <p className="text-gray-400 mt-2">
            Your dashboard will show revenue, orders and product insights once
            your shop is set up.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-8">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl text-white font-semibold">Dashboard</h2>
          <span className="text-gray-500">/</span>
          <span className="text-gray-400 flex items-center gap-1.5">
            <Store size={16} /> {shop.name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <TrendingUp size={16} className="text-emerald-400" />
          Last 30 days
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Revenue"
          value={money(stats.totalRevenue)}
          subtitle="Paid orders"
          icon={<DollarSign size={22} className="text-emerald-400" />}
          accent="bg-emerald-500/10"
        />
        <StatCard
          title="Total Orders"
          value={String(stats.totalOrders)}
          subtitle={`${stats.pendingOrders} pending`}
          icon={<ShoppingCart size={22} className="text-blue-400" />}
          accent="bg-blue-500/10"
        />
        <StatCard
          title="Total Products"
          value={String(stats.totalProducts)}
          subtitle="Active listings"
          icon={<Boxes size={22} className="text-purple-400" />}
          accent="bg-purple-500/10"
        />
        <StatCard
          title="Low Stock Alerts"
          value={String(stats.lowStockCount)}
          subtitle="Products with 5 or fewer left"
          icon={
            <AlertTriangle
              size={22}
              className={stats.lowStockCount > 0 ? "text-red-400" : "text-gray-500"}
            />
          }
          accent="bg-red-500/10"
        />
      </div>

      {/* Revenue chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Revenue</h3>
          <p className="text-sm text-gray-400">
            {money(revenueByDay.reduce((sum, d) => sum + d.revenue, 0))} total ·{" "}
            {revenueByDay.reduce((sum, d) => sum + d.orders, 0)} paid orders
          </p>
        </div>
        <RevenueChart data={revenueByDay} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Recent Orders</h3>
            <Link
              href="/dashboard/orders"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center"
            >
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-12 text-center">
              <PackageSearch className="mx-auto text-gray-600 mb-3" size={32} />
              <p className="text-gray-500 text-sm">No orders yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="text-left p-3">Order</th>
                    <th className="text-left p-3">Buyer</th>
                    <th className="text-left p-3">Items</th>
                    <th className="text-left p-3">Total</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-gray-800/60 last:border-0 hover:bg-gray-800/40 transition"
                    >
                      <td className="p-3">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="text-blue-400 hover:underline text-sm font-medium"
                        >
                          #{order.id.slice(-6).toUpperCase()}
                        </Link>
                      </td>
                      <td className="p-3 text-white text-sm">
                        {order.user?.name ?? order.user?.email ?? "Guest"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {order.items[0]?.image && (
                            <Image
                              src={order.items[0].image}
                              alt={order.items[0].title}
                              width={32}
                              height={32}
                              className="w-8 h-8 rounded-md object-cover bg-gray-800"
                            />
                          )}
                          <span className="text-white text-sm">
                            {order.items[0]?.title ?? "—"}
                            {order.items.length > 1 && (
                              <span className="text-gray-500">
                                {" "}
                                +{order.items.length - 1} more
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-white text-sm font-medium">
                        {money(order.totalAmount ?? 0)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                            STATUS_STYLES[order.status] ??
                            "bg-gray-500/20 text-gray-400 border-gray-500/40"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-400 text-sm">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Top products */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4">
              Top Selling Products
            </h3>
            {topProducts.length === 0 ? (
              <p className="text-gray-500 text-sm py-6 text-center">
                No sales recorded yet
              </p>
            ) : (
              <ul className="space-y-4">
                {topProducts.map((product, index) => (
                  <li key={product.id} className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs w-4 shrink-0">
                      {index + 1}
                    </span>
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.title}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-md object-cover bg-gray-800 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-gray-800 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm truncate" title={product.title}>
                        {product.title}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {money(product.sale_price)}
                      </p>
                    </div>
                    <span className="text-emerald-400 text-sm font-medium shrink-0">
                      {product.unitsSold} sold
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Low stock */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400" /> Low Stock
              </h3>
              <Link
                href="/dashboard/all-products"
                className="text-sm text-blue-400 hover:text-blue-300 flex items-center"
              >
                Manage <ChevronRight size={14} />
              </Link>
            </div>
            {lowStockProducts.length === 0 ? (
              <p className="text-gray-500 text-sm py-6 text-center">
                All products are well stocked
              </p>
            ) : (
              <ul className="space-y-4">
                {lowStockProducts.map((product) => (
                  <li key={product.id} className="flex items-center gap-3">
                    {product.images[0]?.url ? (
                      <Image
                        src={product.images[0].url}
                        alt={product.title}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-md object-cover bg-gray-800 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-gray-800 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-white text-sm truncate"
                        title={product.title}
                      >
                        {product.title}
                      </p>
                      <p className="text-xs text-red-400">
                        Only {product.stock} left
                      </p>
                    </div>
                    <Link
                      href={`${process.env.NEXT_PUBLIC_USER_UI_LINK}/product/${product.slug}`}
                      className="text-gray-500 hover:text-blue-400 shrink-0"
                      title="View on store"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
