/*
 * Run every demo screenshot through the real pipeline and write a report.
 *
 *     npm install --no-save playwright && npx playwright install chromium
 *     node demo/run-demo.mjs
 *     # then open demo/report.html
 *
 * This is not a test — it asserts nothing and never fails. It is a way to LOOK
 * at what the tool does: each screenshot, the text the engine read out of it,
 * and the verdict the analyzer reached from that text, side by side on one
 * page. Useful for showing someone what the thing does, and for noticing that
 * a change made the output worse in a way no assertion was watching for.
 *
 * Everything runs through the real page in a real browser — the same worker,
 * the same wasm, the same analyzer the user gets. Nothing is stubbed and no
 * text is injected, so what the report shows is what a person would see.
 *
 * Options:
 *   --keep-open   leave the browser open on the last image
 *   --only=01     run one screenshot (matches the filename prefix)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSiteServer, listen } from '../scripts/serve-site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SHOTS = path.join(HERE, 'screenshots');
const PORT = Number(process.env.PORT || 8799);

const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];
const keepOpen = process.argv.includes('--keep-open');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('playwright is not installed.');
  console.error('  npm install --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const server = createSiteServer({ root: ROOT });
await listen(server, PORT);

const files = fs.readdirSync(SHOTS)
  .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
  .filter(f => !only || f.startsWith(only))
  .sort();

if (!files.length) {
  console.error('no screenshots in ' + SHOTS + (only ? ` matching --only=${only}` : ''));
  process.exit(1);
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1200, height: 900 } });
const results = [];

for (const file of files) {
  process.stdout.write(`\n${file}\n  reading… `);
  const t0 = Date.now();

  /* The cache-buster is load-bearing. Navigating to a URL that differs only in
     its hash does NOT reload the document, so without it every screenshot
     appends to the conversation box left behind by the previous one and each
     report row shows the union of everything before it. (In the app that
     accumulation is correct — a user adding two screenshots means to combine
     them. Here each image must be judged alone.) */
  await page.goto(`http://127.0.0.1:${PORT}/?demo=${encodeURIComponent(file)}#/housing/conversation`,
                  { waitUntil: 'load' });
  await page.waitForSelector('body[data-ready="true"]', { timeout: 20000 });
  await page.click('#ocr-panel > summary');
  await page.setInputFiles('#ocr-file', path.join(SHOTS, file));
  await page.waitForSelector('#ocr-review:not([hidden])', { timeout: 240000 });

  const draft = await page.inputValue('#ocr-text');
  const uncertain = await page.$$eval('#ocr-uncertain-list li',
    els => els.map(e => e.textContent.trim()));
  const labelled = await page.isVisible('#ocr-sides');
  process.stdout.write(`${((Date.now() - t0) / 1000).toFixed(1)}s\n  analysing… `);

  /* Straight through the real user path: append, then analyse. */
  await page.click('#btn-ocr-append');
  const analysis = await page.evaluate(() => {
    window.Housing.runAnalysis();
    const r = window.Housing.lastResult || {};
    return {
      assessment: r.assessment,
      /* Only the matches that actually scored — an informational match with no
         companion signal is not something to show as a finding. */
      signals: (r.matches || []).filter(m => m.points > 0).map(m => ({
        title: (m.pattern && m.pattern.title && m.pattern.title.ko) || (m.pattern && m.pattern.id),
        priority: m.priority,
        quote: m.quote || '',
        speaker: m.speaker
      })),
      questions: (r.questions || []).slice(0, 4)
    };
  });
  process.stdout.write(`${analysis.assessment} (${analysis.signals.length} signals)\n`);

  results.push({ file, draft, uncertain, labelled, ...analysis,
                 seconds: ((Date.now() - t0) / 1000).toFixed(1) });
}

if (!keepOpen) await browser.close();
server.close();

/* ------------------------------------------------------------------ report */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STATE = {
  strong_warning_signals: ['위험 신호가 뚜렷합니다', 'Strong warning signals', '#b3261e'],
  needs_review: ['확인이 필요합니다', 'Needs review', '#8a5a00'],
  no_known_signals: ['알려진 위험 신호 없음', 'No known signals', '#1b6b3a'],
  insufficient_information: ['판단할 정보가 부족합니다', 'Not enough information', '#4a5560']
};

