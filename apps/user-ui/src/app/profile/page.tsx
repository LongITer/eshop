"use client";
import useUser from "@/hooks/useUser";
import StatCard from "@/shared/cards/stat.card";
import {
  BadgeCheck,
  Bell,
  CheckCircle,
  Clock,
  Gift,
  Inbox,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  PhoneCall,
  Receipt,
  Settings,
  ShoppingBag,
  Truck,
  User,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/utils/axioInstance";

import QuickActionCard from "@/shared/cards/quick-action.card";
import ShippingAddressSection from "@/shared/cards/shipping-address.card";
import OrdersTable from "@/shared/cards/orders.table";
import Notifications from "@/shared/cards/notifications";
import { ProfileEditor } from "@/shared/components/account-tools";
import ChangePassword from "@/shared/cards/change-password";
import toast from "react-hot-toast";
import { isAxiosError } from "axios";

const profileTabs = ["Profile", "My Orders", "Inbox", "Notifications", "Shipping Address", "Change Password"];

const ProfilePage = () => {
  const { user, isLoading, isError, error, isFetching, refetch } = useUser();
  const [loggingOut, setLoggingOut] = useState(false);
  const { data: orders, isError: ordersError } = useQuery({
    queryKey: ["user-orders"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await axiosInstance.get("/order/get-user-orders");
      return (Array.isArray(data) ? data : data.orders ?? []) as { status: string }[];
    },
  });

  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryTab = searchParams.get("active") || "Profile";
  const activeTab = profileTabs.includes(queryTab) ? queryTab : "Profile";

  useEffect(() => {
    if (queryTab === "Inbox") {
      router.push("/inbox");
    }
  }, [queryTab, router]);

  const setActiveTab = (tab: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("active", tab);
    router.push(`/profile?${newParams.toString()}`, { scroll: false });
  };

  const logOutHandler = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await axiosInstance.get("/api/logout-user");
      await queryClient.cancelQueries();
      queryClient.setQueryData(["user"], null);
      queryClient.removeQueries({ predicate: query => query.queryKey[0] !== "user" });
      router.replace("/login");
    } catch {
      toast.error("Unable to log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  if (isLoading) return <p className="p-6" role="status">Loading profile…</p>;
  if (isError || !user) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const message = status === 429
      ? "Too many requests. Please wait a few minutes and retry."
      : status === 401 || (!isError && !user)
        ? "Your session has expired. Please sign in again."
        : "Unable to connect to the profile service. Please retry.";
    return <div className="p-6 space-y-4" role="alert">
      <p>{message}</p>
      {status && <p className="text-sm text-gray-500">Error {status}</p>}
      <div className="flex flex-wrap gap-4">
        <button disabled={isFetching} className="rounded border px-4 py-2 text-blue-600 disabled:opacity-50" onClick={() => refetch()}>{isFetching ? "Retrying…" : "Retry"}</button>
        <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={() => router.replace("/login")}>Sign in</button>
      </div>
    </div>;
  }

  return (
    <div className="bg-gray-50 p-6 pb-14">
      <div className="md:max-w-7xl mx-auto">
        {/* Greeting */}
        <div className="text-center mb-10 ">
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome back,{" "}
            <span className="text-blue-500">
              {isLoading ? (
                <Loader2 className="inline animate-spin w-5 h-5" />
              ) : (
                `${user?.name || "User"}!`
              )}
            </span>
          </h1>
        </div>

        {/* Profile Overview*/}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <StatCard title="Total Orders" count={orders?.length ?? "—"} Icon={Clock} />
          <StatCard title="Processing Orders" count={orders?.filter(order => ['Pending', 'Confirmed', 'Processing', 'Shipped'].includes(order.status)).length ?? "—"} Icon={Truck} />
          <StatCard title="Completed Orders" count={orders?.filter(order => order.status === 'Delivered').length ?? "—"} Icon={CheckCircle} />
        </div>
        {ordersError && <p role="alert">Unable to load order totals.</p>}

        {/* Sidebar and content layout */}
        <div className="mt-10 flex flex-col md:flex-row gap-6">
          {/* Left navigation */}
          <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100 w-full md:w-1/5">
            <nav className="space-y-2">
              <NavItem
                label="Profile"
                Icon={User}
                active={activeTab === "Profile"}
                onClick={() => setActiveTab("Profile")}
              />
              <NavItem
                label="My Orders"
                Icon={ShoppingBag}
                active={activeTab === "My Orders"}
                onClick={() => setActiveTab("My Orders")}
              />
              <NavItem
                label="Inbox"
                Icon={Inbox}
                active={activeTab === "Inbox"}
                onClick={() => router.push("/inbox")}
              />
              <NavItem
                label="Notifications"
                Icon={Bell}
                active={activeTab === "Notifications"}
                onClick={() => setActiveTab("Notifications")}
              />
              <NavItem
                label="Shipping Address"
                Icon={MapPin}
                active={activeTab === "Shipping Address"}
                onClick={() => setActiveTab("Shipping Address")}
              />
              <NavItem
                label="Change Password"
                Icon={Lock}
                active={activeTab === "Change Password"}
                onClick={() => setActiveTab("Change Password")}
              />
              <NavItem
                label="Logout"
                Icon={LogOut}
                danger
                disabled={loggingOut}
                onClick={() => logOutHandler()}
              />
            </nav>
          </div>
          {/* Main content*/}
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-100 w-full md:w-[55%]">
            <h2 className="text-xl font-semibold text-gray-600 mb-4">
              {activeTab}
            </h2>
            {activeTab === "Profile" && !isLoading && user ? (
              <ProfileEditor key={user.id} user={user} />
            ) : activeTab === "Shipping Address" ? (
              <ShippingAddressSection />
            ) : activeTab === "My Orders" ? (
              <OrdersTable />
            ) : activeTab === "Inbox" ? (
              <div className="flex items-center justify-center py-10 gap-2 text-blue-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Redirecting to Inbox…</span>
              </div>
            ) : activeTab === "Notifications" ? (
              <Notifications />
            ) : activeTab === "Change Password" ? (
              <ChangePassword />
            ) : null}
          </div>

          {/* Right Quick Panel */}
          <div className="w-full md:w-1/4 space-y-4">
            <QuickActionCard
              Icon={Gift}
              title="Refferal Program"
              description="Invite friends and earn rewards."
            />
            <QuickActionCard
              Icon={BadgeCheck}
              title="Your Badges"
              description="View your earned achievements."
            />
            <QuickActionCard
              Icon={Settings}
              title="Account Settings"
              description="Manage preferences and security."
            />
            <QuickActionCard
              Icon={Receipt}
              title="Billing History"
              description="Check your recent payments."
            />
            <QuickActionCard
              Icon={PhoneCall}
              title="Support Center"
              description="Need help? Contact support."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

const NavItem = ({ label, Icon, active, danger, disabled, onClick }: any) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition ${
      active
        ? "bg-blue-100 text-blue-600"
        : danger
          ? "text-red-500 hover:bg-red-50"
          : "text-gray-700 hover:bg-gray-100"
    }`}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);


