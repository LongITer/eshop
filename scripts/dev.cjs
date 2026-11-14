const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

process.env.NX_NATIVE_FILE_CACHE_DIRECTORY ||= path.join(__dirname, '..', '.nx', 'native-cache');
process.env.NX_NO_CLOUD ||= 'true';
// Keep this long-running dev launcher out of the shared Nx daemon/cache write path.
process.env.NX_DAEMON = 'false';

const services = [
  ['auth-service', 6001],
  ['product-service', 6002],
  ['order-service', 6004],
  ['admin-service', 6005],
  ['chatting-service', 6006],
  ['chatbot-service', Number(process.env.CHATBOT_PORT) || 6007],
  ['recommendation-service', Number(process.env.RECOMMENDATION_PORT) || 6008],
  ['logger-service', 6009],
  ['api-gateway', 8080],
  ['kafka-service', null],
];
const children = new Set();
let stopping = false;

function portIsOpen(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = result => { socket.destroy(); resolve(result); };
    socket.setTimeout(700);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

function stop(signal = 'SIGINT') {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(signal);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

async function main() {
  const projects = services.map(([name]) => name).join(',');
  const nxCli = require.resolve('nx/bin/nx');
  console.log(`Building backend services with Nx (${projects})...`);
  const build = spawnSync(process.execPath, [nxCli, 'run-many', '--target=build', `--projects=${projects}`, '--parallel=2'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  });
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status || 1);

  for (const [name, port] of services) {
    if (stopping) break;
    if (port && await portIsOpen(port)) {
      console.log(`${name}: reusing existing listener on ${port}`);
      continue;
    }

    const entry = path.join(__dirname, '..', 'apps', name, 'dist', 'main.js');
    console.log(`${name}: starting${port ? ` on ${port}` : ''}`);
    const child = spawn(process.execPath, [entry], {
      cwd: path.join(__dirname, '..'),
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    children.add(child);
    child.once('error', error => console.error(`${name} failed to start:`, error));
    child.once('exit', (code, signal) => {
      children.delete(child);
      if (!stopping && code !== 0) console.error(`${name} exited (code ${code}, signal ${signal || 'none'}).`);
    });
  }

  if (children.size === 0) {
    console.log('All backend services were already running.');
    return;
  }
  console.log('Backend services are running. Press Ctrl+C to stop services started by this command.');
  await new Promise(resolve => {
    const check = setInterval(() => {
      if (children.size === 0) { clearInterval(check); resolve(); }
    }, 500);
  });
}

main().catch(error => {
  console.error(error);
  stop();
  process.exitCode = 1;
});
