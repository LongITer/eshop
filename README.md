# Eshop

Multi-vendor PC ecommerce application built with an Nx/TypeScript monorepo, Next.js, Express, Prisma/MongoDB, Redis, Kafka and Stripe.

## Applications

- `apps/user-ui`: storefront, cart, checkout, order tracking and PC Builder.
- `apps/seller-ui`: products/SKUs, inventory, orders, returns and reporting.
- `apps/admin-ui`: platform administration and refund processing.
- Backend services: gateway, authentication, products, orders, administration, recommendations, chat, chatbot, logging and Kafka consumers.
- `packages`: shared middleware, components and business rules.
- `prisma/schema.prisma`: database models. MongoDB must run as a replica set for transactions.

Seller workspace changes and validation are documented in [seller improvements](docs/seller-improvements.md).

## Local setup

Use Node.js 22 (matching CI).

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and fill in the database, infrastructure and provider settings. Use test credentials for development.
3. Run `npx prisma generate` and `npx prisma db push --skip-generate` against the intended development database.
4. Run `npm run dev` for backend serve targets. Run the UI targets in separate terminals:

```sh
npm run user-ui
npm run seller-ui
npm run admin-ui
```

The native local UI ports are 3000 (buyer), 3002 (seller) and 3001 (admin); the gateway uses 8080. Docker port mappings are defined separately in the compose file.

`npm run seller-ui` starts Next.js directly on port 3002. This avoids repeated Nx project-graph initialization, which can leave the Windows dev server at `Starting…` when Nx's daemon or graph workers stall. If an old instance is still running, stop that terminal with Ctrl+C before restarting the command.

The Docker alternative is `docker compose up --build` after configuring `.env`. External providers still require valid credentials.

## Verification

```sh
npm run typecheck
npm run test:implementation
npm run test:integration
npm run build:services
npx next build apps/user-ui
npx next build apps/seller-ui
npx next build apps/admin-ui
```

Integration tests start a disposable MongoDB replica set. `npm run test:acceptance:serve` starts a separate fixture API using disposable MongoDB and Stripe/Redis/logging doubles. Set `ACCEPTANCE_PORT` to avoid an existing gateway and point UI `GATEWAY_INTERNAL_URL` at that port. `NEXT_DIST_DIR` lets user/seller UI build output stay separate from a running dev server.

For release preparation, see the [staging, backup and rollback runbook](docs/deployment-runbook.md). `node scripts/deployment-preflight.cjs --env-file tmp/staging.env --mode staging` validates configuration offline without printing credentials or contacting providers. `node scripts/local-load-smoke.cjs --base http://127.0.0.1:8185` checks a bounded set of read-only local API requests; it is not a production capacity benchmark.

### Stripe provider verification (test mode)

Configure matching Stripe test secret/publishable keys in the ignored `.env` and `apps/user-ui/.env`. Never commit keys. Install the official CLI with `npm install -g @stripe/cli`, then run in a separate terminal:

```sh
node scripts/stripe-listen-test.cjs
```

The helper uses the test key, forwards payment/refund events to the local gateway, and writes its signing secret into `.env`. Wait for the readiness message, then start/restart the backend so the order service loads that secret. Keep the listener running. On systems without the default Windows npm global path, set `STRIPE_CLI_SHIM` to the installed `@stripe/cli/bin/shim.js`.

With MongoDB, Redis and the backend running:

```sh
node scripts/verify-stripe-test.cjs
```

This runner accepts only a database named `development` and Stripe test credentials. It creates dedicated test accounts, a shop, SKU and orders, tests payment/webhook replay/decline/cancellation/refund, and writes `tmp/stripe-provider-verification.json`. Audit fixtures remain in the development database; the product is marked inactive/deleted and the temporary administrator is downgraded afterward. Reserved `.invalid` fixture addresses are excluded from outgoing order emails. This is an actual Stripe test API check, not a real-money charge or a browser card-entry test.

## Commerce behavior

GHTK fee API setup and the read-only verification command are documented in [GHTK setup](docs/ghtk-setup.md). Carrier checkout pricing is pending credentials, shipping data and an explicit VND/USD conversion policy.

Prices are USD. Shipping defaults to free; `SHIPPING_FEE_USD` sets a flat fee per shop. Final price, stock, coupon and shipping values are calculated server-side before payment.

See [commerce changes and activation](docs/commerce-improvements.md) for SKU inventory, return workflow, payment confirmation, PC Builder, database changes and verification limits. The older [implementation tracker](docs/implementation-progress.md) records the wider project's acceptance status.
