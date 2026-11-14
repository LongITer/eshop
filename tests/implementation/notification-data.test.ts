import request from 'supertest';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import db, { resetDb } from './mocks/prisma';
import { appFor, userId } from './helpers';
import { getNotifications } from '../../apps/auth-service/src/controllers/account.controller';
import { useNotifications, useReadNotifications } from '../../apps/user-ui/src/hooks/useNotifications';
import axios from '@/utils/axioInstance';

jest.mock('@tanstack/react-query', () => ({ useMutation: jest.fn(), useQuery: jest.fn(), useQueryClient: jest.fn() }));
jest.mock('@/utils/axioInstance', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }), { virtual: true });

const invalidateQueries = jest.fn().mockResolvedValue(undefined);
beforeEach(() => {
  jest.clearAllMocks();
  resetDb();
  (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });
});

test('unread notification pagination filters only the signed-in buyer and retains overall counts', async () => {
  db.notifications.findMany.mockResolvedValue([{ id: 'notification-one', isRead: false }]);
  db.notifications.count.mockImplementation(({ where }: any) => Promise.resolve(where.isRead === false ? 3 : 28));
  const response = await request(appFor('get', '/', getNotifications)).get('/?page=2&limit=2&unread=true&userId=someone-else');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ notifications: [{ id: 'notification-one', isRead: false }], unreadCount: 3, total: 3, totalCount: 28 });
  expect(db.notifications.findMany).toHaveBeenCalledWith({ where: { userId, isRead: false }, skip: 2, take: 2, orderBy: { createdAt: 'desc' } });
  expect(db.notifications.count).toHaveBeenCalledWith({ where: { userId, isRead: false } });
  expect(db.notifications.count).toHaveBeenCalledWith({ where: { userId } });
});

test('the all-notifications filter includes read records and uses the overall total for pagination', async () => {
  db.notifications.findMany.mockResolvedValue([]);
  db.notifications.count.mockImplementation(({ where }: any) => Promise.resolve(where.isRead === false ? 0 : 14));
  const response = await request(appFor('get', '/', getNotifications)).get('/?unread=false');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ notifications: [], unreadCount: 0, total: 14, totalCount: 14 });
  expect(db.notifications.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId }, skip: 0, take: 20 }));
});

test('notification queries separate accounts and filters while forwarding cancellation to the request', async () => {
  const page = { notifications: [], unreadCount: 3, total: 3, totalCount: 28 };
  (axios.get as jest.Mock).mockResolvedValue({ data: page });
  useNotifications('buyer-one', { page: 2, limit: 8, unreadOnly: true });
  const options = (useQuery as jest.Mock).mock.calls[0][0];
  expect(options.queryKey).toEqual(['user-notifications', 'buyer-one', 'list', { page: 2, limit: 8, unreadOnly: true }]);
  expect(options.enabled).toBe(true);
  expect(options.refetchInterval).toBe(30_000);
  expect(options.placeholderData).toBeUndefined();
  const signal = new AbortController().signal;
  await expect(options.queryFn({ signal })).resolves.toBe(page);
  expect(axios.get).toHaveBeenCalledWith('/api/user-notifications', { params: { page: 2, limit: 8, unread: true }, signal });

  useNotifications('buyer-two');
  expect((useQuery as jest.Mock).mock.calls[1][0].queryKey).toEqual(['user-notifications', 'buyer-two', 'list', { page: 1, limit: 20, unreadOnly: false }]);
});

test('guest notification queries stay disabled even if manually refetched', async () => {
  useNotifications(undefined);
  const options = (useQuery as jest.Mock).mock.calls[0][0];
  expect(options.enabled).toBe(false);
  await expect(options.queryFn({ signal: new AbortController().signal })).rejects.toThrow('Sign in');
  expect(axios.get).not.toHaveBeenCalled();
});

test('reading a notification or all notifications refreshes only that buyer notification cache', async () => {
  (axios.patch as jest.Mock).mockResolvedValue({ data: { success: true } });
  useReadNotifications('buyer-one');
  const options = (useMutation as jest.Mock).mock.calls[0][0];
  await options.mutationFn('notification-one');
  expect(axios.patch).toHaveBeenLastCalledWith('/api/notifications/notification-one/read');
  await options.mutationFn(undefined);
  expect(axios.patch).toHaveBeenLastCalledWith('/api/notifications/read-all');
  await options.onSuccess();
  expect(invalidateQueries).toHaveBeenCalledTimes(1);
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['user-notifications', 'buyer-one'] });
});

test('read failures propagate to the UI and guest mutations cannot update another session', async () => {
  useReadNotifications(undefined);
  let options = (useMutation as jest.Mock).mock.calls[0][0];
  await expect(options.mutationFn(undefined)).rejects.toThrow('Sign in');
  expect(axios.patch).not.toHaveBeenCalled();
  useReadNotifications('buyer-one');
  options = (useMutation as jest.Mock).mock.calls[1][0];
  (axios.patch as jest.Mock).mockRejectedValueOnce(new Error('Connection lost'));
  await expect(options.mutationFn('notification-one')).rejects.toThrow('Connection lost');
  expect(invalidateQueries).not.toHaveBeenCalled();
});
