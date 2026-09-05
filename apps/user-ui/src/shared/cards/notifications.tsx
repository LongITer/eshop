"use client";

import axiosInstance from "@/utils/axioInstance";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2 } from "lucide-react";

type Notification = { id: string; title: string; message: string; isRead?: boolean; createdAt?: string };

const fetchNotifications = async (): Promise<Notification[]> => {
  const response = await axiosInstance.get("/api/notifications");
  return Array.isArray(response.data) ? response.data : response.data?.notifications ?? [];
};

const Notifications = () => {
  const { data: notifications = [], isLoading, isError } = useQuery({ queryKey: ["user-notifications"], queryFn: fetchNotifications, staleTime: 1000 * 60 });
  if (isLoading) return <p className="py-8 text-center text-sm text-gray-500">Loading notifications...</p>;
  if (isError) return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">Unable to load notifications right now.</p>;
  if (notifications.length === 0) return <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-500"><Bell className="h-8 w-8 text-gray-300" /><p className="text-sm">You are all caught up.</p></div>;
  return <div className="divide-y divide-gray-100">{notifications.map((notification) => <article key={notification.id} className={`flex gap-3 py-4 ${notification.isRead ? "" : "bg-blue-50/50"}`}><div className="mt-0.5 rounded-full bg-blue-100 p-2 text-blue-600">{notification.isRead ? <CheckCircle2 className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-sm font-semibold text-gray-800">{notification.title}</h3>{notification.createdAt && <time className="text-xs text-gray-400">{new Date(notification.createdAt).toLocaleDateString()}</time>}</div><p className="mt-1 text-sm text-gray-600">{notification.message}</p></div></article>)}</div>;
};

export default Notifications;