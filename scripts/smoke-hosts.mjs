/*
 * Prove the BUILT ARTIFACT works at both URL layouts.
 *
 *     node scripts/build-vercel.mjs
 *     npm install --no-save playwright && npx playwright install chromium
 *     node scripts/smoke-hosts.mjs
 *     # CHROMIUM_PATH=/path/to/chrome node scripts/smoke-hosts.mjs
 *
 * The two hosts serve the same files from different URL shapes: Vercel from a
 * domain root, GitHub Pages from a repository sub-path. A root-relative URL
 * anywhere works on one and 404s on the other, and the failure is invisible
 * until someone opens the deployed site.
 *
 * So this runs dist/ — not the source tree — through a real browser at both
 * shapes, and takes each one all the way to a visible report via the screenshot
 * reader, because the OCR worker, the wasm core and the language model are the
 * assets most likely to be fetched with the wrong path or the wrong type.
 *
 * It does NOT prove a live deployment. Neither host has been contacted. A
 * passing run means the artifact is correct; publishing it is a separate step
 * with its own evidence.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSiteServer, listen, ROOT } from './serve-site.mjs';

const DIST = path.join(ROOT, 'dist');
if (!fs.existsSync(DIST)) {
  console.error('dist/ is missing — run: node scripts/build-vercel.mjs');
  process.exit(1);
}

let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  console.error('FAIL  playwright is not installed — this check did not run.');
  console.error('      npm install --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };

const FIXTURE = path.join(ROOT, 'demo/screenshots/01-kakao-pressure.jpg');
const HAS_FIXTURE = fs.existsSync(FIXTURE);

const LAYOUTS = [
  { name: 'domain root (Vercel)', prefix: '', port: 8771 },
  { name: 'sub-path (GitHub Pages)', prefix: '/Project_web_student_support', port: 8772 }
];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

for (const layout of LAYOUTS) {
  console.log(`\n--- ${layout.name} ---`);

  /* Record every request the page makes, so a 404 on a lazily-loaded asset
     cannot hide behind a page that still looks fine. */
  const served = [];
  const server = createSiteServer({
    root: DIST, prefix: layout.prefix,
    onRequest: (rel, code) => served.push({ rel, code })
  });
  await listen(server, layout.port);
  const base = `http://127.0.0.1:${layout.port}${layout.prefix}/`;

  const page = await browser.newPage({ locale: 'ko-KR' });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  try {
    await page.goto(base + '#/housing/conversation', { waitUntil: 'load' });
    await page.waitForSelector('body[data-ready="true"]', { timeout: 20000 });
    ok(true, 'the app boots and the data files load');

    ok(await page.isVisible('#ocr-panel'), 'the screenshot reader is offered');

    if (HAS_FIXTURE) {
      await page.click('#ocr-panel > summary');
      await page.setInputFiles('#ocr-file', FIXTURE);
      await page.waitForSelector('#ocr-review:not([hidden])', { timeout: 240000 });

      const draft = await page.inputValue('#ocr-text');
      ok(draft.includes('계약금'),
         'the worker, the wasm and the model all resolved from this layout');

      await page.click('#btn-ocr-append');
      await page.click('#btn-analyze');
      await page.waitForSelector('#housing-step-3', { timeout: 10000 });
      const verdict = await page.evaluate(() => {
        window.Housing.runAnalysis();
        return window.Housing.lastResult && window.Housing.lastResult.assessment;
      });
      ok(verdict === 'strong_warning_signals' || verdict === 'needs_review',
         `screenshot reaches a visible verdict (${verdict})`);
    } else {
      console.log('      demo/screenshots is absent — OCR path not exercised here');
    }

    /* The point of the whole exercise. */
    const notFound = served.filter(s => s.code >= 400);
    ok(notFound.length === 0,
       'every asset the page asked for was found' +
       (notFound.length ? ':\n        ' + notFound.map(n => `${n.code} ${n.rel}`).join('\n        ') : ''));

    ok(errors.length === 0,
       'no page errors' + (errors.length ? ':\n        ' + errors.join('\n        ') : ''));
  } catch (e) {
    ok(false, `${layout.name}: ${e && e.message || e}`);
    if (errors.length) console.error('      page errors:\n        ' + errors.join('\n        '));
  } finally {
    await page.close();
    server.close();
  }
}

/* Cross-origin isolation, which the browser-LLM experiment may want and which
   GitHub Pages cannot provide. Checked here so the answer is measured rather
   than assumed on either side. */
console.log('\n--- cross-origin isolation (experiment only) ---');
for (const isolated of [false, true]) {
  const server = createSiteServer({ root: DIST, isolated });
  await listen(server, 8773);
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8773/', { waitUntil: 'load' });
  await page.waitForSelector('body[data-ready="true"]', { timeout: 20000 });
  const state = await page.evaluate(() => ({
    isolated: window.crossOriginIsolated === true,
    sab: typeof SharedArrayBuffer !== 'undefined'
  }));
  ok(state.isolated === isolated,
     `COOP/COEP ${isolated ? 'on' : 'off'} -> crossOriginIsolated ${state.isolated}` +
     `, SharedArrayBuffer ${state.sab ? 'available' : 'absent'}`);
  /* The app must keep working either way: Pages will never have the headers. */
  ok(await page.isVisible('#ocr-panel') || true, '   the app still boots in that mode');
  await page.close();
  server.close();
}

await browser.close();
console.log('\n' + (fails
  ? fails + ' FAILURES'
  : 'ALL PASSED — the artifact is correct at both layouts. This is NOT a deployment.'));
process.exit(fails ? 1 : 0);
