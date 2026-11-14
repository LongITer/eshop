import { ANALYTICS_TIMEZONE, AnalyticsInterval } from './commerce-analytics';

type Stage = Record<string, any>;
const cents = (field: string) => ({ $toLong: { $round: [{ $multiply: [{ $ifNull: [field, 0] }, 100] }, 0] } });
const retained = { $and: [{ $eq: ['$paymentStatus', 'Paid'] }, { $not: [{ $in: ['$status', ['Cancelled', 'Returned', 'Refunded']] }] }] };
const sumIf = (field: unknown, condition: unknown = '$retained') => ({ $sum: { $cond: [condition, field, 0] } });
const dateString = (date: unknown, interval: AnalyticsInterval) => ({ $dateToString: { date: interval === 'week' ? { $dateTrunc: { date, unit: 'week', startOfWeek: 'Monday', timezone: ANALYTICS_TIMEZONE } } : date, format: interval === 'month' ? '%Y-%m' : '%Y-%m-%d', timezone: ANALYTICS_TIMEZONE } });

export function analyticsBasePipeline(range: { from: string | null; to: string }, shopId?: string): Stage[] {
  return [
    { $match: { currency: 'usd', createdAt: { ...(range.from ? { $gte: { $date: range.from } } : {}), $lte: { $date: range.to } }, ...(shopId ? { shopId: { $oid: shopId } } : {}) } },
    { $lookup: { from: 'orderItems', let: { orderId: '$_id' }, pipeline: [
      { $match: { $expr: { $eq: ['$orderId', '$$orderId'] } } }, { $sort: { _id: 1 } },
      { $project: { productId: 1, variantId: 1, sku: 1, title: 1, color: 1, size: 1, quantity: 1, totalPrice: 1 } },
      { $set: { grossCents: cents('$totalPrice') } },
    ], as: 'lines' } },
    { $set: { retained, totalCents: cents('$totalAmount'), discountCents: cents('$discount'), shippingCents: cents('$shippingFee'), grossCents: { $sum: '$lines.grossCents' }, units: { $sum: '$lines.quantity' } } },
    // Cumulative allocation conserves the exact discount cent across lines/SKUs.
    { $set: { allocated: { $reduce: { input: '$lines', initialValue: { gross: 0, discount: 0, lines: [] }, in: {
      $let: { vars: { nextGross: { $add: ['$$value.gross', '$$this.grossCents'] } }, in: {
        $let: { vars: { nextDiscount: { $cond: [{ $gt: ['$grossCents', 0] }, { $toLong: { $round: [{ $divide: [{ $multiply: ['$$nextGross', '$discountCents'] }, '$grossCents'] }, 0] } }, 0] } }, in: {
          gross: '$$nextGross', discount: '$$nextDiscount', lines: { $concatArrays: ['$$value.lines', [{ $mergeObjects: ['$$this', { discountCents: { $subtract: ['$$nextDiscount', '$$value.discount'] }, netCents: { $subtract: ['$$this.grossCents', { $subtract: ['$$nextDiscount', '$$value.discount'] }] } }] }]] },
        } },
      } },
    } } } } },
    { $set: { lines: '$allocated.lines', netCents: { $subtract: ['$grossCents', '$discountCents'] } } },
  ];
}

const productGroup = { _id: { product: '$lines.productId', shop: '$shopId' }, name: { $first: '$lines.title' }, units: sumIf('$lines.quantity'), grossCents: sumIf('$lines.grossCents'), discountCents: sumIf('$lines.discountCents'), netCents: sumIf('$lines.netCents'),
  lastSaleAt: { $max: { $cond: ['$retained', '$createdAt', null] } },
  cancelledUnits: sumIf('$lines.quantity', { $eq: ['$status', 'Cancelled'] }), returnedUnits: sumIf('$lines.quantity', { $eq: ['$status', 'Returned'] }), refundedUnits: sumIf('$lines.quantity', { $or: [{ $eq: ['$status', 'Refunded'] }, { $eq: ['$paymentStatus', 'Refunded'] }] }) };

