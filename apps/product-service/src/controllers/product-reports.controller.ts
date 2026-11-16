import prisma from '@packages/libs/prisma';
import { handle, objectId, pageArgs, textField } from '@packages/utils/api';
import { submitProductReport, violationFields } from '@packages/utils/product-moderation';
import { ForbiddenError, RateLimitError, ValidationError } from '@packages/error-handler';
import { transaction } from '@packages/utils/transaction';

export const reportProduct = handle(async (req, res) => {
  const productId = objectId(req.params.id), reason = textField(req.body.reason, 'report reason', 2000);
  const recent = await prisma.productReport.count({ where: { reporterId: req.user!.id, source: 'Customer', createdAt: { gte: new Date(Date.now() - 86400000) } } });
  if (recent >= 10) throw new RateLimitError('You can submit up to 10 product reports per day');
  const report = await submitProductReport(productId, req.user!.id, 'Customer', req.body.category, reason);
  res.status(201).json({ id: report.id, status: report.status, message: 'Your report has been received for review' });
});
export const sellerViolations = handle(async (req, res) => {
  if (!req.seller?.shop?.id) throw new ForbiddenError();
  const where = { sellerId: req.seller.id };
  const [rows, total] = await Promise.all([prisma.productViolation.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: 'desc' }, select: violationFields }), prisma.productViolation.count({ where })]);
  res.setHeader('Cache-Control', 'no-store'); res.json({ rows, total });
});
export const sellerModerationTasks = handle(async (req, res) => {
  if (!req.seller?.shop?.id) throw new ForbiddenError();
  const status = req.query.status ?? 'Pending';
  if (status !== 'Pending' && status !== 'Resolved') throw new ValidationError('Invalid task status');
  const where = { shopId: req.seller.shop.id, status };
  const [tasks, total] = await Promise.all([prisma.moderationOrderTask.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: 'asc' } }), prisma.moderationOrderTask.count({ where })]);
  const orders = await prisma.orders.findMany({ where: { id: { in: tasks.map(task => task.orderId) }, shopId: req.seller.shop.id }, select: { id: true, orderNumber: true, status: true, paymentStatus: true, stripePaymentId: true, moderationHold: true } });
  res.setHeader('Cache-Control', 'no-store'); res.json({ rows: tasks.map(task => ({ ...task, order: orders.find(order => order.id === task.orderId) })), total });
});
export const resolveModerationTask = handle(async (req, res) => {
  if (!req.seller?.shop?.id) throw new ForbiddenError();
  const id = objectId(req.params.id), resolution = textField(req.body.resolution, 'resolution', 2000);
  await transaction(async tx => {
    const task = await tx.moderationOrderTask.findFirst({ where: { id, shopId: req.seller!.shop!.id } });
    if (!task) throw new ForbiddenError();
    const order = await tx.orders.findFirst({ where: { id: task.orderId, shopId: task.shopId } });
    if (!order) throw new ValidationError('Order is unavailable');
    if (order.moderationHold && !['Cancelled', 'Returned', 'Refunded'].includes(order.status)) throw new ValidationError('Cancel the held order before completing its review');
    if (['Cancelled', 'Returned'].includes(order.status) && order.paymentStatus === 'Paid') throw new ValidationError('Complete the payment refund first');
    await tx.moderationOrderTask.update({ where: { id }, data: { status: 'Resolved', resolution, resolvedAt: new Date() } });
  });
  res.json({ success: true });
});

export const requestSellerUnsuspend = handle(async (req, res) => {
  if (!req.seller?.shop?.id) throw new ForbiddenError();
  const seller = await prisma.sellers.findUnique({ where: { id: req.seller.id } });
  if (!seller) throw new ForbiddenError();
  if (!seller.suspendedAt) throw new ValidationError('Your account is not suspended');
  // Removed restriction for temporary suspension
  const reason = textField(req.body.reason, 'reason', 2000);
  const existing = await prisma.sellerUnsuspendRequest.findFirst({ where: { sellerId: req.seller.id, status: 'Pending' } });
  // Make retries safe when the browser did not receive the response or its
  // status query failed. A pending request is already the desired outcome.
  if (existing) return res.status(200).json({ request: { id: existing.id, status: existing.status, createdAt: existing.createdAt } });
  const request = await prisma.sellerUnsuspendRequest.create({ data: { sellerId: req.seller.id, shopId: req.seller.shop.id, reason } });
  res.status(201).json({ request: { id: request.id, status: request.status, createdAt: request.createdAt } });
});

export const getSellerUnsuspendStatus = handle(async (req, res) => {
  if (!req.seller?.shop?.id) throw new ForbiddenError();
  const request = await prisma.sellerUnsuspendRequest.findFirst({ where: { sellerId: req.seller.id }, orderBy: { createdAt: 'desc' } });
  if (!request) return res.json({ request: null });
  res.json({ request: { id: request.id, status: request.status, reason: request.reason, adminReason: request.adminReason, createdAt: request.createdAt, reviewedAt: request.reviewedAt } });
});
