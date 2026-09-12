# 학생 주거 안전 도우미 · Student Housing Safety Assistant

A static Korean/English rental conversation checker. Paste messages or select
chat screenshots, review text and speakers, then check known warning signals.
It does not establish whether a person or property is fraudulent.

**[Open the website](https://s0lluxx26.github.io/Project_web_student_support/)**

**Maker: Bui Xuan Mai** · [Demo / user guide](https://s0lluxx26.github.io/Project_web_student_support/demo.html)
· [Install on a PC](INSTALL.md) · [Project guide and AI prompts](manual/PROJECT_GUIDE.md)
· [Safety help and 12 practice screenshots](https://s0lluxx26.github.io/Project_web_student_support/help.html)
· [한국어 프로젝트 보고서](manual/PROJECT_GUIDE_KO.md)
· [주요 기능 소개와 실제 화면](manual/MAIN_FUNCTIONS_KO.md)

## Main features

- Conversation checking with 27 curated patterns, concepts, speaker attribution,
  question/denial handling, evidence excerpts and suggested actions.
- Korean screenshot OCR using locally hosted Tesseract.js. Recognition produces
  an editable draft; the user must apply it before analysis. Speaker identity
  starts unknown. Up to 5 PNG/JPEG/WebP images, 8 MiB each, 25 MiB combined,
  and 12 million decoded pixels per image.
- Optional document questions and a goshiwon visit guide.
- Six numbered report sections: summary, coverage, evidence, next checks,
  reviewed export and optional AI. Important evidence and actions are highlighted.
- Shared light/dark controls on the checker, Demo and Safety help pages.
- Bilingual self-check guidance and 12 additional fictional screenshots: three
  ordinary, three uncertain, three pressure and three strong-warning cases.
- Editable redaction preview for copy/share/Print. Direct browser printing of
  the housing page instructs the user to use the preview. Masking is best effort
  and cannot reliably identify personal names.
- Reset clears inputs, previews, results and model state. Canceled work cannot
  repopulate a new session. Data requests time out and core failures offer Retry.

Assessments come from rules, not a trained classifier. Severities and numerical
thresholds are project heuristics, not fraud probabilities or legal decisions.
Similarity detection exists as a library API; there is no review-scraping UI.

## Browser LLM experiment

**It runs under GitHub Pages restrictions, but failed the quality gate for
ordinary use.** The report offers a separate, clearly labeled experiment on
laptops and PCs. Phones and tablets receive a disabled control and explanation.
No GPU is required. Opening the panel or checking the opt-in box downloads no
model; a separate load action is required.

Wllama 3.6.1 runs a pinned Qwen3 0.6B Q4 model in a worker. The download is
**396,705,472 bytes**. It explains one existing finding; it cannot change the
assessment and its draft is excluded from exports. The UI supplies rule
guidance, not the user's conversation.

On a Windows i7-14700KF test machine, the browser process group used about
**1.7 GB working set** and short explanations took **24–62 seconds**. Some
answers were wrong despite valid JSON. These are not laptop or phone guarantees.
[Implementation and benchmark evidence](docs/BROWSER_LLM_OPTIONS.md).

Opting in downloads nothing. An explicit load uses the verified browser cache,
downloads the pinned file if needed, or reads the exact GGUF selected from disk.
The model runs from those bytes on the visitor's CPU. The UI identifies the load
source and warns before and during generation; slower laptops may take minutes.

## Privacy and network use

Conversations, screenshots and contracts are not uploaded. The site host sees
ordinary asset requests. Copy/share/print happen only when the user chooses them.
The optional model download contacts Hugging Face, which sees the request/IP;
selecting the exact GGUF from disk avoids that download.

No chat is intentionally persisted. Language and theme preferences are stored locally;
Tesseract may cache language assets. Verified LLM weights use origin-private
storage. The experimental panel can remove this app's downloaded LLM cache on
the current origin. Pages and Vercel have separate caches.

**Local processing does not guarantee offline reload.** No service worker is
installed; the site still needs its assets available to start.

## Develop and test

Node 22+. Dependencies are pinned in `package-lock.json`.

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run assets:stamp          # after changing versioned application assets
npm run build                # tests and public dist/ artifact
npm run test:ocr              # real OCR, synthetic image fixtures
npm run test:browser          # real OCR, lifecycle, both hosts, mocked LLM UI
npm run serve
```

Preview: `http://127.0.0.1:8765/`. Add `--pages` for the repository sub-path or
`--src` for source preview. Double-clicking `index.html` cannot support fetch and
workers. Real LLM benchmarks are opt-in, excluded from ordinary CI:

```sh
npm run bench:llm -- --model tmp/models/Qwen3-0.6B-Q4_K_M.gguf --cases 20
npm run bench:llm -- --download --cases 1 --cancel-check
```

Only synthetic fixtures are committed. Their test results do not establish
accuracy on real conversations, real phone screenshots or legal questions.
The new examples have independently specified text expectations and recorded
real OCR outcomes in `assets/examples/`. All 12 reached their intended outcomes
without text correction in the recorded run; minor OCR noise remains. See the
[logic review and reproduction notes](docs/REVIEW_2026-09-12.md).

## Deploy

One build supports **GitHub Pages and Vercel**. Both serve `dist/`, containing
public HTML, assets, guide downloads and JSON. Selected fictional examples and
actual app captures are explicitly published for the Demo. GGUF weights, tests, SSH keys and
dependencies are excluded from the site artifact. Keep private files outside
the public `assets/` and `data/` directories.

Pages uses `.github/workflows/deploy.yml` with **GitHub Actions** as its source.
Vercel reads `vercel.json`; importing the repo into an account is still needed.
Neither host needs the developer's laptop running after deployment. Neither
runs this model on a server: the visitor's browser does the work.

[Deployment instructions](docs/DEPLOY_VERCEL.md) · [Current plan](PLAN.md) ·
[Implementation handoff](docs/IMPLEMENTATION_STATUS.md)

Run `npm run verify:install` for the complete installation checks. Run
`npm run demo:capture` to regenerate the public screenshots using real OCR;
review the images and recorded results before updating the guide.

The [technical report](manual/PROJECT_GUIDE.md) includes a table of contents,
repository file tree, deployment/data-flow diagrams, system sequence diagrams,
illustrated results and links to [the prompt playbook](docs/AI_PROMPTS.md).
[Editable Mermaid sources and reproduction steps](docs/diagrams/README.md)
are included. `npm run test:report` checks the committed report and PDF for
consistency without installing Python or Mermaid.

The Korean edition includes translated diagrams, Korean AI prompt templates
and actual Korean UI captures. Reproduce it with `--lang ko` on
`scripts/capture-manual.mjs`, `scripts/render-report-diagrams.mjs` and
`scripts/build-guide-pdf.py`. Review Markdown before generating the PDF;
English files remain separate. Both editions are checked by `npm run test:report`.

The Korean feature-introduction submission has six actual screenshots with short
descriptions. Its PDF uses Malgun Gothic, 9pt text and 1.0 line spacing. Capture
with `node scripts/capture-manual.mjs --features --lang ko`, review
`manual/MAIN_FUNCTIONS_KO.md`, then run `python scripts/build-functions-pdf.py`.
The builder also creates `output/main-functions-ko-submission.zip` with the
Markdown, PDF and six screenshot files for inserting into a submission template.

Application: MIT. Vendored components retain their licenses. The GGUF model is
Apache-2.0 and is not bundled in the repository.
