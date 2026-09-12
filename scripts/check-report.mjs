/* Validate committed report artifacts without installing Python or Mermaid. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file));
const hash = file => createHash('sha256').update(read(file)).digest('hex');
for (const lang of ['en', 'ko']) {
const ko = lang === 'ko';
const guide = ko ? 'manual/PROJECT_GUIDE_KO.md' : 'manual/PROJECT_GUIDE.md';
const pdf = ko ? 'manual/project-guide-ko.pdf' : 'manual/project-guide.pdf';
const md = read(guide).toString('utf8');
const repo = 'https://github.com/S0lluxx26/Project_web_student_support';
const prompts = repo + '/blob/main/docs/AI_PROMPTS.md';
const slug = text => text.toLowerCase().replace(/[^a-z0-9가-힣 -]/g, '').replace(/ /g, '-');
assert(md.includes(ko ? '**제작자: Bui Xuan Mai**' : '**Maker: Bui Xuan Mai**') && md.includes(repo) && md.includes(prompts));
assert(!/\b(daughter|father|mother)\b/i.test(md), 'Unexpected personal reference in report');

const chapters = [...md.matchAll(/^## (\d+\. .+)$/gm)].map(match => match[1]);
assert.equal(chapters.length, 15, 'Review the expected report structure if chapters change');
const toc = md.match(/<!-- toc:start -->([\s\S]*?)<!-- toc:end -->/);
assert(toc, 'Missing Markdown contents');
const links = [...toc[1].matchAll(/^- \[([^\]]+)\]\(#([^)]+)\)$/gm)];
assert.deepEqual(links.map(match => match[1]), chapters, 'Contents must match chapter order');
assert.deepEqual(links.map(match => match[2]), chapters.map(slug), 'Broken contents anchor');

const diagramPath = ko ? 'assets/manual/diagrams/ko/manifest.json' : 'assets/manual/diagrams/manifest.json';
const manifest = JSON.parse(read(diagramPath));
assert.equal(manifest.renderer, 'mermaid@12.0.0');
const fence = String.fromCharCode(96).repeat(3);
const blocks = [...md.matchAll(new RegExp('<!-- mermaid: ([a-z-]+) -->\\s*' + fence + 'mermaid\\n([\\s\\S]*?)\\n' + fence, 'g'))];
assert.deepEqual(blocks.map(match => match[1]), manifest.diagrams.map(item => item.id));
assert.equal(blocks.length, 4, 'Expected four rendered architecture figures');
for (const [i, item] of manifest.diagrams.entries()) {
  assert.equal(blocks[i][2].trim(), read(item.source).toString('utf8').trim(), 'Mermaid source differs from Markdown: ' + item.id);
  for (const kind of ['source', 'svg', 'png']) {
    assert.equal(hash(item[kind]), item[kind + 'Sha256'], 'Stale diagram asset: ' + item[kind] + '. Run node scripts/render-report-diagrams.mjs.');
  }
}

// Relative report links must resolve inside the repository. Remote references
// stay in the published PDF as URLs and are reviewed separately by the author.
for (const match of md.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
  const href = match[1];
  if (/^(https?:|#)/.test(href)) continue;
  const resolved = path.resolve(root, 'manual', href.split('#')[0]);
  const relative = path.relative(root, resolved);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Out-of-project report link');
  assert(fs.statSync(resolved).isFile(), 'Missing report resource: ' + href);
}

const recordPath = ko ? 'assets/manual/report-build-ko.json' : 'assets/manual/report-build.json';
const record = JSON.parse(read(recordPath));
if (ko) {
  assert.equal(record.language, 'ko');
  const captures = JSON.parse(read('assets/manual/ko/cases.json'));
  assert.equal(captures.language, 'ko');
  assert.deepEqual(captures.cases.map(c => [c.id, c.assessment, c.signals.length]),
    [['pressure', 'strong_warning_signals', 4], ['ordinary', 'no_known_signals', 0]]);
  assert(!/딸|아버지|어머니/.test(md), 'Unexpected personal reference in Korean report');
}
assert.equal(record.source, guide);
assert.equal(record.sourceSha256, hash(guide), 'PDF is stale. Review Markdown, then run python scripts/build-guide-pdf.py.');
assert.equal(record.pdfSha256, hash(pdf), 'PDF bytes differ from build record');
assert.equal(record.diagramManifestSha256, hash(diagramPath), 'Regenerate PDF after rendering changed diagrams');
assert.equal(record.bytes, read(pdf).length);
assert.equal(record.maker, 'Bui Xuan Mai');
assert.equal(record.repository, repo);
assert.equal(record.promptReference, prompts);
assert(read(pdf).subarray(0, 5).equals(Buffer.from('%PDF-')));
assert.deepEqual(record.contents.map(entry => entry.title), chapters);
let previousPage = 2;
for (const entry of record.contents) {
  assert.equal(entry.anchor, slug(entry.title));
  assert(Number.isInteger(entry.page) && entry.page >= previousPage && entry.page <= record.pages);
  previousPage = entry.page;
}
for (const file of [guide, pdf, diagramPath, recordPath,
  ...manifest.diagrams.flatMap(item => [item.svg, item.png])]) {
  if (fs.existsSync(path.join(root, 'dist', file))) {
    assert.equal(hash('dist/' + file), hash(file), 'Public artifact is stale: run npm run build');
  }
}
console.log(lang + ' report checks passed: 15 linked chapters, 4 matching Mermaid figures, attribution, resources and PDF hashes (' + record.pages + ' pages).');
}
