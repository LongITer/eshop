import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import { appFor, userId, otherId, shopId } from './helpers';
import * as account from '../../apps/auth-service/src/controllers/account.controller';
import { imageKit } from '@packages/libs/imagekit';
beforeEach(resetDb);
test('notifications are scoped to the signed-in buyer and paginated', async () => {
  db.notifications.findMany.mockResolvedValue([]); db.notifications.count.mockResolvedValue(4);
  const response = await request(appFor('get', '/', account.getNotifications)).get('/?page=2&limit=10');
  expect(response.status).toBe(200); expect(response.body.unreadCount).toBe(4);
  expect(db.notifications.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId }, skip: 10, take: 10 }));
});
test('reading another buyer notification returns 404', async () => {
  db.notifications.updateMany.mockResolvedValue({ count: 0 });
  expect((await request(appFor('patch', '/:id', account.readNotification)).patch('/' + otherId)).status).toBe(404);
  expect(db.notifications.updateMany).toHaveBeenCalledWith({ where: { id: otherId, userId }, data: { isRead: true } });
});
test('read-all only updates unread records belonging to buyer', async () => {
  db.notifications.updateMany.mockResolvedValue({ count: 2 });
  expect((await request(appFor('patch', '/', account.readAllNotifications)).patch('/')).status).toBe(200);
  expect(db.notifications.updateMany.mock.calls[0][0].where).toEqual({ userId, isRead: false });
});
const address = { label: 'Home', name: 'Buyer', street: '1 Street', city: 'Saigon', zip: '70000', country: 'Vietnam', isDefault: true };
test('cannot modify an address belonging to another user', async () => {
  db.address.findFirst.mockResolvedValue(null);
  expect((await request(appFor('put', '/:addressId', account.updateAddress)).put('/' + otherId).send(address)).status).toBe(404);
  expect(db.address.updateMany).not.toHaveBeenCalled();
});
test('default address changes are within one transaction and own user scope', async () => {
  db.address.findFirst.mockResolvedValue({ id: otherId }); db.address.update.mockResolvedValue({ id: otherId, ...address });
  expect((await request(appFor('put', '/:addressId', account.updateAddress)).put('/' + otherId).send(address)).status).toBe(200);
  expect(db.$transaction).toHaveBeenCalledTimes(1); expect(db.address.updateMany.mock.calls[0][0].where).toEqual({ userId, isDefault: true });
});
test.each([{}, { ...address, isDefault: 'true' }, { ...address, city: '' }])('invalid address data is rejected', async body => {
  expect((await request(appFor('put', '/:addressId', account.updateAddress)).put('/' + otherId).send(body)).status).toBe(400);
});
test('profile update only allows name and avatar, never role or email', async () => {
  db.users.update.mockResolvedValue({ id: userId, name: 'Updated' });
  expect((await request(appFor('put', '/', account.updateUser)).put('/').send({ name: 'Updated', role: 'admin', email: 'attacker@example.com' })).status).toBe(200);
  expect(db.users.update.mock.calls[0][0].data).toEqual({ name: 'Updated', avatar: undefined });
});
test('shop updates reject another seller shop before mutation', async () => {
  db.shops.findFirst.mockResolvedValue(null);
  expect((await request(appFor('put', '/:shopId', account.updateShop, 'seller')).put('/' + shopId).send({ name: 'New shop' })).status).toBe(404);
  expect(db.shops.update).not.toHaveBeenCalled();
});
test('unsafe shop URLs are rejected', async () => {
  db.shops.findFirst.mockResolvedValue({ id: shopId });
  expect((await request(appFor('put', '/:shopId', account.updateShop, 'seller')).put('/' + shopId).send({ name: 'Shop', website: 'javascript:alert(1)' })).status).toBe(400);
});
test('follow uses atomic not-already-following condition', async () => {
  db.shops.findUnique.mockResolvedValue({ id: shopId });
  expect((await request(appFor('post', '/:shopId', account.followShop)).post('/' + shopId)).status).toBe(200);
  expect(db.users.updateMany.mock.calls[0][0].where).toEqual({ id: userId, NOT: { following: { has: shopId } } });
});
test('unfollow preserves every other followed shop', async () => {
  db.users.findUniqueOrThrow.mockResolvedValue({ id: userId, following: [shopId, otherId] });
  await request(appFor('delete', '/:shopId', account.unfollowShop)).delete('/' + shopId);
  expect(db.users.update.mock.calls[0][0].data.following).toEqual([otherId]);
});
test('avatar upload rejects non-image payload without provider call', async () => {
  expect((await request(appFor('post', '/', account.uploadAccountImage)).post('/').send({ file: 'data:text/html;base64,PHNjcmlwdD4=' })).status).toBe(400);
  expect(imageKit.upload).not.toHaveBeenCalled();
});
