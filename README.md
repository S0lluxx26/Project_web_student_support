# 학생 주거 안전 도우미 · Student Housing Safety Assistant

A free, static web tool that helps students renting in Korea avoid housing fraud.
Everything runs in the browser — no server, no accounts, no data leaves your device.

**Live site:** https://s0lluxx26.github.io/Project_web_student_support/

## What it does

Paste the messages you exchanged with an agent or landlord. The tool splits them
into messages, works out who said what, and reports which messages are concerning,
why they matter, and what to ask next. Everything runs in your browser.

**The conversation checker is the main feature and it is the landing page.** There
is no form to fill in first — no housing type, no documents, no deposit figures.
Paste and press one button.

The report leads with a verdict (`판단하기에 정보가 부족합니다`, `알려진 위험 신호는
없습니다`, `확인이 필요한 내용이 있습니다`, `진행 전에 반드시 확인하세요`), then states
what the verdict rests on: how many messages were read, how many had an unidentified
speaker, how many document questions were answered, and how many matches were *not*
counted because they were questions, denials, or the user's own words. Each finding
quotes the exact message with the matched phrase highlighted, attributes a speaker,
and explains what to do.

Two supporting tools remain, reachable from the landing page and never required:

**서류 확인 / Document checks** — what to obtain and what to look for, from the
등기부등본 through the contract. Each question is answered 예 / 아니오 / 해당없음 /
모름, defaulting to 모름. An explicit 아니오 is evidence that you checked; an
unanswered question is a gap in coverage, and the report distinguishes them.

**고시원 안내 / Goshiwon guide** — visit in person first, with the checklist to take
along. If you truly cannot visit, it builds the questions to ask from your
conditions, and only then covers paying a deposit safely.

## How the analysis works

The engine has three layers, all deterministic and all in the browser.

**Messages, not a blob.** `assets/js/conversation.js` splits the paste into messages
and derives a speaker (plain `집주인:` labels, KakaoTalk `[이름] [오후 3:21]` exports,
dated exports), a speech act (question, denial, refusal, statement) and whether the
speaker is quoting someone else. An unlabelled line resolves to *unknown*, never to
the landlord — guessing a speaker is how you manufacture evidence. This is what stops
"Tenant: I will not pay now" being read as a payment demand.

**Curated patterns.** `data/patterns.json` holds 26 rental-scam patterns, each with a
severity, Korean and English keywords, an explanation of the underlying legal risk,
and a recommended action. `assets/js/analyzer.js` matches them per message, then gates
each hit: a tenant's own words are not evidence about the counterparty, a question
about a risk is not evidence of it, and an explicit denial voids patterns whose whole
claim is that the risk is present.

**Concepts, for rewording.** `assets/js/detector.js` adds a second pass over
`data/lexicon.json`, which maps about thirty concepts (URGENCY, PAY, HOLD_ROOM,
THIRD_PARTY…) to their surface forms. A rule names concepts rather than phrases, so
"오늘 안에 예약금만 넣어주시면 방 빼놓을게요" is caught despite sharing no keyword with
anything in the catalogue. The same file also does n-gram near-duplicate detection,
which catches copy-pasted scripts; measured on real pairs it scores a genuine Korean
paraphrase at about 0.06, which is why concept rules and not shingles carry the
paraphrase work.

The verdict comes from the evidence, not a running total: severity sets an action
priority per finding, and one `strong` finding is enough to be prominent. A numeric
score still exists for tuning but is not what the user is told, because six
severity-5 signals and twelve both saturate at 100.

