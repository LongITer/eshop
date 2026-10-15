import prisma from '@packages/libs/prisma';
import { handle, objectId, pageArgs, textField } from '@packages/utils/api';
import { transaction } from '@packages/utils/transaction';
import { audit } from '@packages/utils/admin-audit';
import { NotFoundError, ValidationError } from '@packages/error-handler';

export const queueNotification = handle(async (req, res) => {
  const title = textField(req.body.title, 'title', 150); const message = textField(req.body.message, 'message', 3000);
  const audience = req.body.audience; const requestKey = textField(req.body.requestKey, 'request key', 100);
  if (!['users', 'sellers'].includes(audience)) throw new ValidationError('Choose customers or sellers');
  const recipientId = req.body.recipientId ? objectId(req.body.recipientId) : null;
  if (!recipientId && req.body.confirmBroadcast !== true) throw new ValidationError('Confirm the broadcast');
  if (recipientId) {
    const recipient = audience === 'users' ? await prisma.users.findFirst({ where: { id: recipientId, role: 'user' }, select: { id: true } }) : await prisma.sellers.findUnique({ where: { id: recipientId }, select: { id: true } });
    if (!recipient) throw new NotFoundError('Recipient not found');
  }
  const data = { actorId: req.user!.id, title, message, audience, recipientId };
  const job = await transaction(async tx => {
    const result = await tx.notificationJob.upsert({ where: { requestKey }, create: { requestKey, ...data }, update: {} });
    if (Object.entries(data).some(([key, value]) => result[key as keyof typeof result] !== value)) throw new ValidationError('This request key belongs to another message');
    // One audit record per enqueue, even when the HTTP response is retried.
    if (!await tx.adminAudit.findFirst({ where: { action: 'notification.queue', targetId: result.id } })) await audit(tx, req.user!.id, 'notification.queue', result.id, recipientId ? 'Individual notification' : 'Confirmed broadcast', {}, data);
    return result;
  });
  res.status(202).json({ job });
});
export const notificationJobs = handle(async (req, res) => {
  const where = { actorId: req.user!.id };
  const [rows, total] = await Promise.all([prisma.notificationJob.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: 'desc' } }), prisma.notificationJob.count({ where })]);
  res.json({ rows, total });
});
export const retryNotification = handle(async (req, res) => {
  const id = objectId(req.params.id);
  await transaction(async tx => {
    const result = await tx.notificationJob.updateMany({ where: { id, actorId: req.user!.id, status: 'Failed' }, data: { status: 'Queued', error: null } });
    if (!result.count) throw new ValidationError('Only your failed deliveries can be retried');
    await audit(tx, req.user!.id, 'notification.retry', id, 'Resume failed delivery', { status: 'Failed' }, { status: 'Queued' });
  });
  res.json({ success: true });
});
