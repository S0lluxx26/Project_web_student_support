# Demo

Two ways to look at what this thing does.

**Windows**

```powershell
.\demo\run.ps1              # serve the site and open a browser
.\demo\run.ps1 -Report      # run every screenshot through it, write a report
```

**macOS / Linux**

```bash
./demo/run.sh
./demo/run.sh --report
```

Both need only Node 18+. The report mode additionally installs Playwright and a
Chromium build on first use, which is a few hundred megabytes and slow; the
manual mode needs nothing else.

## Showing it to someone

Serve it, open `#/housing/conversation`, expand **스크린샷에서 글자 읽기**, and
feed it a file from `screenshots/`.

Show **01** first and **02** second. 01 is a landlord's agent applying every
kind of pressure at once and comes back with four findings. 02 is an ordinary,
entirely reasonable conversation and comes back with **nothing** — which is the
harder thing to get right and the more important thing to demonstrate. A
checker that flags everything is a checker people learn to ignore, and then it
misses the real one.

The first run downloads the recognition model (~6 MB) before it can read
anything; after that it is about four seconds per screenshot (two
segmentation passes — see below). Everything runs in
the browser — no upload, no network call to anyone.

## The screenshots

Twenty-two captures, in two groups.

**01-13 vary the layout and the capture quality** — what breaks *recognition*.

| file | what it is | measured |
|---|---|---|
| `01-kakao-pressure.jpg` | agent refuses a viewing, wants a holding deposit today, into an account in his own name | strong · 4 |
| `02-kakao-ordinary.jpg` | **ordinary** — offers a viewing, offers the register, confirms 전입신고 | **clean · 0** |
| `03-dark-mode.jpg` | dark theme; pay-before-contract, "delay your 전입신고" | strong · 3 |
| `04-sms-message.jpg` | SMS layout; under market, a 근저당 waved away, cash discount | strong · 4 |
| `05-goshiwon.jpg` | goshiwon manager talking someone out of visiting | strong · 2 |
| `06-group-chat.jpg` | **group chat** — sender names above bubbles, two counterparties | strong · 3 |
| `07-dense-thread.jpg` | many short bubbles, unread markers, two days | strong · 1 |
| `08-mixed-language.jpg` | **Korean + English** — see the limit noted below | strong · 1 |
| `09-goshiwon-ordinary.jpg` | **ordinary** — a manager doing everything right | **clean · 0** |
| `10-low-quality.jpg` | 420px wide, JPEG quality 45 — a screenshot of a screenshot | strong · 2 |
| `11-photo-of-screen.jpg` | **photographed off a screen** — rotation, glare, blur | strong · 2 |
| `12-casual-slang.jpg` | ㅎㅎ, ㅠㅠ, ~~, how students actually type | strong · 3 |
| `13-correct-but-loaded.jpg` | **ordinary** — 근저당·전입신고·계약금 all used correctly | **clean · 0** |

**14-22 hold the layout steady and vary the danger** — one transaction risk per
file, so it is obvious which risk a verdict came from.

| file | the risk | measured |
|---|---|---|
| `14-danger-kkangtong.jpg` | 깡통전세 — deposit ≈ sale price, uninsurable | review · 2 |
| `15-danger-trust.jpg` | 신탁등기 — "the register says the trust company, but I'm the real owner" | strong · 2 |
| `16-danger-no-mandate.jpg` | 무권대리 — signing for an owner with no 위임장, money to the proxy | strong · 2 |
| `17-danger-double-lease.jpg` | 이중계약 — the flat is still let, 전입세대열람 discouraged | strong · 2 |
| `18-danger-unlicensed.jpg` | 무등록 중개 — no licence, no 공제증서, cash only, no photos | review · 3 |
| `19-danger-name-mismatch.jpg` | 명의 불일치 — the account is not the registered owner | strong · 1 |
| `20-danger-seizure.jpg` | 가압류·경매 dismissed, 선순위 채권 refused | strong · 2 |
| `21-trust-done-right.jpg` | **ordinary** — a trust property handled CORRECTLY | **clean · 0** |
| `22-ordinary-refusal.jpg` | **ordinary** — polite refusals, nothing demanded | **clean · 0** |

Seventeen dangerous conversations, all flagged. Five ordinary ones, all clean.
Those numbers are from the last `--report` run, not from hope — regenerate them
rather than trusting this table after a change.

