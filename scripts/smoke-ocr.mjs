/*
 * OCR browser smoke test — THE GATE.  Run from the repo root:
 *
 *     npm install --no-save playwright && npx playwright install chromium
 *     node scripts/smoke-ocr.mjs
 *
 * `OCR.enabled` in assets/js/ocr.js is only allowed to be true while this
 * passes against the current build. Everything the mock tests cannot see lives
 * here: whether the Web Worker starts from the vendored path, whether the
 * browser accepts the wasm build we ship, whether the language file is served
 * in a form the worker can read, whether the review pane fills, and
 * whether the reviewed text actually reaches the conversation box.
 *
 * It drives the real page — no stubs, no injected text. It serves the repo over
 * http (via the shared server in scripts/serve-site.mjs) because a file://
 * origin cannot start a worker, and it uploads a committed fixture through the
 * real <input type="file">.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSiteServer, listen } from './serve-site.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUESTED_PORT = Number(process.env.OCR_TEST_PORT || 0);

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('FAIL  playwright is not installed — the gate did not run.');
  console.error('      npm install --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const server = createSiteServer({ root: ROOT });
await listen(server, REQUESTED_PORT);
const PORT = server.address().port;

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };

/* CHROMIUM_PATH lets a machine that already has a Chromium point at it rather
   than downloading a second copy, and rescues the case where the installed
   playwright expects a build revision the machine does not have. */
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

try {
  await page.goto(`http://127.0.0.1:${PORT}/#/housing/conversation`, { waitUntil: 'load' });
  await page.waitForSelector('body[data-ready="true"]', { timeout: 20000 });
  ok(true, 'the app boots');

  /* The flag gates the control, so force it on for the run and re-bind. This
     is the one thing the test may override — it is testing whether turning it
     on is justified. */
  // Exercise the shipped binding; binding twice would start two OCR jobs.

  const visible = await page.isVisible('#ocr-panel');
  ok(visible, 'the screenshot reader appears once the flag is on');
  ok(await page.evaluate(() => window.OCR.unavailable()) === null,
     'this browser reports it can run OCR');

  await page.click('#ocr-panel > summary');
  await page.setInputFiles('#ocr-file', path.join(ROOT, 'scripts/fixtures/kakao-ko.png'));

  /* The first run downloads the model and compiles the wasm, so this is
     generous on purpose. A tighter timeout here would fail on CI's disk, not
     on a real defect. */
  await page.waitForSelector('#ocr-review:not([hidden])', { timeout: 180000 });
  ok(true, 'the real worker ran and the review pane opened');

  const draft = await page.inputValue('#ocr-text');
  console.log('\n      --- what the browser actually read ---');
  console.log(draft.split('\n').map(l => '      | ' + l).join('\n'));
  console.log('      --------------------------------------\n');

  /* The same phrases the Node run asserts, now through the browser's own
     canvas, worker and wasm. If greyscaling in the browser differs from the
     Node path, the outgoing lines go missing here and nowhere else. */
  [['계약금', 'the deposit demand'],
   ['명의 계좌', 'the personal-account request'],
   ['못 보여드려요', 'the refusal to show the room'],
   ['등기부등본', 'an OUTGOING bubble — the greyscale step worked in-browser']]
    .forEach(([needle, what]) => ok(draft.includes(needle), `read ${what}`));

  ok(!/\d{1,2}:\d{2}\s*$/m.test(draft), 'timestamps were cleaned off the line ends');
  /* Regression: the labelled draft is built from the engine's raw line text, so
     it has its own path through clean(). The first version of it skipped that
     and shipped every mangled timestamp straight into the box. */
  ok(!/[.,]\s*[0-9]*[*=:;^"]+\S*\s*$/m.test(draft),
     'and the labelled draft was cleaned too, not just the unlabelled one');

  /* The gate itself: nothing may reach the analyzer before the button. */
  ok(await page.inputValue('#chat-input') === '',
     'the conversation box is still empty — recognition alone does not feed the analyzer');

  const sidesShown = await page.isVisible('#ocr-sides');
  if (sidesShown) {
    ok(await page.isChecked('[name="ocr-mine"][value="none"]'), 'speaker identity is unknown until the user confirms');
    await page.check('[name="ocr-mine"][value="right"]');
    ok((await page.inputValue('#ocr-text')).includes(':'), 'confirmed side produces editable speaker labels');
  } else {
    console.log('      (no side split on this fixture; labelling falls back to manual)');
  }

  /* Prove an edit survives: this is what the review pane is for. */
  await page.fill('#ocr-text', draft + '\n상대방: 오늘 안에 입금해주세요');
  await page.click('#btn-ocr-append');

  const chat = await page.inputValue('#chat-input');
  ok(chat.includes('계약금'), 'the reviewed text reached the conversation box');
  ok(chat.includes('오늘 안에 입금해주세요'), 'and the user\'s edit went with it');
  ok(await page.isHidden('#ocr-review'), 'the review pane closes after appending');

  /* End to end: the appended text must actually produce a finding, or the
     feature is a text box that goes nowhere. */
  await page.click('#btn-analyze');
  await page.waitForSelector('#housing-step-4', { timeout: 10000 });
  const assessment = await page.evaluate(() => {
    window.Housing.runAnalysis();
    return window.Housing.lastResult && window.Housing.lastResult.assessment;
  });
  ok(assessment === 'needs_review' || assessment === 'strong_warning_signals',
     `the recognised conversation reaches a real verdict (${assessment})`);

  ok(errors.length === 0, 'no page errors' + (errors.length ? ':\n        ' + errors.join('\n        ') : ''));
} catch (e) {
  ok(false, 'smoke test threw: ' + (e && e.message || e));
  if (errors.length) console.error('      page errors:\n        ' + errors.join('\n        '));
} finally {
  await browser.close();
  server.close();
}

console.log('\n' + (fails
  ? fails + ' FAILURES — OCR.enabled must stay false'
  : 'ALL PASSED — this build is cleared to ship with OCR.enabled = true'));
process.exit(fails ? 1 : 0);
