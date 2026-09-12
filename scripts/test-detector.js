/*
 * Detector test suite. Run from the repo root:
 *     node scripts/test-detector.js
 *
 * Asserts three things:
 *   1. Concept rules catch paraphrased scam messages that share no keywords
 *      with anything in the catalogue.
 *   2. Benign rental messages stay silent — a false positive here is worse
 *      than a miss, because a tool that cries wolf gets ignored.
 *   3. Shingle similarity catches copy-pasted scripts (spacing changes,
 *      inserted words, embedding in a longer message) without flagging
 *      unrelated text.
 *
 * Add a case here whenever you add a pattern or a lexicon entry.
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = require(path.join(ROOT, 'assets/js/detector.js'));
const fs = require('fs');
const L = JSON.parse(fs.readFileSync(path.join(ROOT,'data/lexicon.json'),'utf8'));
const P = JSON.parse(fs.readFileSync(path.join(ROOT,'data/patterns.json'),'utf8'));

// corpus of known scam sentences, seeded from the pattern catalogue
const corpus = P.patterns.flatMap(p => [
  { id: p.id+':ko', patternId: p.id, text: p.sample.ko, severity: p.severity },
  { id: p.id+':en', patternId: p.id, text: p.sample.en, severity: p.severity },
]);

let fails = 0;
const ok = (c,m) => { console.log((c?'PASS  ':'FAIL  ')+m); if(!c) fails++; };

// ---- paraphrases that keyword matching misses entirely ----
const PARAPHRASES = [
  ['오늘 안에 예약금만 넣어주시면 방 빼놓을게요.', 'fz-hold-room-payment'],
  ['지금 바로 쏴주시면 확보해드립니다.', 'fz-urgent-payment'],
  ['문의가 많아서 오늘 결정 안 하시면 곤란해요.', 'fz-competition-pressure'],
  ['제 와이프 통장으로 넣어주세요.', 'fz-third-party-account'],
  ['건물주가 지방에 계셔서 제가 대리로 진행합니다.', 'fz-owner-absent-proxy'],
  ['등기 관련 서류는 나중에 보여드릴게요.', 'fz-refuse-register'],
  ['대출 때문에 주민등록이전은 한 달만 늦춰주세요.', 'fz-delay-movein'],
  ['담보는 잡혀 있지만 전혀 문제없습니다.', 'fz-mortgage-reassure'],
  ['수탁회사 명의지만 임대인은 저라 괜찮아요.', 'fz-trust-reassure'],
  ['멀리 계시니 직접 안 보셔도 되고 열쇠는 택배로 보내요.', 'fz-keys-by-mail'],
  ['보증금 반환은 절대 불가합니다.', 'fz-no-refund'],
  ['사업자등록 같은 건 없습니다.', 'fz-no-business-reg'],
];
console.log('--- paraphrase detection (concept rules) ---');
PARAPHRASES.forEach(([text, expect]) => {
  const hits = D.matchRules(text, L.lexicon, L.rules);
  const found = hits.some(h => h.rule.id === expect);
  ok(found, `${expect.padEnd(26)} <- "${text.slice(0,34)}…"` + (found?'':`  got: ${hits.map(h=>h.rule.id).join(',')||'none'}`));
});

// ---- benign text must stay quiet ----
console.log('\n--- benign controls (must not fire) ---');
const BENIGN = [
  '안녕하세요. 등기부등본 미리 보내드릴게요.',
  '전입신고와 확정일자는 이사 당일 꼭 받으세요.',
  '보증금은 제 명의 계좌로 계약서 쓰고 입금하시면 됩니다.',
  '주말에 방 보러 오실 수 있나요? 지하철역에서 도보 5분입니다.',
  '근저당은 없습니다. 등기부등본으로 확인해보세요.',
  '환불 규정은 계약서에 명시되어 있습니다.',
  '월세 55만원에 관리비 5만원이고 인터넷이 포함입니다.',
];
BENIGN.forEach(t => {
  const hits = D.matchRules(t, L.lexicon, L.rules);
  ok(hits.length === 0, `quiet on: "${t.slice(0,40)}…"` + (hits.length?`  fired: ${hits.map(h=>h.rule.id).join(',')}`:''));
});

// ---- near-duplicate detection (copy-pasted scripts) ----
console.log('\n--- near-duplicate detection (shingles) ---');
const original = P.patterns.find(p=>p.id==='pay-urgency').sample.ko;
const variants = [
  [original.replace(/ /g,''), 'spacing removed'],
  [original.replace('입금하셔야','입금해주셔야'), 'word inserted'],
  ['안녕하세요 ' + original + ' 연락주세요', 'embedded in a longer message'],
];
variants.forEach(([v,label]) => {
  const hits = D.scan(v, corpus);
  const found = hits.some(h => h.entry.patternId === 'pay-urgency');
  ok(found, `${label.padEnd(30)} detected` + (found?` (${hits[0].how}, ${hits[0].score.toFixed(2)})`:''));
});
const unrelated = D.scan('주말에 방 보러 가도 될까요? 지하철역에서 가깝나요?', corpus);
ok(unrelated.length === 0, 'unrelated text is not flagged as a duplicate' + (unrelated.length?` (${unrelated.map(u=>u.entry.id).join(',')})`:''));

// ---- combined ----
console.log('\n--- combined analyze() ---');
const msg = '오늘 안에 예약금만 넣어주시면 방 빼놓을게요. 제 와이프 통장으로 보내주시면 됩니다. 등기 서류는 계약할 때 보여드릴게요.';
const r = D.analyze(msg, { lexicon: L.lexicon, rules: L.rules, corpus });
ok(r.rules.length >= 3, `combined run found ${r.rules.length} concept rules`);
r.rules.forEach(h => console.log('        · ' + h.rule.id + '  [' + h.terms.join(', ') + ']'));

// ---- performance ----
const big = Array(200).fill(msg).join('\n');
const t0 = Date.now();
D.analyze(big, { lexicon: L.lexicon, rules: L.rules, corpus });
const ms = Date.now() - t0;
ok(ms < 1500, `200-line transcript analysed in ${ms}ms`);

console.log('\n' + (fails ? fails + ' FAILURES' : 'ALL PASSED'));
process.exit(fails ? 1 : 0);
