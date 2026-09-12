/* Installation/guide checks: public resources, both hosts, desktop and mobile. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createSiteServer, listen, ROOT } from './serve-site.mjs';

const source = process.argv.includes('--src');
const browser = await chromium.launch();
const profiles = [
  { name: 'desktop without GPU', viewport: { width: 1280, height: 900 }, blocked: false },
  { name: 'narrow desktop', viewport: { width: 390, height: 844 }, blocked: false },
  { name: 'Android phone', viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36', blocked: true },
  { name: 'Android tablet', viewport: { width: 1024, height: 768 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36', blocked: true },
  { name: 'iPhone', viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', blocked: true },
  { name: 'desktop-mode iPad', viewport: { width: 1024, height: 768 }, ipad: true, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', blocked: true }
];
try {
  for (const prefix of ['', '/Project_web_student_support']) {
    const server = createSiteServer({ root: source ? ROOT : path.join(ROOT, 'dist'), prefix });
    await listen(server, 0);
    const base = 'http://127.0.0.1:' + server.address().port + prefix + '/';
    try {
      const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1280, height: 900 } });
      const requests = [], errors = [];
      page.on('request', request => requests.push(request.url()));
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + 'demo.html');
      await page.waitForFunction(() => document.getElementById('pressure-outcome').textContent.includes('4 signals'));
      assert.equal(await page.locator('main .guide-step').count(), 7);
      assert.equal(await page.locator('#ordinary-outcome').textContent().then(t => t.includes('0 signals')), true);
      assert.equal(requests.some(url => /tesseract|wllama|llm-worker|huggingface/.test(url)), false);
      const resources = await page.locator('[href], [src]').evaluateAll(nodes => [...new Set(nodes.flatMap(n => [n.getAttribute('href'), n.getAttribute('src')]).filter(Boolean))]);
      for (const rel of resources) {
        if (/^(https?:|data:|#)/.test(rel)) continue;
        const url = new URL(rel, base);
        assert.equal(url.href.startsWith(base), true, rel + ' stays within host base');
        const response = await page.request.get(url.href);
        assert.equal(response.status(), 200, 'guide resource: ' + rel);
        if (rel.endsWith('.pdf')) {
          assert.ok(response.headers()['content-type'].includes('application/pdf'));
          assert.equal((await response.body()).subarray(0, 5).toString(), '%PDF-');
        }
      }
      const guideResponse = await page.request.get(base + 'manual/PROJECT_GUIDE.md');
      const md = await guideResponse.text();
      assert.ok(md.includes('Bui Xuan Mai'));
      assert.ok(md.includes('https://github.com/S0lluxx26/Project_web_student_support'));
      assert.equal(/\b(daughter|father|mother)\b/i.test(md), false);
      for (const match of md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g))
        assert.equal((await page.request.get(new URL(match[1], base + 'manual/PROJECT_GUIDE.md').href)).status(), 200);
      const versions = await page.locator('link[rel="stylesheet"], script[src]').evaluateAll(nodes => nodes.map(n => (n.href || n.src).match(/\?v=([a-f0-9]{8})/)[1]));
      const indexResponse = await page.request.get(base);
      const mainVersion = (await indexResponse.text()).match(/\?v=([a-f0-9]{8})/)[1];
      assert.ok(versions.every(v => v === mainVersion), 'guide assets share the current version');
      fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
      if (!prefix) await page.screenshot({ path: path.join(ROOT, 'tmp/manual-desktop.png') });
      await page.locator('#manual-language').click();
      assert.equal(await page.locator('html').getAttribute('lang'), 'ko');
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'manual has no overflow at ' + width);
      }
      if (!prefix) await page.screenshot({ path: path.join(ROOT, 'tmp/manual-mobile.png') });
      assert.deepEqual(errors, []);
      // Follow the installation guide using downloaded PUBLIC sample bytes.
      for (const id of ['pressure', 'ordinary']) {
        await page.goto(base);
        await page.waitForSelector('body[data-ready="true"]');
        await page.locator('#btn-home-ocr').click();
        const sample = await page.request.get(base + 'assets/manual/sample-' + id + '.jpg');
        await page.locator('#ocr-file').setInputFiles({ name: 'sample-' + id + '.jpg', mimeType: 'image/jpeg', buffer: await sample.body() });
        await page.waitForSelector('#ocr-review:not([hidden])', { timeout: 240000 });
        if (await page.locator('#ocr-sides').isVisible()) await page.locator('[name="ocr-mine"][value="right"]').check();
        await page.locator('#btn-ocr-analyze').click();
        await page.waitForSelector('#housing-step-4:not([hidden])');
        const result = await page.evaluate(() => ({ assessment: Housing.lastResult.assessment, count: Housing.lastResult.matches.filter(m => m.points > 0).length }));
        assert.deepEqual(result, { assessment: id === 'pressure' ? 'strong_warning_signals' : 'no_known_signals', count: id === 'pressure' ? 4 : 0 }, 'actual public demo sample ' + id);
      }
      assert.deepEqual(errors, []);
      await page.close();
      for (const profile of profiles) {
        const context = await browser.newContext({ viewport: profile.viewport, ...(profile.userAgent ? { userAgent: profile.userAgent } : {}) });
        await context.addInitScript(({ ipad }) => {
          Object.defineProperty(navigator, 'gpu', { get: () => undefined, configurable: true });
          if (ipad) {
            Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
          }
        }, { ipad: !!profile.ipad });
        const p = await context.newPage(), loads = [], faults = [];
        p.on('request', req => loads.push(req.url()));
        p.on('pageerror', e => faults.push(e.message));
        await p.goto(base + '?experiment=llm');
        await p.waitForSelector('body[data-ready="true"]');
        await p.locator('#home-chat').fill('집주인: 오늘 안에 계약금 먼저 보내주세요.');
        await p.locator('#btn-home-analyze').click();
        await p.locator('#llm-panel summary').click();
        assert.equal(await p.locator('#llm-enable').isDisabled(), profile.blocked, profile.name);
        assert.equal(await p.evaluate(() => LLM.capabilities().webgpu), false);
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, profile.name + ' no overflow');
        if (profile.blocked) {
          assert.equal(await p.locator('#llm-device-note').textContent(), await p.evaluate(() => I18n.t('llm.mobileDisabled')));
          const rejected = await p.evaluate(async () => {
            const box = document.getElementById('llm-enable');
            box.checked = true; box.dispatchEvent(new Event('change'));
            const enabled = LLM.enabled;
            LLM.enabled = true;
            let error;
            try { await LLM.load(LLM.MODELS[0]); } catch (e) { error = e.message; }
            LLM.enabled = false;
            return { enabled, error };
          });
          assert.deepEqual(rejected, { enabled: false, error: 'mobile-disabled' }, 'mobile events and adapter cannot initiate a model load');
        } else {
          await p.locator('#llm-enable').check();
          assert.equal(await p.locator('#llm-download').isEnabled(), true, 'CPU desktop eligible');
        }
        assert.equal(loads.some(url => /wllama|llm-worker|hash-wasm|huggingface/.test(url)), false, 'no automatic model/runtime load');
        assert.deepEqual(faults, []);
        await context.close();
      }
      console.log('PASS ' + (prefix || '/') + ': guide resources, PDF, attribution, languages, layouts and six device profiles');
    } finally { await new Promise(resolve => server.close(resolve)); }
  }
} finally { await browser.close(); }
