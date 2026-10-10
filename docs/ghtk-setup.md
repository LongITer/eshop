# GHTK fee verification

Provider selected: GHTK. Implementation status: read-only verification script prepared; authenticated provider verification and checkout integration remain pending.

## Configure

1. Use the account portal matching the environment. Production token management: https://khachhang.giaohangtietkiem.vn/web/thong-tin-shop/cau-hinh-api . Create a token with the fee-calculation permission. For staging, obtain the matching staging account/token from GHTK; do not assume a production token works there.
2. Copy the `GHTK_*` entries from `.env.example` into ignored `.env`. Fill `GHTK_API_TOKEN`, `GHTK_PARTNER_CODE` (shop/partner code), and `GHTK_ENVIRONMENT` (`staging` or `production`). Never put the token in browser environment variables or commit it.
3. Set the actual pickup location using `GHTK_PICK_ADDRESS_ID`, or province/ward and optional district/address. For a multi-seller store, final integration needs a pickup location per shop.
4. Set the test destination province/ward and optional district/address, actual packaged weight in grams, and optional declared value in VND. Use a test route you authorize sending to GHTK.

```sh
node scripts/verify-ghtk-fee.cjs
```

The script calls `GET /services/shipment/fee` with Token and X-Client-Source headers. It rejects missing configuration, redirects, timeouts, unsuccessful responses, invalid fee data and unsupported destinations. It never creates shipments. Output is saved to ignored `tmp/ghtk-fee-verification.json` without tokens or addresses. A failed run overwrites earlier success evidence.

## Checkout prerequisites

Current checkout still uses `SHIPPING_FEE_USD`. Saved addresses need a structured ward; products/SKUs need packaged weight and each seller needs a pickup location. Do not guess these from free-form text or use a fixed weight for all PC parts.

GHTK returns VND while this catalog remains USD. Before charging carrier fees, choose and record an explicit VND-per-USD conversion policy and persist the rate and original quote with each checkout session. No exchange rate has been assumed. Preserve fee, insurance and surcharge fields separately until GHTK confirms whether `extFees` are already included in `fee.fee`; the example alone does not establish the payable total. A successful quote check does not verify shipment creation, tracking or callbacks.

## Official references

- Fee API: https://api.ghtk.vn/docs/submit-order/calculate-shipping-fee/
- Environments and authentication: https://api.ghtk.vn/docs/submit-order/logistic-overview/
