/* Regenerate public guide captures from two fictional fixtures, using real OCR.
 * npm run assets:stamp && node scripts/capture-manual.mjs
 * Korean feature submission: node scripts/capture-manual.mjs --features --lang ko
 * --features writes a separate features-ko folder and demonstrates export masking.
 * Requires the project's Playwright Chromium. No model download is performed.
 * Changes assets/manual/: review the images and cases.json before committing.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createSiteServer, listen, ROOT } from './serve-site.mjs';

const features = process.argv.includes('--features');
const lang = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : features ? 'ko' : 'en';
if (!['en', 'ko'].includes(lang)) throw Error('--lang must be en or ko');
if (features && lang !== 'ko') throw Error('--features currently requires Korean');
const out = path.join(ROOT, 'assets/manual', features ? 'features-ko' : lang === 'ko' ? 'ko' : '');
fs.mkdirSync(out, { recursive: true });
const sources = { pressure: '01-kakao-pressure.jpg', ordinary: '02-kakao-ordinary.jpg' };
for (const [id, file] of Object.entries(sources))
  fs.copyFileSync(path.join(ROOT, 'demo/screenshots', file), path.join(out, 'sample-' + id + '.jpg'));
const server = createSiteServer({ root: ROOT });
await listen(server, 0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch();
const viewport = features ? { width: 900, height: 780 } : { width: 1120, height: 820 };
const page = await browser.newPage({ locale: lang === 'ko' ? 'ko-KR' : 'en-US', colorScheme: 'light', viewport });
const errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', req => requests.push(req.url()));
const records = { capturedAt: new Date().toISOString(), language: lang, browser: browser.version(),
  viewport,
  source: 'Fictional chats drawn by demo/make-demo-screenshots.py; actual browser OCR and rule results.',
  speakerChoice: 'right', textCorrections: 'none', cases: [] };
async function shot(file, selector) {
  if (selector) await page.locator(selector).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 88, animations: 'disabled' });
}
try {
  for (const [id, file] of Object.entries(sources)) {
    await page.goto(base);
    await page.waitForSelector('body[data-ready="true"]');
    if (id === 'pressure') await shot('01-home.jpg');
    await page.locator('#btn-home-ocr').click();
    await page.locator('#ocr-file').setInputFiles(path.join(ROOT, 'demo/screenshots', file));
    await page.waitForSelector('#ocr-review:not([hidden])', { timeout: 240000 });
    assert.equal(await page.locator('[name="ocr-mine"]:checked').inputValue(), 'none');
    if (await page.locator('#ocr-sides').isVisible()) await page.locator('[name="ocr-mine"][value="right"]').check();
    const draft = await page.locator('#ocr-text').inputValue();
    assert.ok(draft.length > 30, 'real OCR produced text');
    if (id === 'pressure') await shot('02-review.jpg', '#ocr-text');
    await page.locator('#btn-ocr-analyze').click();
    await page.waitForSelector('#housing-step-4:not([hidden])');
    const result = await page.evaluate(() => ({
      assessment: Housing.lastResult.assessment,
      signals: Housing.lastResult.matches.filter(m => m.points > 0).map(m => ({ id: m.pattern.id, title: m.pattern.title, quote: m.quote || '' }))
    }));
    assert.equal(result.assessment, id === 'pressure' ? 'strong_warning_signals' : 'no_known_signals');
    assert.equal(result.signals.length > 0, id === 'pressure');
    records.cases.push({ id, fixture: 'demo/screenshots/' + file,
      sha256: createHash('sha256').update(fs.readFileSync(path.join(out, 'sample-' + id + '.jpg'))).digest('hex'), draft, ...result });
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(id === 'pressure' ? '03-pressure-result.jpg' : '04-ordinary-result.jpg');
    if (id === 'pressure') {
      await page.locator('#btn-copy').click();
      await shot('06-export.jpg', '#export-text');
      await page.locator('#export-cancel').click();
      await page.locator('#llm-panel summary').click();
      await page.locator('#llm-enable').check();
      // Oversized panels are centered by scrollIntoView, hiding their heading.
      // Capture each meaningful stage from below the sticky header instead.
      for (const [file, selector] of [['07-ai-controls.jpg', '#llm-panel'], ['08-ai-wait.jpg', '#llm-wait-warning']]) {
        await page.evaluate(selector => {
          const header = document.querySelector('header').getBoundingClientRect().height;
          window.scrollTo(0, scrollY + document.querySelector(selector).getBoundingClientRect().top - header - 20);
        }, selector);
        await shot(file);
      }
      await page.locator('[data-goto-step="3"]').last().click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot('05-contract.jpg');
    }
    console.log(id + ': ' + result.assessment + ', ' + result.signals.length + ' signals');
  }
  if (features) {
    await page.goto(base);
    await page.waitForSelector('body[data-ready="true"]');
    const redactionInput = '집주인: 오늘 가계약금 100만원을 먼저 보내주시고 010-0000-0000으로 연락하세요.';
    await page.locator('#home-chat').fill(redactionInput);
    await page.locator('#btn-home-analyze').click();
    await page.waitForSelector('#housing-step-4:not([hidden])');
    await page.locator('#btn-copy').click();
    const preview = await page.locator('#export-text').inputValue();
    assert(!preview.includes('010-0000-0000'), 'fictional phone is masked in export');
    const masked = await page.locator('.export-found').textContent();
    assert(masked.includes('전화번호'), 'actual mask summary identifies phone data');
    await page.locator('#export-text').evaluate(el => { el.scrollTop = 0; });
    await page.locator('#export-preview').screenshot({ path: path.join(out, '06-export.jpg'), type: 'jpeg', quality: 88, animations: 'disabled' });
    records.exportDemo = { fictional: true, input: redactionInput, maskSummary: masked, preview };
    await page.goto(base + 'help.html');
    await page.waitForSelector('#learning-cases .sample-card');
    if (await page.locator('html').getAttribute('lang') !== 'ko') await page.locator('#help-language').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'ko');
    assert.equal(await page.locator('#learning-cases .sample-card').count(), 12);
    await page.locator('#compare').screenshot({ path: path.join(out, '09-help.jpg'), type: 'jpeg', quality: 88, animations: 'disabled' });
    records.helpCases = 12;
  }
  assert.deepEqual(errors, []);
  assert.equal(requests.some(url => /wllama|huggingface|llm-worker/.test(url)), false, 'captures do not load the optional model');
  fs.writeFileSync(path.join(out, 'cases.json'), JSON.stringify(records, null, 2) + '\n');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
