# Current project plan

Updated 2026-09-12. Supersedes the original document-first, no-OCR roadmap.

## Goal and implemented work

Help students review rental conversations and prepare questions. Paste and
screenshot inputs are the main entry points; documents/goshiwon are supporting tools.

| Area | Current behavior |
|---|---|
| Checker | 27 patterns, concepts, speakers, evidence and cautious assessment states |
| OCR | Korean Tesseract, editable draft, explicit apply, unknown speaker until confirmed |
| Session | Cancellation, reset, synchronized inputs, stale result invalidation |
| Exports | Redaction preview for copy/share/Print; raw Ctrl+P housing output suppressed |
| LLM | Real Wllama integration, pinned/hash-verified GGUF, download/local file, cancel/cache removal |
| LLM gate | Visible PC experiment, opt-in and explicit load; disabled on phones/tablets |
| Demo/manual | Bilingual public walkthrough, two fictional samples, actual captures, Markdown/PDF |
| Installation | INSTALL.md with an AI setup prompt and npm run verify:install |
| Build | Locked tooling; public dist/ allowlist; byte verification; model/key exclusion |
| Pages | Active workflow validates before publishing dist/ |
| Vercel | Static config supplied; account import remains |
| Checks | Unit/data suites, real OCR, browser lifecycle and both URL layouts |

## Hosting and AI decision

Keep Pages as the default; Vercel can serve the same static app. OCR and LLM
compute happen on the visitor's device on either host. Moving hosting does not
remove model download/memory costs. No cloud inference endpoint, API key,
scraper, database or trained rental classifier has been added.

The tested model downloads about 397 MB and used about 1.7 GB browser working
set. Twenty synthetic explanations exposed meaning errors. Keep the experiment
optional on desktop with an explicit quality warning; keep mobile blocked.
[Measurements](docs/BROWSER_LLM_OPTIONS.md).

## Remaining tasks and acceptance criteria

1. **Actual laptop and phone tests.** Record hardware/browser, cold download,
   warm load, generation latency, memory measurement method, responsiveness,
   cancellation and fallback. Do not present desktop measurements as phone results.
2. **Real screenshot evaluation with permission.** Include KakaoTalk/SMS,
   light/dark themes, cropping/compression, amounts and negations. Compare OCR
   and speaker assignment with human-reviewed text. Keep private captures out
   of Git and record misses as well as successes.
3. **Review all 27 rules and sources.** Related official references do not prove
   every claim or numerical threshold. Prioritize deposit ratios, fees, proxy
   authority, insurance eligibility, refunds and absolute claims. Obtain Korean
   housing/legal review of both languages; record exact supporting passages.
4. **Label data before training a classifier.** Obtain consent, remove personal
   identifiers, define evidence/uncertainty labels, use independent annotations,
   split by conversation/source and hold out a final test set. Compare precision,
   recall and error categories against the rules. Synthetic regression fixtures
   are not a real evaluation corpus. Training is unnecessary for this release.
5. **Vercel account import, if desired.** Follow [these settings](docs/DEPLOY_VERCEL.md),
   record the real URL and verify paste, OCR and export before claiming it is live.
6. **Field research/review analysis.** Follow the existing
   [research protocol](docs/FIELD_RESEARCH.md) and
   [review proposal](docs/REVIEW_ANALYSIS.md). Conversation checking needs no
   Jikbang/Dabang/Soomgo collection. Check permitted access and usefulness before
   adding an integration; do not claim fieldwork or scraping permission exists.

## Release checks

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run assets:stamp
npm run build
npm run test:ocr
npm run test:browser
```

For model/runtime changes, verify actual size/SHA-256, rerun the real benchmark
and review meaning. Do not make the experiment automatic or promote it as
validated advice without language quality and target-device evidence.
Schema-valid output is not evidence of correctness.
