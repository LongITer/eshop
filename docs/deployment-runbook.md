# Staging and release runbook

This is a repeatable release procedure, not evidence that production has already been deployed. Run checks from the repository root with Node.js 22. Use a separate staging database, provider test accounts and dedicated fixture users. Do not copy customer data into staging without an approved sanitization process.

## 1. Validate configuration before starting services

Store the selected configuration outside Git, for example `tmp/staging.env` (`tmp/` is ignored). The preflight reads one explicit file and overlays existing shell variables. It never loads credentials into `process.env`, contacts providers, applies a schema or prints values.

```sh
node scripts/deployment-preflight.cjs --env-file tmp/staging.env --mode staging
node scripts/deployment-preflight.cjs --env-file tmp/staging.env --mode staging --json
```

Profiles:

- `development`: permits HTTP/local WebSockets, requires Stripe test keys.
- `staging` (default): requires HTTPS/WSS public endpoints and Stripe test keys.
- `production`: requires live Stripe keys, database/Redis authentication and Kafka TLS. Running this profile only validates strings; it never makes a charge.

Exit status is `0` when required configuration passes and `1` on errors. Warnings always require review; a passing result does not establish credentials are valid, networks are reachable or deployment is safe. MongoDB SRV topology, TLS policies, permissions and provider account/key pairing require separate checks.

The checks include explicit MongoDB database/replica-set configuration, distinct JWT secrets, Redis, Kafka, Stripe key modes/signing secret, public URLs, SMTP, ImageKit and a nonnegative USD shipping fee. Google login, Gemini and web push are called out when absent or incomplete.

SMTP is required for registration OTP and order notifications. Set `SMTP_HOST` or `SMTP_SERVICE`, `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_PORT` (default application port: 587). These settings are consumed by both auth and order services and are listed in `.env.example`. A successful preflight does not send an email.

For native Next.js builds, also check the app's `.env*` files and inherited shell values. The preflight deliberately does **not** merge them: app-local values can override a root file and differ from what Docker builds receive. `NEXT_PUBLIC_*` and rewrites are resolved at build time; changing only runtime secrets does not update browser bundles. Rebuild the UI with the intended publishable key, public site/chat endpoints and internal gateway URL. Never expose secret Stripe, SMTP or ImageKit keys through `NEXT_PUBLIC_*`.

## 2. Build and test the exact release

Record the commit SHA, lockfile, Node version and configuration profile. Do not record secret values.

```sh
npm ci
npx prisma validate
npx prisma generate
npm run typecheck
npm run test:implementation
npm run test:integration
npm run build:services
npx next build apps/user-ui
npx next build apps/seller-ui
npx next build apps/admin-ui
docker compose --env-file .env.example config --quiet
```

Set `DATABASE_URL` to the intended non-production configuration before Prisma validation/generation. These two commands do not apply database changes. Integration tests use their own disposable MongoDB replica set. UI builds can need network access for fonts. Archive test results and image digests alongside the release SHA; do not describe an unexecuted command as passed.

The supplied Compose stack is a **local development stack**, with local unauthenticated MongoDB/Redis/Kafka and a schema-init service. Do not expose it unchanged to the internet or use `docker compose up --build` as a production migration procedure. Its port mappings differ from native development: buyer 3000, seller 3001, admin 3002. Native seller/admin defaults are 3002/3001.

For staging/production, configure a TLS reverse proxy, network isolation, authenticated managed infrastructure, restricted administrative access and persistent storage with backups. Build all three UIs using the environment's public URLs. Current CI publishes images by SHA but does not supply release-specific public build arguments; publishing an image does not prove its checkout or cross-app links are configured for the destination. Validate these before using an image as a release candidate.

## 3. Back up and apply database changes deliberately

Before schema changes:

1. Confirm the target database by environment and database name using the provider console or approved connection tooling. Do not paste a credential-bearing URI into an issue or chat.
2. Create an encrypted snapshot or consistent replica-set backup using the database provider's supported procedure. Record backup ID, timestamp, restore location, retention and responsible operator.
3. Restore the backup into a separate database and verify representative products, order items, payment receipts, account roles and unique indexes. A backup without a tested restore is insufficient.
4. Review the Prisma schema diff and any required data backfills. MongoDB in this project uses `db push`, not a SQL migration history. Existing documents do not automatically acquire new field values; verify compatibility with missing fields and run explicit backfills only when required by a reviewed change.
5. Schedule the update and pause customer writes, workers and webhook fulfillment if the schema change is incompatible. Preserve incoming provider events for replay; do not discard events or disable the provider's retries.

