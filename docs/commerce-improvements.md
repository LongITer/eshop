# Commerce improvements — 2026-10-09

## Delivered

- Cart lines are keyed by product + color + size. Existing local carts still work. Quantity changes/removal affect one option combination.
- Checkout loads current product/SKU prices, coupon eligibility and stock from the database. Different variants of one product are allowed; combined quantities cannot exceed product stock.
- Sellers can create/edit SKUs under **Dashboard → Products → Edit → SKU inventory**. Each SKU has its own USD price, stock and availability. The first SKU replaces the old product-level stock. Subsequent product-level price/stock/option edits are blocked so the aggregate stays consistent.
- SKU deductions, product deductions, orders, receipt and order history commit in one transaction. Cancellation restores the purchased SKU exactly once. Deactivated SKU inventory is not counted as available product inventory.
- If a product gains SKUs after an older order was placed without a SKU, cancellation notifies the seller to allocate those units manually. It does not guess a variant or inflate aggregate stock.
- Catalog/payment amounts stay in **USD**, as confirmed by the project owner. Chatbot product cards and AI catalog context now also label prices as USD.
- `SHIPPING_FEE_USD` is a flat charge **per shop**, default `0`. The trusted checkout snapshot captures it, displays it before payment, and allocates it to each shop's order. This is not a carrier quote and does not vary by destination.
- Payment success checks the authenticated session's committed receipt. Visiting the return URL alone cannot clear the cart or claim an order was created.
- Payment confirmation also retrieves the saved Stripe PaymentIntent server-side when a webhook is delayed. The same transactional fulfillment checks owner, amount, currency and inventory before committing a receipt. After 60 seconds the UI replaces the waiting message with a delayed-confirmation message and manual retry. Failed/canceled payments and paid orders needing review have distinct states. Recovery through this endpoint does not send a confirmation email.
- Buyer and seller logins preserve each other's cookies. Their API clients select the appropriate session and refresh expired access tokens once per group of concurrent requests. Temporary network/service failures no longer trigger login redirects.
- Orders follow Pending → Confirmed → Processing → Shipped → Delivered. Cancellation is allowed before shipment; buyers can cancel only Pending orders. Status changes record actor/time/reason.
- Buyers can request a full-order return for a Delivered/Paid order, with a reason and up to five HTTPS evidence links. Sellers approve/reject, then confirm receipt. Receipt sets the order to Returned so the existing admin refund flow can process it. Returned stock requires inspection and a deliberate seller inventory adjustment.
- `/pc-builder` supports component search, live USD totals, socket/RAM/PSU checks, add-to-cart, saving on the current device and sharing a selection URL. Price/stock are reloaded when opening a shared build. Missing specifications produce a warning, not a compatibility guarantee.

## Schema and activation

New collections: `productVariant`, `orderEvent`, `returnRequest`. New fields: order currency, order item SKU/variant IDs, receipt session ID. Existing prices are **not** converted.

Before using the changes against the intended database, run:

```sh
npx prisma generate
npx prisma db push --skip-generate
```

Restart the order/product services and the user/seller UIs to load the new Prisma client and code. On Windows, stop processes holding Prisma's engine DLL if `prisma generate` reports EPERM; then regenerate. Do not use a data-loss override.

The implementation and browser acceptance used disposable MongoDB replica sets. On 2026-10-09, the schema was also applied successfully to the configured Atlas `development` database without a data-loss override. Prisma Client was regenerated and the backend plus buyer/seller development servers were restarted. USD prices were preserved.

For nonzero shipping, set e.g. `SHIPPING_FEE_USD=2.50` in the order service environment and restart that service. Existing checkout sessions retain their quoted fee.

## PC specifications

Use `custom_specification` as either an object or an array of `{ name, value }` entries (`key` and `label` legacy labels also work):

| Component | Field | Example |
|---|---|---|
| CPU, motherboard | `socket` | `AM5` |
| RAM, motherboard | `memoryType` | `DDR5` |
| PSU | `wattage` | `750` |
| GPU | `recommendedPsuWatts` | `650` |

The checker normalizes Vietnamese/English labels such as `CPU Socket`, `Socket CPU`, `Loại RAM`, and `Loại bộ nhớ`, and explicit values such as `LGA 1700`, `DDR 5` and `750 W`. It reads specifications supplied by the seller; it does not infer hardware from product titles. Missing, unrecognized, negated or contradictory values stay unverified and identify the component/field to complete. A family listing several sockets or DDR generations needs specifications for the selected model.

Seller **Create product** and **Edit product → Product specifications** provide component-specific field suggestions. Adding suggestions inserts empty field names only; the seller must supply the selected model's manufacturer specifications. Existing object/array data and metadata are preserved while editing.

