// Read-only carrier check. Does not create a shipment or change checkout prices.
const fs = require('node:fs');
const env = { ...require('dotenv').parse(fs.readFileSync('.env')), ...process.env };
const reportPath = 'tmp/ghtk-fee-verification.json';
async function main() {
  const required = ['GHTK_API_TOKEN', 'GHTK_PARTNER_CODE', 'GHTK_ENVIRONMENT', 'GHTK_TEST_PROVINCE', 'GHTK_TEST_WARD', 'GHTK_TEST_WEIGHT_GRAMS'];
  if (!env.GHTK_PICK_ADDRESS_ID) required.push('GHTK_PICK_PROVINCE', 'GHTK_PICK_WARD');
  const missing = required.filter(key => !env[key]?.trim());
  if (missing.length) throw new Error('Missing configuration: ' + missing.join(', '));
  const hosts = { staging: 'https://services-staging.ghtklab.com', production: 'https://services.giaohangtietkiem.vn' };
  const host = hosts[env.GHTK_ENVIRONMENT];
  if (!host) throw new Error('GHTK_ENVIRONMENT must be staging or production');
  const weight = Number(env.GHTK_TEST_WEIGHT_GRAMS);
  if (!Number.isSafeInteger(weight) || weight <= 0) throw new Error('GHTK_TEST_WEIGHT_GRAMS must be a positive integer');
  const url = new URL('/services/shipment/fee', host);
  const fields = {
    pick_address_id: 'GHTK_PICK_ADDRESS_ID', pick_province: 'GHTK_PICK_PROVINCE',
    pick_district: 'GHTK_PICK_DISTRICT', pick_ward: 'GHTK_PICK_WARD', pick_address: 'GHTK_PICK_ADDRESS',
    province: 'GHTK_TEST_PROVINCE', district: 'GHTK_TEST_DISTRICT', ward: 'GHTK_TEST_WARD', address: 'GHTK_TEST_ADDRESS',
  };
  for (const [field, key] of Object.entries(fields)) if (env[key]?.trim()) url.searchParams.set(field, env[key].trim());
  url.searchParams.set('weight', String(weight));
  if (env.GHTK_TEST_VALUE_VND?.trim()) {
    const value = Number(env.GHTK_TEST_VALUE_VND);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('GHTK_TEST_VALUE_VND must be a nonnegative integer');
    url.searchParams.set('value', String(value));
  }
  let response;
  try {
    response = await fetch(url, { headers: { Token: env.GHTK_API_TOKEN, 'X-Client-Source': env.GHTK_PARTNER_CODE }, redirect: 'error', signal: AbortSignal.timeout(15000) });
  } catch { throw new Error('GHTK connection failed or timed out; check network and environment'); }
  if (!response.ok) throw new Error(`GHTK HTTP ${response.status}; check token permissions and environment`);
  let body;
  try { body = await response.json(); } catch { throw new Error('GHTK returned invalid JSON'); }
  if (body.success !== true) throw new Error('GHTK rejected the fee request; check token permissions and address configuration');
  const fee = body.fee;
  if (!fee || typeof fee.delivery !== 'boolean' || !Number.isSafeInteger(fee.fee) || fee.fee < 0 || !Number.isSafeInteger(fee.insurance_fee) || fee.insurance_fee < 0) throw new Error('GHTK returned an unexpected fee format');
  if (!fee.delivery) throw new Error('GHTK does not support delivery to the configured destination');
  const extras = fee.extFees ?? [];
  if (!Array.isArray(extras) || extras.some(item => !item || !Number.isSafeInteger(item.amount) || item.amount < 0)) throw new Error('GHTK returned unexpected surcharge data');
  // Keep fields separate: the documentation does not define whether extFees are included in fee.fee.
  const report = { passed: true, checkedAt: new Date().toISOString(), environment: env.GHTK_ENVIRONMENT, currency: 'VND', delivery: fee.delivery, feeVnd: fee.fee, insuranceFeeVnd: fee.insurance_fee, additionalFeeAmountsVnd: extras.map(item => item.amount), shipmentCreated: false, checkoutIntegrated: false };
  fs.mkdirSync('tmp', { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('PASS: authenticated GHTK fee response. Report: ' + reportPath);
}
main().catch(error => {
  fs.mkdirSync('tmp', { recursive: true });
  // Overwrite previous success so a failed rerun cannot leave misleading evidence.
  fs.writeFileSync(reportPath, JSON.stringify({ passed: false, checkedAt: new Date().toISOString(), error: error.message }, null, 2));
  console.error(error.message);
  process.exitCode = 1;
});
