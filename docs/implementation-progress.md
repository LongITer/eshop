# Implementation acceptance tracker

Baseline: `C:\Users\Dell\Downloads\implement.md` (2026-10-04), branch `feat/hi`.
The baseline defines 22 requirement groups. The user explicitly deferred Google login (4.3) on 2026-10-04; current acceptance covers the other 21 groups. Code presence and passing unit tests alone do not establish the requested >98% acceptance. No group is assigned an unsupported completion percentage.

## Verified checks (2026-10-04)

- `npm run typecheck`: all 13 apps pass.
- `npm run test:implementation`: 8 suites, 74 tests pass. Covers role/ownership boundaries, stock/reviews, transitions/refunds, recommendation/reporting, Google state/nonce/linking, real WebSocket frames with mocked dependencies, and chat/logger consumers.
- `npm run test:integration`: 11 tests pass using a disposable MongoDB replica set and actual Prisma indexes. Includes concurrent follows/reviews/cancellation/default addresses, atomic payment webhook and stock-failure rollback.
- Production Next builds: user, seller and admin passed; user/seller rebuilt after the latest UI fixes.
- `docker compose --env-file .env.example config --quiet`: passes after adding schema initialization before service startup.
- Browser QA uses `npm run test:acceptance:serve`: temporary MongoDB with Stripe/Redis/logging doubles. It cannot prove live provider behavior.

| Group | Implemented | Current evidence / remaining acceptance |
|---|---|---|
| 1.1 Seller dashboard | Revenue/orders/products, chart, recent orders, best sellers, low stock | DB revenue tests and browser populated dashboard; finish mobile review |
| 1.2 Recommendations | Personalized/content similarity/trending, analytics scoring, gateway and UI | Unit and real DB filtering tests pass; expand browser candidate fixture |
| 1.3 Product editing | Owner-scoped API, prefilled form, images, price, stock, description, category, variants | API/integration tests pass; browser prefill verified, save flow in progress |
| 1.4 Buyer notifications | List/read/read-all, page, header badge | Ownership tests and browser read-all/badge passed |
| 2.1 Admin orders | Detail, shop/status/date filters, lifecycle updates | Transition tests pass; browser acceptance pending |
| 2.2 Admin dashboard | Revenue and registration charts, top products | Real DB revenue test passes; browser acceptance pending |
| 2.3 Admin notifications | Real DB list, recipient or confirmed broadcast | Browser send/list acceptance pending |
| 2.4 Admin payments | Stripe pagination, shop/time revenue, idempotent order refunds | Provider doubles cover refunds; live Stripe test-mode and browser checks pending |
| 2.5 Shop settings | Name/bio/avatar/banner/hours/social API and UI | Ownership/URL validation tests pass; browser save/upload pending |
| 2.6 Reviews | Schema, delivered-buyer upsert, aggregate, form/list | Concurrent DB rating tests and browser submit pass; removed duplicate static review placeholder |
| 3.1 Logger | Idempotent Kafka persistence, filtered query/charts, CSV/JSON | Consumer persistence test passes; full query/export and browser acceptance pending |
| 3.2 Profile | Name/avatar API and upload/form | Real DB avatar replacement and browser name save pass; provider upload pending |
| 3.3 Inventory | Low-stock view, history, automatic notification | DB adjustment/purchase/cancellation tests pass; browser history pending |
| 3.4 Tracking | Timeline, tracking/ETA, Pending cancellation | Transaction tests and browser tracking/ETA pass; browser cancel pending |
| 3.5 Following | Atomic follow/unfollow, shop button, followed list | Concurrent DB follows and browser follow pass; list/unfollow browser pending |
| 3.6 Address update | Prefilled edit form, ownership, serialized defaults | Concurrent create/update invariant passes; browser save pending |
| 4.1 Seller reporting | Day/week/month, best sellers, coupon use/discount, CSV, print/PDF | Aggregation/CSV tests pass; browser export/print-layout pending |
| 4.2 Chat | Authenticated tickets, presence, typing, attachments, push, unread | WebSocket and consumer tests pass; two-client UI and actual browser push pending |
| 4.3 Google OAuth | PKCE/state/nonce callback, stable identity and existing account handling | Deferred by explicit user instruction: "chua can lam dang nhap google". Existing code and 9 tests retained; live callback not claimed. |
| 4.4 Responsive | Shared hamburger, responsive forms/tables/header | Initial 390px seller check; comprehensive route/touch and hydration audit still pending |
| 4.5 SEO | Product/shop metadata, canonical/OG/Twitter, sitemap/robots | Fixed shop image array and product brand; production build passes; HTTP metadata/sitemap acceptance pending |
| 4.6 Docker/CI | 13 Dockerfiles, Compose infra/schema init, CI tests/builds/image publishing | Compose syntax passes; actual container build/start unverified while Docker Linux daemon unavailable |

## Environment and scope

- No production broadcast, refund, deployment, commit or push performed.
- Existing user changes remain in the shared worktree.
- Local VAPID keys generated in ignored `.env`; values never logged. Production VAPID subject must use the deployment operator's contact/site.
- Google login is excluded from this acceptance run at the user request. Credentials remain absent.
- Docker daemon was unavailable; static validation does not substitute for runtime verification.
- Log exports currently cap 10,000 records and disclose truncation; chart data caps 50,000. Review pagination/streaming for full-scope export.
- Sitemap currently has a single-file limit guard; consider sharding before large deployments.

Goal remains active. Finish remaining acceptance, repair observed failures, then audit each checklist item against current evidence.

