# Customer and product statistics

Seller: **Statistics** in the sidebar, `/dashboard/statistics`.
Admin: **Statistics** in the sidebar, `/dashboard/statistics` (aggregated products only).

Endpoints:

- `GET /product/api/seller-statistics`: authenticated seller, restricted to
  `req.seller.shop.id`; a query parameter can never override this scope.
- `GET /admin/statistics`: authenticated administrator with `overview` permission.
  Optional `shopId` restricts aggregate product results to one shop. `kind=customers`
  and sorting by orders are forbidden. No customer identities or order rows are
  loaded or returned. See `product-moderation.md` for the order privacy policy.

Seller supports `kind=customers|products`; admin supports `kind=products` only. Both support `q` (up to 200 characters),
`sort=amount|units|lastPurchasedAt` (seller additionally supports `orders`; descending, ID tie-breaker), `page`,
`limit` (up to 100), and `format=csv`. CSV exports every matching table row,
regardless of pagination, with spreadsheet formula escaping.

The default period is **all time**. Supply both `from` and `to` as calendar dates
for an inclusive custom period of up to 366 days, interpreted in Vietnam time
(UTC+7). The date is order creation time. Results include USD orders paid at report
time, excluding Cancelled, Returned and Refunded orders. This is a current sales
report, not a historical cash-flow ledger: later refunds change earlier totals.

Summary totals use the period and shop filters. Search applies only to table rows.
The API provides `summary`, `rows`, `pagination`, `currency`, `kind`, and `asOf`.

Seller customer rows show distinct paid orders, total item quantity, distinct product IDs,
total spending, average order value, and latest purchase. Spending uses order
`totalAmount`, including shipping and after order-level discounts.

Seller product rows show distinct paid orders, units sold, unique buyers, gross product
sales, average unit selling price, current stock and latest sale. Gross sales use
historical order-item `totalPrice` before order-level discounts and exclude shipping.
They intentionally differ from customer spending. Products are grouped across SKU
rows without double-counting orders. Current names/stock come from the catalog;
historical item titles survive when a product is unavailable. Zero-sale products
and customers without qualifying purchases are absent, rather than shown as zero.

Order history is read in keyset batches of 1,000, selecting only necessary fields.
Aggregations retain one entry per buyer/product, then search/sort/page the full
result. There is no first-page or top-N truncation. All-time reports still scan
the eligible history; admin uses an aggregate-only database pipeline and returns no
order/customer breakdown. For a very large marketplace a materialized reporting store
would reduce repeated reads. Responses are marked `Cache-Control: no-store`.
