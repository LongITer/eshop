const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const services = ['api-gateway', 'auth-service', 'product-service', 'order-service', 'admin-service', 'recommendation-service', 'chatting-service', 'chatbot-service', 'logger-service', 'kafka-service'];
async function build() {
  const selected = process.argv[2] ? [process.argv[2]] : services;
  for (const service of selected) {
    if (!services.includes(service)) throw new Error('Unknown service');
    const outdir = path.join('.build', service);
    await esbuild.build({ entryPoints: [`apps/${service}/src/main.ts`], outfile: `${outdir}/main.js`, bundle: true, platform: 'node', target: 'node22', packages: 'external', tsconfig: 'tsconfig.base.json', sourcemap: true });
    for (const entry of ['assets', 'utils/send-email/email-templates']) {
      const source = `apps/${service}/src/${entry}`;
      if (fs.existsSync(source)) fs.cpSync(source, `${outdir}/${entry}`, { recursive: true });
    }
    console.log(`Built ${service}`);
  }
}
build().catch(error => { console.error(error); process.exitCode = 1; });
