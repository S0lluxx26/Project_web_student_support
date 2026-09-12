# Contributing

The most valuable contributions are new scam patterns and better translations. Neither
requires touching the application code — both live in `data/*.json`.

## Adding a scam pattern

Open `data/patterns.json` and add an object to the `patterns` array:

```json
{
  "id": "short-kebab-id",
  "category": "payment_pressure",
  "severity": 4,
  "keywords": {
    "ko": ["핵심 표현", "다른 표현"],
    "en": ["key phrase", "another phrase"]
  },
  "title": { "ko": "한 줄 제목", "en": "One-line title" },
  "why": { "ko": "왜 위험한지, 법적 근거 포함", "en": "Why it is risky, with the legal basis" },
  "action": { "ko": "구체적으로 무엇을 해야 하는지", "en": "Concretely what to do" },
  "sample": { "ko": "실제로 올 수 있는 문장", "en": "A sentence that would actually arrive" }
}
```

Notes on each field:

`category` must be one of `payment_pressure`, `identity`, `register_risk`, `contract`,
`too_good`, `goshiwon`, `agent_behaviour`. The category decides which follow-up questions the
result screen suggests (see `NEXT_QUESTIONS` in `assets/js/analyzer.js`).

`severity` runs 1–5 and is multiplied by 5 for the score. Reserve 5 for patterns that on their
own should stop a transaction — money to a third party's account, a trust registration, a
request to delay the move-in report. Use 3 for things that are bad practice but not fraud in
themselves.

`keywords` are matched after both sides are lower-cased and stripped of all whitespace, so
Korean spacing variants match automatically: `"오늘 안 하면"` also matches `오늘안하면`. Keep
keywords short enough to survive paraphrase but long enough not to fire on innocent text —
`"계좌"` alone would match almost any rental conversation, while `"개인 계좌"` is specific.
Test a candidate keyword against a few normal conversations before adding it.

An optional `regex` field is matched against the raw text when no keyword hits. Use it only
where a keyword cannot express the pattern, for example a numeric relationship.

`why` should name the mechanism — what legally goes wrong and who loses money — rather than
just asserting that it is dangerous. `action` should be something the reader can do this
afternoon.

After editing, validate the file:

```bash
python3 -c "import json; json.load(open('data/patterns.json', encoding='utf-8'))"
```

Then regenerate the catalogue so `docs/SCAM_PATTERNS.md` stays in sync, and confirm your
sample sentence is actually detected by pasting it into the conversation analyzer on a local
server (`python3 -m http.server 8000`).

## Adding or fixing translations

UI strings live in `data/i18n.json` under `ko` and `en`, keyed identically. If a key exists in
one language only, the app falls back to the other rather than showing the raw key, so a
partial translation is still an improvement. Content strings — document descriptions, goshiwon
questions, pattern text — are `{ "ko": ..., "en": ... }` pairs inline in their own data files.

## Adding a goshiwon question

`data/goshiwon.json` has `questions.universal` (always shown) and `questions.conditional`, a
list of blocks with a `when` clause:

```json
{
  "when": { "needs": ["laundry"] },
  "ko": ["질문 1", "질문 2"],
  "en": ["Question 1", "Question 2"]
}
```

A block is included when any value in any `when` key matches the user's answers. Keys and
values must match the `conditions` array in the same file.

## Code changes

Plain HTML, CSS and ES5-compatible JavaScript, no build step and no dependencies — please keep
it that way so the site stays auditable and trivially deployable. Before opening a pull
request, check both flows in both languages, at 375px width, and in dark mode, and make sure
nothing you add sends user input off the device. That last point is the project's core promise.
