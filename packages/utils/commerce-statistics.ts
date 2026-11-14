/** Buyer spending includes shipping/discounts; product sales are gross line totals. */
export type StatisticsKind = 'customers' | 'products';
export type StatisticsRow = {
  id: string; name: string; email?: string; shopName?: string; stock?: number;
  orders: number; units: number; distinctCount: number; amount: number;
  average: number; lastPurchasedAt: string;
};
export type StatisticsReport = {
  kind: StatisticsKind; currency: 'usd'; asOf: string;
  summary: { orders: number; units: number; customers: number; products: number; totalSpent: number; productSales: number; averageOrderValue: number };
  rows: StatisticsRow[];
  pagination: { page: number; total: number; totalPages: number };
};

type Purchase = {
  id: string; userId: string; totalAmount: number; createdAt: Date;
  user: { name: string; email: string } | null;
  items: { productId: string; title: string; quantity: number; totalPrice: number }[];
};
type Entry = { id: string; name: string; email?: string; orders: number; units: number; distinct: Set<string>; cents: number; lastPurchasedAt: string };

export function purchaseStatistics() {
  const customers = new Map<string, Entry>();
  const products = new Map<string, Entry>();
  let orders = 0, units = 0, spentCents = 0, salesCents = 0;
  const entry = (map: Map<string, Entry>, id: string, name: string, date: string) => {
    let row = map.get(id);
    if (!row) { row = { id, name, orders: 0, units: 0, distinct: new Set(), cents: 0, lastPurchasedAt: date }; map.set(id, row); }
    if (date > row.lastPurchasedAt) row.lastPurchasedAt = date;
    return row;
  };
  return {
    add(order: Purchase) {
      const date = order.createdAt.toISOString();
      const buyer = entry(customers, order.userId, order.user?.name || 'Deleted customer', date);
      buyer.email = order.user?.email;
      buyer.orders++;
      buyer.cents += Math.round(order.totalAmount * 100);
      orders++; spentCents += Math.round(order.totalAmount * 100);
      const seenProducts = new Set<string>();
      for (const item of order.items) {
        const row = entry(products, item.productId, item.title, date);
        if (!seenProducts.has(item.productId)) { row.orders++; seenProducts.add(item.productId); }
        row.distinct.add(order.userId);
        row.units += item.quantity; row.cents += Math.round(item.totalPrice * 100);
        buyer.distinct.add(item.productId); buyer.units += item.quantity;
        units += item.quantity; salesCents += Math.round(item.totalPrice * 100);
      }
    },
    result(kind: StatisticsKind) {
      const rows: StatisticsRow[] = [...(kind === 'customers' ? customers : products).values()].map(row => ({
        id: row.id, name: row.name, ...(row.email ? { email: row.email } : {}),
        orders: row.orders, units: row.units, distinctCount: row.distinct.size,
        amount: row.cents / 100,
        average: Math.round(row.cents / (kind === 'customers' ? row.orders : row.units || 1)) / 100,
        lastPurchasedAt: row.lastPurchasedAt,
      }));
      return { rows, summary: { orders, units, customers: customers.size, products: products.size, totalSpent: spentCents / 100, productSales: salesCents / 100, averageOrderValue: orders ? Math.round(spentCents / orders) / 100 : 0 } };
    },
  };
}
