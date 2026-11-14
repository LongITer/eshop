# Seller workspace update — 2026-10-16

The seller workspace keeps its existing APIs and dark appearance, with consistent navigation, forms, tables, loading/error states and layouts for smaller screens.

## Main changes

- The dashboard uses the shop's actual statistics, 30-day revenue activity, recent orders and stock watch. Product totals describe all non-deleted listings; revenue excludes canceled, returned and refunded orders.
- Navigation includes implemented routes only. The dashboard checks the seller session before mounting its pages, handles connection failures and redirects signed-out sellers. Signing out clears cached account data; account changes remount page drafts.
- Catalog search, status/category filters and pagination work together. Ratings require a real review count; the legacy default rating of five is not presented as a customer review. Low stock consistently includes the selected threshold.
- Product forms preserve entered details when a SKU refreshes. SKU saves synchronize managed price, stock and options without replacing the title or specifications. Product/SKU saves cannot run over each other. Uploads are validated and serialized; failed saves retain the draft. Suspended listings can update details without sending a republish request.
- Orders distinguish payment from fulfillment, support search/status filters and pagination, and submit status changes explicitly. Shipping and cancellation use the existing tracking, delivery and reason fields.
- Inventory validates its threshold, separates product browsing from stock history and labels the scope of each list. Notifications offer unread filtering and mark-read actions.
- Shop settings retain unsaved edits during background refreshes and preserve the existing avatar until a replacement is saved. Discount assignment dialogs keep the seller's changes during refreshes and support keyboard focus/Escape.
- Deleting a discount code removes its references from the seller's products in the same retrying transaction. Assignment updates serialize on the discount document, so a concurrent new assignment cannot outlive deletion. Other sellers' products are not changed.
- Revenue reports require valid dates, an ordered range and the API's 366-day maximum. Invalid dates hide retained results and disable export/print. Filter/account changes cancel outdated CSV exports.

## Local startup and builds

`npm run seller-ui` runs Next.js directly on port 3002. Seller typography uses the system font stack, so startup/builds do not download Google Fonts. Parallel build workers are limited to two to reduce memory pressure on local machines.

## Verification

- 318 implementation tests passed, including product draft/SKU updates, report validation and export cancellation.
- Five disposable MongoDB integration tests passed for discount ownership, rollback and concurrent updates.
- Seller and product-service TypeScript checks passed; seller production build passed.
- Browser accessibility snapshots confirmed the populated overview and catalog. The browser renderer then crashed; screenshots, click-through verification and mobile visual review were not completed. Recheck those views in a working browser before release.

These checks used disposable local data. They do not verify live provider uploads, Stripe onboarding or external carrier services.
