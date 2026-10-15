import { Prisma } from '@prisma/client';
import prisma from '@packages/libs/prisma';
import { handle, pageArgs, textField } from '@packages/utils/api';
import { csv } from '@packages/utils/reporting';
import { transaction } from '@packages/utils/transaction';
import { audit } from '@packages/utils/admin-audit';
import { adminRoles, canAdmin, isSuspended } from '@packages/utils/admin-access';
import { ForbiddenError, NotFoundError, ValidationError } from '@packages/error-handler';

export const accountFields = { id: true, name: true, email: true, role: true, adminRole: true, createdAt: true, avatar: true, suspendedAt: true, suspendedUntil: true, suspensionReason: true } as const;
const sellerFields = { id: true, name: true, email: true, phone_number: true, country: true, createdAt: true, suspendedAt: true, suspendedUntil: true, suspensionReason: true, shop: { select: { id: true, name: true, avatar: true, category: true, ratings: true } } } as const;
const searchText = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 200) : '';
const personSearch = (search: string) => search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] } : {};

async function exportRows(res: any, name: string, fetch: (cursor?: string) => Promise<any[]>, map: (row: any) => Record<string, unknown>) {
  res.attachment(`${name}.csv`).type('text/csv');
  let cursor: string | undefined; let first = true;
  do {
    const batch = await fetch(cursor);
    if (!batch.length || res.destroyed) break;
    const encoded = csv(batch.map(map));
    if (!res.write((first ? '\uFEFF' + encoded : encoded.slice(encoded.indexOf('\n') + 1)) + '\r\n')) {
      await new Promise<void>(resolve => { const done = () => { res.off('drain', done); res.off('close', done); resolve(); }; res.once('drain', done); res.once('close', done); });
    }
    first = false; cursor = batch.length === 500 ? batch[batch.length - 1].id : undefined;
  } while (cursor && !res.destroyed);
  if (!res.destroyed) res.end();
}
const batchArgs = (cursor?: string) => ({ take: 500, orderBy: { id: 'asc' as const }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
const pagination = (query: any, total: number) => { const { skip, take } = pageArgs(query); return { currentPage: skip / take + 1, totalPages: Math.max(1, Math.ceil(total / take)) }; };
function catalog(events: boolean) {
  return handle(async (req, res) => {
    const search = searchText(req.query.search);
    const where: Prisma.productsWhereInput = {
      ...(events ? { AND: [{ starting_date: { not: null } }, { ending_date: { not: null } }] } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { category: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    if (req.query.status) {
      if (!['Active', 'Inactive', 'Draft', 'Suspended'].includes(String(req.query.status))) throw new ValidationError('Invalid status');
      where.status = req.query.status as any;
    }
    const include = { images: true, shop: { select: { id: true, name: true, avatar: true } } };
    if (req.query.format === 'csv') return exportRows(res, events ? 'promotions' : 'products', cursor => prisma.products.findMany({ where, ...batchArgs(cursor), include }), p => ({ Title: p.title, Price: p.sale_price, Stock: p.stock, Category: p.category, Rating: p.rating, Shop: p.shop?.name, Status: p.status, Deleted: p.isDeleted, Start: p.starting_date?.toISOString(), End: p.ending_date?.toISOString() }));
    const [rows, total] = await Promise.all([prisma.products.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include }), prisma.products.count({ where })]);
    res.json({ success: true, [events ? 'events' : 'products']: rows, total, ...pagination(req.query, total) });
  });
}
export const getAllProducts = catalog(false);
export const getAllEvents = catalog(true);
export const getAllUsers = handle(async (req, res) => {
  const role = req.query.role ?? 'user';
  if (!['user', 'admin', 'all'].includes(String(role))) throw new ValidationError('Invalid role filter');
  const where: Prisma.usersWhereInput = { ...personSearch(searchText(req.query.search)), ...(role === 'all' ? { role: { in: ['user', 'admin'] } } : { role: String(role) }) };
  if (req.query.format === 'csv') return exportRows(res, 'users', cursor => prisma.users.findMany({ where, ...batchArgs(cursor), select: accountFields }), u => ({ Name: u.name, Email: u.email, Role: u.role, Joined: u.createdAt.toISOString(), Suspended: isSuspended(u) }));
  const [users, total] = await Promise.all([prisma.users.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: accountFields }), prisma.users.count({ where })]);
  res.json({ users, total, ...pagination(req.query, total) });
});
export const getAllSellers = handle(async (req, res) => {
  const where = personSearch(searchText(req.query.search));
  if (req.query.format === 'csv') return exportRows(res, 'sellers', cursor => prisma.sellers.findMany({ where, ...batchArgs(cursor), select: sellerFields }), s => ({ Name: s.name, Email: s.email, Phone: s.phone_number, Country: s.country, Shop: s.shop?.name, Rating: s.shop?.ratings, Joined: s.createdAt.toISOString(), Suspended: isSuspended(s) }));
  const [sellers, total] = await Promise.all([prisma.sellers.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: sellerFields }), prisma.sellers.count({ where })]);
  res.json({ sellers, total, ...pagination(req.query, total) });
});
export const getAllAdmin = handle(async (_req, res) => {
  res.json({ admins: await prisma.users.findMany({ where: { role: 'admin' }, select: accountFields, orderBy: { createdAt: 'asc' } }) });
});
export const addAdmin = handle(async (req, res) => {
  const email = textField(req.body.email, 'email', 254).toLowerCase();
  const role = req.body.role ?? 'admin'; const adminRole = req.body.adminRole ?? 'operations';
  const reason = textField(req.body.reason, 'reason', 1000);
  if (!['admin', 'user'].includes(role) || !adminRoles.includes(adminRole)) throw new ValidationError('Invalid administrator role');
  const user = await transaction(async tx => {
    await tx.adminGuard.upsert({ where: { id: 'owners' }, create: { id: 'owners', revision: 1 }, update: { revision: { increment: 1 } } });
    const actor = await tx.users.findUnique({ where: { id: req.user!.id } });
    if (!canAdmin(actor, 'team') || isSuspended(actor!)) throw new ForbiddenError();
    const current = await tx.users.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: accountFields });
    if (!current) throw new NotFoundError('User not found');
    if (current.id === req.user!.id) throw new ValidationError('Ask another owner to change your access');
    if (isSuspended(current) && role === 'admin') throw new ValidationError('Restore the account before granting access');
    const updated = await tx.users.update({ where: { id: current.id }, data: { role, adminRole: role === 'admin' ? adminRole : null }, select: accountFields });
    await audit(tx, req.user!.id, 'admin.role', current.id, reason, { role: current.role, adminRole: current.adminRole }, { role, adminRole: updated.adminRole });
    return updated;
  });
  res.json({ success: true, user });
});
export const getSiteConfig = handle(async (_req, res) => {
  const config = await prisma.site_config.findFirst();
  if (!config) throw new NotFoundError('Site config not found');
  res.json({ config });
});
export const updateSiteConfig = handle(async (req, res) => {
  const data: Prisma.site_configUpdateInput = {};
  for (const key of ['logo', 'banner'] as const) if (req.body[key] !== undefined) {
    const value = req.body[key];
    if (value !== '' && value !== null && (typeof value !== 'string' || value.length > 2000 || !/^https:\/\//.test(value))) throw new ValidationError('Use an uploaded image or HTTPS URL');
    data[key] = value || null;
  }
  if (req.body.categories !== undefined) {
    if (!Array.isArray(req.body.categories) || req.body.categories.length > 200) throw new ValidationError('Invalid categories');
    const categories = req.body.categories.map((v: unknown) => textField(v, 'category', 100));
    if (new Set(categories.map((v: string) => v.toLowerCase())).size !== categories.length) throw new ValidationError('Duplicate categories');
    data.categories = categories;
  }
  if (req.body.subCategories !== undefined) {
    const value = req.body.subCategories;
    if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 30000 || Object.values(value).some(v => !Array.isArray(v) || v.some(s => typeof s !== 'string' || !s.trim() || s.length > 100))) throw new ValidationError('Invalid subcategories');
    data.subCategories = value;
  }
  const config = await transaction(async tx => {
    const current = await tx.site_config.findFirst();
    if (!current) throw new NotFoundError();
    const categories = req.body.categories ?? current.categories;
    const subs = req.body.subCategories ?? current.subCategories;
    if (Object.keys(subs as object).some(key => !categories.includes(key))) throw new ValidationError('Subcategories must belong to an existing category');
    const removed = current.categories.filter(c => !categories.includes(c));
    if (removed.length && await tx.products.count({ where: { category: { in: removed }, isDeleted: false } })) throw new ValidationError('Move products before removing their category');
    const updated = await tx.site_config.update({ where: { id: current.id }, data });
    await audit(tx, req.user!.id, 'settings.site', current.id, 'Updated site configuration', current, updated);
    return updated;
  });
  res.json({ config });
});
