# AI 프롬프트 가이드 · AI Prompt Playbook

Prompts that actually produce usable material for this project, and the failure
modes that will bite you if you trust the output.

The tool itself contains **no AI at runtime** — it is a deterministic rule
engine, which is why it is free, private and auditable. AI is used *upstream*,
by us, to research patterns and draft rules. That distinction matters: a
hallucinated fact in a chat window costs nothing, but the same fact written
into `patterns.json` gets shown to a student as safety advice.

So the rule for everything below is: **AI drafts, a primary source decides.**

---

## 1. What to use AI for, and what not to

| Good use | Why |
|---|---|
| Enumerating tactics to *investigate* | Broad recall; you verify each one |
| Generating paraphrases of a known scam sentence | Directly feeds the fuzzy detector's test set |
| Drafting the "why this is risky" explanation | You check the legal basis against the statute |
| Finding the Korean term for a concept you only know in English | Cheap, easy to verify |
| Writing benign control sentences | Needed to test for false positives, tedious by hand |

| Bad use | Why |
|---|---|
| Asking for the current penalty under a specific statute | Amounts and articles change; models state old ones confidently |
| Asking whether a specific listing or agency is a scam | It cannot know, and will produce a plausible answer anyway |
| Generating the pattern catalogue wholesale | You get generic advice, not Korea-specific mechanisms |
| Deciding a threshold or weight | There is no ground truth in the model; use your test set |

---

## 2. Research prompts

### 2.1 Enumerate tactics to investigate

```
You are helping build a fraud-prevention checklist for students renting
one-room apartments in South Korea (전세/월세).

List the tactics a fraudulent landlord or unlicensed broker uses in the
MESSAGING stage — before any contract is signed. For each one give:

1. The tactic in one sentence.
2. The mechanism: what legally goes wrong, and who ends up losing money.
3. Two or three realistic Korean sentences a scammer would actually send.
4. What a legitimate counterpart would say instead in the same situation.
5. The single question a tenant should ask to test it.

Focus on mechanisms specific to Korean lease law — 등기부등본, 근저당,
신탁등기, 전입신고, 확정일자, 대항력, 우선변제권. Skip generic advice
that would apply in any country.

Mark anything you are not confident about with [VERIFY].
```

Item 4 is the one people leave out, and it is the most useful: you cannot write
a rule that avoids false positives without knowing what the innocent version of
the sentence looks like. Item 5 becomes a follow-up question in the tool.

### 2.2 Turn a tactic into a testable rule

```
Here is a scam tactic and three real messages that use it:

[paste your field-research quotes]

I need to detect this in Korean chat text with a deterministic rule engine.
Korean spacing is inconsistent, so matching happens on text with all
whitespace removed.

Give me:
1. Keyword strings that are specific enough NOT to fire on normal rental
   conversation. For each, name a benign sentence it would wrongly match,
   or say why none exists.
2. Concept pairs: two or three groups of words where a match requires one
   word from EACH group in the same sentence.
3. Five benign sentences that contain some of these words innocently, so I
   can test for false positives.
4. Five paraphrases of the scam message using completely different wording,
   to test that the concept pairs generalise.

Do not give me a regex. Give me word lists.
```

Point 1's demand — "name a benign sentence it would wrongly match" — is what
stops you shipping `근저당` as a keyword when `근저당은 없습니다` is the most
reassuring sentence in the language. We shipped exactly that bug and caught it
with a control sentence.

### 2.3 Generate paraphrases for the detector's test set

```
Rewrite this Korean message 10 different ways. Keep the same intent —
pressuring the reader to send money today — but change the vocabulary as
much as possible. Vary formality (해요체, 합니다체, 반말), use chat
abbreviations and typos, and use slang for "send money" (쏘다, 넣다, 쏴).

Original: "오늘 가계약금 먼저 입금해주시면 방 잡아드릴게요."
```

Paste the results straight into `scripts/test-detector.js`. If the concept
rules catch fewer than eight of ten, the lexicon is missing surface forms —
add them and re-run.

### 2.4 Find the Korean term for a concept

```
In Korean residential leasing, what is the standard term for [concept]?
Give the term, its hanja if commonly used, two or three colloquial variants
a normal person would say in a chat message, and which government site
issues the related document.
```

---

## 3. What to be aware of — the failure modes

These are ranked by how much damage they do to *this* project.

### 3.1 Confidently wrong law

The single biggest risk. A model will state a penalty, an article number or a
deadline with complete assurance and be a year or two out of date. Korean
housing law has changed repeatedly since 2023 — the tenant's right to request
the landlord's tax certificates, 전세사기특별법, HUG insurance thresholds.

