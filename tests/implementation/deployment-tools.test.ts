const { validateEnvironment } = require('../../scripts/deployment-preflight.cjs');
const { parseOptions, runSmoke } = require('../../scripts/local-load-smoke.cjs');

const staging = () => ({
  DATABASE_URL: 'mongodb://127.0.0.1:27017/staging?replicaSet=rs0',
  REDIS_DATABASE_URL: 'redis://127.0.0.1:6379', KAFKA_BROKERS: '127.0.0.1:9092', KAFKA_SSL: 'false',
  ACCESS_TOKEN_JWT_SECRET: 'a'.repeat(48), REFRESH_TOKEN_JWT_SECRET: 'b'.repeat(48),
  STRIPE_SECRET_KEY: 'sk_test_unitOnly', NEXT_PUBLIC_STRIPE_PUBLIC_KEY: 'pk_test_unitOnly', STRIPE_WEBHOOK_SECRET: 'whsec_unitOnly',
  USER_UI_URL: 'https://store.example.test', NEXT_PUBLIC_SITE_URL: 'https://store.example.test',
  GATEWAY_INTERNAL_URL: 'http://api-gateway:8080', NEXT_PUBLIC_CHAT_WS_URL: 'wss://store.example.test/chatting-ws',
  SMTP_HOST: 'mail.example.test', SMTP_PORT: '587', SMTP_USER: 'sender@example.test', SMTP_PASS: 'unit-only-password',
  IMAGEKIT_PUBLIC_KEY: 'unit-public', IMAGEKIT_PRIVATE_KEY: 'unit-private', IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/unit',
  SHIPPING_FEE_USD: '2.50',
});
const check = (env: Record<string, string>, mode = 'staging') => validateEnvironment(env, { mode, nodeVersion: '22.0.0' });
const errors = (report: any) => report.issues.filter((issue: any) => issue.level === 'error').map((issue: any) => issue.name);

describe('offline deployment preflight', () => {
  it('accepts complete staging configuration without mutating it or hiding provider limitations', () => {
    const env = staging(); const before = { ...env };
    const report = check(env);
    expect(report.passed).toBe(true);
    expect(env).toEqual(before);
    expect(report.issues).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'STRIPE_ACCOUNT', level: 'warning' }), expect.objectContaining({ name: 'DATABASE_TOPOLOGY', level: 'warning' })]));
  });
  it('rejects placeholders, short or shared JWT secrets', () => {
    expect(errors(check({ ...staging(), ACCESS_TOKEN_JWT_SECRET: 'replace-with-a-long-random-secret' }))).toContain('ACCESS_TOKEN_JWT_SECRET');
    expect(errors(check({ ...staging(), ACCESS_TOKEN_JWT_SECRET: 'small' }))).toContain('ACCESS_TOKEN_JWT_SECRET');
    expect(errors(check({ ...staging(), REFRESH_TOKEN_JWT_SECRET: 'a'.repeat(48) }))).toContain('JWT_SECRETS');
  });
  it('rejects incomplete database topology and missing database names', () => {
    expect(errors(check({ ...staging(), DATABASE_URL: 'mongodb://localhost:27017/staging' }))).toContain('DATABASE_URL');
    expect(errors(check({ ...staging(), DATABASE_URL: 'mongodb+srv://user:password@db.example.test/' }))).toContain('DATABASE_URL');
    expect(errors(check({ ...staging(), DATABASE_URL: 'mongodb+srv://user:password@db.example.test/staging' }))).not.toContain('DATABASE_URL');
  });
  it('rejects live Stripe keys in staging and mixed key modes', () => {
    const report = check({ ...staging(), STRIPE_SECRET_KEY: 'sk_live_unitOnly' });
    expect(errors(report)).toEqual(expect.arrayContaining(['STRIPE_KEYS', 'STRIPE_MODE']));
  });
  it('enforces production credentials, isolated database, secure endpoints and live payment profile', () => {
    const report = check({ ...staging(), DATABASE_URL: 'mongodb://localhost/development?replicaSet=rs0', USER_UI_URL: 'http://store.example.test', NEXT_PUBLIC_CHAT_WS_URL: 'ws://store.example.test' }, 'production');
    expect(errors(report)).toEqual(expect.arrayContaining(['DATABASE_URL', 'REDIS_DATABASE_URL', 'KAFKA_SSL', 'STRIPE_MODE', 'USER_UI_URL', 'NEXT_PUBLIC_CHAT_WS_URL']));
    const ready = { ...staging(), DATABASE_URL: 'mongodb+srv://user:pass@db.example.test/eshop', REDIS_DATABASE_URL: 'rediss://user:pass@cache.example.test:6379', KAFKA_SSL: 'true', STRIPE_SECRET_KEY: 'sk_live_unitOnly', NEXT_PUBLIC_STRIPE_PUBLIC_KEY: 'pk_live_unitOnly' };
    expect(check(ready, 'production').passed).toBe(true);
  });
  it('reports email, image storage, broker and amount configuration errors', () => {
    const report = check({ ...staging(), SMTP_PASS: '', IMAGEKIT_PRIVATE_KEY: '', KAFKA_API_KEY: 'unit-only', SHIPPING_FEE_USD: 'Infinity', SMTP_PORT: '70000' });
    expect(errors(report)).toEqual(expect.arrayContaining(['SMTP_PASS', 'IMAGEKIT_PRIVATE_KEY', 'KAFKA_CREDENTIALS', 'SHIPPING_FEE_USD', 'SMTP_PORT']));
  });
  it('does not include secret values or full connection URLs in results', () => {
    const env = { ...staging(), DATABASE_URL: 'invalid-url-containing-secret', STRIPE_SECRET_KEY: 'invalid-stripe-secret', SMTP_PASS: 'password-never-print' };
    const serialized = JSON.stringify(check(env));
    for (const secret of [env.DATABASE_URL, env.STRIPE_SECRET_KEY, env.SMTP_PASS, env.ACCESS_TOKEN_JWT_SECRET, env.REFRESH_TOKEN_JWT_SECRET]) expect(serialized).not.toContain(secret);
  });
});

