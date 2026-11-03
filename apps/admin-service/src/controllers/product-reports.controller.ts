import prisma from '@packages/libs/prisma';
import { handle, objectId, pageArgs, textField } from '@packages/utils/api';
import { decideProductReport, submitProductReport, listingSnapshot, reportFields, violationFields } from '@packages/utils/product-moderation';
import { scanProductListing } from '@packages/utils/product-moderation-ai';
import { NotFoundError, ValidationError } from '@packages/error-handler';

export const reports = handle(async (req, res) => {
  const status = req.query.status ?? 'Pending';
  if (!['Pending', 'Confirmed', 'Dismissed'].includes(status as string)) throw new ValidationError('Invalid report status');
  const where = { status: status as string, ...(req.query.productId ? { productId: objectId(req.query.productId) } : {}) };
  const [rows, total] = await Promise.all([prisma.productReport.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: 'asc' }, select: reportFields }), prisma.productReport.count({ where })]);
  res.setHeader('Cache-Control', 'no-store'); res.json({ rows, total });
});
export const adminReport = handle(async (req, res) => {
  const report = await submitProductReport(objectId(req.body.productId), req.user!.id, 'Admin', req.body.category, textField(req.body.reason, 'reason', 2000));
  res.status(201).json({ report });
});
export const scanListing = handle(async (req, res) => {
  const id = objectId(req.params.id);
  const product = await prisma.products.findUnique({ where: { id } });
  if (!product) throw new NotFoundError();
  const snapshot = listingSnapshot(product);
  const result = await scanProductListing(snapshot);
  if (!result.flagged) { res.json({ flagged: false, reason: result.reason }); return; }
  const report = await submitProductReport(id, req.user!.id, 'AI', result.category, result.reason, snapshot);
  res.json({ flagged: true, report });
});
export const reviewReport = handle(async (req, res) => {
  const result = await decideProductReport(objectId(req.params.id), req.user!.id, { ...req.body, reason: textField(req.body.reason, 'decision reason', 2000) });
  res.json(result);
});
export const violations = handle(async (req, res) => {
  const where = { ...(req.query.sellerId ? { sellerId: objectId(req.query.sellerId) } : {}), ...(req.query.shopId ? { shopId: objectId(req.query.shopId) } : {}), ...(req.query.productId ? { productId: objectId(req.query.productId) } : {}) };
  const [rows, total] = await Promise.all([prisma.productViolation.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: 'desc' }, select: violationFields }), prisma.productViolation.count({ where })]);
  res.setHeader('Cache-Control', 'no-store'); res.json({ rows, total });
});
