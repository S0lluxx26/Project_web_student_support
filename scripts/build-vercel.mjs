/*
 * Stage the public site into dist/.
 *
 *     node scripts/build-vercel.mjs
 *
 * The same artifact is published to both hosts, so there is exactly one
 * definition of "what is public" and it lives here rather than being implied by
 * whatever happens to sit in the repository root. Before this existed the Pages
 * workflow uploaded `path: .`, which would have published the test suites, the
 * demo screenshots and anything else in the folder.
 *
 * dist/ is disposable output and never source. It is gitignored, it is cleared
 * on every run, and nothing should ever be edited inside it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/* Resolved from this file, not from the shell's working directory: the build
   runs from the repo root on Vercel and from wherever the user happens to be
   locally, and those are not the same place. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

const argv = process.argv.slice(2);
const skipTests = argv.includes('--skip-tests');

const log = (...a) => console.log('  ', ...a);
const die = (msg) => { console.error('\nBUILD FAILED: ' + msg + '\n'); process.exit(1); };

/* ------------------------------------------------------------------ tests */
/*
 * A build that publishes a broken data file is worse than no build. These are
 * the suites that need nothing but node; the real-engine and browser suites
 * need dependencies this build deliberately does not install, and they run in
 * CI instead.
 */
const SUITES = ['test-analyzer.js', 'test-detector.js', 'test-data.js',
                'test-ocr.js', 'test-llm.js', 'test-learning-cases.js'];

if (skipTests) {
  log('tests skipped (--skip-tests)');
} else {
  console.log('\nchecks');
  for (const suite of SUITES) {
    const file = path.join(ROOT, 'scripts', suite);
    if (!fs.existsSync(file)) die(`scripts/${suite} is missing`);
    const r = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) {
      console.error(r.stdout || '');
      console.error(r.stderr || '');
      die(`scripts/${suite} failed (exit ${r.status})`);
    }
    const last = (r.stdout || '').trim().split('\n').pop();
    log(suite.padEnd(20), last);
  }
}

/* ------------------------------------------------------------- what ships */
/*
 * An allowlist, not a denylist. Adding a file to the repo must never publish
 * it by accident — a private fixture or a half-finished note would go out with
 * the next deploy and nobody would notice.
 */
const FILES = ['index.html', 'demo.html', 'help.html', 'manual/PROJECT_GUIDE.md',
  'manual/project-guide.pdf', 'manual/PROJECT_GUIDE_KO.md', 'manual/project-guide-ko.pdf',
  'manual/MAIN_FUNCTIONS_KO.md', 'manual/main-functions-ko.pdf', '.nojekyll', 'LICENSE'];
const DIRS = ['assets', 'data'];

/*
 * The experimental UI is available, but users must explicitly load the model.
 * Publish the runtime so that action can work; do not fetch it at page startup.
 * GGUF weights are never stored under assets or copied to the artifact.
 */
const LLM_DIR = 'assets/vendor/wllama';
const llmSource = fs.existsSync(path.join(ROOT, 'assets/js/llm.js'))
  ? fs.readFileSync(path.join(ROOT, 'assets/js/llm.js'), 'utf8') : '';
const LLM_ON = /^\s*experimental:\s*true/m.test(llmSource);
const SKIP = LLM_ON ? [] : [LLM_DIR];

/* Assets whose absence would break the site silently rather than loudly. */
const REQUIRED = [
  'index.html',
  'demo.html', 'manual/PROJECT_GUIDE.md', 'manual/project-guide.pdf',
  'assets/manual/cases.json',
  'data/patterns.json',
  'data/i18n.json',
  'data/documents.json',
  'assets/js/app.js',
  'assets/css/style.css',
  'assets/vendor/tesseract/tesseract.min.js',
  'assets/vendor/tesseract/worker.min.js',
  'assets/vendor/tesseract/lang/kor.traineddata',
  'assets/vendor/tesseract/tesseract-core-lstm.wasm.js',
  'assets/vendor/tesseract/tesseract-core-simd-lstm.wasm.js'
];
if (LLM_ON) REQUIRED.push('assets/js/llm-ui.js', 'assets/js/llm-worker.js',
  'assets/vendor/wllama/wllama.esm.js', 'assets/vendor/wllama/wllama.wasm',
  'assets/vendor/hash-wasm/sha256.umd.min.js');