describe('bounded local load smoke', () => {
  it.each(['https://example.com', 'http://example.com', 'http://127.0.0.1@evil.test', 'http://127.0.0.1/path', 'http://127.0.0.1?token=secret', 'http://127.0.0.1#fragment', 'http://127.0.0.1:8080@evil.test'])('refuses non-loopback or decorated targets: %s', (base: string) => {
    expect(() => parseOptions(['--base', base])).toThrow();
  });
  it('pins localhost to literal loopback and bounds request count, concurrency and timeouts', () => {
    expect(parseOptions(['--base', 'http://localhost:8185']).base).toBe('http://127.0.0.1:8185');
    for (const args of [['--requests', '121'], ['--concurrency', '6'], ['--timeout-ms', '10001'], ['--requests', '2'], ['--requests', '3.1']]) expect(() => parseOptions(args)).toThrow();
  });
  it('sends only fixed GETs, disables redirects and respects configured concurrency', async () => {
    let active = 0; let peak = 0;
    const request = jest.fn(async (url: string, init: RequestInit) => {
      active++; peak = Math.max(peak, active);
      expect(init.method).toBe('GET'); expect(init.redirect).toBe('manual'); expect(init.headers).toEqual({ accept: 'application/json' });
      await new Promise(resolve => setTimeout(resolve, 1)); active--;
      return Response.json(url.includes('get-filtered-products') ? { products: [] } : { categories: [] });
    });
    const report = await runSmoke(parseOptions(['--requests', '9', '--concurrency', '2']), request);
    expect(report.passed).toBe(true); expect(report.requests).toBe(9); expect(peak).toBeLessThanOrEqual(2);
    expect(request).toHaveBeenCalledTimes(9);
    expect(report.summary.map((entry: any) => entry.requests)).toEqual([3, 3, 3]);
  });
  it('fails on redirects, HTTP errors and unexpected HTML without reporting response bodies', async () => {
    const responses = [new Response(null, { status: 302, headers: { location: 'https://example.com' } }), new Response('private-error', { status: 500 }), new Response('<html>not-json</html>', { status: 200 })];
    const report = await runSmoke(parseOptions(['--requests', '3', '--concurrency', '1']), async () => responses.shift());
    expect(report.passed).toBe(false);
    expect(report.summary.every((entry: any) => entry.failed === 1)).toBe(true);
    expect(JSON.stringify(report)).not.toContain('private-error');
  });
  it('fails a 200 catalog response that lacks products', async () => {
    const report = await runSmoke(parseOptions(['--requests', '3']), async () => Response.json({ error: 'not a catalog' }));
    expect(report.passed).toBe(false);
    expect(report.summary[2].failures).toContain('unexpected-json');
  });
});
