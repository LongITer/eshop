import { Prisma } from '@prisma/client';
import prisma from '@packages/libs/prisma';
import { handle, objectId, pageArgs, textField } from '@packages/utils/api';
import { adminDateRange } from '../lib/reporting';
import { transaction } from '@packages/utils/transaction';
import { audit } from '@packages/utils/admin-audit';
import { canAdmin } from '@packages/utils/admin-access';
import { NotFoundError, ValidationError, ForbiddenError } from '@packages/error-handler';
import { imageKit } from '@packages/libs/imagekit';

export const suspendAccount = handle(async (req, res) => {
  const id = objectId(req.params.id); const seller = req.params.kind === 'sellers';
  if (!['users', 'sellers'].includes(req.params.kind) || typeof req.body.suspended !== 'boolean') throw new ValidationError('Invalid account action');
  const reason = textField(req.body.reason, 'reason', 1000);
  const until = req.body.until ? new Date(req.body.until) : null;
  if (until && (!Number.isFinite(until.getTime()) || until.getTime() <= Date.now())) throw new ValidationError('Choose a future expiry');
  await transaction(async tx => {
    const current = seller ? await tx.sellers.findUnique({ where: { id } }) : await tx.users.findUnique({ where: { id } });
    if (!current) throw new NotFoundError();
    if (id === req.user!.id || ('role' in current && current.role === 'admin')) throw new ValidationError('Revoke administrator access through team management first');
    const data = { suspendedAt: req.body.suspended ? new Date() : null, suspendedUntil: req.body.suspended ? until : null, suspensionReason: req.body.suspended ? reason : null };
    if (seller) await tx.sellers.update({ where: { id }, data }); else await tx.users.update({ where: { id }, data });
    await audit(tx, req.user!.id, `${req.params.kind}.${req.body.suspended ? 'suspend' : 'restore'}`, id, reason, { suspendedAt: current.suspendedAt, suspendedUntil: current.suspendedUntil }, data);
    await tx.notifications.create({ data: { ...(seller ? { sellerId: id } : { userId: id }), type: 'System', title: req.body.suspended ? 'Account suspended' : 'Account restored', message: reason } });
  });
  res.json({ success: true });
});
export const moderateProduct = handle(async (req, res) => {
  const id = objectId(req.params.id); const reason = textField(req.body.reason, 'reason', 1000);
  if (typeof req.body.hidden !== 'boolean') throw new ValidationError('Choose hide or restore');
  if (req.body.hidden) throw new ValidationError('Report and review this product through the violations workflow');
  const product = await transaction(async tx => {
    const current = await tx.products.findUnique({ where: { id }, include: { shop: { select: { sellerId: true } } } });
    if (!current) throw new NotFoundError();
    if (!req.body.hidden && current.status !== 'Suspended') throw new ValidationError('Product is not suspended');
    // Restoring returns a product to Inactive; its seller decides when to publish again.
    const status = req.body.hidden ? 'Suspended' : 'Inactive';
    const updated = await tx.products.update({ where: { id, status: current.status }, data: { status, moderationReason: reason, isDeleted: false, deleteAt: null } });
    await audit(tx, req.user!.id, 'product.moderation', id, reason, { status: current.status }, { status });
    await tx.notifications.create({ data: { sellerId: current.shop.sellerId, type: 'System', title: req.body.hidden ? 'Product hidden by administrator' : 'Product restored for editing', message: `${current.title}: ${reason}`, redirectUrl: '/dashboard/all-products' } });
    return updated;
  });
  res.json({ product });
});
export const auditLog = handle(async (req, res) => {
  const where: Prisma.adminAuditWhereInput = { createdAt: adminDateRange(req.query, 90), AND: [{ OR: ['product.', 'violation.', 'report.', 'sellers.', 'users.', 'admin.', 'notification.', 'template.', 'site.'].map(prefix => ({ action: { startsWith: prefix } })) }], ...(req.query.targetId ? { targetId: String(req.query.targetId) } : {}), ...(req.query.action ? { action: String(req.query.action) } : {}) };
  const [rows, total] = await Promise.all([prisma.adminAudit.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }), prisma.adminAudit.count({ where })]);
  const actors = await prisma.users.findMany({ where: { id: { in: [...new Set(rows.map(r => r.actorId))] } }, select: { id: true, name: true, email: true } });
  res.json({ rows: rows.map(row => ({ ...row, actor: actors.find(a => a.id === row.actorId) })), total });
});
export const returns = handle(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  if (status && !['Requested', 'Approved', 'Rejected', 'Received', 'Escalated'].includes(status)) throw new ValidationError('Invalid return status');
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([prisma.returnRequest.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }), prisma.returnRequest.count({ where })]);
  const orders = await prisma.orders.findMany({ where: { id: { in: rows.map(r => r.orderId) } }, include: { user: { select: { name: true, email: true } }, shop: { select: { name: true } }, items: true } });
  res.json({ rows: rows.map(r => ({ ...r, order: orders.find(o => o.id === r.orderId) })), total });
});
export const reviewReturn = handle(async (req, res) => {
  const orderId = objectId(req.params.orderId); const status = req.body.status; const reason = textField(req.body.reason, 'reason', 2000);
  if (!['Approved', 'Rejected', 'Received'].includes(status)) throw new ValidationError('Invalid return decision');
  const request = await transaction(async tx => {
    const current = await tx.returnRequest.findUnique({ where: { orderId } });
    const order = await tx.orders.findUnique({ where: { id: orderId } });
    if (!current || !order) throw new NotFoundError();
    const allowed: Record<string, string[]> = { Escalated: ['Approved', 'Rejected'], Requested: ['Approved', 'Rejected'], Rejected: ['Approved'], Approved: ['Received'] };
    if (!allowed[current.status]?.includes(status) || order.status !== 'Delivered' || order.paymentStatus !== 'Paid') throw new ValidationError('This return can no longer receive that decision');
    await tx.orders.update({ where: { id: orderId, status: 'Delivered' }, data: { ...(status === 'Received' ? { status: 'Returned' } : {}), updatedAt: new Date() } });
    const updated = await tx.returnRequest.update({ where: { id: current.id, status: current.status }, data: { status, sellerNote: `Admin: ${reason}` } });
    await tx.orderEvent.create({ data: { orderId, actorId: req.user!.id, from: `Return:${current.status}`, to: `Return:${status}`, reason } });
    await audit(tx, req.user!.id, 'return.review', orderId, reason, { status: current.status }, { status });
    const shop = await tx.shops.findUniqueOrThrow({ where: { id: order.shopId } });
    await tx.notifications.createMany({ data: [{ userId: order.userId, orderId, type: 'System', title: `Return ${status}`, message: reason, redirectUrl: `/order/${orderId}` }, { sellerId: shop.sellerId, orderId, type: 'System', title: `Administrator reviewed return: ${status}`, message: reason, redirectUrl: `/dashboard/orders/${orderId}` }] });
    return updated;
  });
  res.json({ request });
});
export const workQueue = handle(async (req, res) => {
  const [overdue, refunds, returnCount] = await Promise.all([
    canAdmin(req.user, 'orders') ? prisma.orders.count({ where: { status: { in: ['Pending', 'Confirmed', 'Processing'] }, createdAt: { lt: new Date(Date.now() - 48 * 3600000) } } }) : 0,
    canAdmin(req.user, 'payments') ? prisma.orders.count({ where: { status: { in: ['Cancelled', 'Returned'] }, paymentStatus: 'Paid' } }) : 0,
    canAdmin(req.user, 'returns') ? prisma.returnRequest.count({ where: { status: { in: ['Requested', 'Approved', 'Escalated'] } } }) : 0,
  ]);
  res.json({ overdue, refunds, returns: returnCount });
});
export const lookup = handle(async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100).trim() : '';
  const contains = { contains: search, mode: 'insensitive' as const };
  const kind = String(req.query.kind);
  if (kind === 'products') {
    if (!canAdmin(req.user, 'catalog')) throw new ForbiddenError();
    const rows = await prisma.products.findMany({ where: req.query.id ? { id: objectId(req.query.id) } : { title: contains }, take: 20, select: { id: true, title: true, shop: { select: { name: true } } } });
    res.json({ rows: rows.map(row => ({ id: row.id, name: `${row.title} · ${row.shop.name}` })) });
  } else if (kind === 'shops') {
    if (!['overview', 'catalog'].some(p => canAdmin(req.user, p as any))) throw new ForbiddenError();
    res.json({ rows: await prisma.shops.findMany({ where: { name: contains }, take: 20, select: { id: true, name: true } }) });
  } else {
    if (!canAdmin(req.user, 'notifications')) throw new ForbiddenError();
    const where = { OR: [{ name: contains }, { email: contains }] };
    const rows = kind === 'sellers' ? await prisma.sellers.findMany({ where, take: 20, select: { id: true, name: true, email: true } }) : await prisma.users.findMany({ where: { ...where, role: 'user' }, take: 20, select: { id: true, name: true, email: true } });
    res.json({ rows });
  }
});
export const uploadImage = handle(async (req, res) => {
  const file = req.body.file;
  if (typeof file !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(file)) throw new ValidationError('Choose a PNG, JPG or WebP image');
  const bytes = Buffer.from(file.slice(file.indexOf(',') + 1), 'base64');
  if (bytes.length > 5 * 1024 * 1024 || bytes.length < 12) throw new ValidationError('Image must be at most 5 MB');
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !jpg && !webp) throw new ValidationError('Invalid image contents');
  const result = await imageKit.upload({ file, fileName: `site-${Date.now()}.${png ? 'png' : jpg ? 'jpg' : 'webp'}`, folder: '/site' });
  res.json({ url: result.url });
});
