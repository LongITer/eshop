import prisma from '@packages/libs/prisma';
import { transaction } from '@packages/utils/transaction';
import { canAdmin, isSuspended } from '@packages/utils/admin-access';

// Notifications and cursor are committed together: a crash/retry cannot duplicate a batch.
export async function processNotificationJob() {
  const now = new Date();
  const candidate = await prisma.notificationJob.findFirst({ where: { OR: [{ status: 'Queued' }, { status: 'Running', leaseUntil: { lt: now } }] }, orderBy: { createdAt: 'asc' } });
  if (!candidate) return;
  const leaseUntil = new Date(Date.now() + 60000);
  const claimed = await prisma.notificationJob.updateMany({ where: { id: candidate.id, status: candidate.status, ...(candidate.status === 'Running' ? { leaseUntil: { lt: now } } : {}) }, data: { status: 'Running', leaseUntil } });
  if (!claimed.count) return;
  try {
    await transaction(async tx => {
      const job = await tx.notificationJob.findUniqueOrThrow({ where: { id: candidate.id } });
      if (job.leaseUntil?.getTime() !== leaseUntil.getTime() || job.status !== 'Running') return;
      // Acquire the job write lock before writing recipient notifications.
      await tx.notificationJob.update({ where: { id: job.id, status: 'Running', leaseUntil }, data: { updatedAt: new Date() } });
      const actor = await tx.users.findUnique({ where: { id: job.actorId } });
      if (!canAdmin(actor, 'notifications') || isSuspended(actor!)) throw new Error('Sender no longer has permission');
      const where = { createdAt: { lte: job.createdAt }, ...(job.recipientId ? { id: job.recipientId } : {}) };
      const args = { where, select: { id: true }, take: 200, orderBy: { id: 'asc' as const }, ...(job.cursor ? { cursor: { id: job.cursor }, skip: 1 } : {}) };
      const rows = job.audience === 'users' ? await tx.users.findMany({ ...args, where: { ...where, role: 'user' } }) : await tx.sellers.findMany(args);
      if (rows.length) await tx.notifications.createMany({ data: rows.map(row => ({ title: job.title, message: job.message, type: 'System', metadata: { jobId: job.id }, ...(job.audience === 'users' ? { userId: row.id } : { sellerId: row.id }) })) });
      await tx.notificationJob.update({ where: { id: job.id }, data: { cursor: rows.at(-1)?.id ?? job.cursor, sent: { increment: rows.length }, status: rows.length === 200 ? 'Queued' : 'Completed', leaseUntil: null, error: null } });
    });
  } catch (error) {
    await prisma.notificationJob.updateMany({ where: { id: candidate.id, status: 'Running', leaseUntil }, data: { status: 'Failed', leaseUntil: null, error: error instanceof Error && error.message === 'Sender no longer has permission' ? error.message : 'Delivery failed. Retry to continue from the last completed batch.' } });
  }
}
export function startNotificationWorker() {
  let busy = false;
  const timer = setInterval(async () => { if (busy) return; busy = true; try { await processNotificationJob(); } catch (error) { console.error('Notification worker unavailable', error instanceof Error ? error.message : 'Unknown error'); } finally { busy = false; } }, 2000);
  timer.unref();
  return timer;
}
