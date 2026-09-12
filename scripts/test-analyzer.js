/*
 * Analyzer regression suite. Run from the repo root:
 *     node scripts/test-analyzer.js
 *
 * This is the committed version of the regression table in
 * docs/CODE_REVIEW_FIXES.md. Every case below was a real, reproduced defect;
 * they are here so they cannot come back silently.
 *
 * The false-positive block matters more than the true-positive one. A tool
 * that cries wolf gets ignored, and then misses the real thing.
 */

const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

global.window = global;
require(path.join(ROOT, 'assets/js/i18n.js'));
require(path.join(ROOT, 'assets/js/conversation.js'));
require(path.join(ROOT, 'assets/js/detector.js'));
require(path.join(ROOT, 'assets/js/analyzer.js'));

const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
I18n.load(read('data/i18n.json'));
I18n.lang = 'ko';
Analyzer.load(read('data/patterns.json')).loadFuzzy(read('data/lexicon.json'));

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fails++; };
const ids = r => r.matches.filter(m => m.points > 0).map(m => m.pattern.id);
const run = t => Analyzer.analyze(t, {}, []);

/* ---------------------------------------------------------------------------
   1. Must NOT fire — ordinary or opposite-meaning messages
   --------------------------------------------------------------------------- */
console.log('--- false positives (must stay clean) ---');
[
  ['Landlord: Deposit insurance is possible.', 'con-no-insurance', 'positive insurance claim'],
  ['집주인: 이 집은 보증보험 가입이 가능합니다.', 'con-no-insurance', 'positive insurance claim (ko)'],
  ['Tenant: Is deposit insurance possible?', 'con-no-insurance', 'tenant question'],
  ['Tenant: I will not pay now.', 'pay-urgency', 'tenant refusal'],
  ['세입자: 지금은 입금 안 하겠습니다.', 'pay-urgency', 'tenant refusal (ko)'],
  ['집주인: 압류나 경매는 없습니다.', 'reg-seizure-auction', 'denial of seizure'],
  ['집주인: 등기부등본 소유자와 예금주가 같은 제 계좌로 보내주세요.', 'pay-personal-account', 'account matches owner'],
  /* The possessor is the whole signal. Paying into the OWNER's account is the
     correct thing to do, so the keyword list must never match "명의 계좌" on
     its own — only an account belonging to the wrong party. */
  ['중개사: 집주인 명의 계좌로 보내시면 됩니다.', 'pay-personal-account', 'owner-named account is correct'],
  /* Speaker-conditioned: the same words excuse the pattern from the owner and
     must not excuse it from anyone else. */
  ['집주인: 제 명의 계좌로 보내주세요.', 'pay-personal-account', 'owner saying "my own name"'],
  ['중개사: 임대인 명의 계좌 확인하시고 입금하세요.', 'pay-personal-account', 'lessor-named account is correct'],
  ['Landlord: The existing tenant will leave on Friday.', 'con-double-lease', 'ordinary handover'],
  ['Manager: There is no problem with a refund.', 'gosi-no-refund', 'refunds are fine'],
  ['세입자: 전입신고는 언제 하면 되나요?', 'con-no-moving-report', 'tenant asking about move-in report'],
  /* A trust-owned flat handled CORRECTLY — the trustee's consent is required
     and the money goes to the trust's own account. Same vocabulary as the
     fraud, opposite direction, and the reassurance lands in a DIFFERENT
     message from the trust mention, which is what `suppressedBy.anywhere` is
     for. */
  ['중개사: 이 물건은 등기부상 소유자가 신탁회사입니다.\n중개사: 신탁사 임대차 동의서를 먼저 받아야 계약이 유효합니다.\n중개사: 보증금은 신탁사 지정 계좌로 입금하셔야 합니다.',
    'reg-trust', 'trust handled correctly'],
  ['중개사: 잔금일에 근저당을 말소하기로 특약에 넣겠습니다.', 'reg-dismiss-question', 'a written undertaking is not a brush-off'],
  ['중개사: 근저당은 없고 집주인분 명의로 되어 있습니다.', 'reg-dismiss-question', 'a straight answer'],
].forEach(([text, mustNot, label]) => {
  const got = ids(run(text));
  ok(!got.includes(mustNot), `${label.padEnd(34)} no ${mustNot}` +
    (got.includes(mustNot) ? `  (fired: ${got.join(',')})` : ''));
});

