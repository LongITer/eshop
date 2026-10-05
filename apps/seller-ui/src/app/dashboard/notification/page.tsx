"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "apps/seller-ui/src/utils/axioInstance";
import { ChevronRight, LoaderCircle } from "lucide-react";
import Link from "next/link";

interface SellerNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  redirectUrl: string | null;
  createdAt: string;
}

interface NotificationResponse {
  notifications: SellerNotification[];
  unreadCount: number;
}

const NOTIFICATIONS_QUERY_KEY = ["seller-notifications"];

const fetchNotifications = async (): Promise<NotificationResponse> => {
  const response = await axiosInstance.get(
    "/product/get-seller-notifications",
  );
  return {
    notifications: response.data?.notifications ?? [],
    unreadCount: response.data?.unreadCount ?? 0,
  };
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));

const SellerNotificationsPage = () => {
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      axiosInstance.patch(`/product/notifications/${id}/read`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });

  const notifications = notificationsQuery.data?.notifications ?? [];

  return (
    <section className="min-h-screen bg-black px-6 py-6 text-white sm:px-10">
      <div className="max-w-[820px]">
        <h1 className="py-2 text-2xl font-semibold text-white">Notifications</h1>
        <nav aria-label="Breadcrumb" className="flex items-center text-white">
          <Link
            href="/dashboard"
            className="cursor-pointer text-[#80Deea]"
          >
            Dashboard
          </Link>
          <ChevronRight size={20} className="opacity-[.8]" />
          <span>Notifications</span>
        </nav>

        {notificationsQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <LoaderCircle size={18} className="animate-spin" />
            Đang tải thông báo...
          </div>
        ) : notificationsQuery.isError ? (
          <div className="py-16 text-center">
            <p className="text-sm text-rose-300">
              Không thể tải thông báo lúc này.
            </p>
            <button
              type="button"
              onClick={() => notificationsQuery.refetch()}
              className="mt-3 text-sm text-amber-300 underline underline-offset-4"
            >
              Thử lại
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="mt-6 bg-[#0c1117] px-4 py-5 text-sm text-slate-400">
            No notifications yet.
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!notification.isRead) {
                      markReadMutation.mutate(notification.id);
                    }
                  }}
                  aria-label={`${notification.isRead ? "Read" : "Unread"}: ${notification.title}. ${notification.message}`}
                  className={`w-full px-4 py-3 text-left transition hover:bg-[#151b22] ${
                    notification.isRead ? "bg-[#090d12]" : "bg-[#0c1117]"
                  }`}
                >
                  <span className="block text-sm font-medium text-slate-100">
                    {notification.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-300">
                    {notification.message}
                  </span>
                  <time
                    className="mt-1 block text-[10px] text-slate-500"
                    dateTime={notification.createdAt}
                  >
                    {formatDate(notification.createdAt)}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default SellerNotificationsPage;