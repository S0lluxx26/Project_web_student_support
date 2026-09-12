# Implementation handoff — 2026-09-12

The remaining engineering work was implemented directly in this repository.
This document replaces claims that OCR is unimplemented or that no real LLM has
been run. It also separates tested functionality from work requiring real data,
target hardware or an account connection.

## What changed

1. Added a landing-page screenshot entry point and kept both text inputs in
   sync, including sample/clear/OCR paths. Editing invalidates old exports and AI
   drafts. Screenshot analysis goes directly to the report.
2. Added real worker cancellation and initialization guards for OCR, retryable
   script loading, file/pixel bounds and partial-image recovery. Reset/discard
   clears all screenshot URLs, original OCR text and uncertain-line content.
   Image encoding finishes before Tesseract receives bytes, preventing its
   asynchronous conversion from sending to a worker canceled in the meantime.
3. Kept speaker identity unknown until confirmed. Edited OCR text is retained
   across language changes and navigation. The explicit rebuild action remains
   a deliberate replacement with the original recognition.
4. Prevented raw housing text from printing through Ctrl+P. Reviewed Print/PDF
   snapshots persist until afterprint or a later state change, not a fixed
   three-second timer. Copy/share/print use the editable masking preview.
5. Added finite data request timeouts and browser tests for an optional request
   that never returns and a core failure followed by successful Retry.
6. Implemented a real Wllama worker with correct sub-path imports, pinned model
   revision, exact size/SHA-256 checks, streaming OPFS cache, local GGUF picker,
   cancellation, unload, cache deletion and bounded schema-constrained output.
7. Completed real 20-case model evaluation plus browser download/cache/cancel
   checks. The model runs but makes meaning errors, so the experimental UI is
   hidden on normal visits and remains opt-in behind `?experiment=llm`.
8. Added locked Node tooling, consistent asset stamping and line endings, and
   activated the Pages workflow that publishes only tested `dist/`. Updated
   Vercel configuration and build-input allowlist for the same artifact.
9. Reconciled README, PLAN, OCR, model and deployment documentation. The pattern
   catalogue now includes all 27 IDs with dated related official references;
   exact legal-claim review remains explicitly incomplete.

## Verification and limits

`npm run build`, `npm run test:ocr`, and `npm run test:browser` are the release
checks. The browser suite exercises real Korean OCR, session resets, export
masking, default-hidden AI, mock inference failures, real wrong-file rejection,
and both root/sub-path layouts. Real GGUF inference is tested separately with
`npm run bench:llm`; see [the recorded evidence](BROWSER_LLM_OPTIONS.md).
The real LLM was also exercised on the public GitHub Pages origin. The
landing-to-OCR path is explicitly included in the browser host tests.

Fixtures and model prompts are synthetic. No private chat or model weights are
committed. No claim is made that a trained scam classifier exists, that phone
performance has been measured, or that this website guarantees a safe contract.

The repository supports Vercel; that does not mean a Vercel project/account has
been connected. [Import instructions](DEPLOY_VERCEL.md) are ready. Pages remains
the default host. Both run OCR/LLM on the visitor's device, not the web server.

## Next work requiring external evidence

- Test actual laptop/phone hardware and consented real screenshots.
- Review inherited legal wording and heuristic thresholds against exact sources.
- Collect/label consented transcripts before training any classifier.
- Connect Vercel only if a second deployment is wanted.
- Conduct the planned field research before adding marketplace/review features.

Detailed acceptance criteria are in [PLAN.md](../PLAN.md). The most useful next
AI improvement is evidence-based evaluation, not automatically enabling this
397 MB model or moving the same browser code to another static host.