/* ---------------------------------------------------------------------------
   2. Must fire, and must be prominent
   --------------------------------------------------------------------------- */
console.log('\n--- true positives (must be prominent) ---');
[
  ['집주인: 전입신고 하지 마세요.', 'con-no-moving-report', 'explicit move-in restriction'],
  ['Landlord: The viewing can only be arranged once a holding sum reaches the bank details I sent.',
    'pay-before-viewing', 'payment before viewing'],
  ['집주인: 입금 확인되면 방 주소랑 호수 알려드릴게요.', 'pay-before-viewing', 'address only after payment'],
  ['집주인: 오늘 가계약금 먼저 입금하셔야 잡아드려요.', 'pay-urgency', 'urgent payment demand'],
  ['집주인: 제 개인 계좌로 보내주세요.', 'pay-personal-account', 'personal account'],
  /* Missed until demo/run-demo.mjs put a real screenshot through the pipeline:
     an agent asking for the deposit in their OWN name is the classic version of
     this and the catalogue had no phrasing that reached it. */
  ['중개사: 제 명의 계좌로 보내주세요 사장님이 지방에 계셔서요.', 'pay-personal-account', 'agent\'s own account'],
  ['중개사: 중개사 계좌로 먼저 입금해주세요.', 'pay-personal-account', 'agent account by role name'],
  ['집주인: 신탁회사 소유인데 실제 주인은 저예요.', 'reg-trust', 'trust property'],
  /* The conversation that scored completely clean before this pattern existed:
     the TENANT raises 가압류 and 경매, so every register keyword sits on the
     user's own side and is gated out, while the counterparty only ever replies
     with reassurance — which, reg-seizure-auction being `deniable`, actively
     SUPPRESSED it. The signal is the refusal to give a number. */
  ['집주인: 그런 거 따지면 계약 못 해요. 별거 아닙니다.', 'reg-dismiss-question', 'dodging a register question'],
  ['집주인: 근저당이 좀 있는데 곧 말소될 예정이라 괜찮습니다.', 'reg-dismiss-question', 'unverifiable discharge promise'],
  ['집주인: 확정일자만 받아두시면 아무 문제 없습니다.', 'reg-dismiss-question', 'false reassurance about 확정일자'],
  ['중개사: 그건 등기부 보시면 되는데 신경 안 쓰셔도 됩니다.', 'reg-dismiss-question', 'steering away from the register'],
  ['집주인: 오늘 안에 결정 안 하시면 다음 분께 넘어갑니다.', 'pay-urgency', 'deadline with no payment word'],
  ['중개사: 계약서는 입금 확인 후에 보내드립니다.', 'pay-before-contract', 'contract only after the money'],
].forEach(([text, must, label]) => {
  const r = run(text);
  const got = ids(r);
  ok(got.includes(must), `${label.padEnd(34)} ${must}` +
    (got.includes(must) ? '' : `  (got: ${got.join(',') || 'none'})`));
});

console.log('\n--- a single explicit demand is enough to be prominent ---');
[
  '집주인: 전입신고 하지 마세요.',
  '집주인: 입금 확인되면 방 주소 알려드릴게요.',
].forEach(text => {
  const r = run(text);
  ok(r.level === 'veryhigh',
    `single strong signal -> ${r.level} ` + JSON.stringify(text.slice(0, 26)));
});

/* ---------------------------------------------------------------------------
   3. Reported speech is kept, but marked and de-escalated
   --------------------------------------------------------------------------- */
console.log('\n--- reported speech ---');
{
  const r = run('집주인이 전입신고 하지 말라고 했어요.');
  ok(ids(r).includes('con-no-moving-report'), 'tenant reporting the landlord still yields the signal');
  const m = r.matches.find(x => x.pattern.id === 'con-no-moving-report');
  ok(m && m.reported, 'marked as reported rather than directly observed');
  ok(m && m.priority === 'review', `de-escalated to review (got ${m && m.priority})`);
}

