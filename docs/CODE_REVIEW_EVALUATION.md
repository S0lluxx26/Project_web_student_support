# Evaluation of `CODE_REVIEW_FIXES.md`

Second opinion on the Codex review. Every claim below was checked against the
running code, not read off the source — the evidence lines are output from
actual runs, in this repo, at the commit under review.

**Verdict: a good review.** Nine findings, no false positives, and one of them
is the most serious bug currently in the tool. Two corrections to its analysis
and one re-prioritisation follow, plus five things it did not look at.

---

## Summary

| # | Finding | Codex | Verified? | My priority | Note |
|---|---|---|---|---|---|
| 1 | Stale asset version | P1 | Yes | **P2** | Real hazard, but process not correctness |
| 2 | LTV omits senior debt | P1 | **Yes** | **P1** | Worst bug in the tool |
| 3 | Numeric input validation | P1 | Yes | **P2** | Produces `Infinity%`, not a wrong verdict |
| 4 | Step navigation bypass | P2 | Partly | **P3** | Already handled; hardening only |
| 5 | File metadata not cleared | P2 | Yes | **P2** | Correct, and it is my bug |
| 6 | `safe` vs `insufficient` | P2 | **Yes** | **P1** | Same class of harm as #2 |
| 7 | Fuzzy overmatch | P3 | Yes, **wrong mechanism** | **P3** | Latent, not live |
| 8 | Schema validation | P3 | Yes (preventive) | **P2** | Finds nothing today; cheap insurance |
| 9 | Error recovery | P3 | Yes | P3 | Agreed as stated |

The two I would fix before anything else are **#2 and #6**, because they share a
failure mode: the tool tells a user things look fine when it has no basis for
saying so. For a tool whose entire purpose is to prevent someone losing a
deposit, false reassurance is the only category of bug that can cause the harm
we exist to prevent. Everything else on this list is a defect; those two are
the product failing at its job.

---

## #2 — LTV omits senior debt · **confirmed, P1**

The strongest finding in the review. Verified:

```
deposit 2억 / market 3억 = 66.7%   level = caution
true exposure with a 2억 lien = (20000+20000)/30000 = 133%
```

Because 66.7 is below the 70 threshold, `renderResult` selects `panel-ok` —
the **green** panel — and prints "보증금 비율은 비교적 안전한 범위입니다."
A property whose combined senior debt and deposit is 133% of market value is
presented to a student in a green box.

The existing copy does append "단, 선순위 근저당을 더해 다시 계산해야 합니다",
which is a caveat, not a fix. A green panel with a specific number defeats a
sentence of qualification; this is exactly the presentation problem where users
read the colour and the figure and skip the prose.

Both of Codex's proposed fixes are acceptable. I would take the first — add an
optional 채권최고액 field — because the data is on the 등기부등본 the user is
already being told to obtain in the same flow, so we are asking for a number
they are holding. Rules:

- If the lien field is empty, do not show a ratio panel at all. Show the
  formula and tell them to compute it once they have the register. Absence of
  input must not become a reassuring output.
- If supplied, compute `(lien + deposit) / market` and label it
  "(선순위 채권 + 보증금) ÷ 시세" so the figure states its own formula.
- Keep the deposit-only figure out of the UI entirely. A second number invites
  the reader to prefer the friendlier one.

## #6 — `safe` vs `insufficient` · **confirmed, promote to P1**

Verified:

```
"네 알겠습니다."   score=0  level=safe  ->  특별한 신호 없음
"ㅇㅇ"            score=0  level=safe  ->  특별한 신호 없음
"안녕하세요"        score=0  level=safe  ->  특별한 신호 없음
```

Two characters of input produce the same verdict as a thoroughly checked
conversation. This is the empty-result bug I fixed last round, one step
removed: I made "nothing entered" distinct from "analysed and clean", but not
"almost nothing entered".