**Rule: no legal claim enters `patterns.json` without a primary source.** Use
[국가법령정보센터](https://www.law.go.kr) for statutes,
[찾기쉬운 생활법령정보](https://www.easylaw.go.kr) for plain-language
summaries, and the ministry's own pages for procedure. If you cannot find the
source in five minutes, write the advice without the legal claim — "이런
요구는 받아들이지 마세요" is useful even without a statute number attached.

### 3.2 Plausible but non-existent specifics

Ask for "the URL to check 전입세대열람" and you may get a real-looking URL that
404s. Ask for a fee and you may get a number that was true in 2019. Every URL,
phone number, fee and office name in our data files should be opened once by a
human before it ships. A student following a dead link at the moment they are
being pressured to pay is worse than no link.

### 3.3 Generic advice dressed as Korea-specific

Ask a broad question and you get "verify the landlord's identity" — true
everywhere, actionable nowhere. The fix is to demand the mechanism (prompt 2.1,
item 2). If the answer doesn't name a specific document, register section or
filing, it is not yet advice.

### 3.4 Over-broad keywords

Models optimise for recall. Ask for keywords and you get `보증금`, `계좌`,
`계약` — words in every legitimate rental conversation. A false positive here
is not harmless: a tool that flags normal conversations as fraud gets ignored,
and then misses the real thing. **Always generate the benign control set in the
same session**, and treat a control firing as a bug in the rule, not the control.

### 3.5 Fabricated statistics

"전세사기 피해자의 70%가 20–30대" — a number like this will be produced on
request, with or without a real source. Either cite a specific published
report you have opened, or write the claim qualitatively. Our homepage says
"상당수가 20–30대 1인 가구" for exactly this reason: it is defensible without
a number we cannot source.

### 3.6 The model agreeing with you

If you ask "is this a good keyword?", you will usually be told yes. Ask
instead: "give me three sentences where this keyword fires but no fraud is
present." Adversarial framing gets you real answers; confirmatory framing gets
you agreement.

---

## 4. A worked example, end to end

**Field finding.** An agent wrote: "입금 확인되면 방 킵해드릴게요."

**Prompt.**

```
Korean rental chat: "입금 확인되면 방 킵해드릴게요."

1. What tactic is this, and what is the mechanism of loss?
2. Which of these concept groups does each part belong to?
   PAY = [입금, 송금, 이체, 넣어, 보내, 쏴]
   HOLD_ROOM = [잡아드, 잡아둘, 빼놓, 확보]
3. What surface forms are missing from those groups?
4. Give five benign sentences containing "킵" or "입금" where no fraud is
   present.
```

**What comes back that you keep.** "킵" belongs in `HOLD_ROOM`; also missing
are "찜", "예약해". The tactic is pay-before-viewing, and the mechanism is that
a holding payment with no written terms has no legal basis for recovery.

**What you verify.** The claim about recoverability — check against
가계약금 반환 case law before writing it into `why`.

**What you do.** Add `"킵", "찜", "예약해"` to `HOLD_ROOM` in
`data/lexicon.json`. Add the benign sentences to the control set in
`scripts/test-detector.js`. Run the tests. The existing rule
`fz-hold-room-payment` now catches this sentence and four paraphrases of it,
without a new pattern and without touching any code.

That is the shape of a good contribution: one word in a JSON file, verified
against a primary source, covered by a test.

---

## 5. Prompt for reviewing a proposed rule before it ships

```
Here is a rule I am about to add to a fraud-detection tool used by students:

[paste the pattern or lexicon entry]

Argue against it. Specifically:
1. Give three realistic, entirely innocent Korean rental messages that would
   trigger this rule.
2. Identify any legal claim in the explanation that is outdated, jurisdiction-
   specific, or overstated.
3. Say what a scammer would change in one word to evade it.
4. Say whether the recommended action is something a student can actually do
   this afternoon, or whether it assumes knowledge they don't have.

Be harsh. This ships to people who may lose their deposit.
```

Run this on every new pattern. It is the cheapest quality gate we have, and
point 3 in particular has repeatedly produced better concept pairs than the
original drafting prompt did.

---

## Sources

- [국가법령정보센터](https://www.law.go.kr) — statutes, authoritative
- [찾기쉬운 생활법령정보 — 인터넷 명예훼손](https://www.easylaw.go.kr/CSP/CnpClsMain.laf?csmSeq=293&ccfNo=1&cciNo=1&cnpClsNo=2)
- [크롤링 관련 최근 대법원 판결과 그 시사점 — 법무법인 세종](https://www.shinkim.com/kor/media/newsletter/1843)
