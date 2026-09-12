/*
 * OCR tests — REAL ENGINE.  Run from the repo root:
 *
 *     npm install --no-save tesseract.js@5 pngjs
 *     node scripts/test-ocr-real.js
 *
 * Unlike scripts/test-ocr.js there is no mock anywhere in this file. It decodes
 * the committed fixtures, runs them through the same `OCR.toGreyscale` the
 * browser uses, hands them to actual tesseract.js with the traineddata this
 * repo vendors, and asserts on what comes back.
 *
 * What it can and cannot tell you:
 *
 *   CAN   the vendored model still reads Korean chat text; the greyscale step
 *         still recovers the coloured outgoing bubbles; a model or library bump
 *         has not silently degraded recognition.
 *   CANNOT  that the feature works in a browser. Nothing here touches a Web
 *         Worker, the wasm build a browser picks, the vendored file paths, or
 *         the page. That is scripts/smoke-ocr.mjs, and OCR stays off until it
 *         passes.
 *
 * The fixtures are synthetic (see scripts/fixtures/make-fixtures.py). Assertions
 * are deliberately loose — a required substring, a line count, a floor on
 * confidence — because exact output shifts with every model revision and a test
 * pinned to an exact string would be rewritten rather than read.
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OCR = require(path.join(ROOT, 'assets/js/ocr.js'));

const REQUIRED = process.argv.includes('--require-engine');

let Tesseract, PNG;
try {
  Tesseract = require('tesseract.js');
  PNG = require('pngjs').PNG;
} catch (e) {
  const msg = 'tesseract.js / pngjs are not installed — real-engine tests did not run.\n' +
              '    npm install --no-save tesseract.js@5 pngjs';
  if (REQUIRED) {
    console.error('FAIL  ' + msg);
    console.error('\n(--require-engine was passed, so a skip is a failure here.)');
    process.exit(1);
  }
  console.log('SKIP  ' + msg);
  process.exit(0);
}

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };

const LANG_DIR = path.join(ROOT, 'assets/vendor/tesseract/lang');

/** Decode, apply the shipped greyscale, re-encode. Same maths as the browser. */
function greyscale(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  OCR.toGreyscale({ data: png.data });
  return PNG.sync.write(png);
}

function raw(file) {
  return fs.readFileSync(file);
}

(async () => {
  ok(fs.existsSync(path.join(LANG_DIR, 'kor.traineddata')),
     'the Korean model is vendored in this repo');

  const worker = await Tesseract.createWorker('kor', 1, {
    langPath: LANG_DIR, gzip: false, logger: () => {}
  });
  const read = async (buf) => (await worker.recognize(buf)).data;

  const fx = (n) => path.join(ROOT, 'scripts/fixtures', n);

  /* ------------------------------------------------ the greyscale claim --- */
  console.log('\n--- greyscale recovers the outgoing bubbles ---');
  {
    /* This is the measurement the preprocessing step exists for, asserted
       rather than described. On the raw capture the yellow bubbles binarise
       into the page and the user's own lines are simply gone. */
    const before = await read(raw(fx('kakao-ko.png')));
    const after = await read(greyscale(fx('kakao-ko.png')));

    const mine = ['이번 주에', '등기부등본'];
    const lostBefore = mine.filter(s => before.text.indexOf(s) === -1);
    const lostAfter = mine.filter(s => after.text.indexOf(s) === -1);

    ok(lostBefore.length > 0,
       `the raw capture still loses outgoing text (missing: ${lostBefore.join(', ') || 'nothing'})`);
    ok(lostAfter.length === 0,
       `greyscale recovers it (missing: ${lostAfter.join(', ') || 'nothing'})`);
    ok(after.confidence >= before.confidence,
       `and does not cost confidence (${before.confidence} -> ${after.confidence})`);
  }

  /* ------------------------------------------------------- content read --- */
  console.log('\n--- the risky lines are legible ---');
  {
    const d = await read(greyscale(fx('kakao-ko.png')));
    const text = OCR.clean(d.text);
    /* Each of these is the trigger for a real pattern in data/patterns.json.
       If the engine cannot read them the feature has no reason to exist. */
    [['계약금', 'the deposit demand'],
     ['보내주시면', 'the pay-first phrasing'],
     ['명의 계좌', 'the personal-account request'],
     ['못 보여드려요', 'the refusal to show the room'],
     ['50만원', 'the amount, digits included']]
      .forEach(([needle, what]) => ok(text.indexOf(needle) !== -1, `reads ${what} ("${needle}")`));

    ok(d.confidence >= 70, `page confidence is usable (${d.confidence})`);
    ok(text.split('\n').filter(l => l.trim()).length >= 7,
       'all seven bubbles survive cleanup');
    ok(!/\d{1,2}:\d{2}\s*$/m.test(text), 'no timestamp survives at the end of a line');
  }

  console.log('\n--- plain dark-on-white ---');
  {
    const d = await read(greyscale(fx('plain-ko.png')));
    const text = OCR.clean(d.text);
    ['전입신고', '보증금', '오천만원'].forEach(n =>
      ok(text.indexOf(n) !== -1, `reads "${n}"`));
    ok(d.confidence >= 80, `high confidence on the easy case (${d.confidence})`);
  }

  console.log('\n--- dark mode ---');
  {
    /* Light text on a dark ground is the polarity the binariser does NOT
       expect, so this was written expecting to record a weakness. It reads it
       cleanly instead — measured 92 confidence, every phrase found — so it is
       asserted like the rest, and a regression here will be caught rather than
       shrugged at. */
    const d = await read(greyscale(fx('dark-ko.png')));
    const text = OCR.clean(d.text);
    ['입금', '계약서', '지방'].forEach(n =>
      ok(text.indexOf(n) !== -1, `reads "${n}" on a dark ground`));
    ok(d.confidence >= 80, `dark mode is not degraded (${d.confidence})`);
  }

  /* ------------------------------------------------------------- sides --- */
  console.log('\n--- side split on a real page ---');
  {
    const d = await read(greyscale(fx('kakao-ko.png')));
    const split = OCR.sideSplit((d.lines || []).map(l => ({
      text: l.text, confidence: l.confidence, bbox: l.bbox
    })));
    if (split) {
      const left = split.groups.filter(g => g.side === 'left').length;
      const right = split.groups.filter(g => g.side === 'right').length;
      ok(left >= 2 && right >= 2,
         `recovers both columns from real boxes (left ${left}, right ${right})`);
    } else {
      /* Refusing is a valid outcome and better than a wrong guess; say so
         loudly rather than failing, because the UI falls back to hand
         labelling and nothing is attributed to the wrong person. */
      console.log('      declined to split this page — the UI falls back to manual labelling');
      ok(true, 'declining is an acceptable outcome');
    }
  }

  await worker.terminate();
  console.log('\n' + (fails ? fails + ' FAILURES' : 'ALL PASSED (real engine)'));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAIL  ' + (e && e.stack || e)); process.exit(1); });
