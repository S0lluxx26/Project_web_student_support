/*
 * OCR integration tests — MOCK ENGINE.  Run from the repo root:
 *     node scripts/test-ocr.js
 *
 * READ THIS BEFORE TRUSTING A GREEN RUN.
 *
 * Every test in this file replaces the recognition engine with a stub that
 * returns text we wrote ourselves. They prove the code AROUND the engine:
 * cleanup rules, the low-confidence report, the left/right split, the promise
 * plumbing, the feature flag. They prove NOTHING about whether tesseract can
 * read a Korean chat screenshot, and a passing run here is not grounds for
 * turning OCR on.
 *
 * The engine itself is exercised by two other things, and only those:
 *   scripts/test-ocr-real.js   real tesseract.js over generated fixtures (Node)
 *   scripts/smoke-ocr.mjs      the real page in a real browser
 */

const path = require('path');
const OCR = require(path.join(__dirname, '..', 'assets/js/ocr.js'));

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const eq = (got, want, m) =>
  ok(got === want, m + (got === want ? '' : `\n        want: ${JSON.stringify(want)}\n        got:  ${JSON.stringify(got)}`));

console.log('=== MOCK ENGINE — proves the integration, not the recognition ===\n');

/* --------------------------------------------------------------- cleanup */
console.log('--- clean: timestamps ---');
{
  eq(OCR.clean('오늘 계약금 먼저 보내주세요 오후 3:21'),
     '오늘 계약금 먼저 보내주세요', 'strips a 오후 h:mm tail');
  eq(OCR.clean('네 알겠습니다 오전 9:05'), '네 알겠습니다', 'strips a 오전 tail');
  eq(OCR.clean('ok then PM 11:59'), 'ok then', 'strips an English meridiem tail');
  eq(OCR.clean('보증금은 3:21 이라고 하셨죠'), '보증금은 3:21 이라고 하셨죠',
     'leaves a time that is not at the end alone');
  eq(OCR.clean('계좌번호 끝자리 1:23'), '계좌번호 끝자리',
     'strips a bare h:mm tail');
  eq(OCR.clean('50만원'), '50만원', 'does not mistake an amount for a time');
}

console.log('\n--- clean: mangled timestamps ---');
{
  /* Every one of these came out of a real run over scripts/fixtures/kakao-ko.png
     — the small grey clock, too small for the engine to resolve, once per line. */
  eq(OCR.clean('안녕하세요 방 보고 연락드렸어요 .5*=그'),
     '안녕하세요 방 보고 연락드렸어요', 'strips a mangled clock');
  eq(OCR.clean('지금 세입자가 있어서 방을 못 보여드려요 .3*::'),
     '지금 세입자가 있어서 방을 못 보여드려요', 'strips another shape of it');
  eq(OCR.clean('제 명의 계좌로 보내주세요 .85:기'),
     '제 명의 계좌로 보내주세요', 'strips one that kept a Hangul fragment');
  eq(OCR.clean('오늘 계약금 50만원 먼저 보내주시면 잡아드릴게요 ,5533'),
     '오늘 계약금 50만원 먼저 보내주시면 잡아드릴게요', 'strips a comma-led run of digits');

  /* The negatives matter more than the positives: this rule sits one comma
     away from eating real text. */
  eq(OCR.clean('보증금은 오천만원입니다.'), '보증금은 오천만원입니다.',
     'leaves punctuation attached to the last word');
  eq(OCR.clean('계약금은 100만원, 잔금은 나중에'), '계약금은 100만원, 잔금은 나중에',
     'leaves a mid-sentence comma alone');
  eq(OCR.clean('지금 바로 보내주세요 ...진짜로 급해요'),
     '지금 바로 보내주세요 ...진짜로 급해요',
     'leaves a punctuation-led token that is too long to be clock debris');
  /* A whole line is only ever deleted when it holds no language at all
     (isNoiseLine). Debris carrying a Hangul fragment stays: deleting a line on
     suspicion risks deleting something that was said, and the reviewer can see
     and delete it in a way the analyzer never could. */
  eq(OCR.clean('.5*=-'), '', 'a line of pure debris goes entirely');
  eq(OCR.clean('.5*=그'), '.5*=그',
     'debris carrying a Hangul fragment is kept for the reviewer to judge');
  eq(OCR.clean('네'), '네', 'a one-word line survives');
}