const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>데모 결과 · Demo results</title>
<style>
  :root { color-scheme: light dark; --ink:#1a1d21; --dim:#5a6570; --edge:#dfe3e8; --bg:#f4f6f8; --card:#fff; }
  @media (prefers-color-scheme: dark) {
    :root { --ink:#e9ecef; --dim:#9aa4af; --edge:#31363d; --bg:#15181c; --card:#1d2126; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 16px 64px; background:var(--bg); color:var(--ink);
         font:15px/1.6 system-ui,-apple-system,"Segoe UI","Malgun Gothic",sans-serif; }
  .wrap { max-width: 1100px; margin: 0 auto; }
  h1 { font-size:1.6rem; margin:0 0 6px; }
  .sub { color:var(--dim); margin:0 0 28px; }
  .case { background:var(--card); border:1px solid var(--edge); border-radius:14px;
          padding:20px; margin-bottom:24px; }
  .case h2 { font-size:1.05rem; margin:0 0 14px; font-family:ui-monospace,Menlo,monospace; }
  .cols { display:grid; grid-template-columns: 260px 1fr 1fr; gap:20px; align-items:start; }
  .cols img { width:100%; border-radius:10px; border:1px solid var(--edge); }
  .lbl { font-size:.74rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
         color:var(--dim); margin:0 0 7px; }
  pre { white-space:pre-wrap; word-break:break-word; background:var(--bg); border:1px solid var(--edge);
        border-radius:9px; padding:12px; margin:0; font:13px/1.55 ui-monospace,Menlo,monospace; }
  .verdict { display:inline-block; font-weight:700; padding:7px 14px; border-radius:999px;
             color:#fff; margin-bottom:12px; }
  ul { margin:0; padding-left:20px; } li { margin-bottom:8px; }
  .q { color:var(--dim); font-size:.92rem; }
  .meta { color:var(--dim); font-size:.85rem; margin-top:10px; }
  .note { background:var(--bg); border:1px solid var(--edge); border-left-width:4px;
          border-radius:9px; padding:14px 16px; margin-bottom:28px; }
  @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } .cols img { max-width:300px; } }
</style></head><body><div class="wrap">
<h1>데모 결과 · Demo results</h1>
<p class="sub">${files.length} screenshot${files.length > 1 ? 's' : ''} · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · every step ran in a real browser</p>

<div class="note">
  <strong>These screenshots are drawn, not photographed.</strong> No stock library of
  Korean rental-scam chats exists, and the ones circulating online are real people's
  private conversations. Every name, number and account here is invented. The layout
  and the failure modes are reproduced faithfully; the mess of a genuine capture is not.
</div>

${results.map(r => {
  const [ko, en, colour] = STATE[r.assessment] || ['?', r.assessment, '#666'];
  return `<div class="case">
  <h2>${esc(r.file)}</h2>
  <div class="cols">
    <div><img src="screenshots/${esc(r.file)}" alt="${esc(r.file)}"></div>
    <div>
      <p class="lbl">기계가 읽은 글 · what the engine read</p>
      <pre>${esc(r.draft)}</pre>
      <p class="meta">${r.seconds}s${r.labelled ? ' · 말풍선 위치로 화자 구분됨 / speakers split by bubble side' : ''}${
        r.uncertain.length ? ` · ${r.uncertain.length} line(s) flagged as uncertain` : ''}</p>
    </div>
    <div>
      <p class="lbl">판정 · verdict</p>
      <div class="verdict" style="background:${colour}">${esc(ko)} · ${esc(en)}</div>
      ${r.signals.length
        ? `<ul>${r.signals.map(s =>
            `<li><strong>${esc(s.title)}</strong>${s.priority ? ` <span class="q">[${esc(s.priority)}]</span>` : ''}${
              s.quote ? `<br><span class="q">“${esc(s.quote)}”</span>` : ''}</li>`).join('')}</ul>`
        : '<p class="q">신호 없음 · no signals matched</p>'}
      ${r.questions.length
        ? `<p class="lbl" style="margin-top:16px">다음에 물어볼 것 · ask next</p>
           <ul class="q">${r.questions.map(q => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
    </div>
  </div>
</div>`;
}).join('\n')}
</div></body></html>`;

const out = path.join(HERE, 'report.html');
fs.writeFileSync(out, html);

console.log('\n' + '-'.repeat(58));
results.forEach(r => console.log(
  `  ${r.file.padEnd(26)} ${String(r.assessment).padEnd(24)} ${r.signals.length} signals`));
console.log('-'.repeat(58));
console.log('\nreport written to ' + out);
if (keepOpen) console.log('browser left open — close it to exit.');
else process.exit(0);
