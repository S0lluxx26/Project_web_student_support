/*
 * Session lifecycle and edit preservation — the prerequisites the browser LLM
 * would otherwise amplify.
 *
 *     npm install --no-save playwright && npx playwright install chromium
 *     node scripts/smoke-session.mjs
 *
 * Every one of these covers a defect that was really present, and every one is
 * the kind that no unit test would have caught because it lives in the gap
 * between a promise, a DOM node and a user changing their mind. They run
 * against the real page with the real engine: a mock cannot reproduce "the
 * recognition you started ten seconds ago is still running".
 *
 * The stakes are specific. If an old recognition can land in a new session, the
 * report a student acts on contains a conversation they did not submit. If a
 * correction can be silently overwritten, the amount or the negation they fixed
 * goes back to what the engine misread. Attaching a language model to that
 * state before fixing it would multiply the same errors into generated prose.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSiteServer, listen } from './serve-site.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8768);
const SHOT = path.join(ROOT, 'demo/screenshots/01-kakao-pressure.jpg');
const SHOT2 = path.join(ROOT, 'demo/screenshots/02-kakao-ordinary.jpg');

let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  console.error('FAIL  playwright is not installed — this check did not run.');
  process.exit(1);
}
if (!fs.existsSync(SHOT)) {
  console.error('FAIL  demo/screenshots is missing — regenerate it first.');
  process.exit(1);
}

const server = createSiteServer({ root: ROOT });
await listen(server, PORT);

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const eq = (got, want, m) =>
  ok(got === want, m + (got === want ? '' : `\n        want ${JSON.stringify(want)}\n        got  ${JSON.stringify(got)}`));

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ locale: 'ko-KR' });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

const open = async () => {
  await page.goto(`http://127.0.0.1:${PORT}/?t=${Date.now()}#/housing/conversation`,
                  { waitUntil: 'load' });
  await page.waitForSelector('body[data-ready="true"]', { timeout: 20000 });
};
const readShot = async (file = SHOT) => {
  await page.click('#ocr-panel > summary').catch(() => {});
  await page.setInputFiles('#ocr-file', file);
  await page.waitForSelector('#ocr-review:not([hidden])', { timeout: 240000 });
};

try {
  /* ------------------------------------------------- edits survive things */
  console.log('\n--- a correction outlives everything except reset ---');
  await open();
  await readShot();

  const CORRECTION = '상대방: 보증금은 삼천만원이 아니라 오천만원입니다';
  await page.fill('#ocr-text', (await page.inputValue('#ocr-text')) + '\n' + CORRECTION);

  /* The bug: flipping the side rebuilt the textarea from the original
     recognition, discarding the correction without a word. */
  const sidesVisible = await page.isVisible('#ocr-sides');
  if (sidesVisible) {
    await page.check('[name="ocr-mine"][value="left"]');
    ok((await page.inputValue('#ocr-text')).includes(CORRECTION),
       'changing which side is "me" keeps the correction');
    ok(await page.isVisible('#btn-ocr-relabel'),
       'and offers the re-label as a button instead of doing it silently');

    await page.click('#btn-ocr-relabel');
    ok(!(await page.inputValue('#ocr-text')).includes(CORRECTION),
       'pressing that button does rebuild the draft, as advertised');
    await page.fill('#ocr-text', (await page.inputValue('#ocr-text')) + '\n' + CORRECTION);
  } else {
    console.log('      (no side split on this capture; side test skipped)');
  }

  await page.click('#lang-toggle');
  await page.waitForTimeout(200);
  ok((await page.inputValue('#ocr-text')).includes(CORRECTION),
     'switching language keeps it');
  await page.click('#lang-toggle');
  await page.waitForTimeout(200);

  await page.click('[data-goto-step="1"]');
  await page.click('[data-goto-step="2"]');
  ok((await page.inputValue('#ocr-text')).includes(CORRECTION),
     'navigating away and back keeps it');

  await page.click('#btn-ocr-append');
  ok((await page.inputValue('#chat-input')).includes(CORRECTION),
     'and it is the corrected text that reaches the analyzer');

  /* -------------------------------------------------- reset owns it all */
  console.log('\n--- reset clears the whole session ---');
  await page.fill('#ctx-deposit', '3000');
  await page.click('#btn-reset');
  await page.waitForTimeout(150);
  eq(await page.inputValue('#chat-input'), '', 'the conversation box is empty');
  eq(await page.inputValue('#ctx-deposit'), '', 'the context numbers are empty');
  eq(await page.inputValue('#ocr-text'), '', 'the review box is empty');
  ok(await page.isHidden('#ocr-review'), 'the review pane is closed');
  ok(await page.evaluate(() => window.Housing.ocrState === null),
     'the recognition state is dropped');
  ok(await page.evaluate(() => window.Housing.lastResult === null),
     'the previous report is dropped');
  ok(await page.evaluate(() => document.getElementById('export-preview') === null),
     'any open export preview is dismissed');

  /* --------------------------------------- a stale result cannot land */
  console.log('\n--- a recognition in flight cannot repopulate a new session ---');
  await open();
  await page.click('#ocr-panel > summary');
  await page.setInputFiles('#ocr-file', SHOT);
  /* Reset WHILE it is reading. The wasm cannot be aborted, so the promise is
     still coming; the session id is what stops it from being applied. */
  await page.waitForTimeout(120);
  await page.click('#btn-reset');
  await page.waitForTimeout(9000);
  eq(await page.inputValue('#ocr-text'), '',
     'the old recognition never reached the new session');
  eq(await page.inputValue('#chat-input'), '', 'and never reached the analyzer');
  ok(await page.isHidden('#ocr-review'), 'the review pane stayed closed');

  console.log('\n--- starting a second read supersedes the first ---');
  await open();
  await page.click('#ocr-panel > summary');
  await page.setInputFiles('#ocr-file', SHOT);
  await page.waitForTimeout(120);
  await page.setInputFiles('#ocr-file', SHOT2);        /* B supersedes A */
  await page.waitForSelector('#ocr-review:not([hidden])', { timeout: 240000 });
  await page.waitForTimeout(6000);                      /* let A resolve */
  const draft = await page.inputValue('#ocr-text');
  ok(draft.includes('토요일') || draft.includes('신분증'),
     'the review box holds the SECOND screenshot');
  ok(!draft.includes('가계약금'), 'and not the first one');

  console.log('\n--- cancel ---');
  await open();
  await page.click('#ocr-panel > summary');
  await page.setInputFiles('#ocr-file', SHOT);
  await page.waitForSelector('#ocr-cancel-row:not([hidden])', { timeout: 5000 });
  await page.click('#btn-ocr-cancel');
  await page.waitForTimeout(9000);
  ok(await page.isHidden('#ocr-review'), 'a cancelled read never opens the review pane');

  /* --------------------------------------------- nothing deleted in secret */
  console.log('\n--- cleanup is inspectable ---');
  await open();
  await readShot();
  ok(await page.isVisible('#btn-ocr-original'),
     'the draft offers to show what cleanup removed');
  await page.click('#btn-ocr-original');
  const original = await page.textContent('#ocr-original pre');
  ok((original || '').length > 0, 'and the uncleaned text is actually there');
  ok(await page.isVisible('#ocr-sources img'),
     'the source screenshot is shown beside the text to check it against');

  /* ---------------------------------------- screenshot goes straight to a report */
  console.log('\n--- a screenshot reaches a report without the contract step ---');
  await open();
  await readShot();
  await page.click('#btn-ocr-analyze');
  await page.waitForSelector('#housing-step-4:not([hidden])', { timeout: 10000 });
  ok(await page.isVisible('#result-root'), 'the report is on screen');
  ok(await page.isHidden('#housing-step-3'), 'the contract step was not in the way');
  const verdict = await page.evaluate(() =>
    window.Housing.lastResult && window.Housing.lastResult.assessment);
  ok(verdict === 'strong_warning_signals' || verdict === 'needs_review',
     `with a real verdict (${verdict})`);

  /* ------------------------------------------------- print is redacted too */
  console.log('\n--- print goes through the redaction preview ---');
  await page.evaluate(() => {
    /* Keep the print dialog from blocking the run; we are testing the path to
       it, not the platform's printer. */
    window.__printed = null;
    window.print = () => { window.__printed = document.querySelector('#print-sheet pre').textContent; };
  });
  /* We are on the result step after the direct path above; the conversation
     box lives on step 2. */
  await page.click('[data-goto-step="2"]');
  await page.fill('#chat-input',
    '집주인: 계좌번호 110-123-456789 로 오늘 계약금 보내주세요. 연락처는 010-1234-5678 입니다.');
  await page.click('#btn-analyze');
  await page.waitForSelector('#housing-step-3', { timeout: 10000 });
  await page.click('[data-goto-step="4"]');
  await page.click('#btn-print');
  ok(await page.isVisible('#export-preview'),
     'print opens the same preview copy and share use');
  await page.click('#export-go');
  const printed = await page.evaluate(() => window.__printed);
  ok(typeof printed === 'string' && printed.length > 0, 'something was sent to the printer');
  ok(printed && !printed.includes('110-123-456789'), 'the account number was masked');
  ok(printed && !printed.includes('010-1234-5678'), 'the phone number was masked');

  ok(errors.length === 0,
     'no page errors' + (errors.length ? ':\n        ' + errors.join('\n        ') : ''));
} catch (e) {
  ok(false, 'threw: ' + (e && e.stack || e));
  if (errors.length) console.error('      page errors:\n        ' + errors.join('\n        '));
} finally {
  await browser.close();
  server.close();
}

console.log('\n' + (fails ? fails + ' FAILURES' : 'ALL PASSED (session lifecycle)'));
process.exit(fails ? 1 : 0);
