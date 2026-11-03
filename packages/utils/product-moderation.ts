import { createHash, randomUUID } from 'node:crypto';
import prisma from '@packages/libs/prisma';
import { NotFoundError, ValidationError } from '@packages/error-handler';
import { transaction } from './transaction';
import { audit } from './admin-audit';

export const violationCategories = ['Prohibited', 'Counterfeit', 'Misleading', 'Unsafe', 'Other'] as const;
export const reportFields = { id: true, productId: true, shopId: true, source: true, category: true, reason: true, snapshot: true, status: true, resolutionReason: true, resolvedAt: true, violationId: true, createdAt: true } as const;
export const violationFields = { id: true, productId: true, shopId: true, sellerId: true, productTitle: true, category: true, reason: true, severity: true, productAction: true, sellerAction: true, suspendedUntil: true, occurrence: true, followupStatus: true, affectedOrders: true, createdAt: true } as const;
export function listingSnapshot(product: { title: string; category: string; detailed_description: string }) {
  return { title: product.title, category: product.category, description: product.detailed_description.replace(/<[^>]*>/g, ' ').slice(0, 12000) };
}
export async function submitProductReport(productId: string, reporterId: string, source: 'Customer' | 'Admin' | 'AI', category: string, reason: string, expectedSnapshot?: ReturnType<typeof listingSnapshot>) {
  if (!violationCategories.includes(category as any)) throw new ValidationError('Invalid violation category');
  const product = await prisma.products.findUnique({ where: { id: productId } });
  if (!product || (source === 'Customer' && (product.status !== 'Active' || product.isDeleted))) throw new NotFoundError('Product is unavailable');
  const snapshot = listingSnapshot(product);
  if (expectedSnapshot && JSON.stringify(snapshot) !== JSON.stringify(expectedSnapshot)) throw new ValidationError('The listing changed during the AI scan. Review the updated listing again.');
  const version = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  const dedupeKey = source === 'Admin' ? randomUUID() : `${source}:${reporterId}:${productId}:${version}`;
  return prisma.productReport.upsert({ where: { dedupeKey }, update: {}, create: { productId, shopId: product.shopId, reporterId, source, category, reason, snapshot, dedupeKey }, select: reportFields });
}