console.log('\n--- clean: noise lines ---');
{
  ok(OCR.isNoiseLine('.5*=-'), 'a symbol run is noise');
  ok(OCR.isNoiseLine('~~ ^'), 'stray marks are noise');
  ok(!OCR.isNoiseLine('그'), 'a single Hangul syllable is not noise');
  ok(!OCR.isNoiseLine('ok'), 'a Latin word is not noise');
  ok(!OCR.isNoiseLine('50만원'), 'text with Hangul is not noise');
  ok(!OCR.isNoiseLine('2026'), 'a run of digits is not noise');
  ok(!OCR.isNoiseLine(''), 'a blank line is not noise (blank handling is separate)');
  eq(OCR.clean('집주인\n.5*=-\n방 보러 갈게요'), '집주인\n방 보러 갈게요',
     'drops the noise line and keeps the rest');
}

console.log('\n--- clean: whitespace ---');
{
  eq(OCR.clean('가\n\n\n\n나'), '가\n\n나', 'collapses a run of blank lines to one');
  eq(OCR.clean('가\n\n\n'), '가', 'drops trailing blank lines');
  eq(OCR.clean('가   \n나\t'), '가\n나', 'trims trailing whitespace');
  eq(OCR.clean(''), '', 'empty in, empty out');
  eq(OCR.clean(null), '', 'null in, empty out');
}

console.log('\n--- clean: never rewrites content ---');
{
  /* The whole point of the review pane is that the user audits what the engine
     read. A cleaner that repaired half-read words would put text in front of
     the analyzer that nobody ever said. */
  const halfRead = '오늘 계약금 50만원 먼저 보내주시면 잠아드릴게요';
  eq(OCR.clean(halfRead), halfRead, 'a misrecognised word is left exactly as read');
}

/* ------------------------------------------------------------ greyscale */
console.log('\n--- greyscale ---');
{
  /* The three surfaces the binariser has to separate on a KakaoTalk capture:
     the outgoing bubble (#FEE551), the page behind it (#ABC6D8) and the text
     on the bubble (#141414). On the raw channels the bubble's blue component
     (0x51) sits far below the page's (0xD8), so a threshold that keeps the
     page also swallows the bubble and the text with it. On luminance the
     bubble is the LIGHTER of the two and the text is far below both, which is
     the ordering the binariser needs. */
  const px = { data: Uint8ClampedArray.from([
    0xFE, 0xE5, 0x51, 255,   /* bubble */
    0xAB, 0xC6, 0xD8, 255,   /* page   */
    0x14, 0x14, 0x14, 255    /* text   */
  ]) };
  ok(px.data[2] < px.data[6], 'before: on the blue channel the bubble reads DARKER than the page');
  OCR.toGreyscale(px);
  const bubble = px.data[0], page = px.data[4], text = px.data[8];
  eq(bubble, px.data[1], 'r, g and b end up equal');
  ok(bubble > page, `after: bubble (${bubble}) is lighter than the page (${page})`);
  ok(page - text > 120, `and the text (${text}) sits well below both (margin ${page - text})`);
}

