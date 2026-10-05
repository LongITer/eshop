import prisma from '@packages/libs/prisma';
import { handle } from '@packages/utils/api';
import { dateRange, bucket, csv } from '@packages/utils/reporting';
import { NotFoundError } from '@packages/error-handler';
export const revenueReport = handle(async (req: any, res) => {
  const shopId = req.seller.shop?.id;
  if (!shopId) throw new NotFoundError();
  const createdAt = dateRange(req.query, 90);
  const interval = ['day', 'week', 'month'].includes(req.query.interval) ? req.query.interval : 'day';
  const orders = await prisma.orders.findMany({ where: { shopId, createdAt, paymentStatus: 'Paid', status: { notIn: ['Cancelled', 'Returned', 'Refunded'] } }, include: { items: true } });
  const timeline: Record<string, { date: string; revenue: number; orders: number; discount: number }> = {};
  const products: Record<string, { id: string; title: string; quantity: number; revenue: number }> = {};
  const coupons: Record<string, { id: string; uses: number; discount: number }> = {};
  for (let day = new Date(createdAt.gte); day <= createdAt.lte; day.setUTCDate(day.getUTCDate() + 1)) { const date = bucket(day, interval); timeline[date] ??= { date, revenue: 0, orders: 0, discount: 0 }; }
  for (const order of orders) {
    const date = bucket(order.createdAt, interval); const row = timeline[date] ??= { date, revenue: 0, orders: 0, discount: 0 };
    row.revenue += order.totalAmount; row.orders++; row.discount += order.discount;
    order.items.forEach(item => { const product = products[item.productId] ??= { id: item.productId, title: item.title, quantity: 0, revenue: 0 }; product.quantity += item.quantity; product.revenue += item.totalPrice; });
    if (order.discountCodeId) { const coupon = coupons[order.discountCodeId] ??= { id: order.discountCodeId, uses: 0, discount: 0 }; coupon.uses++; coupon.discount += order.discount; }
  }
  const codes = await prisma.discountCodes.findMany({ where: { id: { in: Object.keys(coupons) }, sellerId: req.seller.id } });
  const report = { timeline: Object.values(timeline).sort((a, b) => a.date.localeCompare(b.date)), topProducts: Object.values(products).sort((a, b) => b.quantity - a.quantity).slice(0, 20), coupons: Object.values(coupons).map(c => ({ ...c, code: codes.find(code => code.id === c.id)?.discountCode ?? c.id })), totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0), totalOrders: orders.length };
  if (req.query.format === 'csv') { res.attachment('seller-revenue.csv').type('text/csv').send(csv(report.timeline)); return; }
  res.json(report);
});