This is deliberately not a model: it is free to run, works offline, leaks nothing, and
anyone can audit or extend it by editing JSON. See
[`docs/SCAM_PATTERNS.md`](docs/SCAM_PATTERNS.md) for the catalogue and
[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for how to add a pattern.

## Reading a screenshot

Step 2 can read the text out of a chat screenshot. The engine is vendored in this
repo and runs in a Web Worker on the user's machine — no upload, no CDN. What it
reads lands in a review pane and the analyzer never sees it until the user has
corrected it and pressed a button; there is no code path from the engine to the
conversation box.

Measured on the committed fixtures: 84 confidence on a colour KakaoTalk capture,
93 on plain text, 92 in dark mode, roughly one misread word per screen. The
greyscale step is not optional — without it the yellow outgoing bubbles vanish
entirely. [`docs/OCR.md`](docs/OCR.md) has the full account, including what the
cleanup deliberately refuses to fix and the flag that gates the feature.

The fixtures are synthetic, so a green test run is a regression guard rather than
proof it works on a real phone capture.

## Not implemented yet

Stated plainly so nobody has to read the code to find out:

- **Any trained classifier.** There is no model, no training data, and no evaluation
  set. The pattern catalogue is a rule catalogue, not a labelled corpus.
- **Offline reload.** Processing is local, but there is no service worker, so the app
  still needs the network to start. "Local processing" and "works offline" are
  different claims and only the first one is true here.

## Tests

```bash
node scripts/test-analyzer.js    # regression table: false positives, speakers, evidence
node scripts/test-detector.js    # paraphrase detection, benign controls, duplicates
node scripts/test-data.js        # pattern/lexicon/i18n integrity, asset version
node scripts/test-ocr.js         # OCR integration, MOCK engine — proves the wiring only

npm install --no-save tesseract.js@5 pngjs
node scripts/test-ocr-real.js --require-engine   # the real model over real fixtures

npm install --no-save playwright && npx playwright install chromium
node scripts/smoke-ocr.mjs       # the real page, a real worker: the gate for OCR
```

All of them run in CI before every deploy. `OCR.enabled` in `assets/js/ocr.js` is
only allowed to be true while `smoke-ocr.mjs` passes against that build — a mock
suite passing says nothing about whether the engine works in a browser. The false-positive half matters more than the
true-positive half: a tool that cries wolf gets ignored, and then misses the real thing.

## Running it locally

No build step. Serve the folder over HTTP (the `fetch` calls for the JSON data need a server,
so opening `index.html` from the filesystem will not work):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Project layout

```
index.html              single-page shell: checker, documents, goshiwon, result
assets/css/style.css    design system, light and dark, mobile and print
assets/js/i18n.js       language loading and DOM translation
assets/js/conversation.js  messages, speakers, speech acts
assets/js/analyzer.js   pattern matching, gating, verdict
assets/js/detector.js   concept rules and near-duplicate detection
assets/js/housing.js    checker flow, document answers, report rendering
assets/js/goshiwon.js   visit guide and question generator
assets/js/app.js        data loading, routing, focus, session reset
assets/js/ocr.js        screenshot reading: greyscale, cleanup, the review gate
assets/js/redact.js     masking identifiers before anything is copied or shared
assets/vendor/tesseract/  the vendored OCR engine and Korean model
data/patterns.json      26 scam patterns
data/lexicon.json       concepts and concept rules
data/documents.json     document checklist and questions
data/goshiwon.json      visit checklist, conditions, questions
data/examples.json      three clearly fictional example conversations
data/i18n.json          UI strings, Korean and English
scripts/                test suites, run in CI
scripts/fixtures/       synthetic Korean chat screenshots for the OCR tests
docs/                   pattern catalogue, contribution guide, reviews
```

## Deployment

The repository root is the site, so no build step is needed. In the repo, set Settings →
Pages → Source to "Deploy from a branch", branch `main`, folder `/ (root)`. Every push to
`main` republishes. `.nojekyll` keeps Jekyll from ignoring files.

Alternatively, add the provided `.github/workflows/deploy.yml` and set the Pages source to
"GitHub Actions" — that variant also validates every JSON data file before deploying.

## Disclaimer

This is an informational tool, not legal advice. It cannot see the property, verify anyone's
identity, or guarantee that a listing is genuine — it only helps you ask the right questions
and check the right documents. For a real dispute, contact the police (112), free legal aid
(132), or the HUG lease-fraud support centre (1566-9009).

## License

MIT — see [LICENSE](LICENSE).