/* ----------------------------------------------------------- sideSplit */
console.log('\n--- sideSplit ---');
const line = (text, x0, conf) => ({ text, confidence: conf === undefined ? 90 : conf,
                                    bbox: { x0: x0, y0: 0, x1: x0 + 200, y1: 30 } });
{
  const split = OCR.sideSplit([
    line('안녕하세요', 60), line('지금은 못 보여드려요', 62),
    line('네 알겠습니다', 420), line('언제 가능한가요', 418)
  ]);
  ok(!!split, 'recovers a clean two-column layout');
  if (split) {
    ok(split.boundary > 62 && split.boundary < 418, 'boundary falls in the gap');
    eq(split.groups.filter(g => g.side === 'left').length, 2, 'two lines on the left');
    eq(split.groups.filter(g => g.side === 'right').length, 2, 'two lines on the right');
  }

  ok(OCR.sideSplit([line('가', 10), line('나', 400), line('다', 12)]) === null,
     'refuses with fewer than four boxed lines');
  ok(OCR.sideSplit([line('가', 10), line('나', 20), line('다', 30), line('라', 40)]) === null,
     'refuses when there is no dominant gap');
  ok(OCR.sideSplit([line('가', 10), line('나', 400), line('다', 402), line('라', 404)]) === null,
     'refuses when one side has a single line');
  ok(OCR.sideSplit([]) === null, 'refuses an empty page');
  ok(OCR.sideSplit([{ text: '가' }, { text: '나' }, { text: '다' }, { text: '라' }]) === null,
     'refuses when the engine gave no boxes');
}

/* ----------------------------------------------------------------- flag */
console.log('\n--- feature flag ---');
{
  const was = OCR.enabled;
  OCR.enabled = false;
  eq(OCR.unavailable(), 'disabled', 'reports itself unavailable while the flag is off');
  ok(!OCR.available(), 'available() agrees');
  OCR.enabled = was;
}

/* ------------------------------------------------------- recognize(): mock */
console.log('\n--- recognize() against a mock engine ---');

const mock = (result) => ({ recognize: () => Promise.resolve(result) });

(async () => {
  {
    OCR.engine = mock({
      text: '집주인\n지금 세입자가 있어서 방을 못 보여드려요 오후 3:21\n.5*=-\n',
      confidence: 84,
      lines: [line('집주인', 20), line('지금 세입자가 있어서 방을 못 보여드려요', 60)]
    });
    const r = await OCR.recognize('ignored-by-the-mock');
    eq(r.text, '집주인\n지금 세입자가 있어서 방을 못 보여드려요',
       'returns cleaned text');
    ok(r.raw.indexOf('오후 3:21') !== -1, 'keeps the uncleaned original in .raw');
    eq(r.confidence, 84, 'passes the page confidence through');
  }

  {
    OCR.engine = mock({
      text: '가\n나\n다',
      confidence: 60,
      lines: [line('확실한 줄', 60, 95), line('흐릿한 줄', 62, 41), line('.5*=-', 64, 12)]
    });
    const r = await OCR.recognize('x');
    eq(r.uncertain.length, 1, 'flags only the low-confidence line');
    eq(r.uncertain[0].text, '흐릿한 줄', 'and names it');
    eq(r.uncertain[0].confidence, 41, 'with its score, for the review pane');
  }

  {
    OCR.engine = mock({
      text: '가', confidence: 90,
      lines: [line('가', 60, 55), line('나', 62, 55)]
    });
    const r = await OCR.recognize('x', { lowConfidence: 50 });
    eq(r.uncertain.length, 0, 'the low-confidence floor is configurable');
  }

  {
    const seen = [];
    OCR.engine = mock({ text: '가', confidence: 90, lines: [] });
    await OCR.recognize('x', { onProgress: (s) => seen.push(s) });
    ok(seen.indexOf('recognizing text') !== -1, 'reports progress to the caller');
  }

  {
    OCR.engine = { recognize: () => Promise.reject(new Error('worker died')) };
    let msg = null;
    try { await OCR.recognize('x'); } catch (e) { msg = e.message; }
    eq(msg, 'worker died', 'an engine failure reaches the caller instead of resolving empty');
  }

  {
    OCR.engine = mock({
      text: '가', confidence: 90,
      lines: [line('안녕하세요', 60), line('못 보여드려요', 62),
              line('네', 420), line('언제요', 418)]
    });
    const r = await OCR.recognize('x');
    ok(r.sides && r.sides.groups.length === 4, 'carries the side grouping through');
  }

  OCR.engine = null;
  console.log('\n' + (fails ? fails + ' FAILURES' : 'ALL PASSED (mock engine)'));
  process.exit(fails ? 1 : 0);
})();
