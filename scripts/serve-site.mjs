/*
 * The project's static server. One implementation, used by the local preview,
 * the demo runner and the browser tests.
 *
 *     node scripts/build-vercel.mjs
 *     node scripts/serve-site.mjs                 ->  http://127.0.0.1:8765/
 *     node scripts/serve-site.mjs --pages         ->  .../<folder name>/
 *     node scripts/serve-site.mjs --pages --prefix Project_web_student_support
 *     node scripts/serve-site.mjs --src           ->  serve the source tree, no build
 *     node scripts/serve-site.mjs --isolated      ->  add COOP/COEP (experiment only)
 *     node scripts/serve-site.mjs --port 9000 --open
 *
 * Why a server at all: `fetch` cannot read the JSON data files from a file://
 * page and a Web Worker cannot start there, so opening index.html by
 * double-clicking gives a blank screen and a confusing console. OCR in
 * particular can only be tested over http.
 *
 * --pages reproduces the URL SHAPE of GitHub Pages (the repository sub-path),
 * which is what catches a root-relative URL. It does not reproduce Pages'
 * response headers, and --isolated does not reproduce them either: that flag
 * exists to test what the app does WHEN cross-origin isolation is on, not to
 * claim a host provides it. GitHub Pages does not let you set these headers.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
 * The one media-type table. It used to be copied into three test harnesses,
 * which is exactly how the language model ends up served with the wrong type
 * in one of them and nobody notices until a browser refuses it.
 */
export const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
  /* Opaque stream, and deliberately NOT Content-Encoding: gzip. The model is
     vendored uncompressed; a host that marks it as gzip makes the browser
     inflate it in transit and the worker then inflates it again and fails with
     nothing useful in the console. See the note in assets/js/ocr.js. */
  '.traineddata': 'application/octet-stream',
  '.gguf': 'application/octet-stream'
};

/**
 * A static file server over one directory.
 *
 * @param {{root?: string, prefix?: string, isolated?: boolean, onRequest?: function}} opts
 *   root     directory to serve from
 *   prefix   URL prefix to strip, e.g. '/Project_web_student_support'
 *   isolated send COOP/COEP so `crossOriginIsolated` is true in the page
 */
export function createSiteServer(opts = {}) {
  const root = path.resolve(opts.root || path.join(ROOT, 'dist'));
  const prefix = (opts.prefix || '').replace(/\/+$/, '');

  return http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);

    if (prefix) {
      if (urlPath === prefix) { res.writeHead(301, { Location: prefix + '/' }).end(); return; }
      if (!urlPath.startsWith(prefix + '/')) {
        /* Outside the prefix is outside the site. Serving it anyway would hide
           exactly the bug --pages exists to find. */
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404  not under ' + prefix + '/\n');
        if (opts.onRequest) opts.onRequest(urlPath, 404);
        return;
      }
      urlPath = urlPath.slice(prefix.length);
    }

    const rel = urlPath.replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, rel);

    /* Traversal guard. `path.resolve` has already collapsed any ../ so this
       compares the real destination, not the request string. */
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403\n');
      if (opts.onRequest) opts.onRequest(rel, 403);
      return;
    }

    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      /* A real 404. No blanket rewrite to index.html: this app routes on the
         hash, so a missing asset served as the home page would turn a broken
         script tag into a silent, undebuggable failure. */
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404  ' + rel + '\n');
      if (opts.onRequest) opts.onRequest(rel, 404);
      return;
    }

    const headers = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    };
    if (opts.isolated) {
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
      /* Without this the page's own subresources are blocked by its own
         COEP — the first thing that breaks when someone turns isolation on. */
      headers['Cross-Origin-Resource-Policy'] = 'same-origin';
    }
    res.writeHead(200, headers);
    if (opts.onRequest) opts.onRequest(rel, 200);
    fs.createReadStream(file).pipe(res);
  });
}

/** Start one and resolve with { server, url }. Binds to loopback only. */
export function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

/* ------------------------------------------------------------------ CLI */

const isMain = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const argv = process.argv.slice(2);
  const flag = (n) => argv.includes(n);
  const value = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };

  const port = Number(value('--port', process.env.PORT || 8765));
  const pages = flag('--pages');
  const src = flag('--src');
  const isolated = flag('--isolated');
  const root = src ? ROOT : path.join(ROOT, 'dist');
  /* The Pages prefix is the REPOSITORY name, which is only the folder name if
     nobody renamed the checkout. Deriving it silently produces a site where
     every URL 404s and the reason is invisible, so --prefix overrides it and
     the banner below always prints what was used. */
  const prefix = pages ? '/' + value('--prefix', 'Project_web_student_support').replace(/^\/+/, '') : '';

  if (!src && !fs.existsSync(root)) {
    console.error('\n  dist/ does not exist. Build it first:\n' +
                  '      node scripts/build-vercel.mjs\n' +
                  '  or serve the source tree directly with --src\n');
    process.exit(1);
  }

  const server = createSiteServer({ root, prefix, isolated });
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n  Port ${port} is in use. Try:  node scripts/serve-site.mjs --port ${port + 1}\n`);
      process.exit(1);
    }
    throw e;
  });

  await listen(server, port);
  const url = `http://127.0.0.1:${port}${prefix}/`;
  console.log(`
  학생 주거 안전 도우미 — local preview
  ${url}

  serving   ${src ? 'the SOURCE tree (no build)' : 'dist/ (rebuild after editing source)'}
  layout    ${pages ? 'GitHub Pages sub-path' : 'domain root (Vercel)'}
  isolation ${isolated ? 'COOP/COEP ON — experiment only, not what Pages does' : 'off (the default)'}

  ${url}#/housing/conversation   step 2, where the screenshot reader lives
  ${url}#/goshiwon               the goshiwon flow

  Ctrl-C to stop.
`);

  if (flag('--open')) {
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
              : process.platform === 'darwin' ? ['open', [url]]
              : ['xdg-open', [url]];
    try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* printed above */ }
  }
}
