const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const apps = fs.readdirSync('apps').filter(app => fs.existsSync(`apps/${app}/tsconfig.app.json`) || app.endsWith('-ui'));
let failed = false;
for (const app of apps) {
  const config = `apps/${app}/${app.endsWith('-ui') ? 'tsconfig.json' : 'tsconfig.app.json'}`;
  console.log(`Typechecking ${app}`);
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--emitDeclarationOnly', 'false', '-p', config], { stdio: 'inherit' });
  failed ||= result.status !== 0;
}
process.exitCode = failed ? 1 : 0;
