# Product violations and order privacy

This implements the requested platform access policy; it does not assert legal compliance.

## Access boundary

All administrator roles, including owner, lack `orders`, `fulfillment`, `payments`,
`returns` and raw behavior `logs` permissions. Legacy order-service endpoints,
admin order details/exports, refunds and return review are denied at the API boundary.
Admin notification lists exclude order-linked notifications. Order events are no
longer broadcast as global admin notifications. The raw logger WebSocket requires a
server-only `LOGGER_INTERNAL_TOKEN` of at least 32 characters and denies connections
when it is not configured; admin/browser JWTs do not grant access. Admin audit history uses an explicit
allowlist of governance actions, excluding order/payment/return records.

Admin product statistics run an aggregate database pipeline and return product sales,
quantities, average unit prices, stock and dates. They never load customer identities
or return individual order identifiers, order rows or customer purchase statistics.
Seller statistics remain scoped to their own shop. Private customer purchases remain
available through customer sessions for that customer's own orders.

## Reporting and decisions

- Customer: **Report this listing** on a product page. Sign-in required, server-owned
  source/reporter identity, maximum 10 reports per day, deduplicated per listing
  version/customer. Reports alone never hide products or suspend sellers.
- Admin/Moderator: **Violations**, or **Review** from the product catalog. Search for a product,
  submit evidence manually or choose **Scan with AI**. The existing Gemini key is used
  (`GEMINI_API_KEY`; optional `MODERATION_AI_MODEL`, default `gemini-3.8-flash`).
- Moderator is a dedicated admin access level with the `moderation` permission only;
  it cannot access accounts, payments, orders, returns, team settings or analytics.
- AI: stateless (`store:false`) triage of title/category/public description and uploaded
  product images. Images are fetched only from the configured ImageKit host, with
  per-image and total request size limits, timeout and strict response validation.
  No account/customer/order fields are sent.
  Missing configuration, quota failures and invalid output leave manual review
  available, without inventing a clean result. A flagged scan creates a pending
  report only. No legal conclusion or automatic sanction is inferred.
- Admin reviews the evidence and prior confirmed violation count for the shop.
  Dismiss, or confirm with a reason, severity, Hide/Remove and Warn/Suspend.
  High/Critical severity suggests suspension in the UI, Critical suggests removal;
  the administrator retains the final action choice.

Confirmation is transactional: preserve immutable evidence and occurrence count,
suspend the product, optionally soft-remove it, warn/suspend the seller, resolve
pending reports for that product, notify the seller, and create a durable follow-up
job. Concurrent decisions are serialized on the seller document. Reusing a reviewed
report cannot issue another sanction. A later decision cannot shorten a stricter
existing suspension. Removed products retain a suspended tombstone; the normal
cleanup cron cannot physically delete them. Only admin restoration returns a listing
to Inactive. Sellers cannot republish suspended products. Restoration never erases
confirmed violation history.

## Automatic listing gate

New listings are screened before they become public. Gemini checks the title, category,
short description, detailed description and product images for prohibited goods,
counterfeits, scams, unsafe products and inappropriate imagery. A small built-in
keyword list covers common prohibited goods; operators can append comma/semicolon/
newline-separated terms through `PRODUCT_PROHIBITED_KEYWORDS`. A keyword match only
queues human review and never automatically sanctions a seller.

The API validates the selected category and subcategory against the current admin-managed
catalog. Prices are validated for positive values up to USD 10,000,000. A sale price at
least 95% below the regular price, or more than 10× away from the median of the 101 most
recent active listings in the same subcategory (when at least 10 are available), enters
`PendingReview`. This conservative heuristic is a review signal, not a price verdict.
Flagged text/image, keyword or price checks enter `PendingReview`; admins/moderators can
approve or reject the listing. Sellers cannot publish a listing while it is pending or
after rejection.

If the AI service or image fetch is unavailable or returns invalid output, the listing
stays hidden in the same review queue. Edits to an active listing's title, category,
descriptions, images or price are screened again; a flagged or unscannable edit hides the
listing pending review. The screen can miss subtle violations; admins/moderators retain
the final decision. SKU price changes run through the same anomaly check and can move a
listing into `PendingReview`. Product creation and text edits are rate-limited per seller.

## Related purchases: private remediation

A background worker processes up to 100 related orders per transaction, using a
revision/cursor lock. Tasks, notifications and cursor updates commit together;
retries/restarts cannot duplicate a batch. Admin sees only the transferred count and
queue state. No admin endpoint returns the private tasks or order identifiers.

Unshipped orders receive a moderation hold. Fulfillment also checks suspended
products synchronously, so it is blocked before the worker reaches an order. Orders
already shipped/delivered get private follow-up tasks without being blindly cancelled.
Customers and the owning seller receive notices.

Seller **Violations & remediation** provides links to their own orders and actions to
cancel an unshipped order, refund a paid cancellation/received return, and record a
resolution. Cancellation affects the whole order and restores stock through the
existing idempotent order lifecycle. Refunds are scoped to the authenticated shop
before any provider request, bound to the stored payment and order amount, and reuse
validated Stripe refund/retry/idempotency logic. No real cancellation or refund is
performed merely by deploying this feature or submitting a report.

Held orders cannot be marked resolved before cancellation. Paid cancellations and
returns cannot be resolved until the refund completes. For shipped/delivered goods,
the seller contacts the buyer and uses the return workflow. A rejected return can
be sent back to the shop for reconsideration; it no longer routes to an admin order
inspection screen.

Suspension blocks selling, while password sign-in/refresh and a narrow API allowlist
permit viewing/remedying existing shop orders, returns, payment refunds and violation
notices. The seller UI hides selling navigation in this state. Suspension does not
grant access to another shop. Unrelated account APIs and publishing remain denied.

## Setup and verification

Set `GEMINI_API_KEY` and `IMAGEKIT_URL_ENDPOINT` to enable multimodal listing scans.
Configure additional blocked phrases with `PRODUCT_PROHIBITED_KEYWORDS`; restart the
product service after changing environment values. Assign the `moderator` access level
from Admin → Team management to grant moderation access without broader admin access.

Generate Prisma Client after updating the schema. On Windows a running Node service
may lock the engine DLL; stop affected services before a full regeneration if needed.
`node scripts/ensure-moderation-indexes.cjs` only creates the three new collections'
indexes; it never drops existing data/indexes or applies unrelated schema changes.
Restart auth, product, order and admin services after deployment.

Tests cover all admin roles/legacy disclosure routes, report spoofing/deduplication,
confirmation/dismissal/history, concurrent worker retries, order holds, seller scope,
refund binding, recurrence and restricted suspended-seller access. Database workflow
tests use disposable MongoDB; payment and AI provider checks use fixtures, without
live financial transactions or paid model calls. Real provider availability remains
dependent on deployment credentials and the provider account.
