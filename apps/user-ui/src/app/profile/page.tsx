"use client";
import { useStorefrontText } from '@packages/components/storefront-language';

import useRequireAuth from "@/hooks/useRequireAuth";
import StatCard from "@/shared/cards/stat.card";
import {
  Bell,
  CheckCircle,
  Clock,
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

const profileTabs = ["Profile", "My Orders", "Inbox", "Notifications", "Shipping Address", "Change Password"];

const tabLabels:Record<string,string>={'Profile':'Hồ sơ','My Orders':'Đơn hàng','Inbox':'Tin nhắn','Notifications':'Thông báo','Shipping Address':'Địa chỉ giao hàng','Change Password':'Đổi mật khẩu','Logout':'Đăng xuất'};
const ProfilePage = () => {
  const { t } = useStorefrontText();
  const { user, isLoading, isError } = useRequireAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const { data: stats, isError: ordersError } = useQuery({ queryKey: ['user-order-stats'], enabled: !!user, queryFn: async () => (await axiosInstance.get('/order/api/my-order-stats')).data });

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
      toast.error(t("Không đăng xuất được. Vui lòng thử lại."));
    } finally {
      setLoggingOut(false);
    }
  };

  if (isLoading) return <p className="p-6" role="status">{t("Đang tải hồ sơ…")}</p>;
  if (isError || !user) {
    return null; // useRequireAuth will redirect
  }

  return (
    <div className="bg-gray-50 p-6 pb-14">
      <div className="md:max-w-7xl mx-auto">
        {/* Greeting */}
        <div className="text-center mb-10 ">
          <h1 className="text-3xl font-bold text-gray-800">
            {t("Xin chào,")}{" "}
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
          <StatCard title={t("Tổng đơn hàng")} count={stats?.total ?? "—"} Icon={Clock} />
          <StatCard title={t("Đơn đang xử lý")} count={stats?.processing ?? "—"} Icon={Truck} />
          <StatCard title={t("Đơn đã giao")} count={stats?.completed ?? "—"} Icon={CheckCircle} />
        </div>
        {ordersError && <p role="alert">{t("Không tải được thống kê đơn hàng.")}</p>}

        {/* Sidebar and content layout */}
        <div className="mt-10 flex flex-col md:flex-row gap-6">
          {/* Left navigation */}
          <div className="bg-white p-4 rounded-md shadow-sm border border-gray-100 w-full md:w-1/5">
            <nav className="space-y-2">
              <NavItem
                label={t("Profile")}
                Icon={User}
                active={activeTab === "Profile"}
                onClick={() => setActiveTab("Profile")}
              />
              <NavItem
                label={t("My Orders")}
                Icon={ShoppingBag}
                active={activeTab === "My Orders"}
                onClick={() => setActiveTab("My Orders")}
              />
              <NavItem
                label={t("Inbox")}
                Icon={Inbox}
                active={activeTab === "Inbox"}
                onClick={() => router.push("/inbox")}
              />
              <NavItem
                label={t("Notifications")}
                Icon={Bell}
                active={activeTab === "Notifications"}
                onClick={() => setActiveTab("Notifications")}
              />
              <NavItem
                label={t("Shipping Address")}
                Icon={MapPin}
                active={activeTab === "Shipping Address"}
                onClick={() => setActiveTab("Shipping Address")}
              />
              <NavItem
                label={t("Change Password")}
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
              {t(tabLabels[activeTab])}
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
                <span className="text-sm">{t("Đang mở tin nhắn…")}</span>
              </div>
            ) : activeTab === "Notifications" ? (
              <Notifications />
            ) : activeTab === "Change Password" ? (
              <ChangePassword />
            ) : null}
          </div>

          {/* Right Quick Panel */}
          <div className="w-full md:w-1/4 space-y-4">
            <QuickActionCard Icon={Receipt} title={t("Đơn hàng")} description={t("Theo dõi giao hàng và thanh toán.")} href="/profile?active=My+Orders" />
            <QuickActionCard Icon={Settings} title={t("Địa chỉ giao hàng")} description={t("Quản lý địa chỉ nhận hàng.")} href="/profile?active=Shipping+Address" />
            <QuickActionCard Icon={PhoneCall} title={t("Trợ giúp")} description={t("Hướng dẫn mua hàng, trả hàng và liên hệ.")} href="/help" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

const NavItem = ({ label, Icon, active, danger, disabled, onClick }: any) => {
  const { t } = useStorefrontText();
  return (
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
    {t(tabLabels[label] || label)}
  </button>
);
};


