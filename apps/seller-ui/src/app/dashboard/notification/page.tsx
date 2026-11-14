"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import useSeller from "apps/seller-ui/src/hooks/useSeller";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "apps/seller-ui/src/utils/axioInstance";
import { ArrowUpRight, Bell, Check, CheckCheck, ChevronRight, LoaderCircle, Package, RefreshCw, ShoppingBag, Star } from "lucide-react";
import Link from "next/link";

interface SellerNotification { id: string; title: string; message: string; type: string; isRead: boolean; redirectUrl: string | null; createdAt: string }
interface NotificationResponse { notifications: SellerNotification[]; unreadCount: number }
const queryKey = ["seller-notifications"];
const control = "min-h-11 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50";
const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date unavailable";
};

export default function SellerNotificationsPage() {
  const queryClient = useQueryClient();
  const { seller, isLoading: sellerLoading } = useSeller();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notificationsQuery = useQuery<NotificationResponse>({
    queryKey: [...queryKey, seller?.id], enabled: !!seller?.id,
    queryFn: async ({ signal }) => {
      const response = await axiosInstance.get("/product/api/get-seller-notifications", { signal });
      return { notifications: response.data?.notifications ?? [], unreadCount: response.data?.unreadCount ?? 0 };
    },
    refetchInterval: 30_000,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => axiosInstance.patch(`/product/api/notifications/${id}/read`),
    onError: () => toast.error("Could not mark notification as read."),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const markAllRead = useMutation({
    mutationFn: () => axiosInstance.patch("/product/api/notifications/read-all"),
    onError: () => toast.error("Could not mark notifications as read."),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); toast.success("All notifications marked as read."); },
  });
  const notifications = notificationsQuery.data?.notifications ?? [];
  const visible = unreadOnly ? notifications.filter(notification => !notification.isRead) : notifications;
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const saving = markRead.isPending || markAllRead.isPending;
  const loading = sellerLoading || notificationsQuery.isLoading;

  return <main className="min-h-screen bg-[#080d1a] p-4 text-slate-100 sm:p-6 lg:p-8"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-xs text-slate-500"><Link href="/dashboard" className="hover:text-blue-400">Dashboard</Link><ChevronRight size={14} /><span className="text-slate-400">Notifications</span></nav><h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">Notifications{!loading && !notificationsQuery.isError && unreadCount > 0 && <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-400">{unreadCount} unread</span>}</h1><p className="mt-2 text-sm text-slate-400">Orders, inventory alerts and updates for your shop.</p></div><div className="flex flex-wrap gap-2"><button type="button" className={`${control} flex items-center gap-2`} disabled={!seller?.id || notificationsQuery.isFetching} onClick={() => notificationsQuery.refetch()}><RefreshCw size={16} className={notificationsQuery.isFetching ? "animate-spin" : ""} /> Refresh</button><button type="button" onClick={() => markAllRead.mutate()} disabled={saving || !unreadCount || notificationsQuery.isError} className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40">{markAllRead.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCheck size={16} />} Mark all as read</button></div></header>
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4 sm:px-6"><div className="flex rounded-xl bg-slate-950/60 p-1">{[{ label: "All updates", value: false }, { label: "Unread", value: true }].map(tab => <button key={tab.label} type="button" aria-pressed={unreadOnly === tab.value} onClick={() => setUnreadOnly(tab.value)} className={`rounded-lg px-4 py-2 text-sm transition ${unreadOnly === tab.value ? "bg-slate-800 font-medium text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>{tab.label}</button>)}</div><p className="text-xs text-slate-500">Latest 50 notifications</p></div>
      {loading ? <div role="status" className="flex items-center justify-center gap-2 px-6 py-20 text-sm text-slate-400"><LoaderCircle size={18} className="animate-spin" /> Loading notifications…</div> : notificationsQuery.isError ? <div role="alert" className="px-6 py-16 text-center"><Bell className="mx-auto mb-4 text-slate-500" size={34} /><h2 className="font-medium">Notifications could not be loaded.</h2><p className="mt-2 text-sm text-slate-400">Try again to see your shop updates.</p><button type="button" onClick={() => notificationsQuery.refetch()} className="mt-5 text-sm font-medium text-blue-400">Try again</button></div> : !visible.length ? <div className="px-6 py-20 text-center"><span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">{unreadOnly ? <CheckCheck size={26} /> : <Bell size={26} />}</span><h2 className="font-medium">{unreadOnly ? "You’re all caught up" : "No notifications yet"}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">{unreadOnly ? "There are no unread updates in your latest notifications." : "New orders, low stock alerts and reviews will appear here."}</p></div> : <ul className="divide-y divide-slate-800">{visible.map(notification => {
        const Icon = notification.type === "LowStock" ? Package : notification.type === "NewOrder" ? ShoppingBag : notification.type === "NewReview" ? Star : Bell;
        const redirect = notification.redirectUrl && /^\/dashboard(?:\/|$)/.test(notification.redirectUrl) && !notification.redirectUrl.includes("\\") ? notification.redirectUrl : null;
        return <li key={notification.id} className={`flex gap-3 px-4 py-5 transition sm:gap-4 sm:px-6 ${notification.isRead ? "" : "bg-blue-500/[0.035]"}`}><span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${notification.type === "LowStock" ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"}`}><Icon size={18} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h2 className="text-sm font-medium leading-6">{notification.title}</h2>{!notification.isRead && <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-400" />}</div><p className="mt-1 break-words text-sm leading-6 text-slate-400">{notification.message}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><time dateTime={notification.createdAt} className="text-xs text-slate-500">{date(notification.createdAt)}</time><div className="flex items-center gap-4">{!notification.isRead && <button type="button" disabled={saving} onClick={() => markRead.mutate(notification.id)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 disabled:opacity-50">{markRead.isPending && markRead.variables === notification.id ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />} Mark as read</button>}{redirect && <Link href={redirect} onClick={() => { if (!notification.isRead && !saving) markRead.mutate(notification.id); }} className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300">View details <ArrowUpRight size={13} /></Link>}</div></div></div></li>;
      })}</ul>}
    </section>
  </div></main>;
}
