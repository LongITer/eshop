import { transaction } from '@packages/utils/transaction';
import prisma from '@packages/libs/prisma';
import { imageKit } from '@packages/libs/imagekit';
import { handle, objectId, pageArgs, textField } from '@packages/utils/api';
import { NotFoundError, ValidationError } from '@packages/error-handler';

export const getNotifications = handle(async (req, res) => {
  const where = { userId: req.user.id };
  const [notifications, unreadCount, total] = await Promise.all([
    prisma.notifications.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: 'desc' } }),
    prisma.notifications.count({ where: { ...where, isRead: false } }),
    prisma.notifications.count({ where }),
  ]);
  res.json({ notifications, unreadCount, total });
});
export const readNotification = handle(async (req, res) => {
  const result = await prisma.notifications.updateMany({ where: { id: objectId(req.params.id), userId: req.user.id }, data: { isRead: true } });
  if (!result.count) throw new NotFoundError();
  res.json({ success: true });
});
export const readAllNotifications = handle(async (req, res) => {
  await prisma.notifications.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ success: true });
});
export const addAddress = handle(async (req, res) => {
  const userId = req.user.id;
  const data = addressFields(req.body);
  const address = await transaction(async tx => {
    await tx.users.update({ where: { id: userId }, data: { updatedAt: new Date() } });
    if (data.isDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({ data: { ...data, userId } });
  });
  res.status(201).json({ success: true, address });
});
function addressFields(body: Record<string, unknown>) {
  const data = Object.fromEntries(['label', 'name', 'street', 'city', 'zip', 'country'].map(key => [key, textField(body[key], key)])) as Record<'label' | 'name' | 'street' | 'city' | 'zip' | 'country', string>;
  if (typeof body.isDefault !== 'boolean') throw new ValidationError('isDefault must be boolean');
  return { ...data, isDefault: body.isDefault };
}
export const updateAddress = handle(async (req, res) => {
  const id = objectId(req.params.addressId);
  const userId = req.user.id;
  const data = addressFields(req.body);
  const address = await transaction(async tx => {
    if (!await tx.address.findFirst({ where: { id, userId } })) throw new NotFoundError();
    // Serialize default changes even when no address is currently the default.
    await tx.users.update({ where: { id: userId }, data: { updatedAt: new Date() } });
    if (req.body.isDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.update({ where: { id, userId }, data: { ...data, isDefault: req.body.isDefault } });
  });
  res.json({ address });
});
export const uploadAccountImage = handle(async (req, res) => {
  const file = req.body.file;
  if (typeof file !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(file) || file.length > 7_000_000) throw new ValidationError('Choose a PNG, JPEG or WebP image under 5 MB');
  const uploaded = await imageKit.upload({ file, fileName: `account-${Date.now()}`, folder: '/accounts' });
  res.status(201).json({ url: uploaded.url, file_id: uploaded.fileId });
});
function avatarData(avatar: any) {
  if (!avatar) return undefined;
  if (typeof avatar.url !== 'string' || !avatar.url.startsWith('https://') || typeof avatar.file_id !== 'string') throw new ValidationError('Invalid avatar');
  return { deleteMany: {}, create: { url: avatar.url, file_id: avatar.file_id } };
}
export const updateUser = handle(async (req, res) => {
  const name = textField(req.body.name, 'name', 100);
  const user = await prisma.users.update({ where: { id: req.user.id }, data: { name, avatar: avatarData(req.body.avatar) }, select: { id: true, name: true, email: true, avatar: true } });
  res.json({ user });
});
export const updateShop = handle(async (req: any, res) => {
  const id = objectId(req.params.shopId);
  if (!await prisma.shops.findFirst({ where: { id, sellerId: req.seller.id } })) throw new NotFoundError();
  const data: any = { name: textField(req.body.name, 'name', 100), avatar: avatarData(req.body.avatar) };
  for (const key of ['bio', 'address', 'opening_hours', 'website', 'coverBanner']) {
    if (req.body[key] !== undefined) {
      if (req.body[key] === null) { data[key] = null; continue; }
      if (typeof req.body[key] !== 'string' || req.body[key].length > 2000) throw new ValidationError(`Invalid ${key}`);
      if (['website', 'coverBanner'].includes(key) && req.body[key] && !/^https?:\/\//.test(req.body[key])) throw new ValidationError(`Invalid ${key} URL`);
      data[key] = req.body[key];
    }
  }
  if (req.body.socialLinks !== undefined) {
    if (!Array.isArray(req.body.socialLinks) || req.body.socialLinks.length > 10 || req.body.socialLinks.some((item: any) => !item || typeof item.url !== 'string' || !/^https?:\/\//.test(item.url) || typeof item.name !== 'string')) throw new ValidationError('Invalid social links');
    data.socialLinks = req.body.socialLinks;
  }
  const shop = await prisma.shops.update({ where: { id, sellerId: req.seller.id }, data, include: { avatar: true } });
  res.json({ shop });
});
export const followShop = handle(async (req, res) => {
  const shopId = objectId(req.params.shopId);
  if (!await prisma.shops.findUnique({ where: { id: shopId } })) throw new NotFoundError();
  await prisma.users.updateMany({ where: { id: req.user.id, NOT: { following: { has: shopId } } }, data: { following: { push: shopId } } });
  res.json({ success: true });
});
export const unfollowShop = handle(async (req, res) => {
  const shopId = objectId(req.params.shopId);
  await transaction(async tx => {
    const user = await tx.users.findUniqueOrThrow({ where: { id: req.user.id } });
    await tx.users.update({ where: { id: user.id }, data: { following: user.following.filter(id => id !== shopId) } });
  });
  res.json({ success: true });
});
export const followedShops = handle(async (req, res) => {
  const user = await prisma.users.findUniqueOrThrow({ where: { id: req.user.id } });
  const shops = await prisma.shops.findMany({ where: { id: { in: user.following } }, include: { avatar: true } });
  res.json({ shops });
});
