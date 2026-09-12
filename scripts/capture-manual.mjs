/* Regenerate public guide captures from two fictional fixtures, using real OCR.
 * npm run assets:stamp && node scripts/capture-manual.mjs
 * Requires the project's Playwright Chromium. No model download is performed.
 * Changes assets/manual/: review the images and cases.json before committing.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createSiteServer, listen, ROOT } from './serve-site.mjs';

const out = path.join(ROOT, 'assets/manual');
fs.mkdirSync(out, { recursive: true });
const sources = { pressure: '01-kakao-pressure.jpg', ordinary: '02-kakao-ordinary.jpg' };
for (const [id, file] of Object.entries(sources))
  fs.copyFileSync(path.join(ROOT, 'demo/screenshots', file), path.join(out, 'sample-' + id + '.jpg'));
const server = createSiteServer({ root: ROOT });
await listen(server, 0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'en-US', colorScheme: 'light', viewport: { width: 1120, height: 820 } });
const errors = [], requests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('request', req => requests.push(req.url()));
const records = { capturedAt: new Date().toISOString(), browser: browser.version(),
  viewport: { width: 1120, height: 820 },
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
  assert.deepEqual(errors, []);
  assert.equal(requests.some(url => /wllama|huggingface|llm-worker/.test(url)), false, 'captures do not load the optional model');
  fs.writeFileSync(path.join(out, 'cases.json'), JSON.stringify(records, null, 2) + '\n');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
