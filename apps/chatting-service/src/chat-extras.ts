import crypto from 'crypto';
import webpush from 'web-push';
import prisma from '@packages/libs/prisma';
import redis from '@packages/libs/redis';
import { imageKit } from '@packages/libs/imagekit';
import { handle, objectId } from '@packages/utils/api';
import { ForbiddenError, ValidationError } from '@packages/error-handler';
export function actor(req: any) {
  const type = req.role === 'seller' ? 'seller' : 'user';
  const id = type === 'seller' ? req.seller?.id : req.user?.id;
  if (!id || !['user', 'seller'].includes(req.role)) throw new ForbiddenError();
  return { id, type };
}
export const socketTicket = handle(async (req, res) => {
  const identity = actor(req); const ticket = crypto.randomBytes(32).toString('hex');
  await redis.set(`chat-ticket:${ticket}`, JSON.stringify(identity), 'EX', 60);
  res.json({ ticket });
});
export const attachment = handle(async (req, res) => {
  const identity = actor(req); const conversationId = objectId(req.body.conversationId);
  if (!await prisma.conversationGroup.findFirst({ where: { id: conversationId, participantIds: { has: identity.id } } })) throw new ForbiddenError();
  if (typeof req.body.file !== 'string' || req.body.file.length > 7_000_000 || !/^data:(image\/(png|jpeg|webp)|application\/pdf|text\/plain);base64,/.test(req.body.file)) throw new ValidationError('Choose an image, PDF or text file under 5 MB');
  const result = await imageKit.upload({ file: req.body.file, fileName: `chat-${crypto.randomUUID()}-${String(req.body.name || 'attachment').replace(/[^\w.-]/g, '').slice(-100)}`, folder: '/chat' });
  await prisma.chatAttachment.create({ data: { url: result.url, actorId: identity.id, conversationId } });
  res.status(201).json({ url: result.url });
});
export const pushKey = handle(async (_req, res) => { res.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null }); });
export const subscribePush = handle(async (req, res) => {
  const identity = actor(req); const subscription = req.body;
  let url: URL;
  try { url = new URL(subscription.endpoint); } catch { throw new ValidationError('Invalid push endpoint'); }
  const allowed = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'];
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !(allowed.includes(url.hostname) || url.hostname.endsWith('.notify.windows.com')) || typeof subscription.keys?.p256dh !== 'string' || typeof subscription.keys?.auth !== 'string') throw new ValidationError('Invalid push subscription');
  await prisma.pushSubscription.upsert({ where: { endpoint: subscription.endpoint }, create: { endpoint: subscription.endpoint, actorId: identity.id, actorType: identity.type, subscription }, update: { actorId: identity.id, actorType: identity.type, subscription } });
  res.json({ success: true });
});
export async function sendPush(actorId: string, actorType: string, conversationId: string) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const subscriptions = await prisma.pushSubscription.findMany({ where: { actorId, actorType } });
  await Promise.all(subscriptions.map(async record => {
    try { await webpush.sendNotification(record.subscription as any, JSON.stringify({ title: 'New message', body: 'You have a new message on Eshop.', url: `${actorType === 'seller' ? '/dashboard' : ''}/inbox?conversationId=${conversationId}` })); }
    catch (error: any) { if ([404, 410].includes(error.statusCode)) await prisma.pushSubscription.deleteMany({ where: { id: record.id } }); else console.error('Push delivery failed', error.statusCode); }
  }));
}
