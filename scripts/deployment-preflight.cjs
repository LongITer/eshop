// Offline configuration validation only. Never connects, changes env files, or prints values.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const placeholder = value => /replace[-_ ]?with|placeholder|your[-_ ]|changeme/i.test(value || '');
function validateEnvironment(env, { mode = 'staging', nodeVersion = process.versions.node } = {}) {
  if (!['development', 'staging', 'production'].includes(mode)) throw new Error('Unsupported mode.');
  const issues = [];
  const add = (level, name, message) => issues.push({ level, name, message });
  const error = (name, message) => add('error', name, message);
  const warning = (name, message) => add('warning', name, message);
  const value = name => String(env[name] || '').trim();
  const required = name => {
    if (!value(name) || placeholder(value(name))) { error(name, 'Set a non-placeholder value.'); return false; }
    return true;
  };
  const url = (name, protocols, mandatory = true) => {
    if (!value(name)) { if (mandatory) required(name); return null; }
    try {
      const parsed = new URL(value(name));
      if (!protocols.includes(parsed.protocol) || !parsed.hostname) throw new Error();
      return parsed;
    } catch { error(name, 'Set a valid URL with the expected protocol.'); return null; }
  };
  if (Number(nodeVersion.split('.')[0]) !== 22) warning('NODE_VERSION', 'CI and containers use Node.js 22; use that version for reproducible verification.');
  for (const name of ['ACCESS_TOKEN_JWT_SECRET', 'REFRESH_TOKEN_JWT_SECRET']) {
    if (required(name) && value(name).length < 32) error(name, 'Use a random secret of at least 32 characters.');
  }
  if (value('ACCESS_TOKEN_JWT_SECRET') && value('ACCESS_TOKEN_JWT_SECRET') === value('REFRESH_TOKEN_JWT_SECRET')) error('JWT_SECRETS', 'Access and refresh secrets must differ.');
  const db = url('DATABASE_URL', ['mongodb:', 'mongodb+srv:']);
  if (db) {
    if (!db.pathname.slice(1) || db.pathname.slice(1).includes('/')) error('DATABASE_URL', 'Select an explicit database name.');
    if (db.protocol === 'mongodb:' && !db.searchParams.get('replicaSet')) error('DATABASE_URL', 'Transactions need a replica set; declare replicaSet for a non-SRV connection.');
    if (mode === 'production' && (!db.username || !db.password)) error('DATABASE_URL', 'Production must use an authenticated database connection.');
    if (mode === 'production' && ['test', 'development', 'acceptance'].includes(db.pathname.slice(1).toLowerCase())) error('DATABASE_URL', 'Do not deploy production against a test or development database.');
    warning('DATABASE_TOPOLOGY', 'Offline validation cannot confirm replica-set availability, indexes, permissions or backups.');
  }
  const redis = url('REDIS_DATABASE_URL', ['redis:', 'rediss:']);
  if (redis && mode === 'production' && !redis.password) error('REDIS_DATABASE_URL', 'Production must use an authenticated Redis connection.');
  required('KAFKA_BROKERS');
  if (!['true', 'false'].includes(value('KAFKA_SSL'))) error('KAFKA_SSL', 'Set true or false explicitly.');
  if (Boolean(value('KAFKA_API_KEY')) !== Boolean(value('KAFKA_API_SECRET'))) error('KAFKA_CREDENTIALS', 'Configure both SASL key and secret, or neither for an isolated local broker.');
  if (mode === 'production' && value('KAFKA_SSL') !== 'true') error('KAFKA_SSL', 'Production broker transport must use TLS.');
  const stripeModes = {};
  for (const [name, prefix] of [['STRIPE_SECRET_KEY', 'sk'], ['NEXT_PUBLIC_STRIPE_PUBLIC_KEY', 'pk']]) {
    if (required(name)) {
      const match = value(name).match(new RegExp(`^${prefix}_(test|live)_[A-Za-z0-9]+$`));
      if (!match) error(name, 'Use a Stripe key of the expected type.');
      else stripeModes[name] = match[1];
    }
  }
  if (stripeModes.STRIPE_SECRET_KEY && stripeModes.NEXT_PUBLIC_STRIPE_PUBLIC_KEY && stripeModes.STRIPE_SECRET_KEY !== stripeModes.NEXT_PUBLIC_STRIPE_PUBLIC_KEY) error('STRIPE_KEYS', 'Secret and publishable keys must use the same mode.');
  const expectedStripeMode = mode === 'production' ? 'live' : 'test';
  if (Object.values(stripeModes).some(keyMode => keyMode !== expectedStripeMode)) error('STRIPE_MODE', `This profile requires Stripe ${expectedStripeMode} keys.`);
  if (required('STRIPE_WEBHOOK_SECRET') && !/^whsec_[A-Za-z0-9]+$/.test(value('STRIPE_WEBHOOK_SECRET'))) error('STRIPE_WEBHOOK_SECRET', 'Set the signing secret for this environment endpoint.');
  warning('STRIPE_ACCOUNT', 'Key prefixes cannot verify account pairing, webhook delivery or provider permissions.');
  for (const name of ['USER_UI_URL', 'NEXT_PUBLIC_SITE_URL']) {
    const parsed = url(name, ['http:', 'https:']);
    if (parsed && (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/')) error(name, 'Use an origin only, without credentials, paths or query parameters.');
    if (parsed && mode !== 'development' && parsed.protocol !== 'https:') error(name, 'Staging and production public origins must use HTTPS.');
  }
  url('GATEWAY_INTERNAL_URL', ['http:', 'https:']);
  const ws = url('NEXT_PUBLIC_CHAT_WS_URL', ['ws:', 'wss:']);
  if (ws && mode !== 'development' && ws.protocol !== 'wss:') error('NEXT_PUBLIC_CHAT_WS_URL', 'HTTPS sites require a secure WebSocket endpoint.');
  if (value('SHIPPING_FEE_USD') && (!Number.isFinite(Number(value('SHIPPING_FEE_USD'))) || Number(value('SHIPPING_FEE_USD')) < 0)) error('SHIPPING_FEE_USD', 'Set a finite, nonnegative amount in USD.');
  if (!value('SMTP_HOST') && !value('SMTP_SERVICE')) error('SMTP_HOST', 'Configure SMTP_HOST or SMTP_SERVICE for registration and order emails.');
  required('SMTP_USER'); required('SMTP_PASS');
  if (value('SMTP_PORT') && (!/^\d+$/.test(value('SMTP_PORT')) || Number(value('SMTP_PORT')) < 1 || Number(value('SMTP_PORT')) > 65535)) error('SMTP_PORT', 'Use an integer from 1 to 65535.');
  const imageKitNames = ['IMAGEKIT_PUBLIC_KEY', 'IMAGEKIT_PRIVATE_KEY', 'IMAGEKIT_URL_ENDPOINT'];
  for (const name of imageKitNames) required(name);
  url('IMAGEKIT_URL_ENDPOINT', ['https:'], false);
  const googleNames = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
  if (googleNames.some(name => value(name))) for (const name of googleNames) required(name);
  else warning('GOOGLE_LOGIN', 'Google login is not configured.');
  if (value('GOOGLE_REDIRECT_URI')) url('GOOGLE_REDIRECT_URI', mode === 'development' ? ['http:', 'https:'] : ['https:']);
  if (!value('GEMINI_API_KEY')) warning('GEMINI_API_KEY', 'AI provider credentials are absent; verify the chatbot fallback.');
  if (!value('VAPID_PUBLIC_KEY') || !value('VAPID_PRIVATE_KEY') || !value('VAPID_SUBJECT')) warning('WEB_PUSH', 'Web push is not fully configured.');
  return { mode, passed: !issues.some(issue => issue.level === 'error'), issues };
}

function readEnvironment(file, inherited = process.env) {
  // Shell/secret-manager values take precedence, like dotenv.config() in services.
  return { ...dotenv.parse(fs.readFileSync(file)), ...inherited };
}

function main(args = process.argv.slice(2)) {
  let mode = 'staging';
  let envFile = path.resolve('.env');
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') json = true;
    else if (args[i] === '--mode' && args[i + 1]) mode = args[++i];
    else if (args[i] === '--env-file' && args[i + 1]) envFile = path.resolve(args[++i]);
    else throw new Error('Usage: node scripts/deployment-preflight.cjs [--env-file FILE] [--mode development|staging|production] [--json]');
  }
  let env;
  try { env = readEnvironment(envFile); } catch { throw new Error('Cannot read the selected environment file.'); }
  const report = validateEnvironment(env, { mode });
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Offline ${mode} preflight: ${report.passed ? 'PASS' : 'FAIL'}`);
    for (const issue of report.issues) console.log(`${issue.level.toUpperCase()} ${issue.name}: ${issue.message}`);
    console.log('No provider calls or database writes performed. Review warnings and the deployment runbook before release.');
  }
  process.exitCode = report.passed ? 0 : 1;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validateEnvironment, readEnvironment };
