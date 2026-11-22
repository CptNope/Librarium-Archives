// Starts a local copy of the online server (wrangler dev, from server/), runs the online tests against it, and
// stops it. Needs `npm install` in server/ first. Run with:  npm run test:online  [-- --e2e]
//   tests/online-server.mjs        two players as WebSockets: rooms, seats, turns, rejoining (always)
//   tests/e2e/online.e2e.mjs        the hall in Chromium against a player as a WebSocket (with --e2e)
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.ONLINE_PORT || '8788', BASE = `http://127.0.0.1:${PORT}`;
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1', NO_PROXY: '*', no_proxy: '*' };
const wrangler = spawn(join(root, 'server/node_modules/.bin/wrangler'), ['dev', '--port', PORT, '--ip', '127.0.0.1'], { cwd: join(root, 'server'), env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; wrangler.stdout.on('data', d => { log += d; }); wrangler.stderr.on('data', d => { log += d; });
const stop = code => { wrangler.kill('SIGTERM'); setTimeout(() => process.exit(code), 500); };

let up = false;
for (let i = 0; i < 90 && !up; i++) {
  await new Promise(r => setTimeout(r, 1000));
  try { up = (await fetch(BASE + '/health')).ok; } catch (e) { /* not yet */ }
}
if (!up) { console.error('The local server did not start:\n' + log.slice(-3000)); stop(1); }
else {
  const run = file => new Promise(res => {
    const p = spawn(process.execPath, [join(root, file)], { env: { ...env, ONLINE_URL: BASE }, stdio: 'inherit' });
    p.on('exit', res);
  });
  let code = await run('tests/online-server.mjs');
  if (!code && process.argv.includes('--e2e')) code = await run('tests/e2e/online.e2e.mjs');
  if (code) console.error(log.slice(-2000));
  stop(code || 0);
}