/* ------------------------------------------------------------- clear out */
/*
 * Deleting a directory recursively deserves paranoia. Confirm the path is the
 * one we mean, inside the project, and not a symlink or junction that could
 * redirect the removal somewhere else entirely.
 */
function clearOut() {
  if (!fs.existsSync(OUT)) return;
  const st = fs.lstatSync(OUT);
  if (st.isSymbolicLink())
    die('dist is a symlink or junction; refusing to delete through it');
  if (!st.isDirectory()) die('dist exists but is not a directory');
  const real = fs.realpathSync(OUT);
  const realRoot = fs.realpathSync(ROOT);
  if (real !== path.join(realRoot, 'dist'))
    die(`dist resolves to ${real}, which is outside the project; refusing to delete it`);
  fs.rmSync(OUT, { recursive: true, force: true });
}

/* ----------------------------------------------------------------- copy */
let copied = 0, bytes = 0;

function copyFile(rel) {
  const src = path.join(ROOT, rel);
  const dst = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  /* A byte copy, not a transform. The wasm and the language model must arrive
     identical or the worker fails with nothing useful in the console. */
  fs.copyFileSync(src, dst);
  copied++;
  bytes += fs.statSync(src).size;
}

function copyDir(rel) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) die(`${rel}/ is missing`);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const childRel = path.posix.join(rel, entry.name);
    if (SKIP.includes(childRel)) { log(`skipped ${childRel} (experiment unavailable)`); continue; }
    if (/\.(gguf|pem|key)$/i.test(entry.name) || /^id_(rsa|ed25519)/.test(entry.name))
      die(`unexpected model weights or credential file in public assets: ${childRel}`);
    if (entry.isSymbolicLink()) {
      /* node_modules is symlinked in during development; a symlink in the
         published tree would either dangle or leak whatever it points at. */
      log(`skipped symlink ${childRel}`);
      continue;
    }
    if (entry.isDirectory()) copyDir(childRel);
    else if (entry.isFile()) copyFile(childRel);
  }
}

console.log('\nstaging');
clearOut();
fs.mkdirSync(OUT, { recursive: true });

for (const f of FILES) {
  if (!fs.existsSync(path.join(ROOT, f))) {
    if (f === '.nojekyll' || f === 'LICENSE') { log(`skipped missing ${f}`); continue; }
    die(`${f} is missing`);
  }
  copyFile(f);
}
for (const d of DIRS) copyDir(d);

/* --------------------------------------------------------------- verify */
console.log('\nverifying');

const missing = REQUIRED.filter(r => !fs.existsSync(path.join(OUT, r)));
if (missing.length) die('missing from the artifact: ' + missing.join(', '));

/* Every copied byte must match its source. A truncated wasm or model is the
   kind of failure that shows up as a blank screen for a user and nothing at
   all in the build log. */
let checked = 0;
function compare(rel) {
  const a = fs.readFileSync(path.join(ROOT, rel));
  const b = fs.readFileSync(path.join(OUT, rel));
  if (!a.equals(b)) die(`${rel}: copied bytes differ from the source`);
  checked++;
}
function walk(dir, base = '') {
  for (const e of fs.readdirSync(path.join(OUT, dir || '.'), { withFileTypes: true })) {
    const rel = path.posix.join(base, e.name);
    if (e.isDirectory()) walk(path.join(dir, e.name), rel);
    else compare(rel);
  }
}
walk('');

/* The site must stay portable between a domain root and a repository
   sub-path, so no absolute-rooted URL may appear in the HTML. */
for (const file of ['index.html', 'demo.html']) {
  const html = fs.readFileSync(path.join(OUT, file), 'utf8');
  const rooted = [...html.matchAll(/\b(?:src|href)="(\/[^/][^"]*)"/g)].map(m => m[1]);
  if (rooted.length)
    die(file + ' has root-relative URLs, which break on the Pages sub-path: ' +
        [...new Set(rooted)].join(', '));
}

const stamp = {
  builtAt: new Date().toISOString(),
  files: copied,
  bytes,
  node: process.version
};
fs.writeFileSync(path.join(OUT, 'build-info.json'), JSON.stringify(stamp, null, 2) + '\n');

console.log(`\n  browser LLM: ${LLM_ON ? 'opt-in experiment — runtime available, no automatic download' : 'unavailable — runtime not published'}`);
console.log(`  ${copied} files, ${(bytes / 1048576).toFixed(2)} MiB, ${checked} byte-verified`);
console.log(`  artifact: ${OUT}\n`);
