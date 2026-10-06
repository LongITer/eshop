import { Prisma, paymentStatus } from '@prisma/client';
import prisma from '@packages/libs/prisma';
import { ForbiddenError, ValidationError } from '@packages/error-handler';
import { handle, pageArgs } from '@packages/utils/api';

export const getSellerPayments = handle(async (req: any, res) => {
  const shopId = req.seller?.shop?.id;
  if (!shopId) throw new ForbiddenError('Create a shop to view payments');

  const where: Prisma.ordersWhereInput = { shopId };
  if (req.query.month) {
    const month = String(req.query.month);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1000) {
      throw new ValidationError('Choose a valid month');
    }
    const from = new Date(`${month}-01T00:00:00.000Z`);
    const to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);
    where.createdAt = { gte: from, lt: to };
  }
  if (req.query.status) {
    if (!Object.values(paymentStatus).includes(req.query.status)) throw new ValidationError('Invalid payment status');
    where.paymentStatus = req.query.status;
  }
  if (req.query.search) {
    if (typeof req.query.search !== 'string' || req.query.search.length > 100) throw new ValidationError('Search must be at most 100 characters');
    const contains = req.query.search.trim();
    where.OR = [
      { orderNumber: { contains, mode: 'insensitive' } },
      { stripePaymentId: { contains, mode: 'insensitive' } },
    ];
  }
  const { skip, take } = pageArgs(req.query);
  const [payments, total, groups] = await Promise.all([
    prisma.orders.findMany({
      where, skip, take, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, orderNumber: true, totalAmount: true, paymentStatus: true,
        paymentMethod: true, stripePaymentId: true, stripeRefundId: true,
        refundState: true, status: true, createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.orders.count({ where }),
    prisma.orders.groupBy({ by: ['paymentStatus'], where, _sum: { totalAmount: true }, _count: { _all: true } }),
  ]);
  const summary = Object.fromEntries(Object.values(paymentStatus).map(status => {
    const group = groups.find(item => item.paymentStatus === status);
    return [status, { amount: group?._sum.totalAmount ?? 0, count: group?._count._all ?? 0 }];
  }));
  res.json({ payments, summary, total, page: skip / take + 1, pageSize: take, totalPages: Math.ceil(total / take) });
});
