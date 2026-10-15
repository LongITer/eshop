'use client';
import { useStorefrontText } from '@packages/components/storefront-language';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '@/utils/axioInstance';
export default function Notifications() {
  const { t, locale } = useStorefrontText();
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['user-notifications', page], queryFn: async () => (await axios.get(`/api/user-notifications?page=${page}`)).data });
  const read = useMutation({ mutationFn: (id?: string) => axios.patch(id ? `/api/notifications/${id}/read` : '/api/notifications/read-all'), onSuccess: () => client.invalidateQueries({ queryKey: ['user-notifications'] }) });
  if (query.isLoading) return <p>{t("Loading notifications…")}</p>;
  if (query.isError) return <p role="alert">{t("Unable to load notifications. ")}<button onClick={() => query.refetch()}>{t("Retry")}</button></p>;
  return <section className="space-y-4"><div className="flex justify-between gap-3"><p>{query.data.unreadCount} {t(" unread")}</p><button disabled={read.isPending} onClick={() => read.mutate(undefined)} className="text-blue-600">{t("Mark all as read")}</button></div>{read.isError && <p role="alert">{t("Could not update notifications. Please retry.")}</p>}{!query.data.notifications.length && <p>{t("No notifications yet.")}</p>}{query.data.notifications.map((n: any) => <article key={n.id} className={`rounded-xl border p-4 ${n.isRead ? '' : 'bg-blue-50'}`}><h2 className="font-semibold">{n.title}</h2><p>{n.message}</p><time className="text-sm text-gray-500">{new Date(n.createdAt).toLocaleString(locale)}</time><div className="flex gap-4 mt-2">{!n.isRead && <button disabled={read.isPending} onClick={() => read.mutate(n.id)} className="text-blue-600">{t("Mark as read")}</button>}{n.redirectUrl?.startsWith('/') && !n.redirectUrl.startsWith('//') && <Link href={n.redirectUrl}>{t("View details")}</Link>}</div></article>)}<div className="flex gap-4"><button disabled={page === 1} onClick={() => setPage(page - 1)}>{t("Previous")}</button><span>{t("Page ")}{page}</span><button disabled={page * 20 >= query.data.total} onClick={() => setPage(page + 1)}>{t("Next")}</button></div></section>;
}

