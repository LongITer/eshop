const { spawn } = require('node:child_process');
const path = require('node:path');

process.env.NX_DAEMON = 'false';
process.env.NX_NO_CLOUD ||= 'true';

const nxCli = require.resolve('nx/bin/nx');
const child = spawn(process.execPath, [nxCli, ...process.argv.slice(2)], {
  cwd: path.join(__dirname, '..'),
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.once('error', error => {
  console.error('Nx failed to start:', error);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
