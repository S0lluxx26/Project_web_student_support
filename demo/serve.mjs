/*
 * Serve the SOURCE tree for the demo, so a change shows up on reload without a
 * rebuild.
 *
 *     node demo/serve.mjs [--port 8000] [--open]
 *
 * The server itself lives in scripts/serve-site.mjs — there is one
 * implementation and one media-type table. Four copies of that table is how the
 * language model ends up served with the wrong Content-Type in one of them and
 * nobody notices until a browser refuses it.
 */
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createSiteServer, listen, ROOT } from '../scripts/serve-site.mjs';

const argv = process.argv.slice(2);
const at = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const PORT = Number(at('--port', process.env.PORT || 8000));

const server = createSiteServer({ root: ROOT });
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is in use. Try:  node demo/serve.mjs --port ${PORT + 1}\n`);
    process.exit(1);
  }
  throw e;
});
await listen(server, PORT);

const url = `http://127.0.0.1:${PORT}/`;
console.log(`
  학생 주거 안전 도우미 — demo server (source tree)
  ${url}

  Try these:
    ${url}                          the conversation checker
    ${url}#/housing/conversation    step 2, where the screenshot reader lives
    ${url}#/goshiwon                the goshiwon flow

  Screenshots to feed it are in demo/screenshots/.
  Ctrl-C to stop.
`);

if (argv.includes('--open')) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
            : process.platform === 'darwin' ? ['open', [url]]
            : ['xdg-open', [url]];
  try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* url printed */ }
}