Five of the twenty-two being ordinary is deliberate. A demo made only of
alarming cases teaches the wrong lesson: the expensive failure for a checker
like this is crying wolf. 13 and 21 are the sharp ones — both are stuffed with
근저당 / 전입신고 / 계약금 / 신탁, every term used in the correct direction. If
the suppressors ever regress, those two catch it first.

### Measured limits

- **08 (mixed language).** The vendored model is `kor` alone, so English lines
  come back as gibberish — `Please send the deposit first` reads as
  `민6356 56070 6060051`. The Korean lines still carry the verdict, but an
  English-only screenshot will not work. Adding `eng` costs 2.8 MB and has not
  been measured.
- **14 (깡통전세).** The dismissal and the uninsurability are caught; the
  deposit-to-price ratio itself is not, because it is arithmetic rather than
  wording. Type the numbers into 보증금 / 시세 on step 2 and the analyzer
  computes it.
- **10 and 11.** Both degrade — fewer findings than the same conversation would
  produce at full quality — but neither collapses.

### They are drawn, not photographed

There is no stock library of Korean rental-scam chat screenshots. What exists
online is real people's private conversations, posted by victims, carrying
their names and phone numbers and their landlords'. Downloading those into a
public repository to demo a privacy tool would be a poor joke, so every image
here is drawn from an invented conversation. No real name, number, account or
address appears in any of them.

What that costs: these reproduce the *layout* and the *failure modes* — coloured
outgoing bubbles, small grey timestamps, avatar circles, a status bar, JPEG
artefacts at phone resolution — but not the full mess of a real capture. Treat a
good result here as a regression guard, not as proof the feature works on a
student's actual phone. Testing on real screenshots, with permission and not
committed, is still the missing step.

Regenerate them with `python3 demo/make-demo-screenshots.py` (needs Pillow and
a Korean font).

## The report

`--report` drives the real page in a real browser — the same worker, the same
wasm, the same analyzer a user gets — and writes `demo/report.html`: each
screenshot beside the text the engine read out of it and the verdict reached
from that text.

It asserts nothing and never fails. It exists so a person can **look**. Six
defects were found by looking at it rather than by a test failing:

- **recognition collapsed on two perfectly legible captures.** tesseract.js
  defaults to PSM 6, one uniform block, and on those two it returned nothing
  but the date dividers. Measured over eight captures and 45 key phrases:
  PSM 6 alone 30/45 with two total losses, PSM 4 alone 36/45 with none, both
  passes keeping the richer read 43/45. The reader now runs both.
- a wide bubble wraps onto two lines, and each line was becoming its own
  message, so `방을 못` / `보여드려요` split a refusal in half and matched
  nothing;
- the pattern catalogue had no phrasing for an agent asking for the deposit in
  their own name, the most ordinary version of that fraud;
- a suppressor was cancelling that pattern regardless of who was speaking, so
  `제 명의 계좌로 보내주세요` was excused whether the *owner* said it (correct,
  the account matches the register) or the *agent* did (the fraud itself);
- **a textbook-dangerous 가압류 conversation scored completely clean.** The
  tenant raises the seizure, so every register keyword sits on the user's own
  side and is gated out, while the counterparty only ever replies with
  reassurance — and `reg-seizure-auction` being `deniable`, those replies
  actively *suppressed* it. The signal was never the lien; it was the refusal
  to give a number. Hence `reg-dismiss-question`.
- and a trust property handled **correctly** was reported as a strong warning,
  because the reassurance ("the trustee's consent comes first, pay the trust's
  account") sits in a different message from the trust mention and no
  per-message suppressor could see it. Hence `suppressedBy.anywhere`.

Run it after changing anything in `assets/js/ocr.js`, `assets/js/analyzer.js` or
`data/patterns.json`, and read the output rather than just the counts.

Useful flags:

```bash
node demo/run-demo.mjs --only=01        # one screenshot
node demo/run-demo.mjs --keep-open      # leave the browser open at the end
CHROMIUM_PATH=/path/to/chrome node demo/run-demo.mjs   # reuse a Chromium you have
```

## Not a test suite

Nothing in this folder gates a deploy. The suites that do are in `scripts/` and
run in CI:

```bash
node scripts/test-analyzer.js
node scripts/test-detector.js
node scripts/test-data.js
node scripts/test-ocr.js                            # mock engine
node scripts/test-ocr-real.js --require-engine      # real engine, Node
node scripts/smoke-ocr.mjs                          # real browser — the OCR gate
```