/* ---------------------------------------------------------------------------
   4. Evidence must contain the evidence
   --------------------------------------------------------------------------- */
console.log('\n--- evidence excerpt ---');
{
  const long = 'Landlord: ' + '가'.repeat(230) + ' pay now.';
  const r = run(long);
  const m = r.matches[0];
  ok(!!m, 'long message still produces a signal');
  ok(m && /pay now/.test(m.quote), 'excerpt contains the matched phrase');
  ok(m && m.quoteRanges.length > 0, 'highlight ranges resolve against the excerpt');
  ok(m && m.quote.length <= 240, `excerpt stays readable (${m && m.quote.length} chars)`);
}

/* ---------------------------------------------------------------------------
   5. Speaker parsing
   --------------------------------------------------------------------------- */
console.log('\n--- speaker parsing ---');
{
  const msgs = Conversation.parse(
    '집주인: 오늘 입금해주세요.\n' +
    '[김부동산] [오후 3:21] 계약금 보내주세요\n' +
    'Tenant: I will not pay now.\n' +
    '라벨 없는 줄');
  ok(msgs.length === 4, `four messages parsed (${msgs.length})`);
  ok(msgs[0].speaker === 'landlord', 'plain Korean label -> landlord');
  ok(msgs[1].speaker === 'agent', 'KakaoTalk export label -> agent');
  ok(msgs[2].speaker === 'tenant' && msgs[2].act === 'refusal', 'tenant refusal classified');
  ok(msgs[3].speaker === 'unknown', 'unlabeled line stays unknown, never assumed landlord');
}

/* ---------------------------------------------------------------------------
   6. Evidence floor — absence of signals is not safety
   --------------------------------------------------------------------------- */
console.log('\n--- evidence floor ---');
['ㅇㅇ', '네 알겠습니다.', '안녕하세요'].forEach(t => {
  ok(run(t).level === 'insufficient', `${JSON.stringify(t)} -> insufficient`);
});
{
  const long = '안녕하세요. 등기부등본 미리 보내드릴게요. 계약서는 국토부 표준계약서로 쓰고, ' +
               '전입신고와 확정일자는 이사 당일 꼭 받으세요. 주말에 방 보러 오실 수 있나요?';
  ok(run(long).level === 'safe', 'substantial clean conversation earns a clean result');
}

/* ---------------------------------------------------------------------------
   7. Exposure ratio must include senior debt
   --------------------------------------------------------------------------- */
console.log('\n--- exposure ratio ---');
{
  const withLien = Analyzer.analyze('보통 대화입니다.', { deposit: 20000, market: 30000, lien: 20000 }, []);
  ok(withLien.ratio === 133.3, `(lien + deposit) / market = ${withLien.ratio}%`);
  const noLien = Analyzer.analyze('보통 대화입니다.', { deposit: 20000, market: 30000 }, []);
  ok(noLien.ratio === null && noLien.ratioBasis === 'no-lien',
    'unknown lien yields no number at all');
  [Infinity, -5000, NaN].forEach(v => {
    const r = Analyzer.analyze('보통 대화입니다.', { deposit: v, market: 30000, lien: 0 }, []);
    ok(r.ratio === null, `unusable deposit (${v}) -> no ratio`);
  });
}

/* ---------------------------------------------------------------------------
   8. Every pattern still detects its own documented sample
   --------------------------------------------------------------------------- */
console.log('\n--- catalogue self-detection ---');
{
  const P = read('data/patterns.json');
  const miss = [];
  P.patterns.forEach(p => {
    ['ko', 'en'].forEach(L => {
      /* Prefix a neutral counterparty label so the speaker gate does not
         treat the sample as an unattributed line. */
      const r = Analyzer.analyze('집주인: ' + p.sample[L], {}, []);
      if (!r.matches.some(m => m.pattern.id === p.id)) miss.push(`${p.id}(${L})`);
    });
  });
  ok(miss.length === 0, `all ${P.patterns.length} patterns detect their own sample` +
    (miss.length ? `  missing: ${miss.join(', ')}` : ''));
}

console.log('\n' + (fails ? fails + ' FAILURES' : 'ALL PASSED'));
process.exit(fails ? 1 : 0);
