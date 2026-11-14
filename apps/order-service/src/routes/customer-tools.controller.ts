import prisma from '@packages/libs/prisma';
import { handle, objectId, pageArgs } from '@packages/utils/api';
import { ValidationError, NotFoundError } from '@packages/error-handler';
import { isSuspended } from '@packages/utils/admin-access';
import { shippingQuote } from './checkout-quote';
import { cartLineKey } from '@packages/utils/cart';

export const inspectCart = handle(async (req, res) => {
  const cart = req.body.cart;
  if (!Array.isArray(cart) || cart.length > 100) throw new ValidationError('Cart has too many items');
  for (const line of cart) { if(!line || typeof line !== 'object') throw new ValidationError('Invalid item'); objectId(line.id); if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000) throw new ValidationError('Invalid quantity'); if (line.variantId) objectId(line.variantId); }
  const products = await prisma.products.findMany({ where: { id: { in: cart.map(p => p.id) }, status: 'Active', isDeleted: false }, include: { images: true, variants: true, shop: { select: { name: true, sellers: { select: { suspendedAt: true, suspendedUntil: true } } } } } });
  const totals = new Map<string,number>(); cart.forEach(p => totals.set(p.id, (totals.get(p.id) || 0) + p.quantity));
  const keys = new Set<string>();
  const rows = cart.map(line => {
    const key = cartLineKey(line); if (keys.has(key)) throw new ValidationError('Duplicate cart line'); keys.add(key);
    const p = products.find(p => p.id === line.id);
    const unavailable = { key, id: line.id, available: false, reason: 'Sản phẩm hoặc biến thể không còn bán', maxQuantity: 0 };
    if (!p || isSuspended(p.shop.sellers)) return unavailable;
    const options = line.selectedOptions || {};
    const variant = p.variants.find(v => line.variantId ? v.id === line.variantId : v.color === (options.color || '') && v.size === (options.size || ''));
    if ((p.variants.length && (!variant || !variant.active)) || (!p.variants.length && line.variantId)) return unavailable;
    if (!p.variants.length && ((p.colors.length && !p.colors.includes(options.color)) || (p.sizes.length && !p.sizes.includes(options.size)) || (options.color && !p.colors.includes(options.color)) || (options.size && !p.sizes.includes(options.size)))) return unavailable;
    const maxQuantity = Math.max(0, Math.min(variant?.stock ?? p.stock, p.stock - ((totals.get(p.id) || 0) - line.quantity)));
    return { key, id: p.id, title: p.title, slug: p.slug, shopId: p.shopId, shopName: p.shop.name, images: p.images.map(i => ({ url: i.url })), sale_price: variant?.price ?? p.sale_price, variantId: variant?.id ?? null, selectedOptions: variant ? { color: variant.color, size: variant.size } : options, stock: maxQuantity, maxQuantity, available: maxQuantity >= line.quantity, reason: maxQuantity < line.quantity ? `Chỉ còn tối đa ${maxQuantity} sản phẩm cho lựa chọn này` : null };
  });
  res.json({ rows, shippingByShop: shippingQuote([...new Set(rows.flatMap(r => 'shopId' in r ? [r.shopId] : []))]) });
});

export const orderStats = handle(async (req, res) => {
  const rows = await prisma.orders.groupBy({ by: ['status'], where: { userId: req.user!.id }, _count: { _all: true } });
  res.json({ total: rows.reduce((n,r) => n+r._count._all,0), processing: rows.filter(r => ['Pending','Confirmed','Processing','Shipped'].includes(r.status)).reduce((n,r) => n+r._count._all,0), completed: rows.find(r => r.status === 'Delivered')?._count._all ?? 0 });
});
export const customerOrders = handle(async (req,res) => {
  const where: any = { userId: req.user!.id };
  if (req.query.status) { if (!['Pending','Confirmed','Processing','Shipped','Delivered','Cancelled','Returned','Refunded'].includes(String(req.query.status))) throw new ValidationError('Invalid status'); where.status = req.query.status; }
  if (req.query.q) where.orderNumber = { contains: String(req.query.q).slice(0,100), mode: 'insensitive' };
  if (req.query.from || req.query.to) {
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00+07:00`) : new Date(0), to = req.query.to ? new Date(`${req.query.to}T23:59:59.999+07:00`) : new Date();
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to) throw new ValidationError('Invalid dates'); where.createdAt = { gte:from,lte:to };
  }
  const { skip,take } = pageArgs(req.query);
  const [orders,total] = await Promise.all([prisma.orders.findMany({ where, skip,take,orderBy:[{createdAt:'desc'},{id:'desc'}],include:{shop:{select:{id:true,name:true}},items:true} }),prisma.orders.count({where})]);
  res.json({orders,total,page:skip/take+1,totalPages:Math.max(1,Math.ceil(total/take))});
});
export const reorder = handle(async (req,res) => {
  const order = await prisma.orders.findFirst({ where: { id: objectId(req.params.orderId), userId: req.user!.id }, include: { items:true } });
  if (!order) throw new NotFoundError();
  res.json({ cart: order.items.map(i => ({ id:i.productId, title:i.title, price:i.unitPrice, sale_price:i.unitPrice, quantity:i.quantity, variantId:i.variantId, selectedOptions:{ color:i.color || '',size:i.size || '' }, image:i.image })) });
});
