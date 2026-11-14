const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const envPath = path.resolve('.env');
const env = require('dotenv').parse(fs.readFileSync(envPath));
if (!/^sk_test_/.test(env.STRIPE_SECRET_KEY || '')) throw new Error('A Stripe test secret key is required');
const shim = process.env.STRIPE_CLI_SHIM || path.join(process.env.APPDATA || '', 'npm/node_modules/@stripe/cli/bin/shim.js');
if (!fs.existsSync(shim)) throw new Error('Install the official @stripe/cli or set STRIPE_CLI_SHIM');
const child = spawn(process.execPath, [shim, 'listen', '--forward-to', 'http://localhost:8080/api/create-order', '--events', 'payment_intent.succeeded,refund.created,refund.updated,refund.failed'], {
  env: { ...process.env, STRIPE_API_KEY: env.STRIPE_SECRET_KEY }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
});
let buffer = '';
function output(chunk) {
  buffer += chunk.toString();
  const secret = buffer.match(/whsec_[A-Za-z0-9]+/);
  if (secret && !fs.existsSync('.tmp-stripe-listener-ready')) {
    const current = fs.readFileSync(envPath, 'utf8');
    const line = `STRIPE_WEBHOOK_SECRET=${secret[0]}`;
    fs.writeFileSync(envPath, /^STRIPE_WEBHOOK_SECRET=.*$/m.test(current) ? current.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, line) : current + '\n' + line + '\n');
    fs.writeFileSync('.tmp-stripe-listener-ready', JSON.stringify({ pid: child.pid, configuredAt: new Date().toISOString() }));
    console.log('Stripe test listener ready; signing secret saved to ignored .env. Restart order-service to load it.');
  }
  if (buffer.includes('\n')) {
    const index = buffer.lastIndexOf('\n');
    console.log(buffer.slice(0, index).replace(/(?:whsec_|[spr]k_(?:test|live)_)[A-Za-z0-9]+/g, '[REDACTED]'));
    buffer = buffer.slice(index + 1);
  }
}
// Readiness belongs to this listener session, never to an older process.
if (fs.existsSync('.tmp-stripe-listener-ready')) fs.unlinkSync('.tmp-stripe-listener-ready');
child.stdout.on('data', output); child.stderr.on('data', output);
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { if (fs.existsSync('.tmp-stripe-listener-ready')) fs.unlinkSync('.tmp-stripe-listener-ready'); process.exitCode = code || 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
