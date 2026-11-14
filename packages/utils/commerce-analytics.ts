export type AnalyticsInterval = 'day' | 'week' | 'month';
export type AnalyticsPreset = '7d' | '30d' | '90d' | 'month' | 'year' | 'all' | 'custom';
export type AnalyticsView = 'products' | 'inventory' | 'shops' | 'categories' | 'timeline' | 'outcomes' | 'demand' | 'summary';
export type AnalyticsPeriod = {
  preset: AnalyticsPreset; from: string | null; to: string; interval: AnalyticsInterval; days: number;
  previous: { from: string; to: string } | null;
};
export type SalesMetrics = {
  grossSales: number; discounts: number; netSales: number; shipping: number; paidAmount: number;
  refundedAmount: number; awaitingRefundAmount: number; platformFees: number; feeCoveragePercent: number;
  units: number; productsSold: number; averageUnitPrice: number; reconciliationDifference: number; unallocatedDiscount: number;
};
export type SalesPoint = { date: string; grossSales: number; discounts: number; netSales: number; units: number; refundedAmount: number };
export type SalesOutcome = { status: string; units: number; grossSales: number; netSales: number; count?: number };
export type ProductPerformance = {
  id: string; shopId: string; name: string; shopName: string; category: string; brand: string;
  status: string; archived: boolean; shopSuspended: boolean; units: number; grossSales: number; discounts: number;
  netSales: number; previousNetSales: number; changePercent: number | null; sharePercent: number; averageUnitPrice: number;
  stock: number | null; availableStock: number; stockValue: number; coverageDays: number | null;
  lastSaleAt: string | null; cancelledUnits: number; returnedUnits: number; refundedUnits: number;
};
export type InventoryMetrics = {
  products: number; activeProducts: number; availableUnits: number; recordedUnits: number; retailValue: number;
  lowStock: number; outOfStock: number; noSales: number; activeSkus: number; lowStockSkus: number;
  outOfStockSkus: number; inconsistentStock: number;
};
export type PerformanceGroup = { id: string; name: string; units: number; netSales: number; grossSales: number; products: number; availableStock: number; sharePercent: number };
export type MetricChange = { current: number; previous: number; difference: number; percent: number | null };
export type AnalyticsReport = {
  audience: 'seller' | 'admin'; currency: 'usd'; generatedAt: string; period: AnalyticsPeriod;
  summary: SalesMetrics; comparison: Record<string, MetricChange> | null; inventory: InventoryMetrics;
  timeline: SalesPoint[]; categories: PerformanceGroup[]; shops?: PerformanceGroup[]; outcomes: SalesOutcome[];
  demand: { weekday: number; hour: number; units: number; netSales: number }[];
  seller?: { orders: number; customers: number; repeatCustomers: number; repeatRate: number; averageOrderValue: number; payments: { status: string; count: number; amount: number }[] };
  governance: { pendingReports: number; violations: number; bySeverity: { severity: string; count: number }[] };
  products: { rows: ProductPerformance[]; total: number; page: number; totalPages: number };
};
export type ProductAnalyticsDetail = {
  product: ProductPerformance; period: AnalyticsPeriod; generatedAt: string; timeline: SalesPoint[];
  variants: { id: string; sku: string; color: string; size: string; active: boolean; stock: number | null; units: number; grossSales: number; discounts: number; netSales: number }[];
  engagement: { views: number; cartAdds: number; wishListAdds: number; reviews: number; averageRating: number | null };
};
export type CustomerAnalyticsDetail = {
  customer: { id: string; name: string; email: string }; generatedAt: string; period: AnalyticsPeriod;
  summary: { orders: number; units: number; products: number; totalSpent: number; averageOrderValue: number; firstPurchase: string | null; lastPurchase: string | null };
  lifetime: { orders: number; units: number; products: number; totalSpent: number; firstPurchase: string | null; lastPurchase: string | null };
  products: { id: string; name: string; units: number; orders: number; grossSales: number }[];
  timeline: { date: string; amount: number; orders: number; units: number }[];
  purchases: { id: string; orderNumber: string; createdAt: string; status: string; totalAmount: number; units: number; items: { title: string; quantity: number; totalPrice: number }[] }[];
  pagination: { page: number; total: number; totalPages: number };
};
export const ANALYTICS_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const DAY_MS = 86400000;
export const vnDay = (value: Date | string) => new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 10);
export function analyticsBucket(value: Date | string, interval: AnalyticsInterval) {
  const day = new Date(vnDay(value) + 'T00:00:00.000Z');
  if (interval === 'month') return day.toISOString().slice(0, 7);
  if (interval === 'week') day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
export function changeMetric(current: number, previous: number): MetricChange {
  const difference = Math.round((current - previous) * 100) / 100;
  return { current, previous, difference, percent: previous === 0 ? current === 0 ? 0 : null : Math.round(difference / Math.abs(previous) * 10000) / 100 };
}
export function fillAnalyticsTimeline(rows: SalesPoint[], from: string | null, to: string, interval: AnalyticsInterval) {
  if (!from) return rows;
  const indexed = new Map(rows.map(row => [row.date, row]));
  const result: SalesPoint[] = [];
  const first = analyticsBucket(from, interval), last = analyticsBucket(to, interval);
  const cursor = new Date((interval === 'month' ? first + '-01' : first) + 'T00:00:00.000Z');
  while ((interval === 'month' ? cursor.toISOString().slice(0, 7) : cursor.toISOString().slice(0, 10)) <= last) {
    const date = interval === 'month' ? cursor.toISOString().slice(0, 7) : cursor.toISOString().slice(0, 10);
    result.push(indexed.get(date) ?? { date, grossSales: 0, discounts: 0, netSales: 0, units: 0, refundedAmount: 0 });
    if (interval === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1); else cursor.setUTCDate(cursor.getUTCDate() + (interval === 'week' ? 7 : 1));
  }
  return result;
}
