# Reading a screenshot

Students do not have KakaoTalk exports. They have screenshots. Asking someone to
re-type a conversation with their landlord before the checker will look at it is
asking most of them not to bother, so step 2 can read the text out of an image.

This document is the honest account of what that does, what it gets wrong, and
why it is built the way it is. Read it before changing anything under
`assets/vendor/tesseract/`.

## The shape of it

    a screenshot  ->  greyscale  ->  tesseract (Web Worker)  ->  clean up
                  ->  THE REVIEW PANE  ->  the user edits and presses a button
                  ->  the conversation box  ->  the analyzer

The review pane is the only part that is not negotiable. There is no code path
from the engine to `#chat-input`; `Housing.appendOcr()` is the only thing that
writes there, and it only runs on a click. This is not caution for its own sake:
recognition misreads about a word per screen, and a misread word becomes a
finding in a report the user may act on — a sentence their landlord never said,
presented to them as evidence. The user has to see the text first.

## Nothing is uploaded

The engine is vendored in the repo and runs in a Web Worker on the user's own
machine. There is no CDN, because a CDN request would tell a third party that
this person is running a rental-fraud check on a conversation — while the page
says the image never leaves their device. `assets/vendor/tesseract/README.md`
lists the files, their versions and their licences.

First use costs about 6 MB of download (wasm plus the Korean model). Nothing is
fetched until the user opens the screenshot reader.

## What it actually reads

Measured with `scripts/test-ocr-real.js` and `scripts/smoke-ocr.mjs`, on the
fixtures in `scripts/fixtures/`, with tesseract.js 5.1.1 and the `kor`
`4.0.0_best_int` model:

| case | confidence | outcome |
|---|---|---|
| KakaoTalk capture, colour | 84 | all 7 bubbles, ~1 misread word |
| plain dark text on white | 93 | clean |
| dark mode | 92 | clean |

A representative misread: `잡아드릴게요` came back as `잠아드릴게요`. The review
pane flags the lines the engine itself scored lowest, so the user's attention
goes to the lines most likely to be wrong rather than to the whole screen.

### Greyscale is not an optimisation

On the raw KakaoTalk capture the yellow outgoing bubbles **disappeared
completely** — every line the user had typed. Tesseract binarises with one
global threshold, and on the blue channel a yellow bubble (`#FEE551`, blue
`0x51`) sits below the blue-grey page behind it (`#ABC6D8`, blue `0xD8`), so the
threshold that keeps the page swallows the bubble and the text inside it. On
luminance the bubble is the lighter of the two and the text is far below both.
Converting first recovered all seven lines and raised confidence from 80 to 84.

Upscaling 2x on top of that recovered nothing and cost about 20% more time, so
it is not done. Both facts are asserted in the tests, not just written here.

### What cleanup does, and what it refuses to do

Small grey timestamps come back as debris — `.5*=그`, `.3*::`, `.85:기` — once
per line on a KakaoTalk capture. `OCR.clean()` removes two things:

- a tail still shaped like a time (`오후 3:21`, `PM 11:59`, `1:23`);
- a tail that is a short standalone token opening with punctuation, which is
  what is left of that timestamp once it is too mangled to recognise. The
  leading punctuation and the space before it are what keep this off real text:
  Korean chat does not end a line with a separate word starting with a full
  stop, and the clock does it on every line.

It refuses to repair half-read words. `잠아드릴게요` stays `잠아드릴게요`. A
cleaner that guessed would be rewriting the evidence the whole check rests on,
and the user cannot audit a correction they never see.

A whole line is deleted only when it contains no Korean and no letters at all.
Debris carrying a Hangul fragment is kept, because deleting a line on suspicion
risks deleting something that was said.

### Who said what

Chat apps put your messages on one side and theirs on the other, and the engine
returns each line's bounding box, so the split is recoverable. It matters: the
analyzer discounts the user's own words, and without labels every recognised
line is treated as the counterparty's.

`OCR.sideSplit()` only answers when the layout is unambiguous — at least two
lines per side, and a gap between the groups wider than either group. Otherwise
it returns `null` and the user labels by hand. A wrong guess here attributes the
landlord's pressure to the tenant or the reverse, so declining is the better
answer more often than a confident one.

## The flag

`OCR.enabled` in `assets/js/ocr.js` gates the whole feature, and the control is
never rendered while it is false.

**`true` is a claim that `scripts/smoke-ocr.mjs` passed against that exact
build.** Set it back to `false` if you change this module, the vendored files or
the step-2 markup and have not re-run the smoke test. The mock suite passing is
not sufficient and never will be: it replaces the engine with a stub.

## The three test layers

| file | engine | what a pass means |
|---|---|---|
| `scripts/test-ocr.js` | **mock** | the cleanup rules, the low-confidence report, the side split and the promise plumbing are correct |
| `scripts/test-ocr-real.js` | real, Node | the vendored model still reads Korean chat text and greyscale still recovers the outgoing bubbles |
| `scripts/smoke-ocr.mjs` | real, browser | the worker starts from the vendored path, the browser accepts the wasm, the review pane fills, the reviewed text reaches a real verdict |

Running them:

    node scripts/test-ocr.js

    npm install --no-save tesseract.js@5 pngjs
    node scripts/test-ocr-real.js --require-engine

    npm install --no-save playwright && npx playwright install chromium
    node scripts/smoke-ocr.mjs
    # CHROMIUM_PATH=/path/to/chrome node scripts/smoke-ocr.mjs   # reuse an existing build

`--require-engine` turns a missing dependency into a failure, so a broken
install in CI cannot pass as a skip. All three run in `.github/workflows/deploy.yml`
before anything is packaged for Pages.

## Known gaps

- **The fixtures are synthetic.** They reproduce the layout closely enough to
  catch the failure modes that matter, but they are drawn, not photographed: no
  JPEG artefacts, no status bar, no odd crop. A green run is a regression guard,
  not proof the feature works on a real phone capture. Testing against real
  screenshots — with permission, and not committed — is the obvious next step.
- **Only Korean.** The model is `kor` alone. English inside a Korean
  conversation reads passably; an English-only screenshot will not. Adding
  `eng` costs 2.8 MB and has not been measured, so it has not been added.
- **Handwriting and photographs of paper** are out of scope. The contract-photo
  step deliberately does not run OCR — a misread contract clause is a worse
  error than a misread chat line, and the checklist there asks the user what
  they can see instead.
- **No cancel button.** A long recognition can only be waited out or the page
  reloaded. Worth adding.