Codex's framing is precisely right and worth quoting: *a deterministic keyword
engine cannot establish that a property is safe from absence of signals.* The
level should be earned, not defaulted to. Suggested gate for `safe`:

- at least ~80 normalized characters of conversation, **or** three or more
  completed document checks; and
- at least one substantive exchange, not just greetings.

Below that, a distinct `insufficient` level with its own copy: 확인된 신호가
없지만, 판단하기에는 입력이 부족합니다. And the `safe` copy itself should say
"알려진 사기 패턴이 발견되지 않았습니다" rather than anything that reads as an
endorsement — which it currently mostly does, but the level *name* shown to the
user should change too.

## #1 — Stale asset version · confirmed, but **P2 and a different fix**

The hazard is real: `?v=08d5ae3d` is hand-generated, so an edit to `style.css`
without regenerating it ships a new HTML referencing a cached old stylesheet.
That is how you get the mixed-asset breakage the version string exists to
prevent.

I disagree with the proposed fix. Mutating `index.html` in CI before upload
means the deployed artifact no longer matches the repo, which makes "what is
live?" unanswerable from git. Prefer a **check** over a mutation:

```
node scripts/check-asset-version.js   # recompute the hash; fail if index.html disagrees
```

Run it in CI and the build fails on a stale hash with a message telling you the
correct value. The repo stays the source of truth, and the failure is loud and
local. Using the commit SHA also works and is simpler, at the cost of busting
the cache on every commit including documentation-only ones.

## #3 — Numeric validation · confirmed, **P2 not P1**

Verified:

```
deposit Infinity  -> ratio = Infinity   (renders "Infinity%")
deposit 1e999     -> ratio = Infinity
deposit -5000     -> ratio = null       (silently no panel)
market 0          -> ratio = null       (silently no panel)
```

Both behaviours are wrong and the fix is correct as written. I rank it below #2
and #6 because neither produces a false verdict: `Infinity%` is obviously
broken, and a missing panel is a missing panel. Embarrassing, not dangerous.
Fix it with the same change as #2, since both touch the same inputs.

## #5 — File metadata not cleared · confirmed, P2

Correct, and it is a bug I introduced. When I added state preservation across
re-renders, `Housing.files` became durable but nothing clears it: `btn-clear`
only empties `#chat-input`. So file names from a previous property survive into
the next analysis and are re-displayed by `restoreState`.

The proposed single `reset()` is the right shape. Note it must also
`URL.revokeObjectURL` every entry in `photoUrls` — otherwise the contract
photos stay resident in memory for the life of the page, which is the same
privacy point one level deeper. Worth adding a "새로 시작" action to the result
screen too, since that is where a user actually finishes one property and
starts another.

## #4 — Step navigation · partly confirmed, **P3**

The stated impact overstates the current risk. `renderResult` returns early on
`r.empty`, so there is exactly one code path to the result and it handles the
empty case. A user jumping to step 4 today gets the empty-state panel, not a
"safe" level.

What remains is a legitimate hardening argument: the invariant lives in one
function and nothing enforces it. If #6 is implemented, this concern largely
dissolves — `insufficient` becomes the honest answer for a premature jump, and
free navigation stays a feature rather than a hazard. I would not build a state
machine; I would implement #6 and leave navigation open, because forcing a
student through four steps to re-read one document is a worse product.

## #7 — Fuzzy overmatch · confirmed, but **the mechanism is wrong**

Codex says "short messages containing common Korean trigrams can meet the
containment threshold". That is not how the measure behaves — containment is
`|A ∩ B| / |A|`, normalised by the **corpus entry**, so short messages are
inherently safe. Tested:

```
"네 알겠습니다"      clean        "보증금 얼마인가요"   clean
"감사합니다"         clean        "월세 문의드립니다"    clean
```

The real overmatch shape is the opposite: a **short corpus entry** found inside
a longer, innocent sentence.

