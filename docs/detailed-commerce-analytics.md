# Detailed commerce analytics

Both existing Statistics pages now open the detailed dashboard. Seller scope always
comes from the authenticated seller's shop, even if a different shopId is supplied.
Admin sees aggregate product/shop performance only; existing order privacy restrictions
and the legacy statistics API remain in place.

## Contract

- GET `/product/api/seller-analytics`: overview, inventory, categories, demand,
  outcomes and paginated product performance, plus private seller customer/order counts.
- GET `/product/api/seller-analytics/products/:id`: product trend, all current/historical
  SKUs and lifetime recorded engagement/review aggregates, scoped to the seller's shop.
- GET `/product/api/seller-analytics/customers/:id`: that customer's purchases in the
  seller's shop, selected-period/lifetime totals, product breakdown and paginated history.
  Customer existence in another shop never grants access here.
- GET `/admin/analytics`, GET `/admin/analytics/products/:id`: aggregate-only equivalents
  protected by `overview` permission. No admin customer-history route exists. Customer,
  user, order and email filters are rejected. No raw customer/order records are loaded
  by the admin report builder; aggregation occurs inside MongoDB and response DTOs
  contain no customer identities, purchase identifiers or order counts.

Options: `period=7d|30d|90d|month|year|all|custom` (default 30d), `from`/`to` calendar dates
for custom periods only (max 366 days), `interval=auto|day|week|month`, `q`, `category`,
`stock=all|low|out|noSales|active|archived`, `sort=netSales|units|stock|coverage|refunds|lastSale`,
`page`, `limit` (max 100), optional admin `shopId`, and a bounded `refresh` nonce.
Search/category/stock/sort affect the product table and product/inventory export only;
they do not alter period-level overview totals. `coverage` sorts ascending, nulls last;
other numeric metrics sort descending. Calendar periods use Vietnam time (UTC+7).

`format=csv&view=summary|products|inventory|timeline|categories|outcomes|demand|shops`
exports all matching aggregate rows across pages; shops export is admin-only. The
seller customer detail CSV exports that customer's product breakdown. Customer-table
exports continue using the existing seller-statistics API. CSVs include headers for
empty results and use the existing spreadsheet formula escaping.

## Definitions and limits

- **Recognized sales**: USD orders currently Paid, excluding Cancelled/Returned/Refunded.
  Date selection uses order creation time, not provider settlement/refund event time.
- **Gross product sales**: historical line-item totals. Current catalog prices never
  rewrite sales history. **Net product sales** subtracts order-level discounts, excluding
  shipping. Cumulative cent allocation across stable line-item IDs conserves each
  order's exact discount; SKU/category/product totals reconcile to the same cents.
- **Retained paid amount** includes shipping and discounts. Difference from net product
  sales + shipping is surfaced, not hidden, as a source-data reconciliation warning.
- **Refunded amount** is the current fully-refunded value of purchases created in the
  selected period. **Awaiting refunds** means Paid orders currently Cancelled/Returned.
  These are cohort metrics, not a historical cash-flow ledger or Stripe balance.
- **Recorded fees** use only existing platformFeeCents. Coverage is disclosed; missing
  fees are never replaced by an assumed percentage. No actual profit is claimed because
  cost of goods and full provider-processing fees are not available.
- **Comparison** uses the immediately preceding, exactly equal elapsed time window.
  All-time has no artificial previous period. Zero baseline returns null percentage
  (new activity), not infinity. Trends include zero-activity day/week/month buckets;
  weeks start Monday. Very long explicit daily/weekly series require monthly grouping.
- **Repeat buyers** (seller-only) have at least two recognized orders in the selected
  period. This is not a claim that a customer is new/returning over their lifetime.
- **Inventory** is current, not stock at the end of a historical period. Availability
  is bounded by product stock and the sum of active SKU stocks; suspended/removed
  listings and suspended shops are not sellable. Parent/SKU mismatches are surfaced.
  Zero-sale live products remain visible. Archived product/SKU history is preserved.
- **Stock value** estimates available units at current listing price; it is not cost.
  **Days of cover** estimates available units / selected-period daily sales velocity
  (at least one day denominator). Zero-sales products have no invented forecast.
- **Category** uses current catalog metadata because historical categories were not
  stored on order items. Unknown/archived products retain historical item titles.
- **Engagement** is lifetime event counters (views/cart additions/wishlist additions),
  not unique users, period conversion rate or an exact funnel. Ratings use actual
  review aggregates, not the catalog's default rating.

The report cache is process-local, scoped by audience/shop/period, bounded to eight
entries and 20 seconds; explicit refresh creates a fresh snapshot. Responses use
Cache-Control: no-store. This is a live current-state report, not a persistent
historical snapshot; subsequent cancellations/refunds change earlier cohort totals.

## Deployment and verification

No new data fields/models are required. The additive index script
`node scripts/ensure-analytics-indexes.cjs` prepares orderItems.orderId,
orderItems.(productId,orderId), and orders.(shopId,userId,createdAt). It never resets
the database or drops existing indexes. Restart product/admin services after building.

Disposable MongoDB tests exercise real aggregation, cent reconciliation across SKUs,
calendar boundaries, comparisons, outcomes, unsold inventory, archived SKUs, full CSV,
customer scope, shop scope, and cache refresh. Unit tests cover validation and privacy
at the authenticated admin API boundary. No external provider calls or financial
transactions are needed for reporting.