export async function decideProductReport(reportId: string, actorId: string, input: { decision: string; reason: string; severity?: string; productAction?: string; sellerAction?: string; until?: string }) {
  if (!['Confirm', 'Dismiss'].includes(input.decision)) throw new ValidationError('Invalid report decision');
  if (input.decision === 'Confirm' && (!['Low', 'Medium', 'High', 'Critical'].includes(input.severity || '') || !['Hide', 'Remove'].includes(input.productAction || '') || !['Warn', 'Suspend'].includes(input.sellerAction || ''))) throw new ValidationError('Choose severity, product action and seller action');
  const until = input.until ? new Date(input.until) : null;
  if (until && (!Number.isFinite(until.getTime()) || until <= new Date())) throw new ValidationError('Choose a future suspension expiry');
  return transaction(async tx => {
    const report = await tx.productReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundError();
    if (report.status !== 'Pending') throw new ValidationError('This report has already been reviewed');
    if (input.decision === 'Dismiss') {
      await tx.productReport.update({ where: { id: reportId, status: 'Pending' }, data: { status: 'Dismissed', resolvedAt: new Date(), resolvedBy: actorId, resolutionReason: input.reason } });
      await audit(tx, actorId, 'report.dismiss', reportId, input.reason);
      return { dismissed: true };
    }
    const product = await tx.products.findUnique({ where: { id: report.productId }, include: { shop: { select: { sellerId: true } } } });
    if (!product) throw new NotFoundError('Product no longer exists');
    // Serialize decisions for a seller, preserving recurrence counts under concurrent review.
    const seller = await tx.sellers.update({ where: { id: product.shop.sellerId }, data: { moderationRevision: { increment: 1 } } });
    const occurrence = await tx.productViolation.count({ where: { sellerId: seller.id } }) + 1;
    const reports = await tx.productReport.findMany({ where: { productId: product.id, status: 'Pending' }, select: { id: true, source: true, category: true, reason: true, snapshot: true, createdAt: true } });
    const violation = await tx.productViolation.create({ data: {
      productId: product.id, shopId: product.shopId, sellerId: seller.id, actorId,
      productTitle: product.title, category: report.category, reason: input.reason,
      severity: input.severity!, productAction: input.productAction!, sellerAction: input.sellerAction!,
      suspendedUntil: input.sellerAction === 'Suspend' ? until : null, occurrence,
      reports: JSON.parse(JSON.stringify(reports)),
    } });
    await tx.products.update({ where: { id: product.id }, data: { status: 'Suspended', moderationReason: input.reason, ...(input.productAction === 'Remove' ? { isDeleted: true, deleteAt: null } : {}) } });
    if (input.sellerAction === 'Suspend') {
      // A new decision must never shorten an existing, stricter suspension.
      const permanent = seller.suspendedAt && !seller.suspendedUntil;
      const expiry = permanent || !until ? null : seller.suspendedUntil && seller.suspendedUntil > until ? seller.suspendedUntil : until;
      await tx.sellers.update({ where: { id: seller.id }, data: { suspendedAt: new Date(), suspendedUntil: expiry, suspensionReason: input.reason } });
    }
    await tx.productReport.updateMany({ where: { productId: product.id, status: 'Pending' }, data: { status: 'Confirmed', resolutionReason: input.reason, resolvedBy: actorId, resolvedAt: new Date(), violationId: violation.id } });
    await tx.notifications.create({ data: { sellerId: seller.id, type: 'System', title: `Product violation: ${input.productAction}; seller ${input.sellerAction}`, message: `${product.title}: ${input.reason}. Severity: ${input.severity}. Confirmed violation #${occurrence}.`, redirectUrl: '/dashboard/violations' } });
    await audit(tx, actorId, 'violation.confirm', violation.id, input.reason, { productStatus: product.status }, { severity: input.severity, productAction: input.productAction, sellerAction: input.sellerAction, occurrence });
    return { violation: Object.fromEntries(Object.keys(violationFields).map(key => [key, (violation as any)[key]])) };
  });
}

/** Atomic, retryable outbox: notification/task/cursor commit together. Admin sees counts only. */
export async function processViolationFollowups() {
  return transaction(async tx => {
    const job = await tx.productViolation.findFirst({ where: { followupStatus: 'Queued' }, orderBy: { createdAt: 'asc' } });
    if (!job) return;
    await tx.productViolation.update({ where: { id: job.id, followupStatus: 'Queued', followupRevision: job.followupRevision }, data: { followupRevision: { increment: 1 } } });
    const orders = await tx.orders.findMany({ where: { shopId: job.shopId, createdAt: { lte: job.createdAt }, items: { some: { productId: job.productId } }, status: { in: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'] }, ...(job.followupCursor ? { id: { gt: job.followupCursor } } : {}) }, select: { id: true, userId: true, status: true }, orderBy: { id: 'asc' }, take: 100 });
    for (const order of orders) {
      await tx.moderationOrderTask.create({ data: { violationId: job.id, orderId: order.id, shopId: job.shopId, productTitle: job.productTitle, reason: job.reason } });
      if (['Pending', 'Confirmed', 'Processing'].includes(order.status)) await tx.orders.updateMany({ where: { id: order.id, status: { in: ['Pending', 'Confirmed', 'Processing'] } }, data: { moderationHold: true } });
      await tx.notifications.createMany({ data: [
        { sellerId: job.sellerId, orderId: order.id, type: 'System', title: 'Order requires product safety review', message: `${job.productTitle}: ${job.reason}. Review cancellation/refund or contact the buyer for delivered items.`, redirectUrl: '/dashboard/violations' },
        { userId: order.userId, orderId: order.id, type: 'System', title: 'Product notice for your purchase', message: `${job.productTitle} has been removed or hidden: ${job.reason}. Contact the shop for cancellation, return or refund support.`, redirectUrl: `/order/${order.id}` },
      ] });
    }
    await tx.productViolation.update({ where: { id: job.id }, data: { followupCursor: orders.at(-1)?.id ?? job.followupCursor, affectedOrders: { increment: orders.length }, followupStatus: orders.length === 100 ? 'Queued' : 'Complete' } });
    return orders.length;
  }, { timeout: 30000 });
}
