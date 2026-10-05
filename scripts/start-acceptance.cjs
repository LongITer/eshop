const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { spawn } = require('node:child_process');
const esbuild = require('esbuild');
const path = require('node:path');
async function main() {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  process.env.DATABASE_URL = replica.getUri('acceptance');
  process.env.ACCESS_TOKEN_JWT_SECRET = 'local-acceptance-access';
  process.env.REFRESH_TOKEN_JWT_SECRET = 'local-acceptance-refresh';
  process.env.STRIPE_SECRET_KEY = 'sk_test_local_stub';
  process.env.NODE_ENV = 'test';
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: process.env, windowsHide: true, stdio: 'pipe' });
    let out = ''; child.stdout.on('data', chunk => { out += chunk; }); child.stderr.on('data', chunk => { out += chunk; }); child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(out)));
  });
  const replacements = { stripe: 'stripe.ts', '@packages/libs/redis': 'redis.ts', '@packages/utils/logs/behavior-log': 'logging.ts' };
  await esbuild.build({ entryPoints: ['tests/acceptance/server.ts'], outfile: '.build/acceptance.cjs', bundle: true, platform: 'node', packages: 'external', tsconfig: 'tsconfig.base.json', plugins: [{ name: 'test-doubles', setup(build) { build.onResolve({ filter: /^(stripe|@packages\/libs\/redis|@packages\/utils\/logs\/behavior-log)$/ }, args => ({ path: path.resolve('tests/acceptance', replacements[args.path]) })); } }] });
  const { server, prisma } = await require('../.build/acceptance.cjs').start();
  const stop = async () => { server.close(); await prisma.$disconnect(); await replica.stop(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch(error => { console.error(error); process.exit(1); });
