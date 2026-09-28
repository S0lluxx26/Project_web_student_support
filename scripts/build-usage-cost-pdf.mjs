/* Print the reviewed bilingual HTML report without external network access.
 * Requires Playwright Chromium and an installed Malgun Gothic font.
 * node scripts/build-usage-cost-pdf.mjs
 * Render and visually inspect every PDF page before committing the result.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, createSiteServer, listen } from './serve-site.mjs';

const output = path.join(ROOT, 'output/pdf/usage-cost-report.pdf');
fs.mkdirSync(path.dirname(output), { recursive: true });
const server = createSiteServer({ root: ROOT });
await listen(server, 0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await page.goto(base + 'manual/usage-cost-report.html', { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);
  const badStyle = await page.locator('main p, main h1, main h2, main td, main th, main a, main li').evaluateAll(nodes => nodes.filter(n => {
    const s = getComputedStyle(n);
    return s.fontSize !== '12px' || s.lineHeight !== '12px' || !s.fontFamily.includes('Malgun Gothic');
  }).length);
  assert.equal(badStyle, 0, 'Report must use Malgun Gothic, 9pt and 1.0 line spacing');
  // Check the font actually used by Chromium, rather than only the CSS declaration.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'header [lang="ko"] h1' });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  assert(fonts.length && fonts.every(f => /Malgun Gothic|맑은 고딕/i.test(f.familyName)), 'Install Malgun Gothic before building the PDF');
  // Give relative anchor destinations the final public URL, not the local preview URL.
  await page.evaluate(() => {
    const base = document.createElement('base');
    base.href = 'https://s0lluxx26.github.io/Project_web_student_support/manual/usage-cost-report.html';
    document.head.prepend(base);
  });
  await page.pdf({ path: output, preferCSSPageSize: true, printBackground: true,
    displayHeaderFooter: true, headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-family:Malgun Gothic,sans-serif;font-size:9pt;line-height:1;width:100%;text-align:center;color:#455c62"><span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
  fs.copyFileSync(output, path.join(ROOT, 'manual/usage-cost-report.pdf'));
  console.log('Bilingual usage/cost PDF created with actual font verification: ' + output);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
