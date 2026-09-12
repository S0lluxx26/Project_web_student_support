/* Browser integration tests with an injected model engine. The real GGUF is
 * exercised separately by bench-llm.mjs. This suite never downloads weights. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createSiteServer, listen, ROOT } from './serve-site.mjs';

const browser = await chromium.launch();
try {
  for (const prefix of ['', '/Project_web_student_support']) {
    const requests = [], errors = [];
    const server = createSiteServer({ root: path.join(ROOT, 'dist'), prefix });
    await listen(server, 0);
    const page = await browser.newPage({ locale: 'ko-KR' });
    page.on('pageerror', error => errors.push(error.stack || error.message));
    page.on('request', request => requests.push(request.url()));
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}${prefix}/`);
      await page.waitForSelector('body[data-ready="true"]');
      assert.equal(await page.locator('#llm-panel').isVisible(), false, 'unvalidated experiment is hidden on the ordinary site');
      await page.goto(`http://127.0.0.1:${server.address().port}${prefix}/?experiment=llm`);
      await page.waitForSelector('body[data-ready="true"]');
      await page.locator('#home-chat').fill('집주인: 오늘 안에 계약금 먼저 보내주세요. 연락처는 010-1234-5678 입니다.');
      await page.locator('#btn-home-analyze').click();
      await page.waitForSelector('#housing-step-4:not([hidden])');
      const assessment = await page.evaluate(() => Housing.lastResult.assessment);
      await page.locator('#llm-panel summary').click();
      assert.equal(await page.locator('#llm-enable').isChecked(), false);
      assert.equal(requests.some(url => /wllama|hash-wasm|huggingface|llm-worker/.test(url)), false);
      await page.locator('#llm-enable').check();
      assert.equal(requests.some(url => /wllama|huggingface/.test(url)), false, 'checking opt-in alone does not download');

      // Wrong local file uses the real worker and fails before heavy imports.
      await page.locator('#llm-file').setInputFiles({ name: 'wrong.gguf', mimeType: 'application/octet-stream', buffer: Buffer.from('wrong') });
      await page.waitForFunction(() => !LLMUI.busy);
      assert.equal(await page.evaluate(() => LLM.loaded), null);
      assert.equal(await page.locator('#llm-status').textContent(), await page.evaluate(() => I18n.t('llm.wrongFile')));
      assert.equal(await page.evaluate(() => Housing.lastResult.assessment), assessment);

      await page.evaluate(() => {
        window.__closed = 0;
        window.__mode = 'good';
        LLM._realEngine = () => Promise.resolve({
          load: () => window.__mode === 'slow-load' ? new Promise(resolve => { window.__finishLoad = resolve; }) : Promise.resolve({ threads: 1 }),
          generate: messages => {
            window.__messages = messages;
            const input = JSON.parse(messages[1].content.replace(/\n\/no_think$/, ''));
            const value = JSON.stringify({ summary: '서류를 확인하세요.', points: [{ id: input.findings[0].id, why: '계약 전에 확인이 필요합니다.' }], ask: ['등기부등본을 볼 수 있을까요?'] });
            if (window.__mode === 'slow-generate') return new Promise(resolve => { window.__finishGenerate = () => resolve(value); });
            return Promise.resolve(window.__mode === 'bad' ? '<script>bad</script>' : value);
          },
          unload: () => { window.__closed++; }
        });
      });
      await page.locator('#llm-download').click();
      await page.waitForFunction(() => LLMUI.ready && !LLMUI.busy);
      await page.locator('#llm-generate').click();
      await page.waitForSelector('#llm-draft:not([hidden])');
      const messages = await page.evaluate(() => window.__messages);
      assert.equal(JSON.stringify(messages).includes('010-1234-5678'), false, 'no conversation identifiers are needed by the LLM');
      assert.equal(JSON.parse(messages[1].content.replace(/\n\/no_think$/, '')).untrusted_transcript, '');
      assert.equal(await page.evaluate(() => Housing.lastResult.assessment), assessment);
      assert.equal(await page.evaluate(() => Housing.reportText().includes('등기부등본을 볼 수 있을까요?')), false, 'draft does not enter exports');

      await page.evaluate(() => { window.__mode = 'bad'; });
      await page.locator('#llm-generate').click();
      await page.waitForFunction(() => !LLMUI.busy);
      assert.equal(await page.locator('#llm-draft').isVisible(), false);
      assert.equal(await page.locator('#llm-status').textContent(), await page.evaluate(() => I18n.t('llm.rejected')));

      await page.evaluate(() => { window.__mode = 'slow-generate'; });
      await page.locator('#llm-generate').click();
      await page.waitForFunction(() => !!window.__finishGenerate);
      await page.locator('#llm-cancel').click();
      await page.evaluate(() => window.__finishGenerate());
      await page.waitForFunction(() => !LLMUI.busy);
      assert.equal(await page.evaluate(() => LLM.engine), null);
      assert.equal(await page.locator('#llm-draft').isVisible(), false);

      await page.evaluate(() => { window.__mode = 'slow-load'; });
      await page.locator('#llm-download').click();
      await page.waitForFunction(() => !!window.__finishLoad);
      await page.evaluate(() => Housing.resetSession());
      await page.evaluate(() => window.__finishLoad({ threads: 1 }));
      await page.waitForFunction(() => !LLMUI.busy);
      assert.equal(await page.evaluate(() => LLM.loaded), null, 'late load cannot revive a reset session');
      assert.equal(await page.evaluate(() => LLMUI.report), null);
      assert.equal(await page.locator('#llm-enable').isChecked(), false);

      await page.evaluate(() => App.gotoStep(2));
      await page.locator('#chat-input').fill('집주인: 오늘 안에 계약금 먼저 보내주세요. 계좌번호 110-123-456789 입니다.');
      await page.locator('#btn-analyze').click();
      await page.locator('#btn-print').click();
      assert.equal(await page.locator('#export-text').inputValue().then(text => text.includes('110-123-456789')), false);
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('#result-root').isVisible(), false, 'Ctrl+P never prints raw housing evidence');
      assert.equal(await page.locator('#view-housing > .print-review-hint').isVisible(), true);
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => { window.print = () => {}; });
      await page.locator('#export-go').click();
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('#print-sheet').isVisible(), true);
      assert.equal(await page.locator('#print-sheet').textContent().then(text => text.includes('110-123-456789')), false);
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      assert.equal(await page.locator('#print-sheet').count(), 0);

      await page.evaluate(() => App.gotoStep(2));
      await page.locator('#btn-clear').click();
      assert.equal(await page.locator('#home-chat').inputValue(), '');
      assert.equal(await page.evaluate(() => Housing.lastResult), null);
      assert.equal(await page.evaluate(() => LLMUI.report), null);
      assert.equal(await page.locator('#export-preview').count(), 0);

      if (!prefix) {
        await page.goto(`http://127.0.0.1:${server.address().port}/`);
        await page.waitForSelector('body[data-ready="true"]');
        fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({ path: path.join(ROOT, 'tmp/ui-home-desktop.png'), fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile home has no horizontal overflow');
        await page.screenshot({ path: path.join(ROOT, 'tmp/ui-home-mobile.png'), fullPage: true });
        // A connection that never returns must not leave all controls inert.
        await page.route('**/data/lexicon.json', () => {});
        await page.reload();
        await page.waitForSelector('body[data-ready="true"]', { timeout: 14000 });
        assert.equal(await page.evaluate(() => App.degraded.includes('data/lexicon.json')), true);
        await page.unroute('**/data/lexicon.json');
        await page.route('**/data/patterns.json', route => route.abort());
        await page.reload();
        await page.waitForSelector('body[data-ready="failed"]');
        assert.equal(await page.locator('#view-home').isVisible(), false);
        await page.unroute('**/data/patterns.json');
        await page.locator('#btn-retry-boot').click();
        await page.waitForSelector('body[data-ready="true"]');
        assert.equal(await page.locator('#home-chat').isVisible(), true, 'core failure retry recovers');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${prefix || '/'}: opt-in, local-file rejection, output fallback, cancellation, reset, privacy, print and input sync`);
    } finally {
      await page.close();
      await new Promise(resolve => server.close(resolve));
    }
  }
} finally { await browser.close(); }