```
corpus entry "환불 불가합니다" (14 normalized chars)
  "환불 불가합니다만 규정은 계약서에 있습니다"   ->  contains 1.00
```

That sentence is a landlord explaining their refund policy is in the contract —
entirely reasonable, flagged at maximum confidence. So the concern is valid and
the fix (minimum lengths on **both** sides, plus confirmation) is right; the
diagnosis needs correcting or someone will implement a guard on the wrong side.

**More important:** `scan()` is not wired into the application at all. Only
`Detector.matchRules` is called from `analyzer.js`. So this cannot affect a user
today — it is latent, waiting for whoever builds the review-analysis feature
described in `REVIEW_ANALYSIS.md`, which is where `scan()` is meant to be used.
Fix it before that feature ships, not now.

## #8 — Schema validation · confirmed preventive, **promote to P2**

I ran the proposed checks against current data:

```
patterns: 25 unique of 25
lexicon rules pointing at a missing patternId: none
rules referencing a missing concept:           none
data-i18n keys in HTML with no string:         none
severity out of range / unknown category:      none
patterns missing a ko/en field:                none
```

Nothing is broken today, so this is insurance rather than a repair. I promote
it anyway because the named failure mode is **silent**: `analyzer.js` skips a
fuzzy hit whenever `byId[hit.rule.patternId]` is missing, with no warning
anywhere. A typo in a contributor's pull request quietly disables a rule and
every test still passes. Given the contribution model in `CONTRIBUTING.md` —
non-developers editing JSON — silent data failures are the most likely way this
project degrades. It is an hour of work.

Add one check Codex did not list: assert every pattern's own `sample` sentence
is still detected by the keyword engine. That regression currently exists only
in my scratch tests, not in the repo, which is a real coverage gap (see below).

## #9 — Error recovery · confirmed, P3

Agreed as written. Low frequency, and the current failure is at least visible
rather than silent. Worth doing when someone is already in `app.js`.

---

## What the review did not cover

1. **`scan()` and the near-duplicate corpus are dead code in production.** Half
   of `detector.js` is unreachable from the app. Either wire it in or mark it
   explicitly as the API for the future review feature — right now a reader
   cannot tell which.

2. **Score saturation.** Six severity-5 signals cap at 100, and so do twelve.
   A moderately dangerous conversation and a catastrophic one both display
   `100 / 100`, which asserts a precision the engine does not have. Consider
   showing the level prominently and demoting the number, or making the scale
   non-linear above the 매우 위험 threshold.

3. **CI covers the detector, not the analyzer.** `scripts/test-detector.js` is
   in the repo; the analyzer regression (every pattern detects its own sample,
   benign controls stay silent) and the browser suites are not. The keyword
   engine — the part users actually hit — has no committed test.

4. **No accessibility review.** The step rail has no `aria-current`, and
   `#result-root` has no `aria-live`, so a screen-reader user gets no
   announcement when a risk verdict renders. For a tool that exists to warn
   people, an unannounced warning is a functional bug.

5. **`Housing.files` is also not cleared on language switch** — `restoreState`
   re-displays stale names after `refresh()`. Same root cause as #5, one more
   call site to cover in `reset()`.

---

## Recommended order

**Now, before the next deploy** — the false-reassurance pair:

1. #2 LTV with senior debt, or no ratio at all
2. #6 `insufficient` level, with an earned `safe`

**Next, one sitting** — correctness and hygiene:

3. #3 numeric validation (same code as #2)
4. #5 `reset()`, including `photoUrls` and the language-switch path
5. #1 asset-version check in CI
6. #8 schema validation, plus the analyzer regression from gap 3

**When convenient:**

7. Gap 4 accessibility, gap 2 score presentation, #9 error recovery
8. #7 fuzzy guards — before the review feature, not before this deploy
9. #4 only if #6 does not settle it

---

*Reviewed against the working tree described in `CODE_REVIEW_FIXES.md`.
Evidence in this document is output from executed code, not inference.*
