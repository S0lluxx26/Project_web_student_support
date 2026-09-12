/* Real model test; opt-in, never part of ordinary CI. Supply the pinned GGUF.
 * node scripts/bench-llm.mjs --model tmp/models/Qwen3-0.6B-Q4_K_M.gguf
 * --isolated additionally tests an explicitly isolated static server.
 * All prompts here are synthetic; this is not a fraud accuracy evaluation. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { ROOT, createSiteServer, listen } from './serve-site.mjs';

const args = process.argv.slice(2);
const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const model = path.resolve(ROOT, value('--model', 'tmp/models/Qwen3-0.6B-Q4_K_M.gguf'));
const download = args.includes('--download');
if (!download && !fs.existsSync(model)) throw new Error('Supply --model with the pinned GGUF, or explicitly use --download.');
const isolated = args.includes('--isolated');
const liveURL = value('--url', null);
const prefix = '/Project_web_student_support';
const missing = [], errors = [];
const server = createSiteServer({ root: ROOT, prefix, isolated, onRequest: (url, status) => {
  if (status >= 400 && !url.endsWith('favicon.ico')) missing.push({ url, status });
} });
await listen(server, 0);
const browserServer = await chromium.launchServer();
const browser = await chromium.connect(browserServer.wsEndpoint());
const page = await browser.newPage();
page.on('pageerror', e => errors.push(e.message));
const patterns = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/patterns.json'))).patterns;
const result = { at: new Date().toISOString(), synthetic: true, isolated, download,
  liveURL,
  device: { os: os.platform(), arch: os.arch(), cpu: os.cpus()[0].model, logicalCpus: os.cpus().length,
    installedRamBytes: os.totalmem(), browser: browser.version() }, missing, errors };
function memorySnapshot() {
  if (os.platform() !== 'win32') return null;
  const pid = browserServer.process().pid;
  const script = `$taskIds = @(${pid}); $taskAll = Get-CimInstance Win32_Process; do { $taskNext = @($taskAll | Where-Object { $taskIds -contains $_.ParentProcessId -and $taskIds -notcontains $_.ProcessId } | ForEach-Object { $_.ProcessId }); $taskIds += $taskNext } while ($taskNext.Count -gt 0); $taskProcesses = Get-Process -Id $taskIds -ErrorAction SilentlyContinue; @{ workingSetBytes = ($taskProcesses | Measure-Object WorkingSet64 -Sum).Sum; privateCommitBytes = ($taskProcesses | Measure-Object PrivateMemorySize64 -Sum).Sum; processes = $taskProcesses.Count } | ConvertTo-Json -Compress`;
  try { return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8', timeout: 20000 })); }
  catch { return null; }
}
try {
  const target = new URL(liveURL || `http://127.0.0.1:${server.address().port}${prefix}/`);
  target.searchParams.set('experiment', 'llm');
  await page.goto(target.href);
  await page.waitForFunction(() => window.App && App.ready);
  await page.locator('#home-chat').fill('집주인: 오늘 안에 계약금 먼저 보내주세요. 등기부등본은 잔금 후에 보여드릴게요.');
  await page.locator('#btn-home-analyze').click();
  await page.locator('#llm-panel summary').click();
  await page.locator('#llm-enable').check();
  result.capabilities = await page.evaluate(() => LLM.capabilities());
  console.log('Loading actual model', JSON.stringify(result.capabilities));
  const started = Date.now();
  if (download) await page.locator('#llm-download').click();
  else await page.locator('#llm-file').setInputFiles(model);
  await page.waitForFunction(() => !LLMUI.busy, null, { timeout: 180000 });
  result.loadWallMs = Date.now() - started;
  result.loadStatus = await page.locator('#llm-status').textContent();
  result.loadStats = await page.evaluate(() => LLM.stats);
  console.log('Load:', JSON.stringify({ status: result.loadStatus, stats: result.loadStats }));
  if (!(await page.evaluate(() => LLMUI.ready))) throw new Error('Real model did not become ready');
  result.memoryAfterLoad = memorySnapshot();
  const count = Number(value('--cases', '1'));
  result.cases = [];
  for (let i = 0; i < count; i++) {
    const lang = i % 2 ? 'en' : 'ko';
    const pattern = patterns[Math.floor(i / 2) % patterns.length];
    const finding = { id: pattern.id, title: pattern.title[lang], why: pattern.why[lang], action: pattern.action[lang] };
    const generated = await page.evaluate(async ({ i, lang, finding }) => {
      const input = { assessment: 'needs_review', lang, findings: [finding], transcript: '' };
      const answer = await LLM.generate(input);
      return { case: i + 1, lang, finding: finding.id, ...answer, stats: LLM.stats };
    }, { i, lang, finding });
    result.cases.push(generated);
    console.log('Generation:', JSON.stringify(generated));
  }
  result.finalAssessment = await page.evaluate(() => Housing.lastResult.assessment);
  result.memoryAfterGeneration = memorySnapshot();
  if (args.includes('--cancel-check')) {
    await page.evaluate(() => {
      window.__cancelledResult = null;
      LLM.generate({ ...LLMUI.report, findings: [LLMUI.report.findings[0]] })
        .then(() => { window.__cancelledResult = 'unexpected-result'; })
        .catch(error => { window.__cancelledResult = error.cancelled ? 'cancelled' : error.message; });
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => LLMUI.stop(true));
    await page.waitForFunction(() => window.__cancelledResult !== null);
    result.cancelResult = await page.evaluate(() => window.__cancelledResult);
    if (result.cancelResult !== 'cancelled') throw new Error('Real cancellation failed');
  }
  if (download) {
    await page.evaluate(() => LLMUI.stop(true));
    await page.locator('#llm-download').click();
    await page.waitForFunction(() => !LLMUI.busy, null, { timeout: 180000 });
    result.cacheReloadStats = await page.evaluate(() => LLM.stats);
    if (result.cacheReloadStats?.source !== 'verified-cache') throw new Error('Cache reload failed');
    await page.locator('#llm-remove-cache').click();
    await page.waitForFunction(() => !LLMUI.busy);
    result.cacheRemoved = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      try { await root.getDirectoryHandle('student-support-models-v1'); return false; }
      catch (error) { return error.name === 'NotFoundError'; }
    });
    if (!result.cacheRemoved) throw new Error('Cache removal failed');
  }
  await page.evaluate(() => LLMUI.reset());
  result.unloaded = await page.evaluate(() => !LLM.engine && !LLM.loaded);
  if (errors.length || missing.length) throw new Error('Browser errors or missing assets');
} catch (error) {
  result.failure = error.message;
  console.error(error);
  process.exitCode = 1;
} finally {
  fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
  const output = path.join(ROOT, 'tmp', 'llm-benchmark-' + (isolated ? 'isolated' : 'pages') + (download ? '-download' : '') + (liveURL ? '-live' : '') + '.json');
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log('Results:', output);
  await browser.close();
  await browserServer.close();
  await new Promise(resolve => server.close(resolve));
}
