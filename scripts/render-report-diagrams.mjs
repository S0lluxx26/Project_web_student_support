/* Render the report's editable Mermaid files. No runtime Mermaid is published.
 * npm ci --prefix docs/report-tools --ignore-scripts
 * node scripts/render-report-diagrams.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createSiteServer, listen, ROOT } from './serve-site.mjs';

const names = ['deployment', 'data-flow', 'ocr-sequence', 'llm-sequence'];
const lang = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'en';
if (!['en', 'ko'].includes(lang)) throw Error('--lang must be en or ko');
const sourceDir = 'docs/diagrams' + (lang === 'ko' ? '/ko' : '');
const outputDir = 'assets/manual/diagrams' + (lang === 'ko' ? '/ko' : '');
const bundle = 'docs/report-tools/node_modules/mermaid/dist/mermaid.esm.min.mjs';
if (!fs.existsSync(path.join(ROOT, bundle))) throw new Error('Run npm ci --prefix docs/report-tools --ignore-scripts first.');
const out = path.join(ROOT, outputDir);
fs.mkdirSync(out, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const server = createSiteServer({ root: ROOT });
await listen(server, 0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1800 }, deviceScaleFactor: 2 });
const manifest = { renderer: 'mermaid@12.0.0', diagrams: [] };
try {
  await page.goto(base + 'demo.html');
  await page.evaluate(() => { document.body.replaceChildren(); });
  await page.addScriptTag({ type: 'module', content: 'import mermaid from ' + JSON.stringify(base + bundle) + '; window.reportMermaid = mermaid;' });
  await page.waitForFunction(() => !!window.reportMermaid);
  for (const id of names) {
    const source = fs.readFileSync(path.join(ROOT, sourceDir, id + '.mmd'), 'utf8');
    const result = await page.evaluate(async ({ id, source, lang }) => {
      reportMermaid.initialize({
        startOnLoad: false, securityLevel: 'strict', theme: 'base', layout: 'dagre', markdownAutoWrap: false,
        deterministicIds: true, deterministicIDSeed: id,
        fontFamily: lang === 'ko' ? 'Malgun Gothic, Noto Sans CJK KR, sans-serif' : 'Arial, sans-serif',
        themeVariables: { fontSize: '20px', primaryColor: '#eaf2ee', primaryTextColor: '#182e33',
          primaryBorderColor: '#146356', lineColor: '#49636a', secondaryColor: '#faf0db',
          tertiaryColor: '#f3f6f8', actorBkg: '#eaf2ee', actorBorder: '#146356',
          actorTextColor: '#182e33', signalColor: '#49636a', signalTextColor: '#182e33',
          noteBkgColor: '#faf0db', noteBorderColor: '#aa7021', noteTextColor: '#182e33' },
        flowchart: { htmlLabels: false, useMaxWidth: false, curve: 'linear', nodeSpacing: 24, rankSpacing: 32, padding: 12, wrappingWidth: 320, subGraphTitleMargin: { top: 12, bottom: 28 } },
        sequence: { useMaxWidth: false, mirrorActors: false, actorFontSize: 18, noteFontSize: 17,
          messageFontSize: 18, actorMargin: 28, diagramMarginX: 15, diagramMarginY: 12,
          messageMargin: 20, noteMargin: 8, boxMargin: 8, wrap: true, width: 190, height: 50 }
      });
      const { svg } = await reportMermaid.render('diagram-' + id, source);
      document.body.innerHTML = svg;
      document.body.style.cssText = 'margin:0;background:white;display:inline-block';
      const node = document.querySelector('svg');
      const view = node.viewBox.baseVal;
      node.setAttribute('width', Math.ceil(view.width));
      node.setAttribute('height', Math.ceil(view.height));
      node.style.maxWidth = 'none';
      node.style.background = 'white';
      return { svg: node.outerHTML, width: Math.ceil(view.width), height: Math.ceil(view.height) };
    }, { id, source, lang });
    fs.writeFileSync(path.join(out, id + '.svg'), result.svg + '\n');
    await page.locator('svg').screenshot({ path: path.join(out, id + '.png'), animations: 'disabled' });
    const sourcePath = sourceDir + '/' + id + '.mmd';
    const svgPath = outputDir + '/' + id + '.svg', pngPath = outputDir + '/' + id + '.png';
    manifest.diagrams.push({ id, source: sourcePath, sourceSha256: hash(fs.readFileSync(path.join(ROOT, sourcePath))),
      svg: svgPath, svgSha256: hash(fs.readFileSync(path.join(ROOT, svgPath))),
      png: pngPath, pngSha256: hash(fs.readFileSync(path.join(ROOT, pngPath))),
      width: result.width, height: result.height });
    console.log(id + ': ' + result.width + ' x ' + result.height);
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