After confirming a verified backup and the correct target, an operator may run:

```sh
npx prisma generate
npx prisma db push --skip-generate
```

Do not add `--accept-data-loss` to bypass a warning. Stop and resolve incompatible/duplicate data first. Restart all affected backend services with the matching generated Prisma client. Test on staging before repeating the reviewed procedure in production. New collections/fields introduced by the release must be verified using the schema diff, not an old checklist.

## 4. Check readiness through actual user flows

`GET /gateway-health` proves the gateway process responds. It does not probe MongoDB, Redis, Kafka, Stripe, email or ImageKit. Pair it with catalog API checks and authenticated workflows:

| Check | Expected evidence |
| --- | --- |
| Catalog/categories | Valid JSON and the intended staging catalog through the public UI/gateway. |
| Registration and login | OTP reaches the staging mailbox; buyer/seller roles and refresh flows work. |
| Checkout | Server-verified quantity, USD totals, shipping/coupon values and address; no fake success on visiting a return URL. |
| Stripe | Test payment success, decline, additional authentication, abandonment and delayed/replayed webhook; one order/stock deduction per payment. |
| Order lifecycle | Buyer order → seller confirmation/shipping/delivery → buyer return → seller receipt → authorized admin refund. |
| ImageKit | Real PNG/JPEG/WebP upload; invalid/oversized input rejected; upload failure can be retried. |
| Access control | Buyers cannot access another account's orders/builds; sellers cannot update another shop; admin role restrictions hold. |
| Optional providers | Google sign-in redirect, chat/WebSocket reconnect, chatbot fallback and notifications checked when enabled. |

The real Stripe test API report from 2026-10-09 already covers seven cases (see `commerce-improvements.md`). It does not verify a current deployment, browser card entry, every authentication challenge or production money movement. Rerun provider verification when credentials or payment behavior changes. The existing `verify-stripe-test.cjs` runner creates provider/database fixtures, requires the `development` database and a running CLI listener; it is **not** part of the read-only preflight. Do not run it against production or rename a staging database merely to bypass its guard.

For hosted staging/production, register the HTTPS webhook endpoint `/api/create-order` with its own signing secret. A local Stripe CLI signing secret is valid for that listener only. Check delivery responses and application receipts; a green gateway response alone says nothing about webhook fulfillment.

## 5. Bounded local performance smoke

Run against the isolated acceptance server or your local development gateway:

```sh
node scripts/local-load-smoke.cjs --base http://127.0.0.1:8185 --requests 24 --concurrency 2
```

This cycles through gateway health, categories and a 12-item catalog page. It sends only unauthenticated GETs, accepts literal loopback/localhost origins, pins `localhost` to `127.0.0.1`, refuses redirects, caps the response at 1 MiB, and limits requests (3–120), concurrency (1–5) and per-request timeout (100–10,000 ms). Defaults: 24 requests, concurrency 2, timeout 3 seconds. JSON output includes per-route counts, errors/statuses and p50/p95 duration. It never prints response bodies, cookies or credentials.

Exit `1` means at least one request failed or returned unexpected data. Resolve 404/429/provider connectivity first; do not disable rate limiting just to get a passing result. This is a short regression smoke, **not a load-capacity claim**. It cannot establish how many customers production supports and does not exercise checkout, authenticated traffic, AI latency or distributed infrastructure. A production-capacity test requires a separate representative dataset, environment, traffic model, error/latency targets and monitoring plan.

## 6. Release observation and rollback

After rollout, monitor API error rates and latency, failed webhook deliveries, paid payments without committed receipts/orders, notification queue failures, database connections, disk space and worker restarts. Compare with pre-release behavior. Keep secrets, payment client secrets, cookies and user evidence images out of logs. Associate errors with an order/payment/event ID rather than dumping requests.

If readiness fails, stop the rollout, preserve the failed release's logs and retain the previous images/configuration. Revert application images only when the old code remains compatible with the current schema/data. Avoid automatically restoring an old database snapshot over newer orders: that can erase paid transactions. If data recovery is necessary, pause writes, restore into a separate database, reconcile all payments/webhooks/orders created since the backup, and choose the recovery procedure with the responsible operator. After rollback, rerun health/catalog/auth checks and replay provider events idempotently as required.

Release evidence should list what was executed, what passed, what failed and what remains unverified. Never label the project production-ready based on typechecking, a static preflight or local smoke results alone.
