import { NotFoundError } from '@packages/error-handler';
import { handle } from '@packages/utils/api';
import { commerceStatistics } from '@packages/utils/commerce-statistics-report';

export const sellerStatistics = handle(async (req, res) => {
  const shopId = req.seller?.shop?.id;
  if (!shopId) throw new NotFoundError('No shop linked to this seller');
  const report = await commerceStatistics(req.query, shopId);
  res.setHeader('Cache-Control', 'no-store');
  if ('csv' in report) { res.attachment(`seller-${report.kind}-statistics.csv`).type('text/csv').send(report.csv); return; }
  res.json(report);
});
