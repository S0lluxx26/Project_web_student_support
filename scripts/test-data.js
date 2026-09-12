/*
 * Data integrity checks. Run from the repo root:
 *     node scripts/test-data.js
 *
 * These guard against SILENT breakage, which is the way this project is most
 * likely to degrade: contributors edit JSON, not code, and several failure
 * modes produce no error anywhere.
 *
 *   - A typo'd `patternId` in lexicon.json makes analyzer.js skip that fuzzy
 *     hit, with no warning. The rule simply stops working.
 *   - A missing i18n key renders the raw key in the UI.
 *   - The `result.level.*` and `assess.*` keys are built by concatenation, so
 *     no amount of grepping the source finds them. Pruning "unused" keys once
 *     removed them and broke the result screen.
 */

const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };

const patterns = read('data/patterns.json');
const lexicon  = read('data/lexicon.json');
const docs     = read('data/documents.json');
const i18n     = read('data/i18n.json');
const examples = read('data/examples.json');
const html     = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const CATEGORIES = ['payment_pressure', 'identity', 'register_risk', 'contract',
                    'too_good', 'goshiwon', 'agent_behaviour'];

/* ---------------------------------------------------------------- patterns */
console.log('--- patterns ---');
{
  const ids = patterns.patterns.map(p => p.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  ok(dupes.length === 0, `pattern ids unique (${ids.length})` +
    (dupes.length ? `  duplicated: ${[...new Set(dupes)].join(', ')}` : ''));

  const badSev = patterns.patterns.filter(p =>
    !Number.isInteger(p.severity) || p.severity < 1 || p.severity > 5);
  ok(badSev.length === 0, 'severities are integers 1-5' +
    (badSev.length ? `  bad: ${badSev.map(p => p.id).join(', ')}` : ''));

  const badCat = patterns.patterns.filter(p => !CATEGORIES.includes(p.category));
  ok(badCat.length === 0, 'categories are known' +
    (badCat.length ? `  bad: ${badCat.map(p => `${p.id}(${p.category})`).join(', ')}` : ''));

  const missing = [];
  patterns.patterns.forEach(p => {
    ['title', 'why', 'action', 'sample'].forEach(f => {
      if (!p[f] || !p[f].ko || !p[f].en) missing.push(`${p.id}.${f}`);
    });
    if (!p.keywords || (!p.keywords.ko && !p.keywords.en)) missing.push(`${p.id}.keywords`);
  });
  ok(missing.length === 0, 'every pattern has ko and en for title/why/action/sample' +
    (missing.length ? `  missing: ${missing.join(', ')}` : ''));

  const thin = patterns.patterns.filter(p =>
    (p.why.ko || '').length < 40 || (p.action.ko || '').length < 25);
  ok(thin.length === 0, 'explanations and actions are substantive' +
    (thin.length ? `  thin: ${thin.map(p => p.id).join(', ')}` : ''));
}

/* ----------------------------------------------------------------- lexicon */
console.log('\n--- lexicon ---');
{
  const patternIds = new Set(patterns.patterns.map(p => p.id));
  const dangling = lexicon.rules.filter(r => !patternIds.has(r.patternId));
  ok(dangling.length === 0,
    'every lexicon rule points at a real pattern' +
    (dangling.length ? `  dangling: ${dangling.map(d => `${d.id}->${d.patternId}`).join(', ')}` : ''));

  const concepts = new Set(Object.keys(lexicon.lexicon));
  const badConcepts = [];
  lexicon.rules.forEach(r => {
    [].concat(r.all || [], r.any || [], r.none || []).forEach(c => {
      if (!concepts.has(c)) badConcepts.push(`${r.id}->${c}`);
    });
  });
  ok(badConcepts.length === 0, `every rule concept is defined (${concepts.size} concepts)` +
    (badConcepts.length ? `  missing: ${badConcepts.join(', ')}` : ''));

  const empty = Object.keys(lexicon.lexicon).filter(c => !lexicon.lexicon[c].length);
  ok(empty.length === 0, 'no concept is empty' + (empty.length ? `  ${empty.join(', ')}` : ''));

  const ruleIds = lexicon.rules.map(r => r.id);
  ok(new Set(ruleIds).size === ruleIds.length, `rule ids unique (${ruleIds.length})`);
}

/* --------------------------------------------------------------- documents */
console.log('\n--- documents ---');
{
  const qIds = [];
  (docs.documents || []).forEach(d => (d.questions || []).forEach(q => qIds.push(q.id)));
  ((docs.contractChecklist || {}).items || []).forEach(it => qIds.push(it.id));
  const dupes = qIds.filter((id, i) => qIds.indexOf(id) !== i);
  ok(dupes.length === 0, `question ids unique across documents and contract (${qIds.length})` +
    (dupes.length ? `  duplicated: ${[...new Set(dupes)].join(', ')}` : ''));

  const badWeight = [];
  (docs.documents || []).forEach(d => (d.questions || []).forEach(q => {
    if (!Number.isInteger(q.weight) || q.weight < 1 || q.weight > 50) badWeight.push(q.id);
  }));
  ok(badWeight.length === 0, 'question weights are sane' +
    (badWeight.length ? `  bad: ${badWeight.join(', ')}` : ''));
}

/* -------------------------------------------------------------------- i18n */
console.log('\n--- i18n ---');
{
  const ko = new Set(Object.keys(i18n.ko));
  const en = new Set(Object.keys(i18n.en));
  const diff = [...new Set([...ko].filter(k => !en.has(k))
                    .concat([...en].filter(k => !ko.has(k))))];
  ok(diff.length === 0, `Korean and English have the same keys (${ko.size})` +
    (diff.length ? `  differ: ${diff.join(', ')}` : ''));

  const emptyVals = [...ko].filter(k => !String(i18n.ko[k]).trim() || !String(i18n.en[k]).trim());
  ok(emptyVals.length === 0, 'no empty strings' +
    (emptyVals.length ? `  ${emptyVals.join(', ')}` : ''));

  /* Keys the HTML asks for by name. */
  const used = [...html.matchAll(/data-i18n(?:-ph|-aria)?="([^"]+)"/g)].map(m => m[1]);
  const unresolved = [...new Set(used)].filter(k => !ko.has(k));
  ok(unresolved.length === 0, `every data-i18n key in the HTML resolves (${new Set(used).size})` +
    (unresolved.length ? `  missing: ${unresolved.join(', ')}` : ''));

  /* Keys built by concatenation, which grep can never find. */
  const built = []
    .concat(['safe', 'caution', 'high', 'veryhigh'].flatMap(l =>
      [`result.level.${l}`, `result.level.${l}.msg`]))
    .concat(['insufficient_information', 'no_known_signals', 'needs_review',
             'strong_warning_signals'].flatMap(a => [`assess.${a}`, `assess.${a}.msg`]))
    .concat(['strong', 'review', 'info'].map(p => `result.priority.${p}`))
    .concat(['landlord', 'agent', 'manager', 'tenant', 'unknown'].map(r => `result.speaker.${r}`))
    .concat(['yes', 'no', 'na', 'unknown'].map(v => `answer.${v}`))
    .concat(['1', '2', '3', '4'].map(n => `result.before.${n}`));
  const missingBuilt = built.filter(k => !ko.has(k) || !en.has(k));
  ok(missingBuilt.length === 0,
    `all ${built.length} dynamically-built keys exist` +
    (missingBuilt.length ? `  missing: ${missingBuilt.join(', ')}` : ''));
}

/* ---------------------------------------------------------------- examples */
console.log('\n--- examples ---');
{
  const STATES = ['insufficient_information', 'no_known_signals',
                  'needs_review', 'strong_warning_signals'];
  const bad = examples.examples.filter(e => !STATES.includes(e.expect));
  ok(bad.length === 0, 'example expectations name a real assessment state' +
    (bad.length ? `  bad: ${bad.map(e => `${e.id}(${e.expect})`).join(', ')}` : ''));

  const noText = examples.examples.filter(e => !e.text || !e.text.ko);
  ok(noText.length === 0, `every example has Korean text (${examples.examples.length})`);

  /* An example that leaked a real identifier would be published in the repo. */
  const Redact = require(path.join(ROOT, 'assets/js/redact.js'));
  const leaky = [];
  examples.examples.forEach(e => {
    const found = Redact.inspect(e.text.ko || '');
    /* An address or unit number is fine in a fictional example; a phone
       number, email, account or RRN is not. */
    const serious = found.filter(f => ['phone', 'email', 'account', 'rrn'].includes(f.id));
    if (serious.length) leaky.push(`${e.id}: ${serious.map(f => f.id).join(',')}`);
  });
  ok(leaky.length === 0, 'no example contains a phone, email, account or ID number' +
    (leaky.length ? `  ${leaky.join('; ')}` : ''));
}

/* ------------------------------------------------------------ asset version */
console.log('\n--- deployment ---');
{
  const crypto = require('crypto');
  const files = require('./asset-files.cjs');
  const h = crypto.createHash('sha1');
  files.forEach(f => h.update(fs.readFileSync(path.join(ROOT, f))));
  const want = h.digest('hex').slice(0, 8);
  const found = [...new Set([...html.matchAll(/\?v=([0-9a-f]{8})/g)].map(m => m[1]))];
  ok(found.length === 1 && found[0] === want,
    `asset version matches the built files (expected ${want}, found ${found.join(',') || 'none'})` +
    (found.length === 1 && found[0] !== want
      ? `\n        -> update index.html to ?v=${want}` : ''));
}

console.log('\n' + (fails ? fails + ' FAILURES' : 'ALL PASSED'));
process.exit(fails ? 1 : 0);
