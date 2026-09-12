# Code and Logic Review — Fix Items

Review scope: current `main` tree plus the uncommitted working-tree changes. The detector test suite passes (`node scripts/test-detector.js`), but the following issues remain.

## P1 — Deployment workflow can publish stale JavaScript/CSS

**Evidence:** `index.html:17` and `index.html:261-266` use the fixed query string `?v=08d5ae3d`, while `assets/js/*` and `assets/css/style.css` continue to change.

**Impact:** GitHub Pages/CDN or a browser can retain an older asset under the same URL after a deployment. The HTML may be new while the application logic is old, producing reports that do not match the checked-in code.

**Fix:** Generate the asset version from the commit SHA in the Pages workflow (or update one shared version value on every release). A simple static approach is to replace the hard-coded value in `index.html` as part of CI before uploading the artifact. Verify the deployed HTML references the new SHA.

## P1 — Deposit-to-value risk calculation omits senior debt

**Evidence:** `assets/js/analyzer.js:325-331` calculates `deposit / market` only. The UI collects deposit, rent, and market value, but no lien/debt amount (`index.html:117-126`). The pattern guidance in `data/patterns.json` correctly describes `(senior debt + deposit) / market`.

**Impact:** A property with a large mortgage can receive a low “safe” ratio if the deposit alone is below 70%, even though the combined exposure is dangerous. The report presents a precise percentage that is materially incomplete.

**Fix:** Add an optional senior-debt input and calculate `(seniorDebt + deposit) / market`; alternatively remove the numeric ratio panel unless the user has supplied verified debt data, and explicitly label the result as “deposit-only ratio.”

## P1 — Numeric inputs accept invalid values and silently coerce them to zero

**Evidence:** `assets/js/housing.js` helper `num()` (near lines 420-423) returns `Number(e.value)` without checking finiteness or sign; `analyzer.js:327-328` then uses `Number(ctx.deposit) || 0` and `Number(ctx.market) || 0`.

**Impact:** Negative values, `Infinity`, or browser-specific number-input edge cases are treated as zero or can produce an invalid ratio. Users can get a “no ratio” result instead of an input error.

**Fix:** Parse with `Number.isFinite`, require values `>= 0`, and show an inline validation error. Keep the analyzer defensive as well, so callers cannot bypass UI validation.

## P2 — Step navigation lets users bypass the intended flow without preserving a clear state contract

**Evidence:** `assets/js/app.js:89-116` allows any `data-goto-step` button to jump directly to any step, and entering step 4 immediately calls `Housing.runAnalysis()`.

**Impact:** A user can jump to the result page before entering a conversation or reviewing documents. The result is technically marked empty, but the flow still exposes a “safe” level for an empty analysis unless the caller handles `empty` correctly everywhere. Future buttons can easily bypass required prerequisites.

**Fix:** Define an explicit state machine: gate → documents → conversation → contract → result. Either prevent forward jumps until prerequisites are met or make every result entry render only the empty-state panel and never expose a risk level.

## P2 — File metadata is retained indefinitely and is not cleared with the form

**Evidence:** `Housing.files` is populated in `assets/js/housing.js:163-171`; the clear button in `assets/js/housing.js` only clears `#chat-input` (around the `btn-clear` handler) and never clears `Housing.files` or previews.

**Impact:** A user who clears and starts a new property analysis can still have old document names included in the next state snapshot. This is confusing and can expose prior file names on a shared device, even though file contents are not uploaded.

**Fix:** Add a single `reset()` method that clears `files`, revokes all object URLs, clears both file inputs/previews, unchecks document risks, and resets context fields. Call it from the clear/new-analysis action.

## P2 — “No signals” and “not enough evidence” are still too easy to conflate

**Evidence:** `Analyzer.analyze()` returns `level: 'safe'` whenever the score is below the caution threshold (`assets/js/analyzer.js:337-341`). `Housing.runAnalysis()` sets `empty` only when both text and document risks are absent.

**Impact:** A short, generic conversation with no matched rules receives the same “safe” level as a thoroughly checked, clean conversation. A deterministic keyword engine cannot establish that a property is safe from absence of signals.

**Fix:** Add a separate `insufficient`/`unverified` level for short text, missing market/deposit context, or no completed checklist items. Reserve `safe` for a minimum evidence threshold and change the copy to state that no known signals were detected.

## P3 — Fuzzy detector can overmatch short or repetitive sentences

**Evidence:** `assets/js/detector.js:18-21` uses 3-character shingles, and `scan()` applies `containment >= 0.62` (`assets/js/detector.js:145-190`) with no sentence-length minimum; the minimum is applied only to corpus entries.

**Impact:** Short messages containing common Korean trigrams can meet the containment threshold and produce a fuzzy fraud signal. This can create false positives that users may treat as a legal finding.

**Fix:** Require a minimum normalized sentence length and a minimum number of distinct shingles on both sides, and combine containment with an edit-distance or concept-rule confirmation before scoring a fuzzy match.

## P3 — Data/schema validation is incomplete

**Evidence:** The deployment workflow validates that each `data/*.json` file parses, but there is no validation that pattern IDs, lexicon rule `patternId`s, categories, severities, or i18n keys are consistent.

**Impact:** A typo in a data ID silently drops fuzzy matches (`analyzer.js` only adds fuzzy hits when `byId[hit.rule.patternId]` exists), and missing translations fall back to raw keys in the UI.

**Fix:** Add a CI schema/data-integrity test that checks unique pattern IDs, every lexicon `patternId` exists, severity/category fields are valid, all required bilingual fields exist, and all `data-i18n` keys used in `index.html` resolve.

## P3 — Error recovery leaves a partially initialized page

**Evidence:** `assets/js/app.js:21-30` inserts a generic error panel on the first fetch/JSON failure, but does not disable navigation or expose which file failed.

**Impact:** Users can still interact with controls that were not bound or data that was not loaded, resulting in silent no-ops and an unclear failure mode.

**Fix:** Set an explicit failed state, disable/hide the application controls, identify the failed resource in a developer-facing detail, and provide a retry button that reruns boot after clearing the error panel.

## Verification performed

- `node scripts/test-detector.js` — all tests passed, including paraphrase, benign-control, duplicate, combined-analysis, and performance cases.
- All `data/*.json` files parse successfully.
- `git diff --check` reports no whitespace errors for the reviewed changes.