export function analyticsPipeline(range: { from: string | null; to: string; interval: AnalyticsInterval }, shopId: string | undefined, seller: boolean): Stage[] {
  return [...analyticsBasePipeline(range, shopId), { $facet: {
    totals: [{ $group: { _id: null, grossCents: sumIf('$grossCents'), discountCents: sumIf('$discountCents'), netCents: sumIf('$netCents'), shippingCents: sumIf('$shippingCents'), paidCents: sumIf('$totalCents'), units: sumIf('$units'), firstActivity: { $min: '$createdAt' },
      refundedCents: sumIf('$totalCents', { $eq: ['$paymentStatus', 'Refunded'] }), awaitingCents: sumIf('$totalCents', { $and: [{ $eq: ['$paymentStatus', 'Paid'] }, { $in: ['$status', ['Cancelled', 'Returned']] }] }),
      feesCents: sumIf({ $ifNull: ['$platformFeeCents', 0] }), feeKnown: sumIf(1, { $and: ['$retained', { $ne: [{ $ifNull: ['$platformFeeCents', null] }, null] }] }), retainedCount: sumIf(1),
      unallocatedCents: sumIf({ $subtract: ['$discountCents', '$allocated.discount'] }),
    } }, { $project: { _id: 0 } }],
    products: [{ $unwind: '$lines' }, { $group: productGroup }, { $project: { _id: 0, id: { $toString: '$_id.product' }, shopId: { $toString: '$_id.shop' }, name: 1, units: 1, grossCents: 1, discountCents: 1, netCents: 1, cancelledUnits: 1, returnedUnits: 1, refundedUnits: 1, lastSaleAt: { $cond: ['$lastSaleAt', { $dateToString: { date: '$lastSaleAt', format: '%Y-%m-%dT%H:%M:%S.%LZ', timezone: 'UTC' } }, null] } } }],
    timeline: [{ $group: { _id: dateString('$createdAt', range.interval), grossCents: sumIf('$grossCents'), discountCents: sumIf('$discountCents'), netCents: sumIf('$netCents'), units: sumIf('$units'), refundedCents: sumIf('$totalCents', { $eq: ['$paymentStatus', 'Refunded'] }) } }, { $project: { _id: 0, date: '$_id', grossCents: 1, discountCents: 1, netCents: 1, units: 1, refundedCents: 1 } }, { $sort: { date: 1 } }],
    outcomes: [{ $unwind: '$lines' }, { $group: { _id: '$status', units: { $sum: '$lines.quantity' }, grossCents: { $sum: '$lines.grossCents' }, netCents: { $sum: '$lines.netCents' } } }, { $project: { _id: 0, status: '$_id', units: 1, grossCents: 1, netCents: 1 } }],
    demand: [{ $match: { retained: true } }, { $group: { _id: { weekday: { $dayOfWeek: { date: '$createdAt', timezone: ANALYTICS_TIMEZONE } }, hour: { $hour: { date: '$createdAt', timezone: ANALYTICS_TIMEZONE } } }, units: { $sum: '$units' }, netCents: { $sum: '$netCents' } } }, { $project: { _id: 0, weekday: { $mod: [{ $add: ['$_id.weekday', 5] }, 7] }, hour: '$_id.hour', units: 1, netCents: 1 } }],
    ...(seller ? {
      customers: [{ $match: { retained: true } }, { $group: { _id: '$userId', purchases: { $sum: 1 } } }, { $group: { _id: null, customers: { $sum: 1 }, repeatCustomers: { $sum: { $cond: [{ $gte: ['$purchases', 2] }, 1, 0] } } } }, { $project: { _id: 0 } }],
      payments: [{ $group: { _id: '$paymentStatus', count: { $sum: 1 }, cents: { $sum: '$totalCents' } } }, { $project: { _id: 0, status: '$_id', count: 1, cents: 1 } }],
      statuses: [{ $group: { _id: '$status', count: { $sum: 1 } } }, { $project: { _id: 0, status: '$_id', count: 1 } }],
    } : {}),
  } }];
}

export function productDetailPipeline(range: { from: string | null; to: string; interval: AnalyticsInterval }, productId: string, shopId?: string): Stage[] {
  return [...analyticsBasePipeline(range, shopId), { $unwind: '$lines' }, { $match: { 'lines.productId': { $oid: productId }, retained: true } }, { $facet: {
    variants: [{ $group: { _id: { $ifNull: [{ $toString: '$lines.variantId' }, 'base'] }, sku: { $first: '$lines.sku' }, color: { $first: '$lines.color' }, size: { $first: '$lines.size' }, units: { $sum: '$lines.quantity' }, grossCents: { $sum: '$lines.grossCents' }, discountCents: { $sum: '$lines.discountCents' }, netCents: { $sum: '$lines.netCents' } } }, { $project: { _id: 0, id: '$_id', sku: 1, color: 1, size: 1, units: 1, grossCents: 1, discountCents: 1, netCents: 1 } }],
    timeline: [{ $group: { _id: dateString('$createdAt', range.interval), units: { $sum: '$lines.quantity' }, grossCents: { $sum: '$lines.grossCents' }, discountCents: { $sum: '$lines.discountCents' }, netCents: { $sum: '$lines.netCents' } } }, { $project: { _id: 0, date: '$_id', units: 1, grossCents: 1, discountCents: 1, netCents: 1 } }, { $sort: { date: 1 } }],
  } }];
}