Quote responses include `compatibility.checks` with `passed`, `unknown` or `conflict` status and a separate neutral `compatibility.notes` reminder. The manual reminder is not counted as a warning. Confirmed conflicts and exhausted stock block adding the configuration; incomplete specifications remain visible without claiming compatibility.

BIOS support, dimensions, connectors and cooler fit still need checking. A partial selection can be added; the builder does not claim it is a complete bootable PC. The PSU check compares only the supplied GPU recommendation with the rated PSU power; it is not a calculation of the whole system's consumption.

## Verification

- Typecheck all 13 apps passed.
- Latest automated results: 117 implementation tests and 15 MongoDB integration tests passed.
- Implementation tests cover separate cart options, server-priced SKU checkout, aggregate stock, forged coupons, per-shop shipping, ownership/evidence validation, return transitions, payment receipt confirmation and hardware conflicts.
- MongoDB integration tests cover concurrent SKU payment replay/cancellation, shipping allocation, receipt linkage and concurrent unique return requests.
- Production builds of user, seller and admin UI passed; all 10 backend services built successfully.
- Browser acceptance on a disposable database: incompatible/compatible PC selections, USD total, 390px layout, preserved cart while payment is unconfirmed, buyer request → seller approval → receipt, and SKU editing.
- Stripe was stubbed in isolated browser acceptance. A separate real Stripe **test-mode** API run passed all seven checks on 2026-10-09 at 21:38 Vietnam time: invalid signature rejection, a 1.00 USD test payment, actual CLI-forwarded webhook creating the order and deducting SKU stock, buyer receipt confirmation, signed duplicate replay without another deduction, declined card without an order, and cancellation restoring stock plus a successful full test refund. Payment/refund webhook deliveries returned HTTP 200.
- Evidence: `tmp/stripe-provider-verification.json`; payment `pi_3UOevhP6LWr4S4eU1dXN1u9I`, refund `re_3UOevhP6LWr4S4eU1y0W8P61`. The ignored report is local; provider records can be inspected in the matching Stripe account's test mode. Repeatable commands are in README.
- The frontend publishable test key was verified against that PaymentIntent. An invalid root publishable key was replaced with the verified frontend key. No secret keys are included in this document.
- No real money was charged. The real Stripe browser card-entry flow and production hosting were not verified by this API run. Local webhooks require the CLI listener to remain running; production requires its own HTTPS webhook endpoint and signing secret.

## Carrier integration prerequisites

GHTK has been selected. See [GHTK setup](ghtk-setup.md) for account configuration and the read-only fee verification script. No carrier credentials are currently configured and no authenticated carrier quote, tracking response or shipment creation has been verified. The current flat USD shipping fee must not be presented as a carrier API quote.

Provide the carrier name and configure its test credentials, shop/account identifier and pickup location in the ignored environment file, never in chat or Git. Then implement and verify address mapping, authenticated fee quotes, provider errors/timeouts, tracking and signed/authenticated callbacks as supported by that provider. If the provider quotes VND, define an explicit conversion policy before combining it with the USD checkout. Shipment creation that incurs fees requires a separately scoped test; a successful quote alone does not verify shipment creation.

## Follow-up scope

Account-synced carts/wishlists, component comparison and account-saved PC builds are now implemented; see `user-improvements.md`. Carrier APIs, local payment providers, partial returns, warranty cases, advanced coupon limits and broader product-comparison pages remain follow-ups. Stock is checked again during paid fulfillment; inventory reservation and automated compensation for stock lost during payment remain future work.

## Payment reliability update — 2026-10-16

Checkout now uses its durable MongoDB snapshot for initialization and verification, binds the saved PaymentIntent when present, and serializes fulfillment on the checkout document. Legacy snapshots remain supported. One checkout cannot produce duplicate orders from distinct payment intents; a paid stock conflict rolls back all shops and can be replayed after stock is restored.

Refunds must match the whole shop order's payment, amount, currency and verified attempt history. Failed/canceled refunds can be retried with a deterministic idempotency key and `previousRefundId` metadata; a lost database response can be recovered from provider records. Old webhook/admin responses cannot replace a newer attempt or regress a completed refund. Partial or unrelated refunds require review instead of marking the whole order refunded.

`tests/integration/commerce-lifecycle.test.ts` exercises real handlers, MongoDB replica transactions and Stripe SDK HMAC signatures. Only the provider API, email and behavior logging are doubled. It covers checkout→paid fulfillment→seller shipping/delivery→return→refund, invalid signatures, concurrent replay, mismatched metadata/amount/currency/intent, shared-payment allocation, failed-refund retry chains and stock rollback/recovery. This is separate from the historical provider API evidence above; rerun provider/browser verification for the new release before deployment.
