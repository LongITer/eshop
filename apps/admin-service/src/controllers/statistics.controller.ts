import { handle, objectId } from '@packages/utils/api';
import { adminProductStatistics } from '../lib/product-statistics';
import { commerceAnalytics, productAnalyticsDetail } from '@packages/utils/commerce-analytics-report';

export const adminStatistics = handle(async (req, res) => {
  const shopId = req.query.shopId === undefined ? undefined : objectId(req.query.shopId);
  const report = await adminProductStatistics(req.query, shopId);
  res.setHeader('Cache-Control', 'no-store');
  if ('csv' in report) { res.attachment(`admin-${report.kind}-statistics.csv`).type('text/csv').send(report.csv); return; }
  res.json(report);
});
export const adminAnalytics = handle(async (req, res) => {
  const shopId = req.query.shopId === undefined ? undefined : objectId(req.query.shopId);
  const report = await commerceAnalytics(req.query, 'admin', shopId);
  res.setHeader('Cache-Control', 'no-store');
  if ('csv' in report) { res.attachment(`admin-${report.view}-analytics.csv`).type('text/csv').send(report.csv); return; }
  res.json(report);
});
export const adminProductAnalytics = handle(async (req, res) => {
  const shopId = req.query.shopId === undefined ? undefined : objectId(req.query.shopId);
  res.setHeader('Cache-Control', 'no-store');
  res.json(await productAnalyticsDetail(objectId(req.params.id), req.query, 'admin', shopId));
});
