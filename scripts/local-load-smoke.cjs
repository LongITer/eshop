// Fixed, unauthenticated GETs against a loopback origin. No redirects or external traffic.
const { performance } = require('node:perf_hooks');
const paths = ['/gateway-health', '/product/api/get-categories', '/product/api/get-filtered-products?page=1&limit=12'];

function parseOptions(args) {
  const options = { base: 'http://127.0.0.1:8080', requests: 24, concurrency: 2, timeoutMs: 3000 };
  const keys = { '--base': 'base', '--requests': 'requests', '--concurrency': 'concurrency', '--timeout-ms': 'timeoutMs' };
  for (let i = 0; i < args.length; i++) {
    const key = keys[args[i]];
    if (!key || !args[i + 1]) throw new Error('Use --base, --requests, --concurrency or --timeout-ms.');
    options[key] = key === 'base' ? args[++i] : Number(args[++i]);
  }
  let origin;
  try { origin = new URL(options.base); } catch { throw new Error('Use an HTTP loopback origin.'); }
  if (origin.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Only an HTTP loopback origin without credentials or paths is allowed.');
  if (origin.hostname === 'localhost') origin.hostname = '127.0.0.1'; // No DNS resolution, including custom localhost mappings.
  options.base = origin.origin;
  for (const [key, min, max] of [['requests', 3, 120], ['concurrency', 1, 5], ['timeoutMs', 100, 10000]]) {
    if (!Number.isInteger(options[key]) || options[key] < min || options[key] > max) throw new Error(`${key} must be an integer between ${min} and ${max}.`);
  }
  return options;
}

async function runSmoke(options, request = fetch) {
  let next = 0;
  const records = [];
  const started = performance.now();
  async function worker() {
    while (next < options.requests) {
      const index = next++;
      const route = paths[index % paths.length];
      const start = performance.now();
      let status = 0;
      let failure = null;
      try {
        const response = await request(options.base + route, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(options.timeoutMs), headers: { accept: 'application/json' } });
        status = response.status;
        if (status !== 200) { failure = 'http-status'; await response.body?.cancel(); }
        else {
          // Bound memory even if a misconfigured local server returns a large page.
          const reader = response.body?.getReader();
          const chunks = [];
          let size = 0;
          if (reader) {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              size += chunk.value.byteLength;
              if (size > 1024 * 1024) { await reader.cancel(); throw new Error('response-limit'); }
              chunks.push(Buffer.from(chunk.value));
            }
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!body || typeof body !== 'object' || (route.includes('get-filtered-products') && !Array.isArray(body.products))) failure = 'unexpected-json';
        }
      } catch (error) { failure = error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : 'network-or-invalid-response'; }
      records.push({ route, status, failure, ms: performance.now() - start });
    }
  }
  await Promise.all(Array.from({ length: options.concurrency }, worker));
  const summary = paths.map(route => {
    const rows = records.filter(row => row.route === route);
    const times = rows.map(row => row.ms).sort((a, b) => a - b);
    return { route, requests: rows.length, failed: rows.filter(row => row.failure).length, p50Ms: Math.round(times[Math.ceil(times.length * .5) - 1] || 0), p95Ms: Math.round(times[Math.ceil(times.length * .95) - 1] || 0), statuses: [...new Set(rows.map(row => row.status))], failures: [...new Set(rows.flatMap(row => row.failure ? [row.failure] : []))] };
  });
  return { passed: records.every(row => !row.failure), requests: records.length, concurrency: options.concurrency, durationMs: Math.round(performance.now() - started), summary, scope: 'Local read-only smoke; not a production capacity benchmark. No authentication, checkout or AI calls.' };
}

if (require.main === module) {
  (async () => {
    const report = await runSmoke(parseOptions(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.passed ? 0 : 1;
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { parseOptions, runSmoke };
