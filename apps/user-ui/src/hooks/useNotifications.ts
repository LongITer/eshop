'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from '@/utils/axioInstance';

export type StorefrontNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  redirectUrl: string | null;
  createdAt: string;
};

export type NotificationPage = {
  notifications: StorefrontNotification[];
  unreadCount: number;
  total: number;
  totalCount: number;
};

export function useNotifications(
  userId: string | undefined,
  { page = 1, limit = 20, unreadOnly = false }: { page?: number; limit?: number; unreadOnly?: boolean } = {},
) {
  return useQuery<NotificationPage, Error>({
    queryKey: ['user-notifications', userId, 'list', { page, limit, unreadOnly }],
    queryFn: async ({ signal }) => {
      if (!userId) throw new Error('Sign in to view notifications.');
      const { data } = await axios.get<NotificationPage>('/api/user-notifications', {
        params: { page, limit, ...(unreadOnly ? { unread: true } : {}) },
        signal,
      });
      return data;
    },
    enabled: !!userId,
    refetchInterval: 30_000,
  });
}

export function useReadNotifications(userId: string | undefined) {
  const client = useQueryClient();
  return useMutation<void, Error, string | undefined>({
    mutationFn: async (id) => {
      if (!userId) throw new Error('Sign in to update notifications.');
      await axios.patch(id ? `/api/notifications/${encodeURIComponent(id)}/read` : '/api/notifications/read-all');
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['user-notifications', userId] }),
  });
}
