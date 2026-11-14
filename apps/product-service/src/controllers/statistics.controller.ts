import { NotFoundError } from '@packages/error-handler';
import { handle, objectId } from '@packages/utils/api';
import { commerceStatistics } from '@packages/utils/commerce-statistics-report';
import { commerceAnalytics, productAnalyticsDetail } from '@packages/utils/commerce-analytics-report';
import { customerAnalyticsDetail } from '@packages/utils/commerce-customer-analytics';

export const sellerStatistics = handle(async (req, res) => {
  const shopId = req.seller?.shop?.id;
  if (!shopId) throw new NotFoundError('No shop linked to this seller');
  const report = await commerceStatistics(req.query, shopId);
  res.setHeader('Cache-Control', 'no-store');
  if ('csv' in report) { res.attachment(`seller-${report.kind}-statistics.csv`).type('text/csv').send(report.csv); return; }
  res.json(report);
});
export const sellerAnalytics = handle(async (req, res) => {
  const shopId = req.seller?.shop?.id;
  if (!shopId) throw new NotFoundError('No shop linked to this seller');
  const report = await commerceAnalytics(req.query, 'seller', shopId);
  res.setHeader('Cache-Control', 'no-store');
  if ('csv' in report) { res.attachment(`seller-${report.view}-analytics.csv`).type('text/csv').send(report.csv); return; }
  res.json(report);
});
export const sellerProductAnalytics = handle(async (req, res) => {
  const shopId = req.seller?.shop?.id;
  if (!shopId) throw new NotFoundError();
  res.setHeader('Cache-Control', 'no-store');
  res.json(await productAnalyticsDetail(objectId(req.params.id), req.query, 'seller', shopId));
});
export const sellerCustomerAnalytics = handle(async (req, res) => {
  const shopId = req.seller?.shop?.id;
  if (!shopId) throw new NotFoundError();
  const report = await customerAnalyticsDetail(objectId(req.params.id), req.query, shopId);
  res.setHeader('Cache-Control', 'no-store');
  if ('csv' in report) { res.attachment('customer-products.csv').type('text/csv').send(report.csv); return; }
  res.json(report);
});
